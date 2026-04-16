/*!
 * Phase 3 Session 7 — Twig `{% set %}` tag.
 *
 * Twig assignment: `{% set <lhs> <op> <rhs> %}` where
 *   lhs — a bare identifier or a pure-dot path (`foo`, `foo.bar.baz`).
 *         Bracket LHS (`foo[bar]`) is rejected at parse time — the
 *         bracket-lvalue contract is a cross-flavor design call and
 *         is deferred.
 *   op  — any valid JS assignment operator (`=`, `+=`, `-=`, `*=`, `/=`).
 *   rhs — any Twig expression; parsed via `parser.parseExpr`.
 *
 * Emits an IRSet node on `token.irExpr`:
 *
 *   ir.set(ir.varRef(['foo', 'bar']), '=', <IRExpr value>)
 *
 * The backend's `Set` branch (packages/swig-core/lib/backend.js:152)
 * emits `_ctx.foo.bar = <emitted value>;\n`. CVE-2023-25345 checkpoints
 * apply twice — here on the LHS path segments, and again in the backend
 * `checkDangerousSegment` walk — per the duplication invariant in
 * .claude/security.md § _dangerousProps is duplicated across layers.
 */

var ir = require('@rhinostone/swig-core/lib/ir');
var utils = require('@rhinostone/swig-core/lib/utils');
var _dangerousProps = require('@rhinostone/swig-core/lib/security').dangerousProps;

var lexer = require('../lexer');
var _t = require('../tokentypes');

exports.ends = false;
exports.block = true;

/**
 * Parse the `{% set %}` tag body and attach an IRSet node to `token.irExpr`.
 *
 * @param  {string} str    Tag body (everything between `{%` and `%}`, tag name stripped).
 * @param  {number} line   Source line of the opening `{%`.
 * @param  {object} parser The Twig parser module (exposes `parseExpr`).
 * @param  {object} types  Twig lexer token-type enum.
 * @param  {Array}  stack  Open-tag stack (unused — `set` has no `endset`).
 * @param  {object} opts   Per-call options (honors `opts.filename` for filename-aware throws).
 * @param  {object} swig   Swig instance (unused).
 * @param  {object} token  In-progress TagToken. `token.irExpr` is set to the IRSet node.
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

  var lhsTok = consume();
  if (!lhsTok || lhsTok.type !== types.VAR) {
    utils.throwError('Expected variable name in "set" tag', line, opts.filename);
  }

  var path = lhsTok.match.split('.');
  utils.each(path, function (segment) {
    if (_dangerousProps.indexOf(segment) !== -1) {
      utils.throwError('Unsafe assignment to "' + segment + '" is not allowed (CVE-2023-25345)', line, opts.filename);
    }
  });

  // DOTKEY tail — the Twig lexer already folds dotted paths into the
  // VAR match, but a defensive DOTKEY consumer here keeps this tag
  // robust if a future lexer tightening splits `foo.bar` into VAR + DOTKEY.
  while (peek() && peek().type === types.DOTKEY) {
    var dk = consume();
    if (_dangerousProps.indexOf(dk.match) !== -1) {
      utils.throwError('Unsafe assignment to "' + dk.match + '" is not allowed (CVE-2023-25345)', line, opts.filename);
    }
    path.push(dk.match);
  }

  var next = peek();
  if (next && next.type === types.BRACKETOPEN) {
    utils.throwError('Bracket-notation assignment is not supported in "set" (use dot-path notation)', line, opts.filename);
  }

  var opTok = consume();
  if (!opTok || opTok.type !== types.ASSIGNMENT) {
    utils.throwError('Expected assignment operator in "set" tag', line, opts.filename);
  }

  // Skip leading whitespace between `=` and the RHS expression so the
  // RHS slice starts at the first meaningful token. parseExpr tolerates
  // leading whitespace internally, but trimming here keeps the slice
  // shape predictable for future callers.
  while (pos < tokens.length && tokens[pos].type === types.WHITESPACE) { pos += 1; }

  var rhsTokens = tokens.slice(pos);
  if (!rhsTokens.length) {
    utils.throwError('Expected expression after assignment in "set" tag', line, opts.filename);
  }

  var value = parser.parseExpr(rhsTokens);
  token.irExpr = ir.set(ir.varRef(path), opTok.match, value);
  return true;
};

/**
 * Emit the IRSet node the parse handler attached to the token. Routed
 * through the backend's `Set` walker.
 *
 * @return {object} The IRSet node.
 */
exports.compile = function (compiler, args, content, parents, options, blockName, token) {
  return token.irExpr;
};
