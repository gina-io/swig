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
 * Expression-level parser — Pratt-style recursive descent that consumes
 * Twig lexer tokens and returns swig-core IRExpr nodes.
 *
 * Exposed here so callers can import it from the package entry-point;
 * NOT wired into parse(source) yet (that still throws).
 *
 * @type {object}
 */
exports.parser = require('./parser');

/**
 * Built-in Twig tag registry. See `./tags/index.js` for the per-tag shape.
 *
 * @type {object}
 */
exports.tags = require('./tags');

/**
 * Parse a Twig source string into the parse-tree shape consumed by
 * swig-core's `engine.compile`: `{ name, parent, tokens, blocks }`.
 *
 * Convenience wrapper around `exports.parser.parse(swig, source, options,
 * tags, filters)` — defaults `tags` to the built-in Twig registry and
 * `filters` to an empty map. Callers wiring Twig as a frontend through
 * `engine.install(self, frontend)` should call `exports.parser.parse`
 * directly so the engine's own filter and tag maps flow through.
 *
 * @param  {string} source     Twig template source.
 * @param  {object} [options]  Per-call frontend options
 *                             (`autoescape`, `varControls`, `tagControls`,
 *                             `cmtControls`, `filename`, `tags`, `filters`).
 * @return {object}            `{ name, parent, tokens, blocks }`.
 */
exports.parse = function (source, options) {
  options = options || {};
  var tags = options.tags || exports.tags;
  var filters = options.filters || {};
  return exports.parser.parse(undefined, source, options, tags, filters);
};
