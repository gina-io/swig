/**
 * @rhinostone/swig-twig — Twig frontend for the @rhinostone/swig family.
 *
 * Phase 3 scaffold. Subsequent commits add the Twig lexer + parser
 * (source → IR), the Twig filter parity catalog, and the per-flavor
 * tag set. Source-to-IR lowering targets the swig-core IR schema
 * defined in @rhinostone/swig-core/lib/ir; built-in Twig tags lower at
 * parse time rather than registering through the runtime setTag
 * extension point.
 *
 * See .claude/architecture/multi-flavor-ir.md § Phase 3 for the
 * per-flavor split decision and migration sequence.
 */

exports.name = 'twig';

/**
 * Parse a Twig source string into a swig-core IR Template node.
 *
 * @param  {string} source            Twig template source.
 * @param  {object} [options]         Per-call frontend options.
 * @return {object}                   IR Template node — see
 *                                    @rhinostone/swig-core/lib/ir
 *                                    `IRTemplate` typedef.
 * @throws {Error}                    Not yet implemented.
 */
exports.parse = function (source, options) {
  throw new Error('@rhinostone/swig-twig: parse is not yet implemented (Phase 3 scaffold).');
};
