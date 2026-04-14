/**
 * Phase 1 carve bridge — utilities moved to @rhinostone/swig-core.
 *
 * This shim re-routes the in-repo consumer requires (`require('./utils')`
 * from lib/, `require('../utils')` from lib/tags/ and lib/loaders/) so
 * every call site keeps resolving without churn. Removed when the native
 * frontend restructures into packages/swig/ (Phase 2). See
 * .claude/architecture/multi-flavor-ir.md.
 */

module.exports = require('@rhinostone/swig-core/lib/utils');
