/**
 * Phase 1 carve bridge — memory loader moved to @rhinostone/swig-core.
 *
 * Kept as a relative-path shim so the in-repo consumer
 * (`lib/loaders/index.js` → `require('./memory')`) keeps resolving and
 * `browserify@2` — which predates scoped packages and cannot resolve
 * `@rhinostone/swig-core` — keeps producing an identical browser bundle.
 * See .claude/architecture/multi-flavor-ir.md.
 */

module.exports = require('../../packages/swig-core/lib/loaders/memory');
