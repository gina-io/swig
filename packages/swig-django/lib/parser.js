var ir = require('@rhinostone/swig-core/lib/ir'),
  utils = require('@rhinostone/swig-core/lib/utils'),
  _dangerousProps = require('@rhinostone/swig-core/lib/security').dangerousProps;

var lexer = require('./lexer');
var _t = require('./tokentypes');

/**
 * Make a string safe for embedding into a regular expression.
 * @param  {string} str
 * @return {string}
 * @private
 */
function escapeRegExp(str) {
  return str.replace(/[\-\/\\\^$*+?.()|\[\]{}]/g, '\\$&');
}

/**
 * Reserved JS keywords that cannot be used as variable names.
 * @private
 */
var _reserved = ['break', 'case', 'catch', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'finally', 'for', 'function', 'if', 'in', 'instanceof', 'new', 'return', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with'];

/**
 * Django expression parser — Pratt-style recursive descent.
 *
 * Consumes a flat LexerToken[] (produced by swig-django's lexer) and
 * returns an IRExpr tree using swig-core's IR factories. Mirrors the shape
 * of swig-core's TokenParser.parseExpr so the swig-core backend can emit JS
 * from either frontend's output without changes.
 *
 * This is a *lenient superset* of the Django Template Language expression
 * grammar: it keeps the inherited parenthesis / arithmetic / function-call
 * machinery (so every valid Django expression parses, and a handful of
 * non-Django forms like `{{ a + b }}` also happen to work) and layers the
 * Django-specific bits on top:
 *
 *   - `|name` and `|name:arg` colon-filters (Django filters take at most one
 *     positional argument; the arg is a single literal or variable lookup,
 *     never a chained filter or operator expression).
 *   - `True` / `False` / `None` literals.
 *   - `is` / `is not` as *identity* comparisons (`===` / `!==`), NOT
 *     Jinja2-style test calls.
 *
 * Dropped relative to the Jinja2 sibling: `~` concat, `**` power, `//`
 * floor-division, the inline `if`/`else` conditional, and the `is <test>`
 * test-call machinery — none of which exist in Django.
 *
 * CVE-2023-25345 guards (`_dangerousProps`) fire on VAR path segments,
 * DOTKEY matches, STRING-inside-BRACKETOPEN values, FUNCTION/FUNCTIONEMPTY
 * callee names, and filter-argument variable segments — the same
 * checkpoints as the native and Jinja2 frontends.
 *
 * Binding-power table (higher binds tighter):
 *
 *   Level | Tokens                             | Assoc
 *   ------+------------------------------------+------
 *     1   | || / or  (LOGIC)                   | left
 *     2   | && / and (LOGIC)                   | left
 *     3   | == != === !== is "is not" (COMP)   | left
 *     4   | < > <= >= in  (COMPARATOR)          | left
 *     6   | + - (OPERATOR)                     | left
 *     8   | * / % (OPERATOR)                   | left
 *   post  | DOTKEY BRACKETOPEN PARENOPEN        | —
 *          | FILTEREMPTY (+ optional :arg)      |
 *   pfx   | NOT, unary +/-                     | —
 *
 * @param  {object[]} tokens     LexerToken[] from swig-django's lexer.
 * @param  {object}   [filters]  Filter catalog for name validation.
 *                                Pass `{}` when no catalog is available.
 * @param  {object}   [_posOut]  Optional out-param; final cursor stored on
 *                                `_posOut.pos` to let callers detect partial
 *                                consumption.
 * @return {object}              IRExpr tree.
 */
exports.parseExpr = function (tokens, filters, _posOut) {
  var pos = 0;
  filters = filters || {};

  function skipWS() {
    while (pos < tokens.length && tokens[pos].type === _t.WHITESPACE) { pos += 1; }
  }
  function peek() {
    skipWS();
    return pos < tokens.length ? tokens[pos] : null;
  }
  function consume() {
    var t = peek();
    if (t) { pos += 1; }
    return t;
  }
  function bail(msg) {
    utils.throwError(msg);
  }

  function guardSegment(segment) {
    if (_dangerousProps.indexOf(segment) !== -1) {
      bail('Unsafe access to "' + segment + '" is not allowed in templates (CVE-2023-25345)');
    }
  }
  function guardBracketString(value) {
    if (_dangerousProps.indexOf(value) !== -1) {
      bail('Unsafe access to "' + value + '" via bracket notation is not allowed in templates (CVE-2023-25345)');
    }
  }

  function getBinaryOpInfo(tok) {
    var m;
    if (tok.type === _t.LOGIC) {
      if (tok.match === '||') { return { op: '||', prec: 1 }; }
      if (tok.match === '&&') { return { op: '&&', prec: 2 }; }
    }
    if (tok.type === _t.COMPARATOR) {
      m = tok.match;
      if (m === '===' || m === '!==' || m === '==' || m === '!=') {
        return { op: m, prec: 3 };
      }
      return { op: m, prec: 4 };
    }
    // Django `is` / `is not` are *identity* comparisons (not Jinja2 test
    // calls): lowered to `===` / `!==` in parseExpression. Same precedence
    // level as `==` so `x is None` / `x is not None` group naturally.
    if (tok.type === _t.IS) {
      return { op: 'is', prec: 3 };
    }
    if (tok.type === _t.ISNOT) {
      return { op: 'is not', prec: 3 };
    }
    if (tok.type === _t.OPERATOR) {
      m = tok.match;
      if (m === '+' || m === '-') { return { op: m, prec: 6 }; }
      if (m === '*' || m === '/' || m === '%') { return { op: m, prec: 8 }; }
    }
    return null;
  }

  function unquoteString(match) {
    return match.replace(/^['"]|['"]$/g, '');
  }

  function parseArgList(closeType) {
    var args = [];
    var first = peek();
    if (first && first.type === closeType) {
      consume();
      return args;
    }
    while (true) {
      args.push(parseExpression(0));
      var next = consume();
      if (!next) { bail('Unexpected end of expression'); }
      if (next.type === closeType) { break; }
      if (next.type !== _t.COMMA) { bail('Expected comma or closing delimiter'); }
    }
    return args;
  }

  function parseObjectLiteral() {
    var props = [];
    var first = peek();
    if (first && first.type === _t.CURLYCLOSE) {
      consume();
      return ir.objectLiteral([]);
    }
    while (true) {
      var keyTok = consume();
      if (!keyTok) { bail('Unclosed object literal'); }
      var keyExpr;
      if (keyTok.type === _t.STRING) {
        keyExpr = ir.literal('string', unquoteString(keyTok.match));
      } else if (keyTok.type === _t.VAR) {
        if (keyTok.match.indexOf('.') !== -1) {
          bail('Unexpected dot');
        }
        keyExpr = ir.literal('string', keyTok.match);
      } else if (keyTok.type === _t.NUMBER) {
        keyExpr = ir.literal('number', parseFloat(keyTok.match));
      } else {
        bail('Unexpected object key');
      }
      var colon = consume();
      if (!colon || colon.type !== _t.COLON) { bail('Expected colon in object literal'); }
      var value = parseExpression(0);
      props.push(ir.objectProperty(keyExpr, value));
      var next = consume();
      if (!next) { bail('Unclosed object literal'); }
      if (next.type === _t.CURLYCLOSE) { break; }
      if (next.type !== _t.COMMA) { bail('Expected comma or closing curly brace'); }
    }
    return ir.objectLiteral(props);
  }

  // Django filter argument — a *single* constant or variable lookup, never a
  // chained filter or operator expression. This deliberately does NOT route
  // through parsePostfix (which would greedily consume a trailing `|next`
  // filter and wrongly bind it to the argument instead of the filtered
  // value). An optional leading sign is honored only before a NUMBER, so
  // `|floatformat:-3` works while `|add:-x` is rejected.
  function parseFilterArg() {
    var sign = '';
    var pk = peek();
    if (pk && pk.type === _t.OPERATOR && (pk.match === '-' || pk.match === '+')) {
      consume();
      sign = pk.match;
    }
    var tok = consume();
    if (!tok) { bail('Expected filter argument after ":"'); }
    switch (tok.type) {
    case _t.STRING:
      if (sign) { bail('Unexpected "' + sign + '" before string filter argument'); }
      return ir.literal('string', unquoteString(tok.match));
    case _t.NUMBER:
      return ir.literal('number', parseFloat(sign + tok.match));
    case _t.BOOL:
      if (sign) { bail('Unexpected "' + sign + '" before boolean filter argument'); }
      return ir.literal('bool', tok.match === 'true');
    case _t.NONE:
      if (sign) { bail('Unexpected "' + sign + '" before None filter argument'); }
      return ir.literal('null', null);
    case _t.VAR:
      if (sign) { bail('Unexpected "' + sign + '" before variable filter argument'); }
      var path = tok.match.split('.');
      if (_reserved.indexOf(path[0]) !== -1) {
        bail('Reserved keyword "' + path[0] + '" attempted to be used as a variable');
      }
      utils.each(path, function (segment) {
        guardSegment(segment);
      });
      return ir.varRef(path);
    }
    bail('Unexpected filter argument "' + tok.match + '"');
    return null;
  }

  function expectBracketClose() {
    var close = consume();
    if (!close || close.type !== _t.BRACKETCLOSE) {
      bail('Expected closing square bracket');
    }
  }

  function undefinedLiteral() {
    return ir.literal('undefined', undefined);
  }

  // Called after the opening `[`. Either a single-key access `[expr]` or a
  // Python-style slice `[start:stop:step]` with any part omitted. A leading
  // COLON (omitted start) or a COLON after the first expression signals a
  // slice, which lowers to `_utils.slice(obj, start, stop, step)` with
  // undefined literals for omitted bounds. A plain `[expr]` lowers to an
  // Access (string keys are CVE-guarded).
  function parseSubscript(obj) {
    var startExpr = null,
      stopExpr = null,
      stepExpr = null,
      isSlice = false,
      pk = peek();

    if (pk && pk.type === _t.COLON) {
      isSlice = true;
    } else {
      startExpr = parseExpression(0);
      pk = peek();
      if (pk && pk.type === _t.COLON) { isSlice = true; }
    }

    if (!isSlice) {
      if (startExpr.type === 'Literal' && startExpr.kind === 'string') {
        guardBracketString(startExpr.value);
      }
      expectBracketClose();
      return ir.access(obj, startExpr);
    }

    consume(); // first colon
    pk = peek();
    if (pk && pk.type !== _t.COLON && pk.type !== _t.BRACKETCLOSE) {
      stopExpr = parseExpression(0);
    }
    pk = peek();
    if (pk && pk.type === _t.COLON) {
      consume(); // second colon
      pk = peek();
      if (pk && pk.type !== _t.BRACKETCLOSE) {
        stepExpr = parseExpression(0);
      }
    }
    expectBracketClose();
    return ir.fnCall(ir.varRef(['_utils', 'slice']), [
      obj,
      startExpr || undefinedLiteral(),
      stopExpr || undefinedLiteral(),
      stepExpr || undefinedLiteral()
    ]);
  }

  function parsePostfix(expr) {
    var tok, fname, fargs, colon;
    while (true) {
      tok = peek();
      if (!tok) { break; }
      if (tok.type === _t.DOTKEY) {
        consume();
        guardSegment(tok.match);
        if (expr.type === 'VarRef') {
          expr = ir.varRef(expr.path.concat([tok.match]));
        } else {
          expr = ir.access(expr, ir.literal('string', tok.match));
        }
      } else if (tok.type === _t.BRACKETOPEN) {
        consume();
        expr = parseSubscript(expr);
      } else if (tok.type === _t.PARENOPEN) {
        consume();
        expr = ir.fnCall(expr, parseArgList(_t.PARENCLOSE));
      } else if (tok.type === _t.FILTEREMPTY || tok.type === _t.FILTER) {
        consume();
        fname = tok.match;
        if (filters.hasOwnProperty(fname) && typeof filters[fname] !== 'function') {
          bail('Invalid filter "' + fname + '"');
        }
        // Django colon-filter: an optional single positional argument
        // introduced by a colon (`|date:"Y-m-d"`, `|default:user.name`).
        // `fargs` MUST be reset each iteration — `var` is function-scoped, so
        // without this an arg-bearing filter earlier in the chain would leak
        // its args onto a later no-arg filter (e.g. `x|default:y|upper`).
        fargs = undefined;
        colon = peek();
        if (colon && colon.type === _t.COLON) {
          consume();
          fargs = [parseFilterArg()];
        }
        expr = ir.filterCallExpr(fname, expr, fargs);
      } else {
        break;
      }
    }
    return expr;
  }

  function parsePrimary() {
    var tok = peek();
    if (!tok) { bail('Unexpected end of expression'); }

    tok = consume();
    var m;
    switch (tok.type) {
    case _t.STRING:
      return parsePostfix(ir.literal('string', unquoteString(tok.match)));
    case _t.NUMBER:
      return parsePostfix(ir.literal('number', parseFloat(tok.match)));
    case _t.BOOL:
      return parsePostfix(ir.literal('bool', tok.match === 'true'));
    case _t.NONE:
      return parsePostfix(ir.literal('null', null));
    case _t.PARENOPEN:
      var grouped = parseExpression(0);
      var close = consume();
      if (!close || close.type !== _t.PARENCLOSE) {
        bail('Mismatched nesting state');
      }
      return parsePostfix(grouped);
    case _t.BRACKETOPEN:
      return parsePostfix(ir.arrayLiteral(parseArgList(_t.BRACKETCLOSE)));
    case _t.CURLYOPEN:
      return parsePostfix(parseObjectLiteral());
    case _t.VAR:
      var path = tok.match.split('.');
      if (_reserved.indexOf(path[0]) !== -1) {
        bail('Reserved keyword "' + path[0] + '" attempted to be used as a variable');
      }
      utils.each(path, function (segment) {
        guardSegment(segment);
      });
      return parsePostfix(ir.varRef(path));
    case _t.FUNCTION:
    case _t.FUNCTIONEMPTY:
      m = tok.match;
      if (_reserved.indexOf(m) !== -1) {
        bail('Reserved keyword "' + m + '" attempted to be used as a variable');
      }
      guardSegment(m);
      if (tok.type === _t.FUNCTIONEMPTY) {
        return parsePostfix(ir.fnCall(ir.varRef([m]), []));
      }
      return parsePostfix(ir.fnCall(ir.varRef([m]), parseArgList(_t.PARENCLOSE)));
    }
    bail('Unexpected token "' + tok.match + '"');
    return null;
  }

  function parseUnary() {
    var tok = peek();
    if (tok && tok.type === _t.NOT) {
      consume();
      return ir.unaryOp('!', parseUnary());
    }
    if (tok && tok.type === _t.OPERATOR && (tok.match === '+' || tok.match === '-')) {
      consume();
      return ir.unaryOp(tok.match, parseUnary());
    }
    return parsePrimary();
  }

  function parseExpression(minPrec) {
    var left = parseUnary();
    while (true) {
      var tok = peek();
      if (!tok) { break; }
      var info = getBinaryOpInfo(tok);
      if (!info || info.prec < minPrec) { break; }
      consume();
      // Django `is` / `is not` — identity comparison. The RHS is a full
      // sub-expression (usually a `None` / `True` / `False` literal or a
      // variable), and the operator lowers to `===` / `!==`.
      if (info.op === 'is' || info.op === 'is not') {
        var rightId = parseExpression(info.prec + 1);
        // `x is None` / `x is not None` on a VarRef subject: emitVarRef
        // coerces a missing or null lookup to "" for safe interpolation,
        // which loses the null signal a plain `=== null` needs. Route through
        // IRVarRefExists (defined-and-non-null) instead — the same handling
        // the Jinja2 sibling uses for its `is none` test. `is None` is true
        // when the subject is absent or null (`!exists`); `is not None` is
        // true when it is present (`exists`). `is True` / `is False` /
        // numeric / variable RHS are unaffected — those values are never
        // null, so emitVarRef returns them intact and plain `===` is correct.
        if (rightId.type === 'Literal' && rightId.kind === 'null' && left.type === 'VarRef') {
          var exists = ir.varRefExists(left.path, left.loc);
          left = info.op === 'is' ? ir.unaryOp('!', exists) : exists;
          continue;
        }
        left = ir.binaryOp(info.op === 'is' ? '===' : '!==', left, rightId);
        continue;
      }
      var right = parseExpression(info.prec + 1);
      left = ir.binaryOp(info.op, left, right);
    }
    return left;
  }

  var result = parseExpression(0);

  if (_posOut) {
    _posOut.pos = pos;
  } else {
    skipWS();
    if (pos < tokens.length) {
      bail('Unexpected token "' + tokens[pos].match + '"');
    }
  }

  return result;
};


/**
 * Parse a Django source string into a parse tree of pre-built IR nodes and
 * tag tokens, ready for swig-core's backend walker.
 *
 * Mirrors the shape of the native swig `parser.parse` so the same
 * `engine.install(self, frontend)` plumbing works for every frontend:
 *
 *   - Plain text chunks → `IRText` nodes (spliced through by the backend).
 *   - `{{ … }}` chunks  → `IROutput` nodes built via parseExpr; if
 *     autoescape is on, the IROutput.filters slot carries an `e` filterCall
 *     tail unless one of the chained filters is `.safe`.
 *   - `{% … %}` chunks  → TagToken from the registered tag's `parse`.
 *   - `{# … #}` chunks  → dropped.
 *
 * Django has no whitespace-control markers (`{{-` / `-%}` are not DTL
 * syntax), so the splitter does not strip surrounding whitespace. The
 * verbatim-text tag is `{% verbatim %}` (Django's analog of swig's `raw`);
 * its body is copied through untouched.
 *
 * Django tags own their argument parsing directly via `parseExpr`; there is
 * no `parser.on(types.X, fn)` callback model. The `parser` argument passed
 * to a tag's `parse(str, line, parser, _t, stack, opts, swig, token)` is
 * this module itself (`exports`), which exposes `parseExpr` and `lexer`.
 *
 * @param  {object}  swig    The Swig instance (or undefined when called
 *                           outside an engine context).
 * @param  {string}  source  Django template source.
 * @param  {object}  opts    Per-call options. Honors `varControls`,
 *                           `tagControls`, `cmtControls`, `autoescape`,
 *                           `filename`.
 * @param  {object}  tags    Tag registry (`{ name: { parse, compile, ends,
 *                           block } }`).
 * @param  {object}  filters Filter catalog. Only used for `.safe` lookup at
 *                           autoescape time.
 * @return {object}  `{ name, parent, parentExpr, tokens, blocks }` tree
 *                   consumed by `engine.compile`.
 * @throws {Error}   On unknown tag, mismatched end tag, or any parseExpr
 *                   error inside a `{{ … }}` chunk.
 */
exports.parse = function (swig, source, opts, tags, filters) {
  source = String(source).replace(/\r\n/g, '\n');
  opts = opts || {};
  tags = tags || {};
  filters = filters || {};

  var varControls = opts.varControls || ['{{', '}}'];
  var tagControls = opts.tagControls || ['{%', '%}'];
  var cmtControls = opts.cmtControls || ['{#', '#}'];

  var escape = opts.autoescape;
  if (typeof escape === 'undefined') { escape = true; }
  // Region-scoped autoescape. `escape` is the template-level default;
  // `{% autoescape on/off %}` pushes a new value for the duration of its
  // body and `{% endautoescape %}` pops it, mirroring the inRaw flag below.
  // parseVariable reads the current top, so the `e` filter tail is baked
  // per-region at parse time (the backend IRAutoescape node is inert).
  var escapeStack = [escape];

  var tagOpen = tagControls[0];
  var tagClose = tagControls[1];
  var varOpen = varControls[0];
  var varClose = varControls[1];
  var cmtOpen = cmtControls[0];
  var cmtClose = cmtControls[1];

  var anyChar = '[\\s\\S]*?';
  var splitter = new RegExp(
    '(' +
      escapeRegExp(tagOpen) + anyChar + escapeRegExp(tagClose) + '|' +
      escapeRegExp(varOpen) + anyChar + escapeRegExp(varClose) + '|' +
      escapeRegExp(cmtOpen) + anyChar + escapeRegExp(cmtClose) +
      ')'
  );
  // No whitespace-control: Django has no `{{-` / `-%}` markers, so the strip
  // patterns carry no `-?` and there is no strip-before / strip-after
  // bookkeeping.
  var tagStrip = new RegExp('^' + escapeRegExp(tagOpen) + '\\s*|\\s*' + escapeRegExp(tagClose) + '$', 'g');
  var varStrip = new RegExp('^' + escapeRegExp(varOpen) + '\\s*|\\s*' + escapeRegExp(varClose) + '$', 'g');

  var line = 1;
  var stack = [];
  var parent = null;
  var parentExpr = null;
  var tokens = [];
  var blocks = {};
  var inRaw = false;

  /**
   * Build an IROutput node for a `{{ … }}` chunk. The autoescape `e` filter
   * tail is appended unless a `.safe` filter appears in the chain.
   *
   * @param  {string} str   Inner expression text (controls already stripped).
   * @param  {number} _line Source line of the opening control.
   * @return {object}       IROutput IR node.
   * @private
   */
  function parseVariable(str, _line) {
    var lexed = lexer.read(utils.strip(str));
    var sawSafe = false;
    utils.each(lexed, function (tok) {
      if (tok.type === _t.FILTEREMPTY || tok.type === _t.FILTER) {
        if (filters.hasOwnProperty(tok.match) && filters[tok.match].safe === true) {
          sawSafe = true;
        }
      }
    });
    var expr = exports.parseExpr(lexed, filters);
    var tail;
    var esc = escapeStack[escapeStack.length - 1];
    if (esc && !sawSafe) {
      var escapeArgs;
      if (typeof esc === 'string') {
        escapeArgs = [ir.literal('string', esc)];
      }
      tail = [ir.filterCall('e', escapeArgs)];
    }
    var node = ir.output(expr, tail);
    // Coerce null / undefined to "" for any non-VarRef output (function
    // calls, dynamic bracket access, ...). A VarRef already coerces inside
    // emitVarRef, so the common `{{ name }}` path stays wrapper-free.
    if (expr.type !== 'VarRef') {
      node.coerce = true;
    }
    return node;
  }

  /**
   * Dispatch a `{% … %}` chunk to its registered tag. Handles `end<name>`
   * close-tag matching against the open-tag stack (filename-aware throws are
   * routed via utils.throwError so the frontend can wrap them via
   * onCompileError).
   *
   * @param  {string} str   Inner tag text (controls already stripped).
   * @param  {number} _line Source line of the opening control.
   * @return {?object}      TagToken, or undefined for end-tag close.
   * @private
   */
  function parseTag(str, _line) {
    var chunks = str.split(/\s+(.+)?/);
    var tagName = chunks.shift();
    var tagArgs = chunks[0] || '';
    var last;

    if (tagName.indexOf('end') === 0) {
      var openName = tagName.replace(/^end/, '');
      last = stack[stack.length - 1];
      if (last && last.name === openName && last.ends) {
        if (openName === 'verbatim') { inRaw = false; }
        if (openName === 'autoescape') { escapeStack.pop(); }
        stack.pop();
        return;
      }
      if (!inRaw) {
        utils.throwError('Unexpected end of tag "' + openName + '"', _line, opts.filename);
      }
    }

    // Inside a verbatim block, non-matching tag chunks fall through to the
    // splitter's chunk-as-text path. The `endverbatim` close has already
    // been handled above; everything else returns undefined so the splitter
    // wraps the verbatim chunk via `ir.text`.
    if (inRaw) {
      return;
    }

    if (!tags.hasOwnProperty(tagName)) {
      utils.throwError('Unexpected tag "' + tagName + '"', _line, opts.filename);
    }

    var tag = tags[tagName];
    var token = {
      block: !!tag.block,
      compile: tag.compile,
      args: [],
      content: [],
      ends: !!tag.ends,
      name: tagName,
      irExpr: undefined
    };

    var ok = tag.parse(tagArgs, _line, exports, _t, stack, opts, swig, token);
    if (!ok) {
      utils.throwError('Unexpected tag "' + tagName + '"', _line, opts.filename);
    }

    if (tagName === 'verbatim') {
      inRaw = true;
    }
    if (tagName === 'autoescape') {
      escapeStack.push(token.escapeValue);
    }

    return token;
  }

  utils.each(source.split(splitter), function (chunk) {
    var token, lines;

    if (!chunk) { return; }

    if (!inRaw && utils.startsWith(chunk, varOpen) && utils.endsWith(chunk, varClose)) {
      token = parseVariable(chunk.replace(varStrip, ''), line);
    } else if (utils.startsWith(chunk, tagOpen) && utils.endsWith(chunk, tagClose)) {
      token = parseTag(chunk.replace(tagStrip, ''), line);
      if (token) {
        if (token.name === 'extends') {
          parent = token.args.length ? String(token.args[0]) : null;
          parentExpr = token.irExpr && token.irExpr.file;
        } else if (token.block && !stack.length) {
          blocks[token.args.join('')] = token;
        }
      }
      // parseTag returns undefined for non-`endverbatim` tag chunks while
      // inRaw is true. Wrap the original chunk as literal text so the
      // content inside `{% verbatim %}` renders verbatim.
      if (inRaw && !token) {
        token = ir.text(chunk);
      }
    } else if (!inRaw && utils.startsWith(chunk, cmtOpen) && utils.endsWith(chunk, cmtClose)) {
      lines = chunk.match(/\n/g);
      line += lines ? lines.length : 0;
      return;
    } else {
      token = ir.text(chunk);
    }

    if (token) {
      if (stack.length) {
        stack[stack.length - 1].content.push(token);
      } else {
        tokens.push(token);
      }
      if (token.name && token.ends) {
        stack.push(token);
      }
    }

    lines = chunk.match(/\n/g);
    line += lines ? lines.length : 0;
  });

  if (stack.length) {
    utils.throwError('Missing end tag for "' + stack[stack.length - 1].name + '"', line, opts.filename);
  }

  return {
    name: opts.filename,
    parent: parent,
    parentExpr: parentExpr,
    tokens: tokens,
    blocks: blocks
  };
};
