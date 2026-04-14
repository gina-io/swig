/**
 * Phase 1 carve bridge — memory loader moved to @rhinostone/swig-core.
 *
 * Kept as a shim so the in-repo consumer (`lib/loaders/index.js` →
 * `require('./memory')`) keeps resolving. See
 * .claude/architecture/multi-flavor-ir.md.
 */

module.exports = require('@rhinostone/swig-core/lib/loaders/memory');
