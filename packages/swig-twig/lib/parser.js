var ir = require('@rhinostone/swig-core/lib/ir'),
  utils = require('@rhinostone/swig-core/lib/utils'),
  _dangerousProps = require('@rhinostone/swig-core/lib/security').dangerousProps;

var _t = require('./tokentypes');

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
 *     4   | < > <= >= in  (COMPARATOR)          | left
 *     5   | .. (RANGE — lowers to _range call) | left
 *     6   | + - (OPERATOR)                     | left
 *     7   | ~ (TILDE — string concat)          | left
 *     8   | * / % (OPERATOR)                   | left
 *   post  | DOTKEY BRACKETOPEN PARENOPEN        | —
 *          | FILTER FILTEREMPTY                 |
 *   pfx   | NOT, unary +/-                     | —
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
      var right = parseExpression(info.prec + 1);
      if (info.op === '..') {
        left = ir.fnCall(ir.varRef(['_range']), [left, right]);
      } else {
        left = ir.binaryOp(info.op, left, right);
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
