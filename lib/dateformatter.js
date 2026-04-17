/**
 * Phase 3 carve bridge — dateformatter moved to @rhinostone/swig-core.
 *
 * This shim re-exports the swig-core module so every in-repo consumer
 * (`require('./dateformatter')` from lib/swig.js and lib/filters.js)
 * keeps resolving to the same exports object. The mutable `tzOffset`
 * binding set by `swig.setDefaultTZOffset` is the same property on
 * both paths via Node's module cache.
 */

module.exports = require('@rhinostone/swig-core/lib/dateformatter');
