var security = require('./security');

var isArray;

/**
 * Strip leading and trailing whitespace from a string.
 * @param  {string} input
 * @return {string}       Stripped input.
 */
exports.strip = function (input) {
  return input.replace(/^\s+|\s+$/g, '');
};

/**
 * Test if a string starts with a given prefix.
 * @param  {string} str    String to test against.
 * @param  {string} prefix Prefix to check for.
 * @return {boolean}
 */
exports.startsWith = function (str, prefix) {
  return str.indexOf(prefix) === 0;
};

/**
 * Test if a string ends with a given suffix.
 * @param  {string} str    String to test against.
 * @param  {string} suffix Suffix to check for.
 * @return {boolean}
 */
exports.endsWith = function (str, suffix) {
  return str.indexOf(suffix, str.length - suffix.length) !== -1;
};

/**
 * Iterate over an array or object.
 * @param  {array|object} obj Enumerable object.
 * @param  {Function}     fn  Callback function executed for each item.
 * @return {array|object}     The original input object.
 */
exports.each = function (obj, fn) {
  var i, l;

  if (isArray(obj)) {
    i = 0;
    l = obj.length;
    for (i; i < l; i += 1) {
      if (fn(obj[i], i, obj) === false) {
        break;
      }
    }
  } else {
    for (i in obj) {
      if (obj.hasOwnProperty(i)) {
        if (fn(obj[i], i, obj) === false) {
          break;
        }
      }
    }
  }

  return obj;
};

/**
 * Test if an object is an Array.
 * @param {object} obj
 * @return {boolean}
 */
exports.isArray = isArray = (Array.hasOwnProperty('isArray')) ? Array.isArray : function (obj) {
  return (obj) ? (typeof obj === 'object' && Object.prototype.toString.call(obj).indexOf() !== -1) : false;
};

/**
 * Test if an item in an enumerable matches your conditions.
 * @param  {array|object}   obj   Enumerable object.
 * @param  {Function}       fn    Executed for each item. Return true if your condition is met.
 * @return {boolean}
 */
exports.some = function (obj, fn) {
  var i = 0,
    result,
    l;
  if (isArray(obj)) {
    l = obj.length;

    for (i; i < l; i += 1) {
      result = fn(obj[i], i, obj);
      if (result) {
        break;
      }
    }
  } else {
    exports.each(obj, function (value, index) {
      result = fn(value, index, obj);
      return !(result);
    });
  }
  return !!result;
};

/**
 * Return a new enumerable, mapped by a given iteration function.
 * @param  {object}   obj Enumerable object.
 * @param  {Function} fn  Executed for each item. Return the item to replace the original item with.
 * @return {object}       New mapped object.
 */
exports.map = function (obj, fn) {
  var i = 0,
    result = [],
    l;

  if (isArray(obj)) {
    l = obj.length;
    for (i; i < l; i += 1) {
      result[i] = fn(obj[i], i);
    }
  } else {
    for (i in obj) {
      if (obj.hasOwnProperty(i)) {
        result[i] = fn(obj[i], i);
      }
    }
  }
  return result;
};

/**
 * Copy all of the properties in the source objects over to the destination object, and return the destination object. It's in-order, so the last source will override properties of the same name in previous arguments.
 * @param {...object} arguments
 * @return {object}
 */
exports.extend = function () {
  var args = arguments,
    target = args[0],
    objs = (args.length > 1) ? Array.prototype.slice.call(args, 1) : [],
    i = 0,
    l = objs.length,
    key,
    obj;

  for (i; i < l; i += 1) {
    obj = objs[i] || {};
    for (key in obj) {
      if (obj.hasOwnProperty(key)) {
        target[key] = obj[key];
      }
    }
  }
  return target;
};

/**
 * Get all of the keys on an object.
 * @param  {object} obj
 * @return {array}
 */
exports.keys = function (obj) {
  if (!obj) {
    return [];
  }

  if (Object.keys) {
    return Object.keys(obj);
  }

  return exports.map(obj, function (v, k) {
    return k;
  });
};

/**
 * Throw an error with possible line number and source file.
 * @param  {string} message Error message
 * @param  {number} [line]  Line number in template.
 * @param  {string} [file]  Template file the error occured in.
 * @throws {Error} No seriously, the point is to throw an error.
 */
exports.throwError = function (message, line, file) {
  if (line) {
    message += ' on line ' + line;
  }
  if (file) {
    message += ' in file ' + file;
  }
  throw new Error(message + '.');
};

/**
 * Inclusive range generator. Mirrors Twig's `..` operator semantics and
 * PHP's range(): numeric bounds produce [from, from±1, ..., to]; single-
 * character string bounds produce a char array across the charCode span.
 * Descending when `from > to`. Mismatched or unsupported argument shapes
 * return an empty array so compiled templates degrade silently rather
 * than throwing at render time.
 *
 * @param  {number|string} from
 * @param  {number|string} to
 * @return {Array}
 */
exports.range = function (from, to) {
  var out = [], i, fc, tc;
  if (typeof from === 'number' && typeof to === 'number') {
    if (from <= to) {
      for (i = from; i <= to; i += 1) { out.push(i); }
    } else {
      for (i = from; i >= to; i -= 1) { out.push(i); }
    }
    return out;
  }
  if (typeof from === 'string' && typeof to === 'string' &&
      from.length === 1 && to.length === 1) {
    fc = from.charCodeAt(0);
    tc = to.charCodeAt(0);
    if (fc <= tc) {
      for (i = fc; i <= tc; i += 1) { out.push(String.fromCharCode(i)); }
    } else {
      for (i = fc; i >= tc; i -= 1) { out.push(String.fromCharCode(i)); }
    }
    return out;
  }
  return out;
};

