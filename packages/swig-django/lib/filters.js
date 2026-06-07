var utils = require('@rhinostone/swig-core/lib/utils'),
  dateFormatter = require('@rhinostone/swig-core/lib/dateformatter'),
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
 * Fidelity notes (cross-checked against Django 5.2 `defaultfilters.py`):
 *
 * - **`.safe` vs Django `is_safe`.** Django's `is_safe=True` does NOT bypass
 *   autoescape — it only means the filter preserves an already-safe input.
 *   Only filters that Django wraps in `mark_safe()` (always returning trusted
 *   markup) get `.safe = true` here: `safe`, `escapejs`, `force_escape`,
 *   `linebreaks`, `linebreaksbr`, `linenumbers`. `floatformat` is NOT marked
 *   safe even though Django `mark_safe`s its success path, because its
 *   error / passthrough path returns the raw input — a `.safe` flag there
 *   would let unescaped input through (its numeric output has no HTML, so the
 *   redundant escape pass is a harmless no-op).
 * - **String filters coerce to string.** Django's `@stringfilter` coerces the
 *   value before the filter runs; the string filters here mirror that.
 * - **No settings system.** `date` / `time` have no locale `DATE_FORMAT` /
 *   `TIME_FORMAT` to fall back on, so they default to fixed formats; pass an
 *   explicit format for full control. The shared PHP-style date formatter
 *   covers the common Django date codes but not the Django-only ones
 *   (`N` AP-month, `P`, `f`, `T`, `e`, `I`, `u`).
 */

/*!
 * Map a single HTML-significant character to its entity. @private
 */
function escapeHtmlRest(ch) {
  return ch === '<' ? '&lt;' : ch === '>' ? '&gt;' : ch === '"' ? '&quot;' : '&#39;';
}

/*!
 * Normalize CRLF / CR newlines to LF, matching Django's
 * `utils.text.normalize_newlines`. @private
 */
function normalizeNewlines(value) {
  return String(value).replace(/\r\n|\r|\n/g, '\n');
}

/*!
 * Round half away from zero to `places` decimals (Django floatformat uses
 * Decimal ROUND_HALF_UP). The `e`-notation shift avoids the common
 * `x * 10^n` float-representation error for the documented cases; rare
 * half-way values at the float-representation boundary may still differ from
 * Python's exact Decimal rounding. @private
 */
function roundHalfUp(num, places) {
  var sign = num < 0 ? -1 : 1,
    n = Math.abs(num);
  return sign * Number(Math.round(Number(n + 'e' + places)) + 'e-' + places);
}

/*!
 * Django `escapejs` character map (`django.utils.html._js_escapes`). @private
 */
var _jsEscapes = {
  '\\': '\\u005C',
  '\'': '\\u0027',
  '"': '\\u0022',
  '>': '\\u003E',
  '<': '\\u003C',
  '&': '\\u0026',
  '=': '\\u003D',
  '-': '\\u002D',
  ';': '\\u003B',
  '`': '\\u0060',
  '\u2028': '\\u2028',
  '\u2029': '\\u2029'
};

/*!
 * Percent-encode one character's UTF-8 bytes. `encodeURIComponent` leaves
 * `! * ' ( )` un-encoded, which Python's `quote` escapes — so finish them by
 * hand. @private
 */
function pctEncode(ch) {
  return encodeURIComponent(ch).replace(/[!*'()]/g, function (m) {
    return '%' + m.charCodeAt(0).toString(16).toUpperCase();
  });
}

/*!
 * Encode a string for a URL, leaving the unreserved set
 * (`A-Z a-z 0-9 _ . - ~`) and any character in `safe` untouched. Mirrors
 * Python's `urllib.parse.quote`. @private
 */
