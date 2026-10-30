var ir = require('@rhinostone/swig-core/lib/ir'),
  utils = require('@rhinostone/swig-core/lib/utils'),
  _dangerousProps = require('@rhinostone/swig-core/lib/security').dangerousProps;

var lexer = require('./lexer');
var _t = require('./tokentypes');

// A catalog entry is read as an own property: a filter can be registered under
// the name hasOwnProperty, and a name like toString is not a filter.
var hasOwn = Object.prototype.hasOwnProperty;

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
 * Jinja2's constant names: `true`, `false` and `none`, each also
 * capitalised. An expression reads them as literals (`none` as `null`),
 * and a tag may not bind them, as in Jinja2 (« can't assign »).
 * @private
 */
var _constants = ['true', 'false', 'none', 'True', 'False', 'None'];

/**
 * Build the literal for one of Jinja2's constant names.
 *
 * @param  {string} name  One of `_constants`.
 * @return {object}       IRLiteral (`bool`, or `null` for none / None).
 * @private
 */
function constantLiteral(name) {
  var lower = name.toLowerCase();
  if (lower === 'none') {
    return ir.literal('null', null);
  }
  return ir.literal('bool', lower === 'true');
}

/**
 * Read `x == none` / `x != none` (a VarRef on either side) like `x is none`
 * / `x is not none`: emitVarRef turns a missing or null value into "", so
 * a plain comparison with null would never hold for a None value.
 *
 * @param  {string} op     `==` or `!=`.
 * @param  {object} left   Left operand IR.
 * @param  {object} right  Right operand IR.
 * @return {object|null}   IRVarRefExists (negated for `==`), or null when
 *                         neither side is a VarRef compared with none.
 * @private
 */
function noneComparison(op, left, right) {
  var ref = null, exists;
  if (left.type === 'VarRef' && right.type === 'Literal' && right.kind === 'null') {
    ref = left;
  } else if (right.type === 'VarRef' && left.type === 'Literal' && left.kind === 'null') {
    ref = right;
  }
  if (!ref) {
    return null;
  }
  exists = ir.varRefExists(ref.path, ref.loc);
  return op === '==' ? ir.unaryOp('!', exists) : exists;
}

/**
 * Throw when a tag binds one of Jinja2's constant names, as Jinja2 does
 * (`{% set none = 1 %}`, `{% for True in xs %}`, `{% macro m(None) %}`).
 * The set, for, macro, with, import and from tags call it beside their
 * prototype-chain guards.
 *
 * @param  {string} name      Name the tag binds.
 * @param  {string} tagName   Tag name, for the message.
 * @param  {number} line      Template line.
 * @param  {string} filename  Template file name.
 * @return {undefined}
 * @private
 */
exports.guardConstantName = function (name, tagName, line, filename) {
  if (_constants.indexOf(name) !== -1) {
    utils.throwError('Cannot assign to the constant "' + name + '" in "' + tagName + '" tag', line, filename);
  }
};

/**
 * Build the IR of `left in right`, or of `left not in right` when `negate`
 * is set: a BinaryOp `in` flagged with this flavor's name, so swig-core
 * emits Jinja2's membership test (`_utils.isIn`) instead of the JavaScript
 * `in` operator, which tests keys.
 *
 * @param  {object}  left     The needle.
 * @param  {object}  right    The container.
 * @param  {boolean} [negate] The `not in` form.
 * @return {object}           IRBinaryOp.
 * @private
 */
function membership(left, right, negate) {
  var node = ir.binaryOp('in', left, right);
  node.membership = 'jinja2';
  if (negate) {
    node.negate = true;
  }
  return node;
}

/**
 * Build the IR of a call to one of the engine's own helpers (an `_ext` test,
 * an `_utils` function, a `Math` function), flagged so swig-core reads the
 * callee from the compiled template's scope and never from the template
 * context, where a locals key such as `_ext`, `_utils` or `Math` would
 * replace it.
 *
 * @param  {string[]} path  Callee path (`['_utils', 'range']`).
 * @param  {object[]} args  Argument expressions.
 * @return {object}         IRFnCall with `closure === true`.
 * @private
 */
function helperCall(path, args) {
  var node = ir.fnCall(ir.varRef(path), args);
  node.closure = true;
  return node;
}

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
 * Binding levels, loosest first, following Jinja2's parser (parse_condexpr,
 * parse_or, parse_and, parse_not, parse_compare ... parse_pow,
 * parse_unary, parse_postfix, parse_filter_expr):
 *
 *   Level  | Tokens                                   | Assoc
 *   -------+------------------------------------------+--------
 *     0    | inline `a if c else b`                   | right
 *     1    | || / or  (LOGIC)                         | left
 *     2    | && / and (LOGIC)                         | left
 *    not   | NOT starting an operand of the levels    | prefix
 *          | above; its operand runs at level 3       |
 *     3    | == != === !== (COMPARATOR)               | left
 *     4    | < > <= >= in  (COMPARATOR)               | left
 *     6    | + - (OPERATOR)                           | left
 *     7    | ~ (TILDE)                                | left
 *     8    | * / % (OPERATOR), // (FLOORDIV)          | left
 *    pow   | ** (POWER), over unary operands          | left
 *   filter | FILTER FILTEREMPTY, IS ISNOT tests       | postfix
 *   unary  | unary + / -                              | prefix
 *   post   | DOTKEY BRACKETOPEN PARENOPEN             | postfix
 *
 * So `not a == b` is not (a == b), `1 + 2 is number` tests 2, `-x|abs` is
 * abs(-x) and `2 ** 3 ** 2` is (2 ** 3) ** 2. A NOT in any other operand
 * position (`a == not b`) binds its unary operand; Jinja2 rejects that
 * form.
 *
 * @param  {object[]} tokens     LexerToken[] from swig-jinja2's lexer.
 * @param  {object}   [filters]  Filter catalog for name validation.
 *                                Pass `{}` when no catalog is available.
 * @param  {object}   [_posOut]  Optional out-param; final cursor stored
 *                                on `_posOut.pos` to let callers detect
 *                                partial consumption.
 * @param  {object}   [_scope]   Set by `exports.parse`: the `line` and the
 *                                `filename` an error names, the instance's
 *                                `extensions`, which make a filter or test
 *                                name the instance does not hold an error,
 *                                and `soft`, which makes that error wait until
 *                                the expression is reached.
 * @return {object}              IRExpr tree.
 */
