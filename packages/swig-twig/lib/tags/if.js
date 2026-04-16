/*!
 * Phase 3 Session 7 — Twig `{% if %}` tag.
 *
 * Twig conditional: `{% if <expr> %}…{% endif %}`. The test expression
 * is parsed via `parser.parseExpr` and attached to `token.irExpr`; the
 * tag's body content is captured via the parser's open-tag stack
 * mechanism (parser.js sets `ends: true` so subsequent tokens append to
 * `token.content` until the matching `{% endif %}` arrives).
 *
 * Session 7 ships a single-branch shape — `{% else %}` / `{% elseif %}`
 * are deferred to a later session. The compile path emits one
 * IRIfBranch carrying the test IRExpr and the recursively-compiled
 * body wrapped in IRLegacyJS.
 */

var ir = require('@rhinostone/swig-core/lib/ir');
var utils = require('@rhinostone/swig-core/lib/utils');

var lexer = require('../lexer');

exports.ends = true;
exports.block = false;

/**
 * Parse the `{% if %}` tag body and attach the test IRExpr to
 * `token.irExpr`.
 *
 * @param  {string} str    Tag body (everything between `{%` and `%}`, tag name stripped).
 * @param  {number} line   Source line of the opening `{%`.
 * @param  {object} parser The Twig parser module (exposes `parseExpr`).
 * @param  {object} types  Twig lexer token-type enum.
 * @param  {Array}  stack  Open-tag stack (managed by parser.js).
 * @param  {object} opts   Per-call options (honors `opts.filename` for filename-aware throws).
 * @param  {object} swig   Swig instance (unused).
 * @param  {object} token  In-progress TagToken. `token.irExpr` is set to the test IRExpr.
 * @return {boolean}       Always `true` on success. Throws otherwise.
 */
exports.parse = function (str, line, parser, types, stack, opts, swig, token) {
  var tokens = lexer.read(utils.strip(str));
  if (!tokens.length) {
    utils.throwError('Expected conditional expression in "if" tag', line, opts.filename);
  }
  token.irExpr = parser.parseExpr(tokens);
  return true;
};

/**
 * Recursively compile the body content and wrap it as a single-branch
 * IRIf node. The backend's `If` walker emits the JS `if (<test>) { … }`
 * envelope.
 *
 * @return {object} IRIf node.
 */
exports.compile = function (compiler, args, content, parents, options, blockName, token) {
  var bodyJS = compiler(content, parents, options, blockName);
  return ir.ifStmt([ir.ifBranch(token.irExpr, [ir.legacyJS(bodyJS)])]);
};
