var utils = require('@rhinostone/swig-core/lib/utils'),
  iterateFilter = require('@rhinostone/swig-core/lib/filters').iterateFilter;

/**
 * Jinja2 filter catalog.
 *
 * Per-flavor map consumed by `engine.install(self, frontend)` as both the
 * `_filters` runtime map in the compiled template function and the
 * mutation target for `setFilter`. The `.safe = true` convention is
 * inherited from swig-core — filters marked `.safe` suppress the
 * autoescape `e` tail injected in the parser's `parseVariable`.
 *
 * Filter names route through `_filters["<name>"]` at runtime (bracket
 * access on the engine's own filter map), never through the `_ctx`
 * prototype chain, so CVE-2023-25345 guards don't apply at this layer.
 * Filter arg expressions inherit the expression parser's `_dangerousProps`
 * guards.
 *
 * This is the bootstrap set (escape / safe + a couple of basics) that the
 * render pipeline needs to function. The full Jinja2 catalog lands in
 * subsequent commits.
 */

/**
 * Uppercase the input. Recurses into arrays / objects.
 *
 * @example
 * {{ "swig"|upper }}
 * // => SWIG
 *
 * @param  {*} input
 * @return {*}
 */
exports.upper = function (input) {
  var out = iterateFilter.apply(exports.upper, arguments);
  if (out !== undefined) {
    return out;
  }
  return input.toString().toUpperCase();
};

/**
 * Lowercase the input. Recurses into arrays / objects.
 *
 * @example
 * {{ "SWIG"|lower }}
 * // => swig
 *
 * @param  {*} input
 * @return {*}
 */
exports.lower = function (input) {
  var out = iterateFilter.apply(exports.lower, arguments);
  if (out !== undefined) {
    return out;
  }
  return input.toString().toLowerCase();
};

/**
 * Mark the input as safe, bypassing autoescape. Jinja2 calls this filter
 * `safe`; the value passes through untouched.
 *
 * @example
 * {{ "<b>bold</b>"|safe }}
 * // => <b>bold</b>
 *
 * @param  {*} input
 * @return {*}
 */
exports.safe = function (input) {
  return input;
};
exports.safe.safe = true;

/**
 * HTML-escape (default) or JS-escape the input. `e` is the shortcut alias
 * applied by autoescape. The HTML branch preserves already-escaped
 * entities (`&amp;`, `&lt;`, …) so the autoescape tail is idempotent.
 *
 * @example
 * {{ "<b>"|escape }}
 * // => &lt;b&gt;
 *
 * @example
 * {{ "<b>"|e("js") }}
 * // => <b>
 *
 * @param  {*}      input
 * @param  {string} [type='html']  Pass `'js'` for JavaScript-safe escaping.
 * @return {string}
 */
function escapeHtmlRest(ch) {
  return ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '"' ? '&quot;' : '&#39;';
}

exports.escape = function (input, type) {
  var t, inp, out, i, code;

  if (input === null || input === undefined) {
    return input;
  }

  t = typeof input;

  if (t !== 'string') {
    if (t === 'object') {
      out = iterateFilter.apply(exports.escape, arguments);
      if (out !== undefined) {
        return out;
      }
    }
    return input;
  }

  if (type === 'js') {
    inp = input.replace(/\\/g, '\\u005C');
    out = '';
    for (i = 0; i < inp.length; i += 1) {
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
  }

  return input.replace(/&(?!amp;|lt;|gt;|quot;|#39;)/g, '&amp;')
    .replace(/[<>"']/g, escapeHtmlRest);
};
exports.e = exports.escape;

/**
 * Return the number of items in a sequence (array, string) or the number
 * of keys in a mapping (object). `count` is an alias.
 *
 * @example
 * {{ "Tacos"|length }}
 * // => 5
 *
 * @param  {*} input
 * @return {number|string} The length, or "" when the input has none.
 */
exports.length = function (input) {
  if (typeof input === 'object' && input !== null && !utils.isArray(input)) {
    return utils.keys(input).length;
  }
  if (input && input.hasOwnProperty('length')) {
    return input.length;
  }
  return '';
};

/**
 * Alias of `length`.
 *
 * @example
 * {{ items|count }}
 * // => 3
 *
 * @param  {*} input
 * @return {number|string}
 */
exports.count = exports.length;

/**
 * Return the first item of an array, the first character of a string, or
 * the first value of an object.
 *
 * @example
 * {{ ["a", "b", "c"]|first }}
 * // => a
 *
 * @param  {*} input
 * @return {*}
 */
exports.first = function (input) {
  if (typeof input === 'object' && input !== null && !utils.isArray(input)) {
    var keys = utils.keys(input);
    return input[keys[0]];
  }
  if (typeof input === 'string') {
    return input.substr(0, 1);
  }
  if (utils.isArray(input)) {
    return input[0];
  }
  return input;
};

/**
 * Return the last item of an array, the last character of a string, or
 * the last value of an object.
 *
 * @example
 * {{ ["a", "b", "c"]|last }}
 * // => c
 *
 * @param  {*} input
 * @return {*}
 */
exports.last = function (input) {
  if (typeof input === 'object' && input !== null && !utils.isArray(input)) {
    var keys = utils.keys(input);
    return input[keys[keys.length - 1]];
  }
  if (typeof input === 'string') {
    return input.charAt(input.length - 1);
  }
  if (utils.isArray(input)) {
    return input[input.length - 1];
  }
  return input;
};

/**
 * Join a sequence with a string glue. The default glue is the empty
 * string (Jinja2 default), not a comma. A mapping joins its keys.
 *
 * @example
 * {{ ["foo", "bar", "baz"]|join(", ") }}
 * // => foo, bar, baz
 *
 * @example
 * {{ [1, 2, 3]|join }}
 * // => 123
 *
 * @param  {*}      input
 * @param  {string} [glue='']
 * @return {string}
 */
exports.join = function (input, glue) {
  if (glue === undefined) { glue = ''; }
  if (utils.isArray(input)) {
    return input.join(glue);
  }
  if (input && typeof input === 'object') {
    return utils.keys(input).join(glue);
  }
  return input;
};

/**
 * Reverse an array or string. Does not sort — items come out in reverse
 * input order.
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
 * Sort an array ascending, returning a copy (does not mutate the input).
 * Numbers sort numerically; everything else compares case-insensitively.
 * A string sorts its characters; an object sorts its keys. Pass a truthy
 * first argument to sort descending.
 *
 * @example
 * {{ [3, 1, 2]|sort|join(",") }}
 * // => 1,2,3
 *
 * @example
 * {{ [3, 1, 2]|sort(true)|join(",") }}
 * // => 3,2,1
 *
 * @param  {*}       input
 * @param  {boolean} [reverse=false]  Sort descending when truthy.
 * @return {*}
 */
exports.sort = function (input, reverse) {
  var arr, isString = false;
  if (utils.isArray(input)) {
    arr = utils.extend([], input);
  } else if (typeof input === 'string') {
    arr = input.split('');
    isString = true;
  } else if (input && typeof input === 'object') {
    arr = utils.keys(input);
  } else {
    return input;
  }
  arr.sort(function (a, b) {
    if (typeof a === 'number' && typeof b === 'number') { return a - b; }
    var sa = String(a).toLowerCase(), sb = String(b).toLowerCase();
    return sa < sb ? -1 : sa > sb ? 1 : 0;
  });
  if (reverse) { arr.reverse(); }
  return isString ? arr.join('') : arr;
};
