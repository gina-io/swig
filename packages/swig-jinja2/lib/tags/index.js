/*!
 * Jinja2 per-flavor tag registry.
 *
 * Each tag exports `{ parse, compile, ends, block }` with a Jinja2-tailored
 * shape:
 *
 *   parse(str, line, parser, types, stack, opts, swig, token) → boolean
 *
 * The 8th `token` argument is the in-progress TagToken. Tag implementations
 * call `parser.parseExpr(lexer.read(str), filters)` directly and attach the
 * resulting IRExpr to `token.irExpr`, then return true. This avoids the
 * native-swig `parser.on(types.X, fn)` callback indirection — Jinja2 tags
 * own their own arg-parsing path.
 */

module.exports = {};
