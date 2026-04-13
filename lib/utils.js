/**
 * Phase 1 carve bridge — utilities moved to @rhinostone/swig-core.
 *
 * This shim re-routes the in-repo relative require so every existing
 * consumer (`require('./utils')` from lib/, `require('../utils')` from
 * lib/tags/ and lib/loaders/, etc.) keeps resolving without churn, and
 * browserify@2 — which predates scoped packages and cannot resolve
 * `@rhinostone/swig-core` — keeps producing an identical browser
 * bundle. Removed when the native frontend restructures into
 * packages/swig/ (Phase 2). See .claude/architecture/multi-flavor-ir.md.
 */

module.exports = require('../packages/swig-core/lib/utils');
