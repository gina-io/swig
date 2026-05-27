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

/*!
 * Resolve a possibly-dotted attribute path against an object. Returns
 * undefined if any segment is missing. @private
 */
function resolveAttr(obj, path) {
  var segs = String(path).split('.'), cur = obj, i;
  for (i = 0; i < segs.length; i += 1) {
    if (cur === null || cur === undefined) { return undefined; }
    cur = cur[segs[i]];
  }
  return cur;
}

/**
 * Return the input, or a default value when the input is undefined, null,
 * or the empty string. (A missing variable arrives here as "" because the
 * engine coerces undefined variable lookups, so the empty string counts as
 * "needs a default".) Real falsy values 0 and false are preserved. Pass a
 * truthy second-after argument to fall back on any falsy value instead.
 * `d` is an alias.
 *
 * @example
 * {{ missing|default("anonymous") }}
 * // => anonymous
 *
 * @example
 * {{ 0|default("n/a", true) }}
 * // => n/a
 *
 * @param  {*}       input
 * @param  {*}       [def='']
 * @param  {boolean} [bool=false]  Fall back on any falsy value when truthy.
 * @return {*}
 */
exports['default'] = function (input, def, bool) {
  if (def === undefined) { def = ''; }
  if (bool) {
    return input ? input : def;
  }
  return (input === undefined || input === null || input === '') ? def : input;
};
exports.d = exports['default'];

/**
 * Absolute value of a number.
 *
 * @example
 * {{ -42|abs }}
 * // => 42
 *
 * @param  {number} input
 * @return {number}
 */
exports.abs = function (input) {
  var n = Number(input);
  return isNaN(n) ? input : Math.abs(n);
};

/**
 * Round a number to a given precision. Method is `"common"` (round half
 * away from zero, the default), `"ceil"`, or `"floor"`.
 *
 * @example
 * {{ 42.55|round(1) }}
 * // => 42.6
 *
 * @example
 * {{ 42.55|round(1, "floor") }}
 * // => 42.5
 *
 * @param  {number} input
 * @param  {number} [precision=0]
 * @param  {string} [method='common']
 * @return {number}
 */
exports.round = function (input, precision, method) {
  var n = Number(input);
  if (isNaN(n)) { return input; }
  var factor = Math.pow(10, precision || 0);
  n = n * factor;
  if (method === 'ceil') {
    n = Math.ceil(n);
  } else if (method === 'floor') {
    n = Math.floor(n);
  } else {
    n = (n < 0) ? -Math.round(-n) : Math.round(n);
  }
  return n / factor;
};

/**
 * Convert the input to an integer, returning a default (0) when the
 * conversion fails. A non-decimal base may be given as the third argument.
 *
 * @example
 * {{ "42.7"|int }}
 * // => 42
 *
 * @param  {*}      input
 * @param  {number} [def=0]
 * @param  {number} [base=10]
 * @return {number}
 */
exports.int = function (input, def, base) {
  if (def === undefined) { def = 0; }
  var n = parseInt(input, base || 10);
  return isNaN(n) ? def : n;
};

/**
 * Convert the input to a floating-point number, returning a default (0)
 * when the conversion fails.
 *
 * @example
 * {{ "42.5"|float }}
 * // => 42.5
 *
 * @param  {*}      input
 * @param  {number} [def=0]
 * @return {number}
 */
exports.float = function (input, def) {
  if (def === undefined) { def = 0; }
  var n = parseFloat(input);
  return isNaN(n) ? def : n;
};

/**
 * Truncate a string to a length, appending an ellipsis when cut. By
 * default the cut falls back to the last word boundary; pass a truthy
 * third argument to cut mid-word. Strings within `leeway` characters of
 * the limit are left whole.
 *
 * @example
 * {{ "foo bar baz qux"|truncate(9) }}
 * // => foo...
 *
 * @param  {*}       input
 * @param  {number}  [length=255]
 * @param  {boolean} [killwords=false]
 * @param  {string}  [end='...']
 * @param  {number}  [leeway=5]
 * @return {string}
 */
exports.truncate = function (input, length, killwords, end, leeway) {
  input = String(input);
  length = length || 255;
  if (end === undefined) { end = '...'; }
  if (leeway === undefined) { leeway = 5; }
  if (input.length <= length + leeway) {
    return input;
  }
  var truncated = input.substr(0, length - end.length);
  if (!killwords) {
    var lastSpace = truncated.lastIndexOf(' ');
    if (lastSpace !== -1) {
      truncated = truncated.substr(0, lastSpace);
    }
  }
  return truncated + end;
};