exports.parseExpr = function (tokens, filters, _posOut, _scope) {
  var pos = 0;
  filters = filters || {};
  // Set when the parse has an engine instance, whose catalogs names are checked against.
  var knownTests = _scope && _scope.extensions;

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
    utils.throwError(msg, _scope && _scope.line, _scope && _scope.filename);
  }

  function hasInlineIf() {
    return tokens.some(function (t) { return t.type === _t.VAR && t.match === 'if'; });
  }

  // An unknown filter or test name: a compile error, or inside an if or an
  // inline-if a node that throws the same error when it is reached.
  function unknownName(msg) {
    if (!_scope.soft && !hasInlineIf()) { bail(msg); }
    return helperCall(['_utils', 'invalidName'], [ir.literal('string', msg + ' on line ' + _scope.line +
      (_scope.filename ? ' in file ' + _scope.filename : '') + '.')]);
  }

  function guardSegment(segment) {
    if (_dangerousProps.indexOf(segment) !== -1) {
      bail('Unsafe access to "' + segment + '" is not allowed in templates (prototype-chain guard)');
    }
  }
  function guardBracketString(value) {
    if (_dangerousProps.indexOf(value) !== -1) {
      bail('Unsafe access to "' + value + '" via bracket notation is not allowed in templates (prototype-chain guard)');
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
      if (/^not\s+in$/.test(m)) {
        return { op: 'not in', prec: 4 };
      }
      return { op: m, prec: 4 };
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
    var nameTok = consume(), pk;
    if (!nameTok) { bail('Expected test name after "is" / "is not"'); }
    var testName;
    var testArgs = [];
    // `true` and `false` lex as BOOL when a space or the end follows them
    // (`x is true`); a VAR otherwise (`(x is true)`).
    if (nameTok.type === _t.VAR || nameTok.type === _t.BOOL) {
      if (nameTok.match.indexOf('.') !== -1) {
        bail('Dotted names are not valid test names');
      }
      testName = nameTok.match;
      pk = peek();
      if (pk && pk.type === _t.PARENOPEN) {
        consume();
        testArgs = parseArgList(_t.PARENCLOSE);
      } else if (pk && isBareTestArgStart(pk)) {
        testArgs = [parsePostfix(parsePrimary())];
      }
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

  // Jinja2's parse_test takes one argument without parentheses when the
  // next token starts a primary (`x is divisibleby 3`, `x is sameas y`);
  // the argument is a primary with its subscripts and calls, no filter or
  // test. `else` ends an inline-if, and `if` is excluded too, so
  // `x is defined if c else d` keeps parsing as an inline-if (Jinja2
  // rejects it).
  function isBareTestArgStart(tok) {
    if (tok.type === _t.VAR) {
      return tok.match !== 'if' && tok.match !== 'else';
    }
    return tok.type === _t.STRING || tok.type === _t.NUMBER || tok.type === _t.BOOL ||
      tok.type === _t.FUNCTION || tok.type === _t.FUNCTIONEMPTY ||
      tok.type === _t.BRACKETOPEN || tok.type === _t.CURLYOPEN;
  }

  // Lower `<subject> is [not] <test>` to `_ext._test_<name>(subject,
  // ...args)`; `is not` wraps the call in a unary `!`. `defined` / `none` /
  // `undefined` on a VarRef subject route through IRVarRefExists instead,
  // because emitVarRef coerces a missing or null lookup to "" and so loses
  // the defined/undefined signal those tests depend on. Other subjects
  // evaluate to a concrete value (no coercion) and use the generic helper
  // the engine registers. `sameas none` with a VarRef on either side reads
  // like `none` (noneComparison).
  function lowerTest(subject, negated) {
    var test = parseTest(), testCall;
    // Jinja2's guards for an optional name: `"name" is filter`, `"name" is test`.
    if (knownTests && (test.name === 'filter' || test.name === 'test') && subject.type === 'Literal' && subject.kind === 'string') {
      testCall = ir.literal('bool', test.name === 'filter' ? hasOwn.call(filters, subject.value) : hasOwn.call(knownTests, '_test_' + subject.value));
      return negated ? ir.unaryOp('!', testCall) : testCall;
    }
    if (knownTests && !hasOwn.call(knownTests, '_test_' + test.name)) {
      testCall = unknownName('Invalid test "' + test.name + '"');
      return negated ? ir.unaryOp('!', testCall) : testCall;
    }
    if (test.args.length === 0 && subject.type === 'VarRef' && test.name === 'defined') {
      testCall = ir.varRefExists(subject.path, subject.loc);
    } else if (test.args.length === 0 && subject.type === 'VarRef' && (test.name === 'none' || test.name === 'undefined')) {
      testCall = ir.unaryOp('!', ir.varRefExists(subject.path, subject.loc));
    } else if (test.name === 'sameas' && test.args.length === 1) {
      testCall = noneComparison('==', subject, test.args[0]) ||
        helperCall(['_ext', '_test_sameas'], [subject].concat(test.args));
    } else {
      testCall = helperCall(['_ext', '_test_' + test.name], [subject].concat(test.args));
    }
    return negated ? ir.unaryOp('!', testCall) : testCall;
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
    return helperCall(['_utils', 'slice'], [
      obj,
      startExpr || undefinedLiteral(),
      stopExpr || undefinedLiteral(),
      stepExpr || undefinedLiteral()
    ]);
  }

  // Subscripts and calls, then (when `withFilter`) filters and tests, as in
  // Jinja2's parse_postfix and parse_filter_expr. A unary minus/plus
  // operand is read without them (Jinja2's parse_unary(False)); they then
  // apply to the negated value.
  function parsePostfix(expr, withFilter) {
    while (true) {
      var tok = peek();
      if (!tok) { break; }
      // A none that is subscripted or passed to a filter reads as "", as a
      // variable holding None does (emitVarRef turns null into "").
      if (expr.type === 'Literal' && expr.kind === 'null' && (tok.type === _t.DOTKEY || tok.type === _t.BRACKETOPEN ||
          (withFilter && (tok.type === _t.FILTER || tok.type === _t.FILTEREMPTY)))) {
        expr = ir.literal('string', '');
      }
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
      } else if (withFilter && (tok.type === _t.IS || tok.type === _t.ISNOT)) {
        consume();
        expr = lowerTest(expr, tok.type === _t.ISNOT);
      } else if (withFilter && (tok.type === _t.FILTER || tok.type === _t.FILTEREMPTY)) {
        consume();
        var fname = tok.match;
        if (hasOwn.call(filters, fname) && typeof filters[fname] !== 'function') {
          bail('Invalid filter "' + fname + '"');
        }
        var unknown = (knownTests && !hasOwn.call(filters, fname)) ? unknownName('Invalid filter "' + fname + '"') : null;
        var fargs;
        // `fargs` must be reset each iteration — `var` is function-scoped
        // (a bare declaration does not reset it), so without this an
        // arg-bearing filter earlier in the chain would leak its args onto
        // a later no-arg filter (e.g. `x|default("y")|upper`).
        fargs = undefined;
        if (tok.type === _t.FILTER) {
          fargs = parseArgList(_t.PARENCLOSE);
        }
        expr = unknown || ir.filterCallExpr(fname, expr, fargs);
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
      return ir.literal('string', unquoteString(tok.match));
    case _t.NUMBER:
      return ir.literal('number', parseFloat(tok.match));
    case _t.BOOL:
      return ir.literal('bool', tok.match === 'true');
    case _t.PARENOPEN:
      var grouped = parseExpression(0);
      var close = consume();
      if (!close || close.type !== _t.PARENCLOSE) {
        bail('Mismatched nesting state');
      }
      return grouped;
    case _t.BRACKETOPEN:
      return ir.arrayLiteral(parseArgList(_t.BRACKETCLOSE));
    case _t.CURLYOPEN:
      return parseObjectLiteral();
    case _t.VAR:
      // Jinja2's constants. `true` / `false` reach here as a VAR when the
      // lexer's BOOL rule does not match (`true)`, `true,`); the
      // capitalised forms and `none` / `None` always do.
      if (_constants.indexOf(tok.match) !== -1) {
        return constantLiteral(tok.match);
      }
      var path = tok.match.split('.');
      if (_reserved.indexOf(path[0]) !== -1) {
        bail('Reserved keyword "' + path[0] + '" attempted to be used as a variable');
      }
      utils.each(path, function (segment) {
        guardSegment(segment);
      });
      return ir.varRef(path);
    case _t.FUNCTION:
    case _t.FUNCTIONEMPTY:
      m = tok.match;
      if (_reserved.indexOf(m) !== -1) {
        bail('Reserved keyword "' + m + '" attempted to be used as a variable');
      }
      guardSegment(m);
      if (tok.type === _t.FUNCTIONEMPTY) {
        return ir.fnCall(ir.varRef([m]), []);
      }
      return ir.fnCall(ir.varRef([m]), parseArgList(_t.PARENCLOSE));
    }
    bail('Unexpected token "' + tok.match + '"');
    return null;
  }

  // Jinja2 parse_unary: a unary minus/plus takes its operand without the
  // filters that follow, which then apply to the negated value (`-x|abs`
  // is abs(-x)). A `not` reached here sits where Jinja2 has no not-level
  // (`a == not b`, `-not x`, `2 ** not x`); it binds its unary operand.
  function parseUnary(withFilter) {
    var tok = peek(), node;
    if (tok && tok.type === _t.NOT) {
      consume();
      return ir.unaryOp('!', parseUnary(withFilter));
    }
    if (tok && tok.type === _t.OPERATOR && (tok.match === '+' || tok.match === '-')) {
      consume();
      node = ir.unaryOp(tok.match, parseUnary(false));
    } else {
      node = parsePrimary();
    }
    return parsePostfix(node, withFilter);
  }

  function parsePower() {
    var left = parseUnary(true);
    var next = peek();
    while (next && next.type === _t.POWER) {
      consume();
      // Left-associative, as Jinja2's parse_pow reads its unary operands in
      // a loop: `2 ** 3 ** 2` is (2 ** 3) ** 2 = 64 (Python gives 512). The
      // base is a unary operand, so a leading minus belongs to it: `-2 ** 2`
      // is (-2) ** 2 = 4, as Jinja2 renders (Python gives -4). Lowered to
      // Math.pow because the emit is parenthesis-safe — a bare `a ** b`
      // emission would mis-group when an operand is itself a binary op and
      // would SyntaxError when the base is a unary (`-2 ** 3`).
      left = helperCall(['Math', 'pow'], [left, parseUnary(true)]);
      next = peek();
    }
    return left;
  }

  // Jinja2's parse_not: a `not` that starts an operand of `and`, `or` or
  // the whole expression (minPrec up to the comparison level) negates a
  // level-3 expression, so `not a == b` is not (a == b) and `not x + y` is
  // not (x + y).
  function parseExpression(minPrec) {
    var left, ntok = peek();
    if (ntok && ntok.type === _t.NOT && minPrec <= 3) {
      consume();
      left = ir.unaryOp('!', parseExpression(3));
    } else {
      left = parsePower();
    }
    while (true) {
      var tok = peek();
      if (!tok) { break; }
      var info = getBinaryOpInfo(tok);
      if (!info || info.prec < minPrec) { break; }
      consume();
      var right = parseExpression(info.prec + 1);
      if (info.op === '//') {
        // Floor division — JS `a // b` is a line comment, so lower to
        // Math.floor(a / b). Matches Python `//` for ints and floats,
        // including negative operands (floors toward negative infinity).
        left = helperCall(['Math', 'floor'], [ir.binaryOp('/', left, right)]);
      } else if (info.op === 'in' || info.op === 'not in') {
        left = membership(left, right, info.op === 'not in');
      } else {
        // `x == none` / `x != none` on a VarRef reads like `x is [not]
        // none` (noneComparison).
        if (info.op === '~' || info.op === '+') {
          // An operand none of ~ or + reads as "", as a variable holding
          // None does, so it never adds the text "null".
          left = left.type === 'Literal' && left.kind === 'null' ? ir.literal('string', '') : left;
          right = right.type === 'Literal' && right.kind === 'null' ? ir.literal('string', '') : right;
        }
        left = ((info.op === '==' || info.op === '!=') && noneComparison(info.op, left, right)) ||
          ir.binaryOp(info.op, left, right);
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

  // Where parseExpr is working, so that an expression error can name its line
  // and file; whether an unknown name waits until it is reached (`soft`); and
  // the extensions that hold the tests (only an engine instance has catalogs to
  // check a name against). A tag gets a handle on this module whose parseExpr
  // works in the same scope and on this parse's filter catalog.
  var scope = { line: 0, filename: opts.filename, soft: false, extensions: swig && swig.extensions };
  var exprParser = Object.create(exports);
  exprParser.parseExpr = function (tokens, _filters, posOut) {
    return exports.parseExpr(tokens, filters, posOut, scope);
  };
  exprParser.knownFilter = function (name) {
    return !scope.extensions || hasOwn.call(filters, name);
  };

  // Jinja2 reports an unknown name at compile time, except directly inside an
  // if: in its condition, or in a branch with no other block tag around the
  // name. There the error waits until the expression is reached. The arguments
  // of a filter or macro tag belong to that tag's own frame.
  function softFrame(tagName) {
    var top = stack[stack.length - 1];
    if (tagName === 'filter' || tagName === 'macro') { return false; }
    return tagName === 'if' || tagName === 'elif' || !!(top && top.name === 'if');
  }

  // The lexer does not know where it is working, so the place of its error is
  // named here. An error from a nested parse has its place already.
  function throwPlaced(err) {
    if (err.unplaced) {
      utils.throwError(err.message.slice(0, -1), scope.line, scope.filename);
    }
    throw err;
  }

  var varControls = opts.varControls || ['{{', '}}'];
  var tagControls = opts.tagControls || ['{%', '%}'];
  var cmtControls = opts.cmtControls || ['{#', '#}'];

  var escape = opts.autoescape;
  if (typeof escape === 'undefined') { escape = true; }
  // Region-scoped autoescape. `escape` is the template-level default;
  // `{% autoescape true/false %}` pushes a new value for the duration of
  // its body and `{% endautoescape %}` pops it, mirroring the inRaw flag
  // below. parseVariable reads the current top, so the `e` filter tail is
  // baked per-region at parse time (the backend IRAutoescape node is inert).
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
  var parentExpr = null;
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
    scope.line = _line;
    scope.soft = softFrame();
    var lexed;
    try {
      lexed = lexer.read(utils.strip(str));
    } catch (e) {
      throwPlaced(e);
    }
    var sawSafe = false;
    utils.each(lexed, function (tok) {
      if (tok.type === _t.FILTER || tok.type === _t.FILTEREMPTY) {
        if (hasOwn.call(filters, tok.match) && filters[tok.match].safe === true) {
          sawSafe = true;
        }
      }
    });
    var expr = exports.parseExpr(lexed, filters, undefined, scope);
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
    // calls, inline-ifs without an else, dynamic bracket access, ...). A
    // VarRef already coerces inside emitVarRef, so the common `{{ name }}`
    // path stays wrapper-free.
    if (expr.type !== 'VarRef') {
      node.coerce = true;
    }
    return node;
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
        if (openName === 'autoescape') { escapeStack.pop(); }
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

    scope.line = _line;
    scope.soft = softFrame(tagName);
    var ok;
    try {
      ok = tag.parse(tagArgs, _line, exprParser, _t, stack, opts, swig, token);
    } catch (e) {
      throwPlaced(e);
    }
    if (!ok) {
      utils.throwError('Unexpected tag "' + tagName + '"', _line, opts.filename);
    }

    if (tagName === 'raw') {
      inRaw = true;
    }
    if (tagName === 'autoescape') {
      escapeStack.push(token.escapeValue);
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
          parentExpr = token.irExpr && token.irExpr.file;
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
    parentExpr: parentExpr,
    tokens: tokens,
    blocks: blocks
  };
};
