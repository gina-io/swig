var utils = require('@rhinostone/swig-core/lib/utils'),
  iterateFilter = require('@rhinostone/swig-core/lib/filters').iterateFilter;

/**
 * Django filter catalog.
 *
 * Per-flavor map consumed by `engine.install(self, frontend)` as both the
 * `_filters` runtime map in the compiled template function and the mutation
 * target for `setFilter`. The `.safe = true` convention is inherited from
 * swig-core — filters marked `.safe` suppress the autoescape `e` tail
 * injected in the parser's `parseVariable`.
 *
 * Filter names route through `_filters["<name>"]` at runtime (bracket access
 * on the engine's own filter map), never through the `_ctx` prototype chain,
 * so CVE-2023-25345 guards don't apply at this layer. Filter argument
 * expressions inherit the expression parser's `_dangerousProps` guards.
 *
 * This is the bootstrap set (escape / safe + a handful of basics) the render
 * pipeline needs to function. The full Django built-in catalog
 * (capfirst / default_if_none / date / floatformat / pluralize / yesno /
 * truncatechars / linebreaks / …) lands in a subsequent commit.
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
 * Mark the input as safe, bypassing autoescape. Django's `safe` filter; the
 * value passes through untouched.
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
 * applied by autoescape. The HTML branch preserves already-escaped entities
 * (`&amp;`, `&lt;`, …) so the autoescape tail is idempotent. Mirrors
 * Django's HTML escaping of `< > & " '`.
 *
 * @example
 * {{ "<b>"|escape }}
 * // => &lt;b&gt;
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
 * Return the number of items in a sequence (array, string) or the number of
 * keys in a mapping (object).
 *
 * @example
 * {{ "Tacos"|length }}
 * // => 5
 *
 * @param  {*} input
 * @return {number} The length, or 0 when the input has none (Django returns
 *                  0 for a value with no length).
 */
exports.length = function (input) {
  if (typeof input === 'object' && input !== null && !utils.isArray(input)) {
    return utils.keys(input).length;
  }
  if (input && input.hasOwnProperty('length')) {
    return input.length;
  }
  return 0;
};

/**
 * If the value is falsy, use the given default. Django's truthiness applies:
 * `False`, `0`, `''`, `None`, an empty list, and an empty mapping are all
 * falsy, so they fall back to the argument.
 *
 * @example
 * {{ ""|default:"nothing" }}
 * // => nothing
 *
 * @param  {*} input
 * @param  {*} def    Fallback value.
 * @return {*}
 */
exports['default'] = function (input, def) {
  if (input === undefined || input === null || input === false || input === 0 || input === '') {
    return def;
  }
  if (utils.isArray(input) && input.length === 0) {
    return def;
  }
  if (typeof input === 'object' && utils.keys(input).length === 0) {
    return def;
  }
  return input;
};

/**
 * Add the argument to the value. Tries numeric addition first (Django's
 * `int(value) + int(arg)`); on failure falls back to direct
 * concatenation for strings / arrays, then to "".
 *
 * @example
 * {{ 4|add:2 }}
 * // => 6
 *
 * @param  {*} input
 * @param  {*} arg
 * @return {*}
 */
exports.add = function (input, arg) {
  var a = parseInt(input, 10),
    b = parseInt(arg, 10);
  if (!isNaN(a) && !isNaN(b) && String(input).trim() === String(a) && String(arg).trim() === String(b)) {
    return a + b;
  }
  if (utils.isArray(input) && utils.isArray(arg)) {
    return input.concat(arg);
  }
  try {
    return input + arg;
  } catch (e) {
    return '';
  }
};

/**
 * Join a list with a string. Django's `join` filter.
 *
 * @example
 * {{ list|join:", " }}
 * // => a, b, c
 *
 * @param  {*}      input
 * @param  {string} [glue=""]  Separator string.
 * @return {*}
 */
exports.join = function (input, glue) {
  if (utils.isArray(input)) {
    return input.join(glue !== undefined ? glue : '');
  }
  return input;
};