/**
 * Serialize the input to a JSON string, escaping the HTML-significant
 * characters (`<`, `>`, `&`, `'`) so the result is safe to embed in a
 * page. Marked `.safe`, so the autoescape tail does not double-escape it.
 *
 * @example
 * {{ {"a": 1}|tojson }}
 * // => {"a":1}
 *
 * @param  {*}      input
 * @param  {number} [indent]  Spaces of indentation for pretty output.
 * @return {string}
 */
exports.tojson = function (input, indent) {
  var json = JSON.stringify(input, null, indent || undefined);
  if (json === undefined) {
    return '';
  }
  return json
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/'/g, '\\u0027');
};
exports.tojson.safe = true;

/**
 * Group a sequence of objects by a (possibly dotted) attribute, returning
 * a list of `{ grouper, list }` records sorted by grouper.
 *
 * @example
 * {% for g in users|groupby("dept") %}{{ g.grouper }}:{{ g.list|length }} {% endfor %}
 *
 * @param  {Array}  input
 * @param  {string} attribute
 * @return {Array}  List of `{ grouper, list }`.
 */
exports.groupby = function (input, attribute) {
  if (!utils.isArray(input)) {
    return input;
  }
  var groups = {}, order = [];
  utils.each(input, function (item) {
    var key = resolveAttr(item, attribute);
    if (!groups.hasOwnProperty(key)) {
      groups[key] = [];
      order.push(key);
    }
    groups[key].push(item);
  });
  order.sort();
  return utils.map(order, function (key) {
    return { grouper: key, list: groups[key] };
  });
};

/**
 * Title-case the input: every word starts with an uppercase letter and the
 * rest are lowercased. Word boundaries are whitespace and any of
 * `- ( [ { <` (matching Jinja2's `title`), so `foo-bar` becomes `Foo-Bar`
 * but an apostrophe does not split a word (`don't` => `Don't`). Recurses
 * into arrays / objects.
 *
 * @example
 * {{ "hello world"|title }}
 * // => Hello World
 *
 * @param  {*} input
 * @return {*}
 */
exports.title = function (input) {
  var out = iterateFilter.apply(exports.title, arguments),
    parts,
    res,
    item,
    i;
  if (out !== undefined) {
    return out;
  }
  parts = String(input).split(/([-\s(\[{<]+)/);
  res = '';
  for (i = 0; i < parts.length; i += 1) {
    item = parts[i];
    if (!item) {
      continue;
    }
    res += item.charAt(0).toUpperCase() + item.substr(1).toLowerCase();
  }
  return res;
};

/**
 * Capitalize the input: uppercase the first character, lowercase the rest.
 * Recurses into arrays / objects.
 *
 * @example
 * {{ "hello WORLD"|capitalize }}
 * // => Hello world
 *
 * @param  {*} input
 * @return {*}
 */
exports.capitalize = function (input) {
  var out = iterateFilter.apply(exports.capitalize, arguments);
  if (out !== undefined) {
    return out;
  }
  input = input.toString();
  return input.charAt(0).toUpperCase() + input.substr(1).toLowerCase();
};

/**
 * Strip SGML/XML tags (and HTML comments) from the input, then collapse
 * runs of whitespace to a single space and trim the ends — matching
 * Jinja2's `striptags`. Recurses into arrays / objects.
 *
 * @example
 * {{ "<p>hello   world</p>"|striptags }}
 * // => hello world
 *
 * @param  {*} input
 * @return {*}
 */
exports.striptags = function (input) {
  var out = iterateFilter.apply(exports.striptags, arguments);
  if (out !== undefined) {
    return out;
  }
  return String(input)
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .replace(/^\s+|\s+$/g, '');
};

/**
 * Strip leading and trailing characters from a string. With no argument
 * the stripped set is whitespace; pass a string of characters to strip
 * those instead (Jinja2's `trim`). Both ends are always stripped.
 *
 * @example
 * {{ "  hello  "|trim }}
 * // => hello
 *
 * @example
 * {{ "xxhixx"|trim("x") }}
 * // => hi
 *
 * @param  {*}      input
 * @param  {string} [chars]  Characters to strip; defaults to whitespace.
 * @return {*}
 */
exports.trim = function (input, chars) {
  var pattern;
  if (typeof input !== 'string') {
    return input;
  }
  if (chars === undefined || chars === null || chars === '') {
    pattern = '\\s';
  } else {
    pattern = '[' + String(chars).replace(/[\\\[\]\^\-]/g, '\\$&') + ']';
  }
  return input
    .replace(new RegExp('^' + pattern + '+'), '')
    .replace(new RegExp(pattern + '+$'), '');
};
