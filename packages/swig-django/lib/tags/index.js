/*!
 * Django per-flavor tag registry.
 *
 * Each tag exports `{ parse, compile, ends, block }` with a Django-tailored
 * shape:
 *
 *   parse(str, line, parser, types, stack, opts, swig, token) → boolean
 *
 * The 8th `token` argument is the in-progress TagToken. Tag implementations
 * call `parser.parseExpr(lexer.read(str), filters)` directly and attach the
 * resulting IRExpr to `token.irExpr`, then return true. This avoids the
 * native-swig `parser.on(types.X, fn)` callback indirection — Django tags
 * own their own arg-parsing path, like the Twig and Jinja2 siblings.
 *
 * Conditionals (if / elif / else) and looping (for / empty) are registered.
 * The remaining inheritance / Django-only tags (block, extends, include,
 * with, autoescape, comment, spaceless, verbatim, cycle, firstof) land in
 * subsequent commits.
 */

module.exports = {
  'if': require('./if'),
  'elif': require('./elif'),
  'else': require('./else'),
  'for': require('./for'),
  'empty': require('./empty')
};
