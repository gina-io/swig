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
/**
 * Extract a slice of a string or array.
 *
 * Mirrors Twig's `slice` and PHP's `array_slice` / `substr` semantics:
 * negative `start` counts from the end; `length` omitted or null slices
 * to the end; negative `length` stops that many elements from the end.
 * Non-string non-array input passes through unchanged.
 *
 * @example
 * {{ "Hello, World"|slice(7, 5) }}
 * // => World
 *
 * @example
 * {{ [1, 2, 3, 4, 5]|slice(-2)|join(",") }}
 * // => 4,5
 *
 * @param  {string|array} input
 * @param  {number} start
 * @param  {number} [length]
 * @return {string|array}
 */
exports.slice = function (input, start, length) {
  if (input === null || input === undefined) {
    return input;
  }
  var isStr = typeof input === 'string';
  var isArr = utils.isArray(input);
  if (!isStr && !isArr) {
    return input;
  }
  var len = input.length;
  var s = start < 0 ? Math.max(0, len + start) : Math.min(start, len);
  var e;
  if (length === undefined || length === null) {
    e = len;
  } else if (length < 0) {
    e = Math.max(s, len + length);
  } else {
    e = Math.min(s + length, len);
  }
  return input.slice(s, e);
};

/**
 * Split a string into an array on a delimiter.
 *
 * Mirrors Twig's `split` filter and PHP's `explode` / `str_split`:
 * positive `limit` caps the number of returned pieces (last piece
 * absorbs the remainder); negative `limit` drops that many pieces
 * from the tail; zero or omitted `limit` splits without a cap.
 * An empty delimiter splits by character — with a positive `limit`,
 * each chunk is `limit` characters wide (last chunk may be shorter).
 *
 * @example
 * {{ "one,two,three"|split(",") }}
 * // => ["one","two","three"]
 *
 * @example
 * {{ "one,two,three,four"|split(",", 3) }}
 * // => ["one","two","three,four"]
 *
 * @param  {string} input
 * @param  {string} delimiter
 * @param  {number} [limit]
 * @return {string[]}
 */
exports.split = function (input, delimiter, limit) {
  if (typeof input !== 'string') {
    return input;
  }
  if (delimiter === '') {
    if (limit === undefined || limit === null || limit <= 1) {
      return input.split('');
    }
    var out = [];
    var i = 0;
    while (i < input.length) {
      out.push(input.substr(i, limit));
      i += limit;
    }
    return out;
  }
  if (limit === undefined || limit === null || limit === 0) {
    return input.split(delimiter);
  }
  if (limit > 0) {
    var parts = input.split(delimiter);
    if (parts.length <= limit) {
      return parts;
    }
    var head = parts.slice(0, limit - 1);
    head.push(parts.slice(limit - 1).join(delimiter));
    return head;
  }
  var all = input.split(delimiter);
  return all.slice(0, Math.max(0, all.length + limit));
};

/**
 * Group an array (or object values) into chunks of `size` items. When
 * a `fill` value is provided, the last chunk is padded to `size` with
 * it; otherwise the tail runs shorter.
 *
 * @example
 * {{ ['a','b','c','d','e']|batch(2) }}
 * // => [['a','b'],['c','d'],['e']]
 *
 * @example
 * {{ ['a','b','c','d','e']|batch(2, '*') }}
 * // => [['a','b'],['c','d'],['e','*']]
 *
 * @param  {array|object} input
 * @param  {number} size
 * @param  {*} [fill]
 * @return {array}
 */
exports.batch = function (input, size, fill) {
  var items;
  if (utils.isArray(input)) {
    items = input;
  } else if (input && typeof input === 'object') {
    items = [];
    utils.each(input, function (v) { items.push(v); });
  } else {
    return [];
  }
  var n = Number(size);
  if (!isFinite(n) || n <= 0) {
    return [];
  }
  n = Math.ceil(n);
  var out = [];
  var i = 0;
  while (i < items.length) {
    out.push(items.slice(i, i + n));
    i += n;
  }
  if (fill !== undefined && out.length > 0) {
    var last = out[out.length - 1];
    while (last.length < n) {
      last.push(fill);
    }
  }
  return out;
};

/**
 * Strip whitespace (or a custom character set) from both ends of a
 * string. Mirrors Twig's `trim` filter and PHP's `trim` / `ltrim` /
 * `rtrim`: passing `side` as `"left"` or `"right"` strips only the
 * leading or trailing end; the default `"both"` strips both sides.
 *
 * @example
 * {{ "  hi  "|trim }}
 * // => "hi"
 *
 * @example
 * {{ "--hi--"|trim("-", "right") }}
 * // => "--hi"
 *
 * @param  {string} input
 * @param  {string} [chars]          Characters to strip (default: whitespace).
 * @param  {string} [side='both']    `"left"`, `"right"`, or `"both"`.
 * @return {string}
 */
exports.trim = function (input, chars, side) {
  if (typeof input !== 'string') {
    return input;
  }
  var pattern;
  if (chars === undefined || chars === null || chars === '') {
    pattern = '\\s';
  } else {
    pattern = '[' + chars.replace(/[\\\[\]\^\-]/g, '\\$&') + ']';
  }
  var out = input;
  if (side !== 'right') {
    out = out.replace(new RegExp('^' + pattern + '+'), '');
  }
  if (side !== 'left') {
    out = out.replace(new RegExp(pattern + '+$'), '');
  }
  return out;
};

/**
 * Format a number with grouped thousands and a fixed number of decimals.
 *
 * Mirrors Twig's `number_format` filter and PHP's `number_format`:
 * rounds to `decimals` places, inserts `thousand_sep` every three
 * integer digits, and joins the fractional part with `decimal_point`.
 * Defaults: 0 decimals, `"."` decimal point, `","` thousand separator.
 *
 * Non-finite input (NaN, Infinity) passes through unchanged; non-numeric
 * input is coerced via `Number(input)` — callers expecting string
 * passthrough should pre-check.
 *
 * @example
 * {{ 9800.333|number_format(2, ".", ",") }}
 * // => 9,800.33
 *
 * @example
 * {{ 1234567|number_format }}
 * // => 1,234,567
 *
 * @param  {number} input
 * @param  {number} [decimals=0]
 * @param  {string} [decimalPoint="."]
 * @param  {string} [thousandSep=","]
 * @return {string}
 */
exports.number_format = function (input, decimals, decimalPoint, thousandSep) {
  var num = Number(input);
  if (!isFinite(num)) {
    return input;
  }
  var d = (decimals === undefined) ? 0 : decimals;
  var dp = (decimalPoint === undefined) ? '.' : decimalPoint;
  var ts = (thousandSep === undefined) ? ',' : thousandSep;
  var fixed = num.toFixed(d);
  var parts = fixed.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ts);
  return parts.join(dp);
};

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

/**
 * Return the keys of an array or object as an array.
 *
 * For an array, returns the integer indices (`0, 1, 2, ...`). For an
 * object, returns the own enumerable keys. For any other input (string,
 * number, null, undefined), returns an empty array.
 *
 * @example
 * {{ [10, 20, 30]|keys|join(",") }}
 * // => 0,1,2
 *
 * @example
 * {{ {"a": 1, "b": 2}|keys|join(",") }}
 * // => a,b
 *
 * @param  {*}        input
 * @return {Array}
 */
exports.keys = function (input) {
  if (utils.isArray(input)) {
    var out = [];
    for (var i = 0; i < input.length; i += 1) {
      out.push(i);
    }
    return out;
  }
  if (input && typeof input === 'object') {
    return utils.keys(input);
  }
  return [];
};
