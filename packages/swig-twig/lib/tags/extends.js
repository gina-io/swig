/*!
 * Phase 3 Session 9 — Twig `{% extends %}` tag.
 *
 * Declares a parent template for inheritance:
 *
 *   {% extends "layout.twig" %}
 *
 * Twig supports both static string paths (handled here) and dynamic
 * expressions (`{% extends some_var %}`, `{% extends a ? b : c %}`). This
 * session rejects dynamic extends at parse time — the engine's parent-
 * chain resolution (`engine.getParents` + `remapBlocks` +
 * `importNonBlocks`) walks the chain statically at compile time, so a
 * runtime-valued parent cannot be resolved without reworking the engine.
 * Dynamic extends is tracked for a later session; the rejection is
 * deliberate, not an oversight.
 *
 * The parser's splitter reads `token.args[0]` and stashes it on
 * `template.parent` (see `packages/swig-twig/lib/parser.js` line 609).
 * This tag must therefore push the *unquoted* path as the single
 * `token.args` element.
 *
 * Compile emits nothing — `extends.compile` returns undefined. The
 * backend's emit loop skips undefined returns. Extends is a parse-time
 * declaration carried via `template.parent` metadata; no runtime code
 * is generated for the `{% extends %}` tag itself.
 */

var utils = require('@rhinostone/swig-core/lib/utils');

var lexer = require('../lexer');
var _t = require('../tokentypes');

exports.ends = false;
exports.block = true;

/**
 * Parse the `{% extends %}` tag body. Extracts the STRING literal path,
 * strips surrounding quotes, and stashes the result as `token.args[0]`
 * for the parser's splitter to pick up.
 *
 * Rejects anything other than a single STRING token — dynamic extends
 * (VAR, FUNCTION, expressions) is not supported in this session.
 *
 * @param  {string} str    Tag body.
 * @param  {number} line   Source line of the opening `{%`.
 * @param  {object} parser The Twig parser module (unused — path is a
 *                         bare string literal).
 * @param  {object} types  Twig lexer token-type enum.
 * @param  {Array}  stack  Open-tag stack (unused — extends has no body).
 * @param  {object} opts   Per-call options (honors `opts.filename`).
 * @param  {object} swig   Swig instance (unused).
 * @param  {object} token  In-progress TagToken. `token.args` gets the
 *                         unquoted parent path as its single element.
 * @return {boolean}       Always `true` on success. Throws otherwise.
 */
exports.parse = function (str, line, parser, types, stack, opts, swig, token) {
  var tokens = lexer.read(utils.strip(str));
  var pos = 0;

  while (pos < tokens.length && tokens[pos].type === types.WHITESPACE) { pos += 1; }
  var pathTok = pos < tokens.length ? tokens[pos] : null;
  if (!pathTok) {
    utils.throwError('Expected parent template path in "extends" tag', line, opts.filename);
  }
  if (pathTok.type !== types.STRING) {
    utils.throwError('Dynamic "extends" is not supported — parent path must be a string literal', line, opts.filename);
  }

  pos += 1;
  while (pos < tokens.length && tokens[pos].type === types.WHITESPACE) { pos += 1; }
  if (pos < tokens.length) {
    utils.throwError('Unexpected token "' + tokens[pos].match + '" after parent path in "extends" tag', line, opts.filename);
  }

  token.args = [pathTok.match.replace(/^['"]|['"]$/g, '')];
  return true;
};

/**
 * No-op compile. Extends is a parse-time declaration — the parent path
 * lives on `template.parent` (set by the parser's splitter), which the
 * engine's `getParents` reads during compile. The `{% extends %}` tag
 * itself emits no runtime code.
 *
 * @return {undefined}
 */
exports.compile = function () {};
