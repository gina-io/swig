var utils = require('./utils'),
  _t = require('./tokentypes'),
  ir = require('./ir');

/**
 * Expression-level codegen shared across @rhinostone/swig-family
 * frontends. Consumes a flat LexerToken[] (produced by a per-flavor
 * lexer) and emits a JS-source fragment that becomes part of the body
 * fed to `new Function('_swig', '_ctx', '_filters', '_utils', '_fn',
 * body)`.
 *
 * The template-level token walker (splicing var/tag tokens between
 * literal text chunks) lives in `./backend.js`; this module handles
 * the inner expression parse for each `{{ … }}` and the tag-argument
 * parse for each `{% … %}`.
 *
 * Filter catalogs stay per-flavor — the caller passes its own
 * `filters` map at construction. The `.safe` autoescape-bypass check
 * is preserved verbatim and is the sole gate for the final `e` filter
 * tail-injection. See .claude/security.md § Autoescape is the only
 * default XSS protection.
 *
 * Error attribution (`utils.throwError(msg, line, filename)`) stays
 * intact: the filename is passed in at construction as an opaque
 * label and used only inside thrown-error messages. TokenParser does
 * not resolve, read, or path-manipulate it — so filename-awareness
 * never crosses the seam back into frontend code. See
 * .claude/architecture/multi-flavor-ir.md § Filename-awareness seam.
 */

// CVE-2023-25345: prototype-chain properties that must never appear as
// variable identifiers or dot-access keys in templates. Allowing these
// gives compiled template code access to Object.prototype (__proto__),
// Object (constructor), or Function (constructor.constructor), which
// enables arbitrary code execution inside the new Function(...) body.
// See .claude/security.md.
var _dangerousProps = require('./security').dangerousProps;

