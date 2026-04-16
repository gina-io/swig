var utils = require('@rhinostone/swig-core/lib/utils'),
  iterateFilter = require('@rhinostone/swig-core/lib/filters').iterateFilter;

/**
 * Twig filter catalog.
 *
 * Per-flavor map consumed by `engine.install(self, frontend)` as both
 * the `_filters` runtime map in the compiled template function and the
 * mutation target for `setFilter`. The `.safe = true` convention is
 * inherited from swig-core — filters marked `.safe` suppress the
 * autoescape `e` tail in `parseVariable`.
 *
 * Filter names route through `_filters["<name>"]` at runtime (bracket
 * access on the engine's own filter map), never through the `_ctx`
 * prototype chain, so CVE-2023-25345 guards don't apply at this layer.
 * Filter arg expressions inherit the expression parser's existing
 * `_dangerousProps` guards.
 *
 * See .claude/architecture/tags-and-filters.md § Filters and
 * .claude/architecture/multi-flavor-ir.md § Filter catalogs stay
 * per-flavor.
 */

/**
 * Get the number of items in an array, string, or object.
 *
 * @example
 * {{ "Tacos"|length }}
 * // => 5
 *
 * @param  {*} input
 * @return {*} The length of the input.
 */
exports.length = function (input) {
  if (typeof input === 'object' && !utils.isArray(input)) {
    var keys = utils.keys(input);
    return keys.length;
  }
  if (input && input.hasOwnProperty('length')) {
    return input.length;
  }
  return '';
};

/**
 * Return the input in all lowercase letters.
 *
 * @example
 * {{ "FOOBAR"|lower }}
 * // => foobar
 *
 * @param  {*} input
 * @return {*} Same type as input, with strings lower-cased.
 */
exports.lower = function (input) {
  var out = iterateFilter.apply(exports.lower, arguments);
  if (out !== undefined) {
    return out;
  }
  return input.toString().toLowerCase();
};

/**
 * Return the input in all uppercase letters.
 *
 * @example
 * {{ "tacos"|upper }}
 * // => TACOS
 *
 * @param  {*} input
 * @return {*} Same type as input, with strings upper-cased.
 */
exports.upper = function (input) {
  var out = iterateFilter.apply(exports.upper, arguments);
  if (out !== undefined) {
    return out;
  }
  return input.toString().toUpperCase();
};

/**
 * Get the first item of an array, character of a string, or first value
 * of an object.
 *
 * @example
 * {{ ["a", "b", "c"]|first }}
 * // => a
 *
 * @param  {*} input
 * @return {*}
 */
exports.first = function (input) {
  if (typeof input === 'object' && !utils.isArray(input)) {
    var keys = utils.keys(input);
    return input[keys[0]];
  }
  if (typeof input === 'string') {
    return input.substr(0, 1);
  }
  return input[0];
};

/**
 * Get the last item of an array, character of a string, or last value
 * of an object.
 *
 * @example
 * {{ ["a", "b", "c"]|last }}
 * // => c
 *
 * @param  {*} input
 * @return {*}
 */
exports.last = function (input) {
  if (typeof input === 'object' && !utils.isArray(input)) {
    var keys = utils.keys(input);
    return input[keys[keys.length - 1]];
  }
  if (typeof input === 'string') {
    return input.charAt(input.length - 1);
  }
  return input[input.length - 1];
};

/**
 * Join an array with a string glue.
 *
 * @example
 * {{ ["foo", "bar", "baz"]|join(", ") }}
 * // => foo, bar, baz
 *
 * @param  {*} input
 * @param  {string} glue
 * @return {string}
 */
exports.join = function (input, glue) {
  if (utils.isArray(input)) {
    return input.join(glue);
  }
  if (typeof input === 'object') {
    var out = [];
    utils.each(input, function (value) {
      out.push(value);
    });
    return out.join(glue);
  }
  return input;
};

/**
 * Reverse an array or string. Unlike swig's `reverse`, this does NOT
 * sort the input first — items come out in reverse input order, matching
 * Twig semantics.
 *
 * @example
 * {{ [1, 2, 3]|reverse|join(",") }}
 * // => 3,2,1
 *
 * @param  {array|string} input
 * @return {array|string}
 */
exports.reverse = function (input) {
  if (utils.isArray(input)) {
    return utils.extend([], input).reverse();
  }
  if (typeof input === 'string') {
    return input.split('').reverse().join('');
  }
  return input;
};

/**
 * Sort an array ascending. Returns a copy — does not mutate the input.
 * If given an object, returns a sorted array of its keys. If given a
 * string, sorts the characters.
 *
 * @example
 * {{ [3, 1, 2]|sort|join(",") }}
 * // => 1,2,3
 *
 * @param  {*} input
 * @return {*}
 */
