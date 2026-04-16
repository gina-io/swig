/*!
 * Phase 3 Session 8 — Twig `{% for %}` tag.
 *
 * Twig iteration:
 *   {% for <val> in <iterable> %}…{% endfor %}
 *   {% for <key>, <val> in <iterable> %}…{% endfor %}
 *
 * Loop variable names must be bare identifiers — dotted paths
 * (`foo.bar`) are rejected at parse time (not valid Twig loop-var
 * syntax; and accepting them would let malformed templates silently
 * through). The CVE-2023-25345 `_dangerousProps` guard runs on every
 * bound name (key and val).
 *
 * The iterable is lowered through `parser.parseExpr`, so filter chains
 * (`list|sort`), BinaryOps (`a + b`), function calls, and ternaries
 * route through the same path as any other Twig expression — no
 * tag-local bail conditions. The resulting IRExpr is attached to
 * `token.irExpr`.
 *
 * The backend's `For` branch (packages/swig-core/lib/backend.js:187)
 * owns the full IIFE scaffolding: `_utils.each`, `_ctx.loop.*`
 * bookkeeping (first/last/index/index0/revindex/revindex0/length/key),
 * and the `Math.random()`-based loopcache identifier that keeps nested
 * loops from clobbering each other's `_ctx.loop` state (gh-433). The
 * tag ships only semantic IR — (val, key, iterable, body).
 */

var ir = require('@rhinostone/swig-core/lib/ir');
var utils = require('@rhinostone/swig-core/lib/utils');
var _dangerousProps = require('@rhinostone/swig-core/lib/security').dangerousProps;

var lexer = require('../lexer');
var _t = require('../tokentypes');

exports.ends = true;
exports.block = false;

/**
 * Parse the `{% for %}` tag body. Extracts the binding names (val or
 * key+val), validates them against `_dangerousProps` and the bare-
 * identifier rule, then lowers the iterable expression through
 * `parser.parseExpr`. Names are stashed on `token.args` (`[val]` or
 * `[key, val]`); the iterable IR is stashed on `token.irExpr`.
 *
 * @param  {string} str    Tag body.
 * @param  {number} line   Source line of the opening `{%`.
 * @param  {object} parser The Twig parser module (exposes `parseExpr`).
 * @param  {object} types  Twig lexer token-type enum.
 * @param  {Array}  stack  Open-tag stack (parser.js manages the push
 *                         after parse returns).
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
      utils.throwError('Unsafe loop variable "' + tok.match + '" is not allowed (CVE-2023-25345)', line, opts.filename);
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

  // NB: the Twig lexer's COMPARATOR rule is `^(=== | ... | in\s)` — the
  // trailing `\s` is required, so `{% for x in %}` (nothing after `in`)
  // lexes `in` as a VAR instead of a COMPARATOR. Match on the literal
  // string so the user-facing error stays "Expected iterable" for that
  // shape rather than "Expected in".
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
  token.irExpr = parser.parseExpr(iterableTokens);
  return true;
};

/**
 * Emit an IRFor node. The backend's `For` branch owns the loopcache +
 * `_utils.each` scaffolding — this returns only (val, iterable, body,
 * key). Body is the recursively-compiled content wrapped in IRLegacyJS.
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
  var bodyJS = compiler(content, parents, options, blockName);
  return ir.forStmt(val, token.irExpr, [ir.legacyJS(bodyJS)], key);
};
