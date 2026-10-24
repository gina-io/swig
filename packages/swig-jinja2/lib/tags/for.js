/*!
 * Jinja2 `{% for %}` tag.
 *
 *   {% for <val> in <iterable> %}…{% endfor %}
 *   {% for <key>, <val> in <iterable> %}…{% endfor %}
 *   {% for <val> in <iterable> %}…{% else %}…{% endfor %}   (empty case)
 *   {% for <val> in <iterable> if <test> %}…{% endfor %}     (loop filter)
 *
 * Binding follows Jinja2: one name over a mapping binds each key, and two
 * names over a list unpack each item into its first and second values (a
 * list's items, a string's characters, a mapping's keys), so
 * `{% for k, v in d|dictsort %}` binds the key and the value. An item that
 * does not hold two values binds what it holds, a missing value rendering
 * empty, where Jinja2 raises. Two names over a mapping bind the key and the
 * value, a swig extension (Jinja2 iterates the keys and unpacks each one).
 *
 * Loop variable names must be bare identifiers — dotted paths (`foo.bar`)
 * are rejected at parse time. The CVE-2023-25345 `_dangerousProps` guard
 * runs on every bound name (key and val).
 *
 * The iterable is lowered through `parser.parseExpr`, so filter chains,
 * binary ops and function calls route through the same path as any other
 * Jinja2 expression; the IRExpr goes on `token.irExpr`. A loop filter,
 * `{% for x in xs if x > 1 %}`, starts at the first `if` at depth 0 and is
 * lowered the same way onto `token.irTest`, which compile sets as the IRFor
 * `test`: it runs once per item with the loop names bound, before the loop,
 * so `loop` in it is the enclosing loop, and the counters and the else
 * branch count only the kept items, as in Jinja2. An inline-if iterable
 * (`{% for x in a if c else b %}`), which Jinja2 rejects without
 * parentheses, still compiles when an `else` is left for that `if`.
 *
 * The backend's `For` branch owns the full IIFE scaffolding: `_utils.each`,
 * the `_ctx.loop.*` bookkeeping (first / last / index / index0 / revindex /
 * revindex0 / length / key), the `Math.random()`-based loopcache that keeps
 * nested loops from clobbering each other's `_ctx.loop` state, and the
 * `emptyBody` (for-else) emission. The tag ships only semantic IR —
 * (val, key, iterable, body, emptyBody) and the `mapKeys` / `unpack`
 * binding flags.
 *
 * A `{% else %}` inside the for body is captured as a marker token (its
 * stack check in tags/else.js allows `for`); compile splits the content at
 * it into the loop body and the empty body.
 */

var ir = require('@rhinostone/swig-core/lib/ir');
var utils = require('@rhinostone/swig-core/lib/utils');
var _dangerousProps = require('@rhinostone/swig-core/lib/security').dangerousProps;

var lexer = require('../lexer');

exports.ends = true;
exports.block = false;

/*!
 * Index of the token that starts a loop filter in the iterable's tokens, or
 * -1: the first `if` at depth 0, unless an `else` is left for it once each
 * nested `if` has taken the next `else`, as parseExpr pairs them (the tail
 * is then an inline-if iterable). `if(` and `if()` lex as FUNCTION and
 * FUNCTIONEMPTY tokens named `if`, and `else(` likewise, so those count.
 *
 * @param  {Array}  tokens The tokens after `in`.
 * @param  {object} types  Jinja2 lexer token-type enum.
 * @return {number}        Index of the splitting token, or -1.
 * @private
 */
function loopFilterIndex(tokens, types) {
  function isWord(tok, word) {
    return tok.match === word && (tok.type === types.VAR || tok.type === types.FUNCTION || tok.type === types.FUNCTIONEMPTY);
  }
  function step(tok, depth) {
    if (tok.type === types.PARENOPEN || tok.type === types.BRACKETOPEN || tok.type === types.CURLYOPEN || tok.type === types.FUNCTION || tok.type === types.FILTER) {
      return depth + 1;
    }
    if (tok.type === types.PARENCLOSE || tok.type === types.BRACKETCLOSE || tok.type === types.CURLYCLOSE) {
      return depth - 1;
    }
    return depth;
  }
  var split = -1, depth = 0, pending = 0, i;
  for (i = 0; i < tokens.length && split === -1; i += 1) {
    if (depth === 0 && isWord(tokens[i], 'if')) {
      split = i;
    }
    depth = step(tokens[i], depth);
  }
  for (; split !== -1 && i < tokens.length; i += 1) {
    if (depth === 0 && isWord(tokens[i], 'if')) {
      pending += 1;
    } else if (depth === 0 && isWord(tokens[i], 'else')) {
      if (pending === 0) {
        return -1;
      }
      pending -= 1;
    }
    depth = step(tokens[i], depth);
  }
  return split;
}

/**
 * Parse the `{% for %}` tag body. Extracts the binding names (val or
 * key+val), validates them, then lowers the iterable expression and a loop
 * filter's test. Names go on `token.args` (`[val]` or `[key, val]`); the
 * iterable IR on `token.irExpr`, the test IR on `token.irTest`.
 *
 * @param  {string} str    Tag body.
 * @param  {number} line   Source line of the opening `{%`.
 * @param  {object} parser The Jinja2 parser module (exposes `parseExpr`).
 * @param  {object} types  Jinja2 lexer token-type enum.
 * @param  {Array}  stack  Open-tag stack (parser.js manages the push).
 * @param  {object} opts   Per-call options (honors `opts.filename`).
 * @param  {object} swig   Swig instance (unused).
 * @param  {object} token  In-progress TagToken.
 * @return {boolean}       Always `true` on success. Throws otherwise.
 */
