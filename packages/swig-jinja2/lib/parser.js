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
 * Jinja2 expression parser — Pratt-style recursive descent.
 *
 * Consumes a flat LexerToken[] (produced by swig-jinja2's lexer) and
 * returns an IRExpr tree using swig-core's IR factories. Mirrors the
 * shape of swig-core's TokenParser.parseExpr so the swig-core backend
 * can emit JS from either frontend's output without changes.
 *
 * CVE-2023-25345 guards (`_dangerousProps`) fire on VAR path segments,
 * DOTKEY matches, STRING-inside-BRACKETOPEN values, and
 * FUNCTION/FUNCTIONEMPTY callee names — same checkpoints as the native
 * frontend.
 *
 * Binding-power table (shared subset; higher binds tighter):
 *
 *   Level | Tokens                             | Assoc
 *   ------+------------------------------------+------
 *     1   | || / or  (LOGIC)                   | left
 *     2   | && / and (LOGIC)                   | left
 *     3   | == != === !== (COMPARATOR)          | left
 *     4   | < > <= >= in  (COMPARATOR)          | left
 *     6   | + - (OPERATOR)                     | left
 *     8   | * / % (OPERATOR)                   | left
 *   post  | DOTKEY BRACKETOPEN PARENOPEN        | —
 *          | FILTER FILTEREMPTY                 |
 *   pfx   | NOT, unary +/-                     | —
 *
 * The Jinja2-only operators (`~` concat, `**` power, `//` floor-division,
 * inline `if`/`else`, `is` / `is not` tests) are added in subsequent
 * commits; their precedence slots into the gaps left here (`~` at 7,
 * `**` above `*`, `//` alongside `*`, inline-if at the loosest level).
 *
 * @param  {object[]} tokens     LexerToken[] from swig-jinja2's lexer.
 * @param  {object}   [filters]  Filter catalog for name validation.
 *                                Pass `{}` when no catalog is available.
 * @param  {object}   [_posOut]  Optional out-param; final cursor stored
 *                                on `_posOut.pos` to let callers detect
 *                                partial consumption.
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
    if (tok.type === _t.TILDE) {
      return { op: '~', prec: 7 };
    }
    if (tok.type === _t.FLOORDIV) {
      return { op: '//', prec: 8 };
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

  function parseTest() {
    var nameTok = consume();
    if (!nameTok) { bail('Expected test name after "is" / "is not"'); }
    var testName;
    var testArgs = [];
    if (nameTok.type === _t.VAR) {
      if (nameTok.match.indexOf('.') !== -1) {
        bail('Dotted names are not valid test names');
      }
      testName = nameTok.match;
    } else if (nameTok.type === _t.FUNCTIONEMPTY) {
      testName = nameTok.match;
    } else if (nameTok.type === _t.FUNCTION) {
      testName = nameTok.match;
      testArgs = parseArgList(_t.PARENCLOSE);
    } else {
      bail('Unexpected token "' + nameTok.match + '" after "is" / "is not"');
    }
    if (_reserved.indexOf(testName) !== -1) {
      bail('Reserved keyword "' + testName + '" attempted to be used as a test name');
    }
    guardSegment(testName);
    return { name: testName, args: testArgs };
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
  // Access (string keys are CVE-guarded, same as before slicing landed).
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
    while (true) {
      var tok = peek();
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
      } else if (tok.type === _t.FILTER || tok.type === _t.FILTEREMPTY) {
        consume();
        var fname = tok.match;
        if (filters.hasOwnProperty(fname) && typeof filters[fname] !== 'function') {
          bail('Invalid filter "' + fname + '"');
        }
        var fargs;
        if (tok.type === _t.FILTER) {
          fargs = parseArgList(_t.PARENCLOSE);
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
    return parsePower();
  }

  function parsePower() {
    var left = parsePrimary();
    var next = peek();
    if (next && next.type === _t.POWER) {
      consume();
      // Right-associative (2 ** 3 ** 2 === 2 ** (3 ** 2)); the exponent is a
      // full unary so `2 ** -3` parses. Lowered to Math.pow because the emit
      // is parenthesis-safe — a bare `a ** b` emission would mis-group when an
      // operand is itself a binary op and would SyntaxError when the base is a
      // unary (`-2 ** 3`). The base is a parsePrimary (not parseUnary), so a
      // leading minus stays with the caller: `-2 ** 2` groups as `-(2 ** 2)`,
      // matching Jinja2/Python.
      var right = parseUnary();
      return ir.fnCall(ir.varRef(['Math', 'pow']), [left, right]);
    }
    return left;
  }

  function parseExpression(minPrec) {
    var left = parseUnary();
    while (true) {
      var tok = peek();
      if (!tok) { break; }
      var info = getBinaryOpInfo(tok);
      if (!info || info.prec < minPrec) { break; }
      consume();
      // `is` / `is not` — the RHS is a constrained test name + optional arg
      // list, not a full expression. Lower to `_ext._test_<name>(subject,
      // ...args)`; `is not` wraps the call in a unary `!`. `defined` /
      // `none` / `undefined` on a VarRef subject route through
      // IRVarRefExists instead, because emitVarRef coerces a missing or
      // null lookup to "" and so loses the defined/undefined signal those
      // tests depend on. Non-VarRef subjects evaluate to a concrete value
      // (no coercion) and fall through to the generic `_ext._test_<name>`
      // helper registered by the engine.
      if (info.op === 'is' || info.op === 'is not') {
        var test = parseTest();
        var testCall;
        if (test.args.length === 0 && left.type === 'VarRef' && test.name === 'defined') {
          testCall = ir.varRefExists(left.path, left.loc);
        } else if (test.args.length === 0 && left.type === 'VarRef' && (test.name === 'none' || test.name === 'undefined')) {
          testCall = ir.unaryOp('!', ir.varRefExists(left.path, left.loc));
        } else {
          testCall = ir.fnCall(ir.varRef(['_ext', '_test_' + test.name]), [left].concat(test.args));
        }
        left = info.op === 'is not' ? ir.unaryOp('!', testCall) : testCall;
        continue;
      }
      var right = parseExpression(info.prec + 1);
      if (info.op === '//') {
        // Floor division — JS `a // b` is a line comment, so lower to
        // Math.floor(a / b). Matches Python `//` for ints and floats,
        // including negative operands (floors toward negative infinity).
        left = ir.fnCall(ir.varRef(['Math', 'floor']), [ir.binaryOp('/', left, right)]);
      } else {
        left = ir.binaryOp(info.op, left, right);
      }
    }
    // Inline conditional `<then> if <cond> else <else>` — binds looser than
    // every binary op, so it's only handled at the top-level minPrec === 0
    // entry (recursive calls for a binary op's RHS run at prec + 1 >= 1 and
    // skip this branch). `if` / `else` lex as VAR tokens; matching on
    // `.match` is safe because both keywords are reserved and so cannot be
    // bare variables. The condition and else-branch parse at minPrec 0 so a
    // nested inline-if (or any operator) inside them is grouped correctly.
    if (minPrec === 0) {
      var iftok = peek();
      if (iftok && iftok.type === _t.VAR && iftok.match === 'if') {
        consume();
        var cond = parseExpression(0);
        var etok = peek();
        if (etok && etok.type === _t.VAR && etok.match === 'else') {
          consume();
          left = ir.conditional(cond, left, parseExpression(0));
        } else {
          // No `else` — Jinja2 yields undefined (empty in output) when the
          // condition is false.
          left = ir.conditional(cond, left, ir.literal('undefined', undefined));
        }
      }
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
 * Parse a Jinja2 source string into a parse tree of pre-built IR nodes
 * and tag tokens, ready for swig-core's backend walker.
 *
 * Mirrors the shape of the native swig `parser.parse` so the same
 * `engine.install(self, frontend)` plumbing works for both frontends:
 *
 *   - Plain text chunks → `IRText` nodes (spliced through by the backend).
 *   - `{{ … }}` chunks  → `IROutput` nodes built via parseExpr; if
 *     autoescape is on, the IROutput.filters slot carries an `e`
 *     filterCall tail unless one of the chained filters is `.safe`.
 *   - `{% … %}` chunks  → TagToken from the registered tag's `parse`.
 *   - `{# … #}` chunks  → dropped.
 *
 * Jinja2 tags own their argument parsing directly via `parseExpr`; there
 * is no `parser.on(types.X, fn)` callback model. The `parser` argument
 * passed to a tag's `parse(str, line, parser, _t, stack, opts, swig,
 * token)` is this module itself (`exports`), which exposes `parseExpr`
 * and `lexer`.
 *
 * @param  {object}  swig    The Swig instance (or undefined when called
 *                           outside an engine context).
 * @param  {string}  source  Jinja2 template source.
 * @param  {object}  opts    Per-call options. Honors `varControls`,
 *                           `tagControls`, `cmtControls`, `autoescape`,
 *                           `filename`.
 * @param  {object}  tags    Tag registry (`{ name: { parse, compile,
 *                           ends, block } }`).
 * @param  {object}  filters Filter catalog. Only used for `.safe` lookup
 *                           at autoescape time.
 * @return {object}  `{ name, parent, tokens, blocks }` tree consumed by
 *                   `engine.compile`.
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
  // Jinja2 whitespace-control. `{{- … -}}` / `{%- … -%}` strip surrounding
  // whitespace; the `-?` lives only adjacent to the open / close marker
  // (no inner `-?` after `\s*`, so `{{ -5 }}` doesn't have its
  // expression-`-` eaten as a strip marker).
  var tagStrip = new RegExp('^' + escapeRegExp(tagOpen) + '-?\\s*|\\s*-?' + escapeRegExp(tagClose) + '$', 'g');
  var varStrip = new RegExp('^' + escapeRegExp(varOpen) + '-?\\s*|\\s*-?' + escapeRegExp(varClose) + '$', 'g');
  var tagStripBefore = new RegExp('^' + escapeRegExp(tagOpen) + '-');
  var tagStripAfter = new RegExp('-' + escapeRegExp(tagClose) + '$');
  var varStripBefore = new RegExp('^' + escapeRegExp(varOpen) + '-');
  var varStripAfter = new RegExp('-' + escapeRegExp(varClose) + '$');

  var line = 1;
  var stack = [];
  var parent = null;
  var tokens = [];
  var blocks = {};
  var inRaw = false;
  // Carries `-}}` / `-%}` strip-after intent across the chunk boundary.
  // Consumed by the next text chunk (leading whitespace stripped, flag
  // reset).
  var stripNext = false;

  /**
   * If the previous token is a Text IR node, strip its trailing
   * whitespace in-place. No-op for non-Text tokens. One-level-deep: a
   * `{%- endif %}` only strips the trailing whitespace of the last child
   * of the immediately enclosing tag, not deeper.
   *
   * @param  {object} token IR node (typed), possibly a Text node.
   * @return {object}       Same node; mutated when `type === 'Text'`.
   * @private
   */
  function stripPrevToken(token) {
    if (token && token.type === 'Text' && typeof token.value === 'string') {
      token.value = token.value.replace(/\s*$/, '');
    }
    return token;
  }

  /**
   * Build an IROutput node for a `{{ … }}` chunk. The autoescape `e`
   * filter tail is appended unless a `.safe` filter appears in the chain.
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
      if (tok.type === _t.FILTER || tok.type === _t.FILTEREMPTY) {
        if (filters.hasOwnProperty(tok.match) && filters[tok.match].safe === true) {
          sawSafe = true;
        }
      }
    });
    var expr = exports.parseExpr(lexed, filters);
    var tail;
    if (escape && !sawSafe) {
      var escapeArgs;
      if (typeof escape === 'string') {
        escapeArgs = [ir.literal('string', escape)];
      }
      tail = [ir.filterCall('e', escapeArgs)];
    }
    return ir.output(expr, tail);
  }

  /**
   * Dispatch a `{% … %}` chunk to its registered tag. Handles `end<name>`
   * close-tag matching against the open-tag stack (filename-aware throws
   * are routed via utils.throwError so the frontend can wrap them via
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
        if (openName === 'raw') { inRaw = false; }
        stack.pop();
        return;
      }
      if (!inRaw) {
        utils.throwError('Unexpected end of tag "' + openName + '"', _line, opts.filename);
      }
    }

    // Inside a raw block, non-matching tag chunks fall through to the
    // splitter's chunk-as-text path. The `endraw` close has already been
    // handled above; everything else returns undefined so the splitter
    // wraps the raw chunk via `ir.text`.
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

    if (tagName === 'raw') {
      inRaw = true;
    }

    return token;
  }

  utils.each(source.split(splitter), function (chunk) {
    var token, lines, stripPrev, prevToken, prevChildToken;

    if (!chunk) { return; }

    if (!inRaw && utils.startsWith(chunk, varOpen) && utils.endsWith(chunk, varClose)) {
      stripPrev = varStripBefore.test(chunk);
      stripNext = varStripAfter.test(chunk);
      token = parseVariable(chunk.replace(varStrip, ''), line);
    } else if (utils.startsWith(chunk, tagOpen) && utils.endsWith(chunk, tagClose)) {
      stripPrev = tagStripBefore.test(chunk);
      stripNext = tagStripAfter.test(chunk);
      token = parseTag(chunk.replace(tagStrip, ''), line);
      if (token) {
        if (token.name === 'extends') {
          parent = token.args.length ? String(token.args[0]) : null;
        } else if (token.block && !stack.length) {
          blocks[token.args.join('')] = token;
        }
      }
      // parseTag returns undefined for non-`endraw` tag chunks while
      // inRaw is true. Wrap the original chunk as literal text so the
      // content inside `{% raw %}` renders verbatim.
      if (inRaw && !token) {
        token = ir.text(chunk);
      }
    } else if (!inRaw && utils.startsWith(chunk, cmtOpen) && utils.endsWith(chunk, cmtClose)) {
      lines = chunk.match(/\n/g);
      line += lines ? lines.length : 0;
      return;
    } else {
      if (stripNext) {
        chunk = chunk.replace(/^\s*/, '');
        stripNext = false;
      }
      token = ir.text(chunk);
    }

    // `{{-` / `{%-` strips the previous text chunk's trailing whitespace.
    // Pop tokens.last; if it's a Text node strip it directly, else if it
    // carries `.content` (a tag with body) drill one level into its last
    // child. One-level-deep.
    if (stripPrev && tokens.length) {
      prevToken = tokens.pop();
      if (prevToken && prevToken.type === 'Text') {
        prevToken = stripPrevToken(prevToken);
      } else if (prevToken && prevToken.content && prevToken.content.length) {
        prevChildToken = stripPrevToken(prevToken.content.pop());
        prevToken.content.push(prevChildToken);
      }
      tokens.push(prevToken);
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
    tokens: tokens,
    blocks: blocks
  };
};