var _reserved = ['break', 'case', 'catch', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'finally', 'for', 'function', 'if', 'in', 'instanceof', 'new', 'return', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with'];

/**
 * Parse strings of variables and tags into tokens for future compilation.
 * @class
 * @param {array}   tokens     Pre-split tokens read by the Lexer.
 * @param {object}  filters    Keyed object of filters that may be applied to variables.
 * @param {boolean} autoescape Whether or not this should be autoescaped.
 * @param {number}  line       Beginning line number for the first token.
 * @param {string}  [filename] Name of the file being parsed.
 * @private
 */
function TokenParser(tokens, filters, autoescape, line, filename) {
  this.out = [];
  this.state = [];
  this.filterApplyIdx = [];
  this._parsers = {};
  this.line = line;
  this.filename = filename;
  this.filters = filters;
  this.escape = autoescape;

  this.parse = function () {
    var self = this;

    if (self._parsers.start) {
      self._parsers.start.call(self);
    }
    utils.each(tokens, function (token, i) {
      var prevToken = tokens[i - 1];
      self.isLast = (i === tokens.length - 1);
      if (prevToken) {
        while (prevToken.type === _t.WHITESPACE) {
          i -= 1;
          prevToken = tokens[i - 1];
        }
      }
      self.prevToken = prevToken;
      self.parseToken(token);
    });
    if (self._parsers.end) {
      self._parsers.end.call(self);
    }

    if (self.escape) {
      self.filterApplyIdx = [0];
      if (typeof self.escape === 'string') {
        self.parseToken({ type: _t.FILTER, match: 'e' });
        self.parseToken({ type: _t.COMMA, match: ',' });
        self.parseToken({ type: _t.STRING, match: String(autoescape) });
        self.parseToken({ type: _t.PARENCLOSE, match: ')'});
      } else {
        self.parseToken({ type: _t.FILTEREMPTY, match: 'e' });
      }
    }

    return self.out;
  };
}

TokenParser.prototype = {
  /**
   * Set a custom method to be called when a token type is found.
   *
   * @example
   * parser.on(types.STRING, function (token) {
   *   this.out.push(token.match);
   * });
   * @example
   * parser.on('start', function () {
   *   this.out.push('something at the beginning of your args')
   * });
   * parser.on('end', function () {
   *   this.out.push('something at the end of your args');
   * });
   *
   * @param  {number}   type Token type ID. Found in the Lexer.
   * @param  {Function} fn   Callback function. Return true to continue executing the default parsing function.
   * @return {undefined}
   */
  on: function (type, fn) {
    this._parsers[type] = fn;
  },

  /**
   * Parse a single token.
   * @param  {{match: string, type: number, line: number}} token Lexer token object.
   * @return {undefined}
   * @private
   */
  parseToken: function (token) {
    var self = this,
      fn = self._parsers[token.type] || self._parsers['*'],
      match = token.match,
      prevToken = self.prevToken,
      prevTokenType = prevToken ? prevToken.type : null,
      lastState = (self.state.length) ? self.state[self.state.length - 1] : null,
      temp;

    if (fn && typeof fn === 'function') {
      if (!fn.call(this, token)) {
        return;
      }
    }

    if (lastState && prevToken &&
        lastState === _t.FILTER &&
        prevTokenType === _t.FILTER &&
        token.type !== _t.PARENCLOSE &&
        token.type !== _t.COMMA &&
        token.type !== _t.OPERATOR &&
        token.type !== _t.FILTER &&
        token.type !== _t.FILTEREMPTY) {
      self.out.push(', ');
    }

    if (lastState && lastState === _t.METHODOPEN) {
      self.state.pop();
      if (token.type !== _t.PARENCLOSE) {
        self.out.push(', ');
      }
    }

    switch (token.type) {
    case _t.WHITESPACE:
      break;

    case _t.STRING:
      // CVE-2023-25345: block prototype-chain traversal via bracket notation
      // e.g. foo["__proto__"] or foo["constructor"]
      if (lastState === _t.BRACKETOPEN) {
        var strippedMatch = match.replace(/^['"]|['"]$/g, '');
        if (_dangerousProps.indexOf(strippedMatch) !== -1) {
          utils.throwError('Unsafe access to "' + strippedMatch + '" via bracket notation is not allowed in templates (CVE-2023-25345)', self.line, self.filename);
        }
      }
      self.filterApplyIdx.push(self.out.length);
      self.out.push(match.replace(/\\/g, '\\\\'));
      break;

    case _t.NUMBER:
    case _t.BOOL:
      self.filterApplyIdx.push(self.out.length);
      self.out.push(match);
      break;

    case _t.FILTER:
      if (!self.filters.hasOwnProperty(match) || typeof self.filters[match] !== "function") {
        utils.throwError('Invalid filter "' + match + '"', self.line, self.filename);
      }
      self.escape = self.filters[match].safe ? false : self.escape;
      self.out.splice(self.filterApplyIdx[self.filterApplyIdx.length - 1], 0, '_filters["' + match + '"](');
      self.state.push(token.type);
      break;

    case _t.FILTEREMPTY:
      if (!self.filters.hasOwnProperty(match) || typeof self.filters[match] !== "function") {
        utils.throwError('Invalid filter "' + match + '"', self.line, self.filename);
      }
      self.escape = self.filters[match].safe ? false : self.escape;
      self.out.splice(self.filterApplyIdx[self.filterApplyIdx.length - 1], 0, '_filters["' + match + '"](');
      self.out.push(')');
      break;

    case _t.FUNCTION:
    case _t.FUNCTIONEMPTY:
      self.out.push('((typeof _ctx.' + match + ' !== "undefined") ? _ctx.' + match +
        ' : ((typeof ' + match + ' !== "undefined") ? ' + match +
        ' : _fn))(');
      self.escape = false;
      if (token.type === _t.FUNCTIONEMPTY) {
        self.out[self.out.length - 1] = self.out[self.out.length - 1] + ')';
      } else {
        self.state.push(token.type);
      }
      self.filterApplyIdx.push(self.out.length - 1);
      break;

    case _t.PARENOPEN:
      self.state.push(token.type);
      if (self.filterApplyIdx.length) {
        self.out.splice(self.filterApplyIdx[self.filterApplyIdx.length - 1], 0, '(');
        if (prevToken && prevTokenType === _t.VAR) {
          temp = prevToken.match.split('.').slice(0, -1);
          self.out.push(' || _fn).call(' + self.checkMatch(temp));
          self.state.push(_t.METHODOPEN);
          self.escape = false;
        } else {
          self.out.push(' || _fn)(');
        }
        self.filterApplyIdx.push(self.out.length - 3);
      } else {
        self.out.push('(');
        self.filterApplyIdx.push(self.out.length - 1);
      }
      break;

    case _t.PARENCLOSE:
      temp = self.state.pop();
      if (temp !== _t.PARENOPEN && temp !== _t.FUNCTION && temp !== _t.FILTER) {
        utils.throwError('Mismatched nesting state', self.line, self.filename);
      }
      self.out.push(')');
      // Once off the previous entry
      self.filterApplyIdx.pop();
      if (temp !== _t.FILTER) {
        // Once for the open paren
        self.filterApplyIdx.pop();
      }
      break;

    case _t.COMMA:
      if (lastState !== _t.FUNCTION &&
          lastState !== _t.FILTER &&
          lastState !== _t.ARRAYOPEN &&
          lastState !== _t.CURLYOPEN &&
          lastState !== _t.PARENOPEN &&
          lastState !== _t.COLON) {
        utils.throwError('Unexpected comma', self.line, self.filename);
      }
      if (lastState === _t.COLON) {
        self.state.pop();
      }
      self.out.push(', ');
      self.filterApplyIdx.pop();
      break;

    case _t.LOGIC:
    case _t.COMPARATOR:
      if (!prevToken ||
          prevTokenType === _t.COMMA ||
          prevTokenType === token.type ||
          prevTokenType === _t.BRACKETOPEN ||
          prevTokenType === _t.CURLYOPEN ||
          prevTokenType === _t.PARENOPEN ||
          prevTokenType === _t.FUNCTION) {
        utils.throwError('Unexpected logic', self.line, self.filename);
      }
      self.out.push(token.match);
      break;

    case _t.NOT:
      self.out.push(token.match);
      break;

    case _t.VAR:
      self.parseVar(token, match, lastState);
      break;

    case _t.BRACKETOPEN:
      if (!prevToken ||
          (prevTokenType !== _t.VAR &&
            prevTokenType !== _t.BRACKETCLOSE &&
            prevTokenType !== _t.PARENCLOSE)) {
        self.state.push(_t.ARRAYOPEN);
        self.filterApplyIdx.push(self.out.length);
      } else {
        self.state.push(token.type);
      }
      self.out.push('[');
      break;

    case _t.BRACKETCLOSE:
      temp = self.state.pop();
      if (temp !== _t.BRACKETOPEN && temp !== _t.ARRAYOPEN) {
        utils.throwError('Unexpected closing square bracket', self.line, self.filename);
      }
      self.out.push(']');
      self.filterApplyIdx.pop();
      break;

    case _t.CURLYOPEN:
      self.state.push(token.type);
      self.out.push('{');
      self.filterApplyIdx.push(self.out.length - 1);
      break;

    case _t.COLON:
      if (lastState !== _t.CURLYOPEN) {
        utils.throwError('Unexpected colon', self.line, self.filename);
      }
      self.state.push(token.type);
      self.out.push(':');
      self.filterApplyIdx.pop();
      break;

    case _t.CURLYCLOSE:
      if (lastState === _t.COLON) {
        self.state.pop();
      }
      if (self.state.pop() !== _t.CURLYOPEN) {
        utils.throwError('Unexpected closing curly brace', self.line, self.filename);
      }
      self.out.push('}');

      self.filterApplyIdx.pop();
      break;

    case _t.DOTKEY:
      if (!prevToken || (
          prevTokenType !== _t.VAR &&
          prevTokenType !== _t.BRACKETCLOSE &&
          prevTokenType !== _t.DOTKEY &&
          prevTokenType !== _t.PARENCLOSE &&
          prevTokenType !== _t.FUNCTIONEMPTY &&
          prevTokenType !== _t.FILTEREMPTY &&
          prevTokenType !== _t.CURLYCLOSE
        )) {
        utils.throwError('Unexpected key "' + match + '"', self.line, self.filename);
      }
      // CVE-2023-25345: block prototype-chain traversal via dot notation
      if (_dangerousProps.indexOf(match) !== -1) {
        utils.throwError('Unsafe access to "' + match + '" is not allowed in templates (CVE-2023-25345)', self.line, self.filename);
      }
      self.out.push('.' + match);
      break;

    case _t.OPERATOR:
      self.out.push(' ' + match + ' ');
      self.filterApplyIdx.pop();
      break;
    }
  },

  /**
   * Parse variable token
   * @param  {{match: string, type: number, line: number}} token      Lexer token object.
   * @param  {string} match       Shortcut for token.match
   * @param  {number} lastState   Lexer token type state.
   * @return {undefined}
   * @private
   */
  parseVar: function (token, match, lastState) {
    var self = this;

    match = match.split('.');

    if (_reserved.indexOf(match[0]) !== -1) {
      utils.throwError('Reserved keyword "' + match[0] + '" attempted to be used as a variable', self.line, self.filename);
    }

    // CVE-2023-25345: block prototype-chain property access
    utils.each(match, function (segment) {
      if (_dangerousProps.indexOf(segment) !== -1) {
        utils.throwError('Unsafe access to "' + segment + '" is not allowed in templates (CVE-2023-25345)', self.line, self.filename);
      }
    });

    self.filterApplyIdx.push(self.out.length);
    if (lastState === _t.CURLYOPEN) {
      if (match.length > 1) {
        utils.throwError('Unexpected dot', self.line, self.filename);
      }
      self.out.push(match[0]);
      return;
    }

    self.out.push(self.checkMatch(match));
  },

  /**
   * Walk a flat LexerToken[] and produce an {@link IRExpr} tree.
   *
   * Parallel path to {@link TokenParser#parse}: `parse()` emits a
   * JS-source fragment (array of strings to be joined), whereas
   * `parseExpr` emits structured IR that {@link backend.emitExpr}
   * later lowers into an equivalent JS-source fragment. `.parse()` is
   * unchanged and remains the production path; `parseExpr` is the
   * incoming target shape for Phase 2 (#T15), introduced additively in
   * Session 14b so the IR grammar can be proven against real lexer
   * output before consumers are flipped in Commits 3-8.
   *
   * The CVE-2023-25345 prototype-chain guards (`_dangerousProps` on
   * VAR segments, DOTKEY matches, STRING-inside-BRACKETOPEN values,
   * FUNCTION / FUNCTIONEMPTY callee names) are mirrored verbatim from
   * {@link TokenParser#parseToken}. Both layers stay live during the
   * migration per `.claude/security.md § _dangerousProps is duplicated
   * across layers — DO NOT dedup`.
   *
   * Parses until end of tokens or an un-nested top-level FILTER /
   * FILTEREMPTY token (filter pipes are an Output-site concern —
   * `IROutput.filters` — not part of the expression grammar). The
   * caller resumes from there to drain the filter chain. Autoescape
   * tail-injection is likewise NOT synthesised here: autoescape is an
   * Output-site property (`IROutput.safe`), so callers decide.
   *
   * @param  {object[]} tokens  LexerToken[] — same shape TokenParser.parse walks.
   * @return {object}           IRExpr tree (see `./ir.js`).
   */
  parseExpr: function (tokens) {
    var self = this;
    var pos = 0;

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
      utils.throwError(msg, self.line, self.filename);
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
      if (tok.type === _t.OPERATOR) {
        m = tok.match;
        if (m === '+' || m === '-') { return { op: m, prec: 5 }; }
        if (m === '*' || m === '/' || m === '%') { return { op: m, prec: 6 }; }
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
          keyExpr = ir.literal('string', keyTok.match);
        } else if (keyTok.type === _t.NUMBER) {
          keyExpr = ir.literal('number', parseFloat(keyTok.match));
        } else {
          bail('Unexpected object key');
        }
        var colon = consume();
        if (!colon || colon.type !== _t.COLON) { bail('Unexpected colon'); }
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
            bail('Unexpected closing square bracket');
          }
          expr = ir.access(expr, keyExpr);
        } else if (tok.type === _t.PARENOPEN) {
          consume();
          expr = ir.fnCall(expr, parseArgList(_t.PARENCLOSE));
        } else {
          break;
        }
      }
      return expr;
    }

    function parsePrimary() {
      var tok = consume();
      if (!tok) { bail('Unexpected end of expression'); }
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
        if (tok.type === _t.FILTER || tok.type === _t.FILTEREMPTY) { break; }
        var info = getBinaryOpInfo(tok);
        if (!info || info.prec < minPrec) { break; }
        consume();
        var right = parseExpression(info.prec + 1);
        left = ir.binaryOp(info.op, left, right);
      }
      return left;
    }

    return parseExpression(0);
  },

  /**
   * Return contextual dot-check string for a match
   * @param  {string} match       Shortcut for token.match
   * @private
   */
  checkMatch: function (match) {
    var temp = match[0], result;

    function checkDot(ctx) {
      var c = ctx + temp,
        m = match,
        build = '';

      build = '(typeof ' + c + ' !== "undefined" && ' + c + ' !== null';
      utils.each(m, function (v, i) {
        if (i === 0) {
          return;
        }
        build += ' && ' + c + '.' + v + ' !== undefined && ' + c + '.' + v + ' !== null';
        c += '.' + v;
      });
      build += ')';

      return build;
    }

    function buildDot(ctx) {
      return '(' + checkDot(ctx) + ' ? ' + ctx + match.join('.') + ' : "")';
    }
    result = '(' + checkDot('_ctx.') + ' ? ' + buildDot('_ctx.') + ' : ' + buildDot('') + ')';
    return '(' + result + ' !== null ? ' + result + ' : ' + '"" )';
  }
};

exports.TokenParser = TokenParser;
