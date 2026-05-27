var iterateFilter = require('@rhinostone/swig-core/lib/filters').iterateFilter;

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
