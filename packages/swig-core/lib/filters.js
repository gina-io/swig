var utils = require('./utils');

/**
 * Filter infrastructure shared across @rhinostone/swig-family frontends.
 *
 * `iterateFilter` and the `.safe` flag convention live
 * here so every flavor's filter catalog (native Swig, Twig, Jinja2,
 * Django) picks up identical recursion + autoescape-bypass semantics.
 * Filter catalogs themselves stay per-flavor.
 */

/**
 * Recursively run a filter across an object/array and apply it to all
 * of the object/array's values. Used by the built-in filter catalog so
 * that e.g. `{{ arr|upper }}` upper-cases every string element.
 *
 * Call sites invoke this with `this` bound to the filter function via
 * `iterateFilter.apply(exports.myFilter, arguments)`. Returning
 * `undefined` signals "input is scalar — caller should handle it". An
 * undefined or null input gives an empty string, as a variable holding one
 * does, so a filter after a filter or a call that found nothing renders
 * nothing instead of failing on it.
 *
 * @param  {*} input
 * @return {*}
 */
exports.iterateFilter = function iterateFilter(input) {
  var self = this,
    out = {};

  if (input === undefined || input === null) {
    return '';
  }

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

/**
 * Text of a filter input: an empty string for undefined or null, `String(input)`
 * for anything else. For the filters that do not go through `iterateFilter`.
 *
 * @param  {*} input
 * @return {string}
 */
exports.asText = function asText(input) {
  return (input === undefined || input === null) ? '' : String(input);
};
