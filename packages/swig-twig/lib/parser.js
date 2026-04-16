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
 * Twig expression parser — Pratt-style recursive descent.
 *
 * Consumes a flat LexerToken[] (produced by swig-twig's lexer) and
 * returns an IRExpr tree using swig-core's IR factories. Mirrors the
 * shape of swig-core's TokenParser.parseExpr so the swig-core backend
 * can emit JS from either frontend's output without changes.
 *
 * CVE-2023-25345 guards (`_dangerousProps`) fire on VAR path segments,
 * DOTKEY matches, STRING-inside-BRACKETOPEN values, and
 * FUNCTION/FUNCTIONEMPTY callee names — same checkpoints as the native
 * frontend. See .claude/security.md § _dangerousProps is duplicated
 * across layers.
 *
 * Binding-power table:
 *
 *   Level | Tokens                             | Assoc
 *   ------+------------------------------------+------
 *     0   | ?? (NULLCOALESCE)                  | left
 *     1   | || / or  (LOGIC)                   | left
 *     2   | && / and (LOGIC)                   | left
 *     3   | == != === !== (COMPARATOR)          | left
 *         | is / is not (IS / ISNOT — lowers to | left
 *         |   _test_<name> call; ISNOT wraps   |
 *         |   in unary !)                      |
 *     4   | < > <= >= in  (COMPARATOR)          | left
 *     5   | .. (RANGE — lowers to _range call) | left
 *     6   | + - (OPERATOR)                     | left
 *     7   | ~ (TILDE — string concat)          | left
 *     8   | * / % (OPERATOR)                   | left
 *   post  | DOTKEY BRACKETOPEN PARENOPEN        | —
 *          | FILTER FILTEREMPTY                 |
 *   pfx   | NOT, unary +/-                     | —
 *   tern  | ? : (QMARK/COLON — ternary + Elvis) | right, minPrec=0 only
 *
 * @param  {object[]} tokens     LexerToken[] from swig-twig's lexer.
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
    if (tok.type === _t.NULLCOALESCE) {
      return { op: '??', prec: 0 };
    }
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
    if (tok.type === _t.RANGE) {
      return { op: '..', prec: 5 };
    }
    if (tok.type === _t.OPERATOR) {
      m = tok.match;
      if (m === '+' || m === '-') { return { op: m, prec: 6 }; }
      if (m === '*' || m === '/' || m === '%') { return { op: m, prec: 8 }; }
    }
    if (tok.type === _t.TILDE) {
      return { op: '~', prec: 7 };
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
        bail('Dotted names are not valid Twig test names');
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
        var keyExpr = parseExpression(0);
        if (keyExpr.type === 'Literal' && keyExpr.kind === 'string') {
          guardBracketString(keyExpr.value);
        }
        var close = consume();
        if (!close || close.type !== _t.BRACKETCLOSE) {
          bail('Expected closing square bracket');
        }
        expr = ir.access(expr, keyExpr);
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

  function parseInterpolatedString() {
    var parts = [];
    while (true) {
      var tok = peek();
      if (!tok) { break; }
      if (tok.type === _t.STRING) {
        consume();
        parts.push(ir.literal('string', unquoteString(tok.match)));
      } else if (tok.type === _t.INTERP_OPEN) {
        consume();
        parts.push(parseExpression(0));
        var close = consume();
        if (!close || close.type !== _t.INTERP_CLOSE) {
          bail('Expected interpolation close');
        }
      } else {
        break;
      }
    }
    if (parts.length === 1) {
      return parts[0];
    }
    var result = parts[0];
    for (var i = 1; i < parts.length; i += 1) {
      result = ir.binaryOp('+', result, parts[i]);
    }
    return result;
  }

  function parsePrimary() {
    var tok = peek();
    if (!tok) { bail('Unexpected end of expression'); }

    // Interpolated string: STRING followed by INTERP_OPEN
    if (tok.type === _t.STRING) {
      var next = pos + 1;
      while (next < tokens.length && tokens[next].type === _t.WHITESPACE) { next += 1; }
      if (next < tokens.length && tokens[next].type === _t.INTERP_OPEN) {
        return parsePostfix(parseInterpolatedString());
      }
    }

    tok = consume();
    var m;
    switch (tok.type) {
    case _t.STRING:
      return ir.literal('string', unquoteString(tok.match));
    case _t.NUMBER:
      return ir.literal('number', parseFloat(tok.match));
    case _t.BOOL:
      return ir.literal('bool', tok.match === 'true');
    case _t.NOT:
      return ir.unaryOp('!', parseUnary());
    case _t.OPERATOR:
      m = tok.match;
      if (m === '+' || m === '-') {
        return ir.unaryOp(m, parseUnary());
      }
      bail('Unexpected operator "' + m + '"');
      break;
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
      // is / is not — RHS is a constrained test-name + optional arg list,
      // not a full expression. Lower to _test_<name>(subject, ...args);
      // ISNOT wraps the call in a unary `!`. Keeps them in the binary-op
      // table at comparator precedence (3) so `foo is defined and bar`
      // parses as `(foo is defined) and bar`.
      if (info.op === 'is' || info.op === 'is not') {
        var test = parseTest();
        var testCall = ir.fnCall(ir.varRef(['_test_' + test.name]), [left].concat(test.args));
        left = info.op === 'is not' ? ir.unaryOp('!', testCall) : testCall;
        continue;
      }
      var right = parseExpression(info.prec + 1);
      if (info.op === '..') {
        left = ir.fnCall(ir.varRef(['_range']), [left, right]);
      } else {
        left = ir.binaryOp(info.op, left, right);
      }
    }
    // Ternary + Elvis — binds looser than every binary op, so it's only
    // handled at the top-level minPrec === 0 entry. Recursive calls (RHS
    // of a binary op, object-literal values, arg-list elements via
    // parseExpression(0)) still get ternary via their own top-level entry;
    // recursive calls for a binary op's RHS run at prec + 1 ≥ 1 and skip
    // this branch, which is what lets `a + b ? c : d` parse as
    // `(a + b) ? c : d` rather than `a + (b ? c : d)`.
    //
    // Elvis shorthand `a ?: b` lowers to Conditional(a, a, b). The `a`
    // subexpression is evaluated twice by downstream emitters — that's a
    // documented consequence of the transliteration. Callers with
    // side-effecting `a` should bind it to a variable first.
    if (minPrec === 0) {
      var qtok = peek();
      if (qtok && qtok.type === _t.QMARK) {
        consume();
        var afterQ = peek();
        var elseBranch;
        if (afterQ && afterQ.type === _t.COLON) {
          consume();
          elseBranch = parseExpression(0);
          left = ir.conditional(left, left, elseBranch);
        } else {
          var thenBranch = parseExpression(0);
          var colon = consume();
          if (!colon || colon.type !== _t.COLON) {
            bail('Expected colon in ternary expression');
          }
          elseBranch = parseExpression(0);
          left = ir.conditional(left, thenBranch, elseBranch);
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
 * Parse a Twig source string into a parse tree of pre-built IR nodes
 * and tag tokens, ready for swig-core's backend walker.
 *
 * Mirrors the shape of the native swig `parser.parse` (lib/parser.js)
 * so the same `engine.install(self, frontend)` plumbing works for both
 * frontends:
 *
 *   - Plain text chunks → `IRText` nodes (object-with-`.type`,
 *     spliced through by the backend).
 *   - `{{ … }}` chunks  → `IROutput` nodes built via parseExpr; if
 *     autoescape is on, the IROutput.filters slot carries an `e`
 *     filterCall tail unless one of the chained filters is `.safe`.
 *   - `{% … %}` chunks  → TagToken from the registered tag's
 *     `parse` (Twig-tailored shape, distinct from native — Twig tags
 *     parse args directly via `parser.parseExpr`).
 *   - `{# … #}` chunks  → dropped.
 *
 * Twig divergence from native swig: tags own their argument parsing
 * directly via `parseExpr`; there is no `parser.on(types.X, fn)`
 * callback model. The `parser` argument passed to a tag's `parse(str,
 * line, parser, _t, stack, opts, swig)` is this module itself
 * (`exports.parser`), which exposes `parseExpr` and `lexer`.
 *
 * @param  {object}  swig    The Swig instance (or undefined when
 *                           called outside an engine context).
 * @param  {string}  source  Twig template source.
 * @param  {object}  opts    Per-call options. Honors `varControls`,
 *                           `tagControls`, `cmtControls`, `autoescape`,
 *                           `filename`.
 * @param  {object}  tags    Tag registry (`{ name: { parse, compile,
 *                           ends, block } }`).
 * @param  {object}  filters Filter catalog. Only used for `.safe`
 *                           lookup at autoescape time.
 * @return {object}  `{ name, parent, tokens, blocks }` tree consumed
 *                   by `engine.compile`.
 * @throws {Error}   On unknown tag, mismatched end tag, or any
 *                   parseExpr error inside a `{{ … }}` chunk.
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
  var tagStrip = new RegExp('^' + escapeRegExp(tagOpen) + '\\s*|\\s*' + escapeRegExp(tagClose) + '$', 'g');
  var varStrip = new RegExp('^' + escapeRegExp(varOpen) + '\\s*|\\s*' + escapeRegExp(varClose) + '$', 'g');

  var line = 1;
  var stack = [];
  var parent = null;
  var tokens = [];
  var blocks = {};

  /**
   * Build an IROutput node for a `{{ … }}` chunk.
   *
   * The lexer is run once on the inner expression. Trailing FILTER /
   * FILTEREMPTY tokens are walked in-place to detect `.safe` filters
   * (which suppress the autoescape tail) — the filter chain itself is
   * consumed through parseExpr's parsePostfix, so the IROutput.expr
   * slot already carries the filter chain as IRFilterCallExpr nodes.
   * IROutput.filters carries only the autoescape `e` tail.
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
   * Dispatch a `{% … %}` chunk to its registered tag. Handles
   * `end<name>` close-tag matching against the open-tag stack
   * (filename-aware throws are routed via utils.throwError so the
   * frontend can wrap them via onCompileError).
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
        stack.pop();
        return;
      }
      utils.throwError('Unexpected end of tag "' + openName + '"', _line, opts.filename);
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

    return token;
  }

  utils.each(source.split(splitter), function (chunk) {
    var token, lines;

    if (!chunk) { return; }

    if (utils.startsWith(chunk, varOpen) && utils.endsWith(chunk, varClose)) {
      token = parseVariable(chunk.replace(varStrip, ''), line);
    } else if (utils.startsWith(chunk, tagOpen) && utils.endsWith(chunk, tagClose)) {
      token = parseTag(chunk.replace(tagStrip, ''), line);
      if (token) {
        if (token.name === 'extends') {
          parent = token.args.length ? String(token.args[0]) : null;
        } else if (token.block && !stack.length) {
          blocks[token.args.join('')] = token;
        }
      }
    } else if (utils.startsWith(chunk, cmtOpen) && utils.endsWith(chunk, cmtClose)) {
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
    tokens: tokens,
    blocks: blocks
  };
};