/**
 * Python-style slice for arrays and strings. Mirrors Jinja2's
 * `seq[start:stop:step]` subscript: negative indices count from the end,
 * omitted bounds (null/undefined) take their step-direction default, and a
 * negative step walks backwards (`seq[::-1]` reverses). Returns a string
 * for string input and an array otherwise. A null/undefined object or a
 * non-indexable value yields an empty result so compiled templates degrade
 * silently rather than throwing at render time.
 *
 * @param  {Array|string} obj
 * @param  {?number}      start
 * @param  {?number}      stop
 * @param  {?number}      step
 * @return {Array|string}
 */
exports.slice = function (obj, start, stop, step) {
  var isString = (typeof obj === 'string'),
    length,
    lower,
    upper,
    s,
    e,
    result = [],
    i;

  function toInt(n) {
    n = Number(n);
    if (isNaN(n)) { return NaN; }
    return n < 0 ? Math.ceil(n) : Math.floor(n);
  }

  function clamp(v, dflt) {
    if (v === null || v === undefined) { return dflt; }
    v = toInt(v);
    if (isNaN(v)) { return dflt; }
    if (v < 0) {
      v += length;
      if (v < lower) { v = lower; }
    } else if (v > upper) {
      v = upper;
    }
    return v;
  }

  if (obj === null || obj === undefined || typeof obj.length !== 'number') {
    return isString ? '' : [];
  }
  length = obj.length;

  if (step === null || step === undefined) {
    step = 1;
  } else {
    step = toInt(step);
    if (isNaN(step) || step === 0) { step = 1; }
  }

  // Lower / upper bounds depend on walk direction (CPython slice rules).
  if (step < 0) {
    lower = -1;
    upper = length - 1;
  } else {
    lower = 0;
    upper = length;
  }

  s = clamp(start, (step < 0) ? upper : lower);
  e = clamp(stop, (step < 0) ? lower : upper);

  if (step > 0) {
    for (i = s; i < e; i += step) { result.push(obj[i]); }
  } else {
    for (i = s; i > e; i += step) { result.push(obj[i]); }
  }

  return isString ? result.join('') : result;
};

/**
 * Coerce a value for string output: `null` and `undefined` become the
 * empty string, everything else passes through unchanged. Used by the
 * backend's `Output` emit when a frontend opts in via `IROutput.coerce`,
 * so a non-VarRef expression that evaluates to null / undefined renders
 * as "" rather than the literal word "null" / "undefined". (VarRef
 * outputs already coerce in `emitVarRef`, so frontends only flag
 * non-VarRef outputs.)
 *
 * @param  {*} v
 * @return {*} `v`, or "" when `v` is null / undefined.
 */
exports.coerceOutput = function (v) {
  return (v === null || v === undefined) ? '' : v;
};

/*!
 * Resolve a single path segment against a value, Django-style. A plain
 * property access (`obj[seg]`) covers dictionary, attribute, and array /
 * string index lookup in one step (JS string-keys an array / string by a
 * numeric segment, so `["a"][0]` and `["a"]["0"]` both yield the element).
 * A callable leaf is auto-called with no arguments, bound to its receiver,
 * honoring Django's opt-outs: `fn.alters_data === true` is not called and
 * yields `undefined` (Django renders nothing for data-altering callables);
 * `fn.do_not_call_in_templates === true` is returned uncalled. A call that
 * throws (e.g. a method that needs arguments) yields `undefined`, mirroring
 * Django's `string_if_invalid` fallback on a failed auto-call. The
 * `_dangerousProps` segments are rejected at runtime as defense-in-depth.
 * @private
 */
function resolveSeg(obj, seg) {
  var val;
  if (obj === null || obj === undefined) {
    return undefined;
  }
  if (security.dangerousProps.indexOf(seg) !== -1) {
    return undefined;
  }
  val = obj[seg];
  if (typeof val === 'function') {
    if (val.alters_data === true) {
      return undefined;
    }
    if (val.do_not_call_in_templates === true) {
      return val;
    }
    // Django auto-calls a callable leaf with no args and falls back to
    // string_if_invalid ("") when the call raises; mirror that here.
    try {
      return val.call(obj);
    } catch (e) {
      return undefined;
    }
  }
  return val;
}

/**
 * Resolve a dotted path against a context object, Django-style — walk each
 * segment through the per-segment lookup, short-circuiting to the missing
 * value as soon as a segment resolves null / undefined. Powers the Django
 * flavor's variable resolution (dict / attribute / method lookup, auto-call
 * of callable leaves, `{{ list.0 }}` index access) when a frontend opts in
 * via the `IRVarRef.resolve` flag. The raw resolved value (including null) is
 * returned so downstream filters such as `default_if_none` see a real null;
 * coercion to "" is deferred to the output drain (via `coerceOutput`).
 *
 * @param  {*}        obj   The root context (usually `_ctx`).
 * @param  {string[]} path  Path segments.
 * @return {*}              The resolved value, or null / undefined when a
 *                          segment is missing.
 */
exports.resolve = function (obj, path) {
  var cur = obj,
    i;
  for (i = 0; i < path.length; i += 1) {
    cur = resolveSeg(cur, path[i]);
    if (cur === null || cur === undefined) {
      return cur;
    }
  }
  return cur;
};
