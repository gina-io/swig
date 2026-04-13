/**
 * Phase 1 carve bridge — loader aggregator moved to @rhinostone/swig-core.
 *
 * Kept as a relative-path shim so `lib/swig.js`'s `require('./loaders')`
 * keeps resolving and `browserify@2` — which predates scoped packages and
 * cannot resolve `@rhinostone/swig-core` — keeps producing an identical
 * browser bundle. See .claude/architecture/multi-flavor-ir.md.
 */

module.exports = require('../../packages/swig-core/lib/loaders');
