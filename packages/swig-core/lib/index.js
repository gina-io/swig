/**
 * @rhinostone/swig-core — shared IR, backend, and runtime for the swig
 * family of template engines.
 *
 * Phase 1 scaffold. Subsequent commits move security guards, loader
 * contract, filter infra, cache, and the JS-codegen backend in from
 * @rhinostone/swig. See .claude/architecture/multi-flavor-ir.md for
 * the full design.
 */

exports.utils = require('./utils');
exports.security = require('./security');
exports.ir = require('./ir');
