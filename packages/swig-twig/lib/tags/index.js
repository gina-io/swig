/*!
 * Phase 3 Session 7 — Twig per-flavor tag registry.
 *
 * Each tag exports `{ parse, compile, ends, block }` with a Twig-tailored
 * shape:
 *
 *   parse(str, line, parser, types, stack, opts, swig, token) → boolean
 *
 * The 8th `token` argument is the in-progress TagToken. Tag implementations
 * call `parser.parseExpr(lexer.read(str), filters)` directly and attach the
 * resulting IRExpr to `token.irExpr`, then return true. This avoids the
 * native-swig `parser.on(types.X, fn)` callback indirection — Twig tags own
 * their own arg-parsing path.
 *
 * Session 7 begins with an empty registry; subsequent commits within the
 * session add `set` (assignment) and `if` (flow control) to validate the
 * per-flavor shape. Future sessions add `for`, `block`, `extends`,
 * `include`, `import`, `macro`, `apply`, `verbatim`, `with`,
 * `from … import`.
 */

module.exports = {
  'set': require('./set'),
  'if': require('./if'),
  'for': require('./for'),
  'block': require('./block'),
  'extends': require('./extends'),
  'include': require('./include'),
  'macro': require('./macro'),
  'import': require('./import'),
  'verbatim': require('./verbatim'),
  'apply': require('./apply'),
  'from': require('./from')
};