exports.sort = function (input) {
  if (utils.isArray(input)) {
    return utils.extend([], input).sort();
  }
  if (typeof input === 'string') {
    return input.split('').sort().join('');
  }
  if (typeof input === 'object') {
    return utils.keys(input).sort();
  }
  return input;
};

/**
 * Strip HTML tags from the input.
 *
 * @example
 * {{ "<p>hi</p>"|striptags }}
 * // => hi
 *
 * @param  {*} input
 * @return {*} Same type as input, with strings tag-stripped.
 */
exports.striptags = function (input) {
  var out = iterateFilter.apply(exports.striptags, arguments);
  if (out !== undefined) {
    return out;
  }
  return input.toString().replace(/(<([^>]+)>)/ig, '');
};

/**
 * URL-encode a string. If an array or object is passed, each value is
 * URL-encoded.
 *
 * @example
 * {{ "a=1&b=2"|url_encode }}
 * // => a%3D1%26b%3D2
 *
 * @param  {*} input
 * @return {*}
 */
exports.url_encode = function (input) {
  var out = iterateFilter.apply(exports.url_encode, arguments);
  if (out !== undefined) {
    return out;
  }
  return encodeURIComponent(input);
};

/**
 * JSON-encode the input.
 *
 * @example
 * {{ {"a": 1}|json_encode }}
 * // => {"a":1}
 *
 * @param  {*} input
 * @param  {number} [indent]  Indent width for pretty-printing.
 * @return {string}
 */
exports.json_encode = function (input, indent) {
  return JSON.stringify(input, null, indent || 0);
};

/**
 * Pass the input through untouched, bypassing autoescape.
 *
 * Marked `.safe = true` so the parser suppresses the trailing `e` filter
 * injected for autoescape. Twig calls this filter `raw`; swig calls the
 * same concept `safe` — Twig exposes only the `raw` name.
 *
 * @example
 * {{ "<b>bold</b>"|raw }}
 * // => <b>bold</b>
 *
 * @param  {*} input
 * @return {*}
 */
exports.raw = function (input) {
  return input;
};
exports.raw.safe = true;

/**
 * HTML-escape (default) or JS-escape the input. `e` is a shortcut alias
 * applied by autoescape.
 *
 * @example
 * {{ "<b>"|escape }}
 * // => &lt;b&gt;
 *
 * @example
 * {{ "<b>"|escape("js") }}
 * // => \u003Cb\u003E
 *
 * @param  {*} input
 * @param  {string} [type='html']  Pass `'js'` for JavaScript-safe escaping.
 * @return {string}
 */
exports.escape = function (input, type) {
  var out = iterateFilter.apply(exports.escape, arguments),
    inp = input,
    i = 0,
    code;

  if (out !== undefined) {
    return out;
  }

  if (typeof input !== 'string') {
    return input;
  }

  out = '';

  switch (type) {
  case 'js':
    inp = inp.replace(/\\/g, '\\u005C');
    for (i; i < inp.length; i += 1) {
      code = inp.charCodeAt(i);
      if (code < 32) {
        code = code.toString(16).toUpperCase();
        code = (code.length < 2) ? '0' + code : code;
        out += '\\u00' + code;
      } else {
        out += inp[i];
      }
    }
    return out.replace(/&/g, '\\u0026')
      .replace(/</g, '\\u003C')
      .replace(/>/g, '\\u003E')
      .replace(/\'/g, '\\u0027')
      .replace(/"/g, '\\u0022')
      .replace(/\=/g, '\\u003D')
      .replace(/-/g, '\\u002D')
      .replace(/;/g, '\\u003B');

  default:
    return inp.replace(/&(?!amp;|lt;|gt;|quot;|#39;)/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
};
exports.e = exports.escape;

/**
 * Return the input if it is not "empty"; otherwise return the fallback.
 *
 * Twig's empty-value semantics match the `empty` test: returns the
 * fallback when the input is `undefined`, `null`, `false`, the empty
 * string `""`, an empty array, or an empty plain object. Numeric `0`
 * and the string `"0"` are NOT considered empty and pass through
 * unchanged. Non-empty values pass through as-is.
 *
 * Divergent from native swig, which has no `default` filter.
 *
 * @example
 * {{ missing|default("fallback") }}
 * // => fallback
 *
 * @example
 * {{ ""|default("fallback") }}
 * // => fallback
 *
 * @example
 * {{ 0|default("fallback") }}
 * // => 0
 *
 * @param  {*} input
 * @param  {*} fallback
 * @return {*}
 */
exports['default'] = function (input, fallback) {
  if (input === undefined || input === null || input === false) {
    return fallback;
  }
  if (input === '') {
    return fallback;
  }
  if (utils.isArray(input) && input.length === 0) {
    return fallback;
  }
  if (typeof input === 'object' && utils.keys(input).length === 0) {
    return fallback;
  }
  return input;
};
