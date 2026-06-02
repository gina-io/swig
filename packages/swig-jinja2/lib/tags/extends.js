/*!
 * Jinja2 `{% extends %}` tag.
 *
 * Declares a parent template for inheritance:
 *
 *   {% extends "layout.html" %}              (static — compile-time)
 *   {% extends parent_var %}                 (dynamic — render-time)
 *   {% extends full if cond else partial %}  (dynamic)
 *
 * A static string-literal path is pushed as the single `token.args`
 * element; the parser's splitter lifts it onto `template.parent`, and the
 * engine's parent-chain resolution (`engine.getParents` + `remapBlocks` +
 * `importNonBlocks`) walks the chain statically at compile time.
 *
 * A dynamic path is lowered through `parser.parseExpr` into an IRExpr and
 * stashed on `token.irExpr.file`; the splitter lifts it onto the sibling
 * `template.parentExpr` slot, which the async codegen path
 * (`buildExtendsDeferred`) prefers over the string literal and resolves at
 * render time via `_swig.getTemplate`. Dynamic extends therefore requires
 * an async loader (`renderFile` with a callback); on the synchronous
 * render path a runtime-valued parent is unresolvable. Mirrors the
 * dynamic-path lowering in `include.js`.
 *
 * Compile emits nothing — `extends` is a parse-time declaration carried via
 * `template.parent` / `template.parentExpr` metadata; no runtime code is
 * generated for the tag.
 */

var utils = require('@rhinostone/swig-core/lib/utils');

var lexer = require('../lexer');

exports.ends = false;
exports.block = true;

/**
 * Parse the `{% extends %}` tag body.
 *
 * A single STRING literal is stashed (quotes stripped) as `token.args[0]`
 * for the splitter to lift onto `template.parent`. Any other expression
 * (VAR, member access, inline-if, ...) is a dynamic path: it is lowered
 * through `parser.parseExpr` into an IRExpr on `token.irExpr.file` (the
 * splitter lifts it onto `template.parentExpr`) and the raw source text is
 * kept on `token.args[0]` so the sync `template.parent` string stays
 * truthy. Mirrors `include.js`.
 *
 * @param  {string} str    Tag body.
 * @param  {number} line   Source line of the opening `{%`.
 * @param  {object} parser The Jinja2 parser module (exposes `parseExpr`).
 * @param  {object} types  Jinja2 lexer token-type enum.
 * @param  {Array}  stack  Open-tag stack (unused — extends has no body).
 * @param  {object} opts   Per-call options (honors `opts.filename`).
 * @param  {object} swig   Swig instance (unused).
 * @param  {object} token  In-progress TagToken. Gets `token.args` (raw or
 *                         unquoted path) and, for a dynamic path,
 *                         `token.irExpr.file` (the lowered IRExpr).
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

  if (pathTok.type === types.STRING) {
    pos += 1;
    while (pos < tokens.length && tokens[pos].type === types.WHITESPACE) { pos += 1; }
    if (pos < tokens.length) {
      utils.throwError('Unexpected token "' + tokens[pos].match + '" after parent path in "extends" tag', line, opts.filename);
    }
    token.args = [pathTok.match.replace(/^['"]|['"]$/g, '')];
    return true;
  }

  // Dynamic path: lower to an IRExpr so it resolves at render time on the
  // async codegen path. The raw source is kept on token.args[0] so the
  // sync template.parent string stays truthy (the async dispatch guard
  // keys on it); buildExtendsDeferred prefers template.parentExpr.
  token.irExpr = { file: parser.parseExpr(tokens) };
  token.args = [utils.strip(str)];
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