exports.parse = function (str, line, parser, types, stack, opts, swig, token) {
  var tokens = lexer.read(utils.strip(str));
  var pos = 0;

  function peek() {
    while (pos < tokens.length && tokens[pos].type === types.WHITESPACE) { pos += 1; }
    return pos < tokens.length ? tokens[pos] : null;
  }
  function consume() {
    var t = peek();
    if (t) { pos += 1; }
    return t;
  }

  function takeName() {
    var tok = consume();
    if (!tok || tok.type !== types.VAR) {
      utils.throwError('Expected loop variable in "for" tag', line, opts.filename);
    }
    if (tok.match.indexOf('.') !== -1) {
      utils.throwError('Loop variable "' + tok.match + '" must be a bare identifier in "for" tag', line, opts.filename);
    }
    if (_dangerousProps.indexOf(tok.match) !== -1) {
      utils.throwError('Unsafe loop variable "' + tok.match + '" is not allowed (prototype-chain guard)', line, opts.filename);
    }
    return tok.match;
  }

  var first = takeName();
  var val = first;
  var key;

  if (peek() && peek().type === types.COMMA) {
    consume();
    key = first;
    val = takeName();
  }

  // The lexer's COMPARATOR rule requires a trailing `\s` on `in`, so
  // `{% for x in %}` (nothing after `in`) lexes `in` as a VAR. Match on the
  // literal string so the error stays "Expected iterable" for that shape.
  var inTok = consume();
  if (!inTok || inTok.match !== 'in' || (inTok.type !== types.COMPARATOR && inTok.type !== types.VAR)) {
    utils.throwError('Expected "in" in "for" tag', line, opts.filename);
  }

  while (pos < tokens.length && tokens[pos].type === types.WHITESPACE) { pos += 1; }

  var iterableTokens = tokens.slice(pos);
  if (!iterableTokens.length) {
    utils.throwError('Expected iterable after "in" in "for" tag', line, opts.filename);
  }

  token.args = key !== undefined ? [key, val] : [val];
  var split = loopFilterIndex(iterableTokens, types);
  if (split === -1) {
    token.irExpr = parser.parseExpr(iterableTokens);
    return true;
  }
  // The test gets back the parentheses that `if(` or `if()` lexed into.
  var splitTok = iterableTokens[split],
    iterTokens = iterableTokens.slice(0, split),
    testTokens = iterableTokens.slice(split + 1);
  if (splitTok.type === types.FUNCTIONEMPTY) {
    testTokens.unshift({ type: types.PARENCLOSE, match: ')', length: 1 });
  }
  if (splitTok.type !== types.VAR) {
    testTokens.unshift({ type: types.PARENOPEN, match: '(', length: 1 });
  }
  function hasToken(list) {
    return list.some(function (t) { return t.type !== types.WHITESPACE; });
  }
  if (!hasToken(iterTokens)) {
    utils.throwError('Expected iterable after "in" in "for" tag', line, opts.filename);
  }
  if (!hasToken(testTokens)) {
    utils.throwError('Expected a condition after "if" in "for" tag', line, opts.filename);
  }
  token.irExpr = parser.parseExpr(iterTokens);
  token.irTest = parser.parseExpr(testTokens);
  return true;
};

/**
 * Emit an IRFor node, splitting `content` at a `{% else %}` marker into the
 * loop body and the empty body, and setting the Jinja2 binding flags and a
 * loop filter's `test`. The backend's `For` branch owns the loopcache +
 * `_utils.each` scaffolding.
 *
 * @return {object} IRFor node.
 */
exports.compile = function (compiler, args, content, parents, options, blockName, token) {
  var val, key;
  if (args.length === 2) {
    key = args[0];
    val = args[1];
  } else {
    val = args[0];
    key = '__k';
  }

  var loopContent = [],
    emptyContent = null,
    filename = options && options.filename;

  utils.each(content, function (child) {
    if (child && child.name === 'else') {
      if (emptyContent !== null) {
        utils.throwError('Multiple "else" branches in "for" tag', null, filename);
      }
      emptyContent = [];
      return;
    }
    if (emptyContent !== null) {
      emptyContent.push(child);
    } else {
      loopContent.push(child);
    }
  });

  var bodyJS = compiler(loopContent, parents, options, blockName);
  var emptyBody;
  if (emptyContent !== null) {
    emptyBody = [ir.legacyJS(compiler(emptyContent, parents, options, blockName))];
  }
  var node = ir.forStmt(val, token.irExpr, [ir.legacyJS(bodyJS)], key, emptyBody);
  // Jinja2 binding (see the IRFor typedef): two names unpack each item of a
  // list, one name binds each key of a mapping.
  if (args.length === 2) {
    node.unpack = true;
  } else {
    node.mapKeys = true;
  }
  if (token.irTest) {
    node.test = token.irTest;
  }
  return node;
};
