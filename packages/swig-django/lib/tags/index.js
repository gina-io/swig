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
 * Conditionals (if / elif / else), looping (for / empty), template
 * inheritance (block / extends / include), the region tags (with /
 * autoescape / spaceless / comment / verbatim), and the Django-only output
 * tags (cycle / firstof) are registered — the full S3 tag set.
 */

module.exports = {
  'if': require('./if'),
  'elif': require('./elif'),
  'else': require('./else'),
  'for': require('./for'),
  'empty': require('./empty'),
  'block': require('./block'),
  'extends': require('./extends'),
  'include': require('./include'),
  'with': require('./with'),
  'autoescape': require('./autoescape'),
  'spaceless': require('./spaceless'),
  'comment': require('./comment'),
  'verbatim': require('./verbatim'),
  'cycle': require('./cycle'),
  'firstof': require('./firstof')
};
