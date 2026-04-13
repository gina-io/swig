var utils = require('./utils');

/**
 * Filter infrastructure shared across @rhinostone/swig-family frontends.
 *
 * Phase 1 carve — `iterateFilter` and the `.safe` flag convention live
 * here so every flavor's filter catalog (native Swig, Twig, Jinja2,
 * Django) picks up identical recursion + autoescape-bypass semantics.
 * Filter catalogs themselves stay per-flavor. See
 * .claude/architecture/multi-flavor-ir.md.
 */

/**
 * Recursively run a filter across an object/array and apply it to all
 * of the object/array's values. Used by the built-in filter catalog so
 * that e.g. `{{ arr|upper }}` upper-cases every string element.
 *
 * Call sites invoke this with `this` bound to the filter function via
 * `iterateFilter.apply(exports.myFilter, arguments)`. Returning
 * `undefined` signals "input is scalar — caller should handle it".
 *
 * @param  {*} input
 * @return {*}
 */
exports.iterateFilter = function iterateFilter(input) {
  var self = this,
    out = {};

  if (utils.isArray(input)) {
    return utils.map(input, function (value) {
      return self.apply(null, arguments);
    });
  }

  if (typeof input === 'object') {
    utils.each(input, function (value, key) {
      out[key] = self.apply(null, arguments);
    });
    return out;
  }

  return;
};
