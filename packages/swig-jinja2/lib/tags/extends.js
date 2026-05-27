/*!
 * Jinja2 `{% extends %}` tag.
 *
 * Declares a parent template for inheritance:
 *
 *   {% extends "layout.html" %}
 *
 * Only static string paths are supported here. Dynamic extends
 * (`{% extends some_var %}`) is rejected at parse time: the engine's
 * parent-chain resolution (`engine.getParents` + `remapBlocks` +
 * `importNonBlocks`) walks the chain statically at compile time, so a
 * runtime-valued parent cannot be resolved on the sync path. Dynamic
 * extends is the async-codegen path's concern, tracked separately.
 *
 * The parser's splitter reads `token.args[0]` and stashes it on
 * `template.parent`. This tag must push the *unquoted* path as the single
 * `token.args` element.
 *
 * Compile emits nothing — `extends` is a parse-time declaration carried via
 * `template.parent` metadata; no runtime code is generated for the tag.
 */

var utils = require('@rhinostone/swig-core/lib/utils');

var lexer = require('../lexer');

exports.ends = false;
exports.block = true;

/**
 * Parse the `{% extends %}` tag body. Extracts the STRING literal path,
 * strips surrounding quotes, and stashes the result as `token.args[0]`.
 * Rejects anything other than a single STRING token.
 *
 * @param  {string} str    Tag body.
 * @param  {number} line   Source line of the opening `{%`.
 * @param  {object} parser The Jinja2 parser module (unused — path is a
 *                         bare string literal).
 * @param  {object} types  Jinja2 lexer token-type enum.
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
 * lives on `template.parent`, which the engine's `getParents` reads during
 * compile. The `{% extends %}` tag itself emits no runtime code.
 *
 * @return {undefined}
 */
exports.compile = function () {};
