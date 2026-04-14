/**
 * Phase 1 carve bridge — loader aggregator moved to @rhinostone/swig-core.
 *
 * Kept as a shim so `lib/swig.js`'s `require('./loaders')` keeps resolving.
 * See .claude/architecture/multi-flavor-ir.md.
 */

module.exports = require('@rhinostone/swig-core/lib/loaders');
