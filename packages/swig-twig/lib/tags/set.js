/*!
 * Phase 3 Session 7 — Twig `{% set %}` tag.
 * Phase 3 Session 11 — extended with body-capture form.
 *
 * Twig `set` has two forms:
 *
 *   Inline:  {% set <lhs> <op> <rhs> %}
 *   Body:    {% set <lhs> %}…{% endset %}
 *
 *   lhs — a bare identifier or a pure-dot path (`foo`, `foo.bar.baz`).
 *         Bracket LHS (`foo[bar]`) is rejected at parse time — the
 *         bracket-lvalue contract is a cross-flavor design call and
 *         is deferred.
 *   op  — any valid JS assignment operator (`=`, `+=`, `-=`, `*=`, `/=`).
 *         Inline form only.
 *   rhs — any Twig expression; parsed via `parser.parseExpr`.
 *         Inline form only.
 *
 * Inline form emits an IRSet node on `token.irExpr`:
 *
 *   ir.set(ir.varRef(['foo', 'bar']), '=', <IRExpr value>)
 *
 * Body form captures the rendered content as a string via an IIFE and
 * assigns it to the target. No dedicated IR factory — emits an
 * IRLegacyJS fragment because the capture is a JS plumbing shape
 * (IIFE over `_output`) that doesn't need its own IR surface.
 *
 * Static `exports.ends = true` is the default so the token's `ends`
 * slot starts truthy — the body form keeps it, the inline form flips
 * `token.ends = false` at parse time so the splitter does NOT push
 * the inline-form token onto the open-tag stack.
 *
 * CVE-2023-25345 checkpoints apply twice — here on the LHS path
 * segments, and again in the backend `checkDangerousSegment` walk —
 * per the duplication invariant in .claude/security.md § _dangerousProps
 * is duplicated across layers.
 */

var ir = require('@rhinostone/swig-core/lib/ir');
var utils = require('@rhinostone/swig-core/lib/utils');
var _dangerousProps = require('@rhinostone/swig-core/lib/security').dangerousProps;

var lexer = require('../lexer');
var _t = require('../tokentypes');

exports.ends = true;
exports.block = true;

/**
 * Parse the `{% set %}` tag body and attach the appropriate IR to the
 * token. Inline form sets `token.irExpr` and flips `token.ends = false`;
 * body form leaves `token.ends = true` and stashes the target path on
 * `token.args` for the compile step to pick up.
 *
 * @param  {string} str    Tag body (everything between `{%` and `%}`, tag name stripped).
 * @param  {number} line   Source line of the opening `{%`.
 * @param  {object} parser The Twig parser module (exposes `parseExpr`).
 * @param  {object} types  Twig lexer token-type enum.
 * @param  {Array}  stack  Open-tag stack (unused — parser.js manages the push).
 * @param  {object} opts   Per-call options (honors `opts.filename` for filename-aware throws).
 * @param  {object} swig   Swig instance (unused).
 * @param  {object} token  In-progress TagToken. Body form: `token.args` gets the path;
 *                         `token.ends` stays true. Inline form: `token.irExpr` gets
 *                         the IRSet; `token.ends` flips to false.
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

  if (!next) {
    // Body-capture form — no more tokens after the LHS. Keep
    // `token.ends = true` (the default from `exports.ends`) so the
    // splitter pushes the token onto the open-tag stack and waits
    // for a matching `{% endset %}`. Stash the path on `token.args`
    // for the compile handler to consume.
    token.args = path;
    return true;
  }

  // Inline form — flip `token.ends = false` so the splitter does NOT
  // push the token onto the open-tag stack.
  token.ends = false;

  var opTok = consume();
  if (opTok.type !== types.ASSIGNMENT) {
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
 * Emit the IR for either the inline-assignment or body-capture form.
 * Inline form returns the pre-built IRSet via `token.irExpr`. Body form
 * compiles the captured content and wraps it in an IIFE assigned to
 * the target.
 *
 * @param  {Function} compiler   Backend walker (recurses into `content`).
 * @param  {Array}    args       Target path segments (body form only).
 * @param  {Array}    content    Child tokens captured between `{% set %}`
 *                               and `{% endset %}` (body form only).
 * @param  {Array}    parents    Parent template chain (passed through).
 * @param  {object}   options    Compile options (passed through).
 * @param  {?string}  blockName  Enclosing block name (passed through).
 * @param  {object}   token      The tag token. `token.irExpr` is set
 *                               for inline form only.
 * @return {object}   IRSet (inline) or IRLegacyJS (body).
 */
exports.compile = function (compiler, args, content, parents, options, blockName, token) {
  if (token.irExpr) {
    return token.irExpr;
  }
  var path = args;
  var bodyJS = compiler(content, parents, options, blockName);
  return ir.legacyJS(
    '_ctx.' + path.join('.') + ' = (function () {\n' +
    '  var _output = "";\n' +
    bodyJS +
    '  return _output;\n' +
    '})();\n'
  );
};