function urlQuote(value, safe) {
  var s = String(value),
    out = '',
    i,
    c;
  for (i = 0; i < s.length; i += 1) {
    c = s.charAt(i);
    if (/[A-Za-z0-9_.\-~]/.test(c) || (safe && safe.indexOf(c) !== -1)) {
      out += c;
    } else {
      out += pctEncode(c);
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Filters (alphabetical)                                             *
 * ------------------------------------------------------------------ */

/**
 * Add the argument to the value. Numeric addition is tried first (Django's
 * `int(value) + int(arg)`); on failure it falls back to concatenation
 * (strings and arrays), then to the empty string.
 *
 * @example
 * {{ 4|add:2 }}
 * // => 6
 *
 * @example
 * {{ first|add:second }}  // first = [1, 2], second = [3, 4]
 * // => [1, 2, 3, 4]
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
 * Backslash-escape quotes and backslashes (Django's `addslashes`). Escapes
 * `\`, `"`, and `'`.
 *
 * @example
 * {{ "I'm using Django"|addslashes }}
 * // => I\'m using Django
 *
 * @param  {*} input
 * @return {string}
 */
exports.addslashes = function (input) {
  return String(input).replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/'/g, "\\'");
};

/**
 * Capitalize the first character of the value, leaving the rest unchanged
 * (Django's `capfirst` — distinct from a title-case or fully-lowercased
 * capitalize).
 *
 * @example
 * {{ "django"|capfirst }}
 * // => Django
 *
 * @param  {*} input
 * @return {string}
 */
exports.capfirst = function (input) {
  var s = String(input);
  if (!s.length) {
    return s;
  }
  return s.charAt(0).toUpperCase() + s.substr(1);
};

/**
 * Center the value in a field of the given width using spaces (Django's
 * `center`, which defers to Python `str.center`). When an odd number of pad
 * characters is needed, the extra space goes on the right.
 *
 * @example
 * "{{ "Django"|center:"15" }}"
 * // => "     Django    "
 *
 * @param  {*}             input
 * @param  {(number|string)} width
 * @return {string}
 */
exports.center = function (input, width) {
  var s = String(input),
    w = parseInt(width, 10),
    marg,
    left,
    right;
  if (isNaN(w) || s.length >= w) {
    return s;
  }
  marg = w - s.length;
  left = Math.floor(marg / 2) + (marg & w & 1);
  right = marg - left;
  return new Array(left + 1).join(' ') + s + new Array(right + 1).join(' ');
};

/**
 * Remove all occurrences of the argument from the value (Django's `cut`).
 *
 * @example
 * {{ "String with spaces"|cut:" " }}
 * // => Stringwithspaces
 *
 * @param  {*}      input
 * @param  {string} arg
 * @return {string}
 */
exports.cut = function (input, arg) {
  return String(input).split(String(arg)).join('');
};

/**
 * Format a date / time. The format string uses PHP-style date tokens (the
 * same set shared with the native and Twig flavors), which covers the common
 * Django date codes; a backslash escapes a literal character. `offset` shifts
 * the timezone (minutes west of GMT) and `abbr` sets the output-only timezone
 * abbreviation. A null / empty input renders the empty string (Django
 * behavior). With no format, defaults to `'F j, Y'` (Django uses the locale
 * `DATE_FORMAT`, which this engine has no settings system for).
 *
 * @example
 * {{ value|date:"D d M Y" }}  // value = 2008-01-09
 * // => Wed 09 Jan 2008
 *
 * @param  {?(Date|string|number)} input
 * @param  {string} [format='F j, Y']
 * @param  {number} [offset]  Timezone offset in minutes west of GMT.
 * @param  {string} [abbr]    Output timezone abbreviation.
 * @return {string}
 */
exports.date = function (input, format, offset, abbr) {
  var l,
    date,
    cur,
    i = 0,
    out = '';

  if (input === null || input === undefined || input === '') {
    return '';
  }

  format = (format === undefined || format === null || format === '') ? 'F j, Y' : String(format);
  l = format.length;
  date = new dateFormatter.DateZ(input);

  if (offset) {
    date.setTimezoneOffset(offset, abbr);
  }

  for (i = 0; i < l; i += 1) {
    cur = format.charAt(i);
    if (cur === '\\') {
      i += 1;
      out += (i < l) ? format.charAt(i) : cur;
    } else if (dateFormatter.hasOwnProperty(cur)) {
      out += dateFormatter[cur](date, offset, abbr);
    } else {
      out += cur;
    }
  }
  return out;
};

/**
 * If the value is falsy, use the given default (Django's `default`). Django
 * truthiness applies: `False`, `0`, `''`, `None`, an empty list, and an empty
 * mapping all fall back to the argument.
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
 * Use the default only when the value is `None` (Django's `default_if_none`).
 * Unlike `default`, other falsy values (`0`, `''`, `False`) pass through.
 *
 * Note: until the Django variable resolver lands, a context value that is
 * `null` is coerced to `""` before reaching this filter, so a context-`None`
 * does not yet trigger the fallback (an empty string does not, by design); a
 * value that arrives genuinely `null` / `undefined` does.
 *
 * @example
 * {{ value|default_if_none:"nothing" }}  // value = None
 * // => nothing
 *
 * @example
 * {{ value|default_if_none:"nothing" }}  // value = 0
 * // => 0
 *
 * @param  {*} input
 * @param  {*} def
 * @return {*}
 */
exports.default_if_none = function (input, def) {
  return (input === null || input === undefined) ? def : input;
};

/**
 * Return whether the value is divisible by the argument (Django's
 * `divisibleby`). Returns a boolean — typically used in `{% if %}`.
 *
 * @example
 * {{ 21|divisibleby:3 }}
 * // => true
 *
 * @param  {*} input
 * @param  {*} arg
 * @return {boolean}
 */
exports.divisibleby = function (input, arg) {
  var v = parseInt(input, 10),
    a = parseInt(arg, 10);
  if (isNaN(v) || isNaN(a) || a === 0) {
    return false;
  }
  return v % a === 0;
};

/**
 * HTML-escape (default) or JS-escape the input. `e` is the shortcut alias
 * applied by autoescape. The HTML branch preserves already-escaped entities
 * (`&amp;`, `&lt;`, …) so the autoescape tail is idempotent. Mirrors Django's
 * HTML escaping of `< > & " '`.
 *
 * @example
 * {{ "<b>"|escape }}
 * // => &lt;b&gt;
 *
 * @param  {*}      input
 * @param  {string} [type='html']  Pass `'js'` for JavaScript-safe escaping.
 * @return {string}
 */
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
 * Hex-encode characters for use inside a JavaScript string literal (Django's
 * `escapejs`). Escapes backslash, quotes, `< > & = - ; \``, the line / para
 * separators U+2028 / U+2029, and all control characters. The output is safe
 * to embed in a `<script>` and cannot break out of it, so it is marked safe.
 *
 * @example
 * {{ "</script>"|escapejs }}
 * // => </script>
 *
 * @param  {*} input
 * @return {string}
 */
exports.escapejs = function (input) {
  var s = (input === null || input === undefined) ? '' : String(input),
    out = '',
    i,
    ch,
    code,
    hex;
  for (i = 0; i < s.length; i += 1) {
    ch = s.charAt(i);
    if (_jsEscapes.hasOwnProperty(ch)) {
      out += _jsEscapes[ch];
    } else {
      code = s.charCodeAt(i);
      if (code < 32) {
        hex = code.toString(16).toUpperCase();
        out += '\\u00' + (hex.length < 2 ? '0' + hex : hex);
      } else {
        out += ch;
      }
    }
  }
  return out;
};
exports.escapejs.safe = true;

/**
 * Format a byte count as a human-readable file size (Django's
 * `filesizeformat`). Uses 1024-based units (bytes, KB, MB, GB, TB, PB), one
 * decimal place for KB and up, and an integer for bytes. The input is
 * truncated to an integer first. Like Django's `avoid_wrapping`, the number
 * and unit are separated by a non-breaking space (U+00A0), so the output is
 * byte-identical to Django; it renders visually as an ordinary space.
 *
 * @example
 * {{ 123456789|filesizeformat }}
 * // => 117.7 MB   (the separator is U+00A0)
 *
 * @param  {*} input
 * @return {string}
 */
exports.filesizeformat = function (input) {
  var bytes = parseInt(input, 10),
    negative,
    KB = 1024,
    MB = KB * 1024,
    GB = MB * 1024,
    TB = GB * 1024,
    PB = TB * 1024,
    value;

  function fnum(v) {
    return (Math.round(v * 10) / 10).toFixed(1);
  }

  if (isNaN(bytes)) {
    return '0\u00a0bytes';
  }
  negative = bytes < 0;
  if (negative) {
    bytes = -bytes;
  }

  if (bytes < KB) {
    value = bytes + (bytes === 1 ? '\u00a0byte' : '\u00a0bytes');
  } else if (bytes < MB) {
    value = fnum(bytes / KB) + '\u00a0KB';
  } else if (bytes < GB) {
    value = fnum(bytes / MB) + '\u00a0MB';
  } else if (bytes < TB) {
    value = fnum(bytes / GB) + '\u00a0GB';
  } else if (bytes < PB) {
    value = fnum(bytes / TB) + '\u00a0TB';
  } else {
    value = fnum(bytes / PB) + '\u00a0PB';
  }

  return negative ? '-' + value : value;
};

/**
 * Return the first item of an array, the first character of a string, or the
 * first value of a mapping (Django's `first`). An empty sequence yields the
 * empty string.
 *
 * @example
 * {{ "Joel"|first }}
 * // => J
 *
 * @param  {*} input
 * @return {*}
 */
exports.first = function (input) {
  var keys;
  if (typeof input === 'string') {
    return input.length ? input.charAt(0) : '';
  }
  if (utils.isArray(input)) {
    return input.length ? input[0] : '';
  }
  if (input && typeof input === 'object') {
    keys = utils.keys(input);
    return keys.length ? input[keys[0]] : '';
  }
  return '';
};

/**
 * Format a floating-point number (Django's `floatformat`). With no argument,
 * rounds to one decimal place but drops the decimal if the value is whole. A
 * positive argument always shows that many decimals; a negative argument
 * shows that many decimals only when the value has a fractional part; `0`
 * rounds to an integer. Rounds half away from zero. The locale grouping
 * suffixes (`g` / `u`) are accepted but ignored (no locale system).
 *
 * @example
 * {{ 34.26000|floatformat }}
 * // => 34.3
 *
 * @example
 * {{ 34.00000|floatformat:"-3" }}
 * // => 34
 *
 * @param  {*}              input
 * @param  {(number|string)} [arg=-1]
 * @return {string}
 */
exports.floatformat = function (input, arg) {
  var p, num, places, a;

  if (arg === undefined || arg === null || arg === '') {
    p = -1;
  } else {
    a = String(arg).replace(/[gu]+$/, '');
    p = parseInt(a, 10);
    if (isNaN(p)) {
      return String(input);
    }
  }

  num = parseFloat(input);
  if (isNaN(num)) {
    return '';
  }

  if (num === Math.floor(num) && p < 0) {
    return String(num);
  }

  places = Math.abs(p);
  return roundHalfUp(num, places).toFixed(places);
};

/**
 * Apply HTML escaping to the value immediately and mark it safe (Django's
 * `force_escape`). Distinct from `escape` only in that the escaped result is
 * not re-escaped by autoescape or a following filter.
 *
 * @example
 * {{ "<b>"|force_escape }}
 * // => &lt;b&gt;
 *
 * @param  {*} input
 * @return {string}
 */
exports.force_escape = function (input) {
  return exports.escape(String(input));
};
exports.force_escape.safe = true;

/**
 * Return the digit of the value at the given 1-based position counted from
 * the right (Django's `get_digit`). Returns 0 when the position is past the
 * number; returns the value unchanged for a non-numeric value or a position
 * below 1.
 *
 * @example
 * {{ 123456789|get_digit:"2" }}
 * // => 8
 *
 * @param  {*} input
 * @param  {*} arg    1-based position from the right.
 * @return {(number|*)}
 */
exports.get_digit = function (input, arg) {
  var a = parseInt(arg, 10),
    v = parseInt(input, 10),
    s,
    d;
  if (isNaN(a) || isNaN(v)) {
    return input;
  }
  if (a < 1) {
    return v;
  }
  s = String(v);
  if (a > s.length) {
    return 0;
  }
  d = parseInt(s.charAt(s.length - a), 10);
  return isNaN(d) ? 0 : d;
};

/**
 * Convert an IRI to a URI, percent-encoding non-ASCII and spaces while
 * preserving URI-reserved characters (Django's `iriencode`).
 *
 * @example
 * {{ "?test=I ♥ Django"|iriencode }}
 * // => ?test=I%20%E2%99%A5%20Django
 *
 * @param  {*} input
 * @return {string}
 */
exports.iriencode = function (input) {
  var s = String(input),
    out = '',
    i,
    c,
    safe = "/#%[]=:;$&()+,!?*@'~";
  for (i = 0; i < s.length; i += 1) {
    c = s.charAt(i);
    if (/[A-Za-z0-9\-_.]/.test(c) || safe.indexOf(c) !== -1) {
      out += c;
    } else {
      out += pctEncode(c);
    }
  }
  return out;
};

/**
 * Join a list with a string (Django's `join`).
 *
 * @example
 * {{ list|join:", " }}  // list = ['a', 'b', 'c']
 * // => a, b, c
 *
 * @param  {*}      input
 * @param  {string} [glue=""]
 * @return {*}
 */
exports.join = function (input, glue) {
  if (utils.isArray(input)) {
    return input.join(glue !== undefined ? glue : '');
  }
  return input;
};

/**
 * Return the last item of an array, the last character of a string, or the
 * last value of a mapping (Django's `last`). An empty sequence yields the
 * empty string.
 *
 * @example
 * {{ "Joel"|last }}
 * // => l
 *
 * @param  {*} input
 * @return {*}
 */
exports.last = function (input) {
  var keys;
  if (typeof input === 'string') {
    return input.length ? input.charAt(input.length - 1) : '';
  }
  if (utils.isArray(input)) {
    return input.length ? input[input.length - 1] : '';
  }
  if (input && typeof input === 'object') {
    keys = utils.keys(input);
    return keys.length ? input[keys[keys.length - 1]] : '';
  }
  return '';
};

/**
 * Return the number of items in a sequence (array, string) or the number of
 * keys in a mapping (Django's `length`). A value with no length yields 0.
 *
 * @example
 * {{ "Tacos"|length }}
 * // => 5
 *
 * @param  {*} input
 * @return {number}
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
 * Convert newlines in plain text to HTML: a blank line becomes a paragraph
 * break and a single newline becomes a `<br>` (Django's `linebreaks`). The
 * text content is HTML-escaped, and the result is marked safe.
 *
 * @example
 * {{ "Joel\nis a slug"|linebreaks }}
 * // => <p>Joel<br>is a slug</p>
 *
 * @param  {*} input
 * @return {string}
 */
exports.linebreaks = function (input) {
  var paras = normalizeNewlines(input).split(/\n{2,}/);
  return utils.map(paras, function (p) {
    return '<p>' + exports.escape(p).replace(/\n/g, '<br>') + '</p>';
  }).join('\n\n');
};
exports.linebreaks.safe = true;

/**
 * Convert every newline to a `<br>` (Django's `linebreaksbr`). The text
 * content is HTML-escaped, and the result is marked safe.
 *
 * @example
 * {{ "Joel\nis a slug"|linebreaksbr }}
 * // => Joel<br>is a slug
 *
 * @param  {*} input
 * @return {string}
 */
exports.linebreaksbr = function (input) {
  return exports.escape(normalizeNewlines(input)).replace(/\n/g, '<br>');
};
exports.linebreaksbr.safe = true;

/**
 * Prefix each line with its line number, zero-padded to a consistent width
 * (Django's `linenumbers`). The line content is HTML-escaped, and the result
 * is marked safe.
 *
 * @example
 * {{ "one\ntwo"|linenumbers }}
 * // => 1. one\n2. two
 *
 * @param  {*} input
 * @return {string}
 */
exports.linenumbers = function (input) {
  var lines = String(input).split('\n'),
    width = String(lines.length).length;
  return utils.map(lines, function (line, i) {
    var n = String(i + 1);
    while (n.length < width) {
      n = '0' + n;
    }
    return n + '. ' + exports.escape(line);
  }).join('\n');
};
exports.linenumbers.safe = true;

/**
 * Left-align the value in a field of the given width, padding with spaces
 * (Django's `ljust`).
 *
 * @example
 * "{{ "Django"|ljust:"10" }}"
 * // => "Django    "
 *
 * @param  {*}              input
 * @param  {(number|string)} width
 * @return {string}
 */
exports.ljust = function (input, width) {
  var s = String(input),
    w = parseInt(width, 10);
  if (isNaN(w) || s.length >= w) {
    return s;
  }
  return s + new Array(w - s.length + 1).join(' ');
};

/**
 * Return the input in all lowercase letters (Django's `lower`). Recurses into
 * arrays / objects.
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
 * Turn the value into a list of its characters / digits (Django's
 * `make_list`).
 *
 * @example
 * {{ "Joel"|make_list }}
 * // => ['J', 'o', 'e', 'l']
 *
 * @param  {*} input
 * @return {Array}
 */
exports.make_list = function (input) {
  return String(input).split('');
};

/**
 * Convert the letters of a phone number to their dial-pad digits (Django's
 * `phone2numeric`). Non-letters pass through.
 *
 * @example
 * {{ "800-COLLECT"|phone2numeric }}
 * // => 800-2655328
 *
 * @param  {*} input
 * @return {string}
 */
exports.phone2numeric = function (input) {
  var map = {
    a: '2', b: '2', c: '2', d: '3', e: '3', f: '3', g: '4', h: '4', i: '4',
    j: '5', k: '5', l: '5', m: '6', n: '6', o: '6', p: '7', q: '7', r: '7',
    s: '7', t: '8', u: '8', v: '8', w: '9', x: '9', y: '9', z: '9'
  };
  return String(input).toLowerCase().replace(/[a-z]/g, function (c) {
    return map[c];
  });
};

/**
 * Return a plural suffix based on a count (Django's `pluralize`). With no
 * argument the suffix is `"s"`; a `"singular,plural"` argument supplies both
 * forms. The count may be a number or anything with a `length`.
 *
 * @example
 * message{{ 2|pluralize }}
 * // => messages
 *
 * @example
 * cherr{{ 1|pluralize:"y,ies" }}
 * // => cherry
 *
 * @param  {*} input
 * @param  {string} [arg="s"]
 * @return {string}
 */
exports.pluralize = function (input, arg) {
  var a = (arg === undefined || arg === null) ? 's' : String(arg),
    bits,
    singular,
    plural,
    n;
  if (a.indexOf(',') === -1) {
    a = ',' + a;
  }
  bits = a.split(',');
  if (bits.length > 2) {
    return '';
  }
  singular = bits[0];
  plural = bits[1];

  n = parseFloat(input);
  if (typeof input === 'number' || (typeof input === 'string' && input.replace(/^\s+|\s+$/g, '') !== '' && !isNaN(n))) {
    return n === 1 ? singular : plural;
  }
  if (input !== null && input !== undefined && typeof input.length === 'number') {
    return input.length === 1 ? singular : plural;
  }
  return '';
};

/**
 * Right-align the value in a field of the given width, padding with spaces
 * (Django's `rjust`).
 *
 * @example
 * "{{ "Django"|rjust:"10" }}"
 * // => "    Django"
 *
 * @param  {*}              input
 * @param  {(number|string)} width
 * @return {string}
 */
exports.rjust = function (input, width) {
  var s = String(input),
    w = parseInt(width, 10);
  if (isNaN(w) || s.length >= w) {
    return s;
  }
  return new Array(w - s.length + 1).join(' ') + s;
};

/**
 * Mark the value as safe, bypassing autoescape (Django's `safe`).
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
 * Return a slice of a list or string using Python `start:stop:step` subscript
 * syntax (Django's `slice`). Omitted bounds take their step-direction
 * default; a negative step walks backwards (`"::-1"` reverses).
 *
 * @example
 * {{ list|slice:":2" }}  // list = ['a', 'b', 'c']
 * // => ['a', 'b']
 *
 * @param  {*}      input
 * @param  {string} arg    A `start:stop:step` slice expression.
 * @return {*}
 */
exports.slice = function (input, arg) {
  var bits,
    start,
    stop,
    step;

  if (!utils.isArray(input) && typeof input !== 'string') {
    return input;
  }

  function p(x) {
    return (x === undefined || x === '') ? null : parseInt(x, 10);
  }

  bits = String(arg === undefined || arg === null ? '' : arg).split(':');
  if (bits.length === 1) {
    start = null;
    stop = p(bits[0]);
    step = null;
  } else if (bits.length === 2) {
    start = p(bits[0]);
    stop = p(bits[1]);
    step = null;
  } else {
    start = p(bits[0]);
    stop = p(bits[1]);
    step = p(bits[2]);
  }
  return utils.slice(input, start, stop, step);
};

/**
 * Slugify the value: lowercase, ASCII-fold accents, strip non-word
 * characters, and collapse whitespace / hyphen runs to single hyphens
 * (Django's `slugify`).
 *
 * @example
 * {{ "Joel is a slug"|slugify }}
 * // => joel-is-a-slug
 *
 * @param  {*} input
 * @return {string}
 */
exports.slugify = function (input) {
  var value = String(input);
  if (value.normalize) {
    value = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  }
  value = value.toLowerCase().replace(/[^\w\s-]/g, '');
  return value.replace(/[-\s]+/g, '-').replace(/^[-_]+|[-_]+$/g, '');
};

/**
 * Strip all HTML / XML tags from the value (Django's `striptags`).
 *
 * @example
 * {{ "<p>foobar</p>"|striptags }}
 * // => foobar
 *
 * @param  {*} input
 * @return {string}
 */
exports.striptags = function (input) {
  return String(input).replace(/(<([^>]+)>)/ig, '');
};

/**
 * Format the time portion of a value (Django's `time`). Uses the same
 * PHP-style date tokens as `date`; defaults to `'g:i A'` (Django uses the
 * locale `TIME_FORMAT`, which this engine has no settings system for).
 *
 * @example
 * {{ value|time:"H:i" }}
 * // => 01:23
 *
 * @param  {?(Date|string|number)} input
 * @param  {string} [format='g:i A']
 * @param  {number} [offset]
 * @param  {string} [abbr]
 * @return {string}
 */
exports.time = function (input, format, offset, abbr) {
  return exports.date(input, (format === undefined || format === null || format === '') ? 'g:i A' : format, offset, abbr);
};

/**
 * Title-case the value: uppercase the first letter of each word and lowercase
 * the rest (Django's `title`).
 *
 * @example
 * {{ "my FIRST post"|title }}
 * // => My First Post
 *
 * @param  {*} input
 * @return {string}
 */
exports.title = function (input) {
  return String(input).replace(/\w\S*/g, function (str) {
    return str.charAt(0).toUpperCase() + str.substr(1).toLowerCase();
  });
};

/**
 * Truncate the value to a number of characters, ending with an ellipsis
 * (Django's `truncatechars`). The ellipsis (`…`) counts toward the length.
 *
 * @example
 * {{ "Joel is a slug"|truncatechars:7 }}
 * // => Joel i…
 *
 * @param  {*}              input
 * @param  {(number|string)} arg   Maximum length including the ellipsis.
 * @return {string}
 */
exports.truncatechars = function (input, arg) {
  var s = String(input),
    n = parseInt(arg, 10);
  if (isNaN(n)) {
    return s;
  }
  if (s.length <= n) {
    return s;
  }
  return s.substr(0, n - 1 < 0 ? 0 : n - 1) + '…';
};

/**
 * Truncate the value to a number of words, ending with a space + ellipsis
 * (Django's `truncatewords`). Whitespace runs within the kept portion are
 * collapsed to single spaces.
 *
 * @example
 * {{ "Joel is a slug"|truncatewords:2 }}
 * // => Joel is …
 *
 * @param  {*}              input
 * @param  {(number|string)} arg   Maximum number of words.
 * @return {string}
 */
exports.truncatewords = function (input, arg) {
  var n = parseInt(arg, 10),
    words;
  if (isNaN(n)) {
    return String(input);
  }
  words = String(input).replace(/^\s+|\s+$/g, '').split(/\s+/);
  if (words.length === 1 && words[0] === '') {
    return '';
  }
  if (words.length <= n) {
    return words.join(' ');
  }
  return words.slice(0, n).join(' ') + ' …';
};

/**
 * Convert the input to all uppercase letters (Django's `upper`). Recurses
 * into arrays / objects.
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
 * URL-encode the value for use in a URL path (Django's `urlencode`). The `/`
 * separator is preserved by default; pass a string of characters to leave
 * unencoded as the argument.
 *
 * @example
 * {{ "a b/c"|urlencode }}
 * // => a%20b/c
 *
 * @param  {*}      input
 * @param  {string} [safe="/"]  Characters to leave unencoded.
 * @return {string}
 */
exports.urlencode = function (input, safe) {
  var safeChars = (safe === undefined || safe === null) ? '/' : String(safe);
  return urlQuote(input, safeChars);
};

/**
 * Count the words in the value (Django's `wordcount`). Words are runs of
 * non-whitespace characters.
 *
 * @example
 * {{ "Joel is a slug"|wordcount }}
 * // => 4
 *
 * @param  {*} input
 * @return {number}
 */
exports.wordcount = function (input) {
  var m = String(input).match(/\S+/g);
  return m ? m.length : 0;
};

/**
 * Wrap the value's words to a maximum line width (Django's `wordwrap`). Words
 * are packed greedily; lines are joined with a newline.
 *
 * @example
 * {{ "the quick brown fox"|wordwrap:10 }}
 * // => the quick\nbrown fox
 *
 * @param  {*}              input
 * @param  {(number|string)} width
 * @return {string}
 */
exports.wordwrap = function (input, width) {
  var w = parseInt(width, 10),
    words,
    lines,
    cur,
    i,
    word;
  if (isNaN(w) || w <= 0) {
    return String(input);
  }
  words = String(input).split(/(\s+)/);
  lines = [];
  cur = '';
  for (i = 0; i < words.length; i += 1) {
    word = words[i];
    if (/^\s+$/.test(word) || word === '') {
      continue;
    }
    if (cur === '') {
      cur = word;
    } else if (cur.length + 1 + word.length <= w) {
      cur += ' ' + word;
    } else {
      lines.push(cur);
      cur = word;
    }
  }
  if (cur !== '') {
    lines.push(cur);
  }
  return lines.join('\n');
};

/**
 * Map the value to one of up to three words based on whether it is truthy,
 * falsy, or `None` (Django's `yesno`). The default mapping is
 * `"yes,no,maybe"`; with only two words, `None` maps to the second.
 *
 * @example
 * {{ value|yesno:"yeah,no,maybe" }}  // value = None
 * // => maybe
 *
 * @param  {*} input
 * @param  {string} [arg="yes,no,maybe"]
 * @return {*}
 */
exports.yesno = function (input, arg) {
  var a = (arg === undefined || arg === null) ? 'yes,no,maybe' : String(arg),
    bits = a.split(','),
    yes,
    no,
    maybe;
  if (bits.length < 2) {
    return input;
  }
  yes = bits[0];
  no = bits[1];
  maybe = (bits.length === 3) ? bits[2] : bits[1];
  if (input === null || input === undefined) {
    return maybe;
  }
  if (input) {
    return yes;
  }
  return no;
};
