var security = require('./security');

var isArray;

/*!
 * What a \s regex atom matches, tested one code unit at a time.
 * @private
 */
var whitespace = /\s/;

/**
 * Strip leading and trailing whitespace from a string. Linear in the input
 * length.
 * @param  {string} input
 * @return {string}       Stripped input.
 */
exports.strip = function (input) {
  // A /\s+$/ alternative takes quadratic time on a long run of whitespace
  // that does not end the string; the trailing run is found by trimEnd.
  // return input.replace(/^\s+|\s+$/g, '');
  return exports.trimEnd(input.replace(/^\s+/, ''));
};

/**
 * Remove trailing characters from a string: whitespace (what `\s` matches)
 * when `chars` is omitted, otherwise every UTF-16 code unit that `chars`
 * contains, as a regex character class built from `chars` would. Linear in
 * the input length, where a `/[...]+$/` regex takes quadratic time on a long
 * run of those characters that does not end the string. Used by the flavor
 * filters.
 * @param  {string} input
 * @param  {string} [chars] Characters to remove; whitespace when omitted.
 * @return {string}
 */
exports.trimEnd = function (input, chars) {
  var end = input.length;
  if (chars === undefined) {
    while (end > 0 && whitespace.test(input.charAt(end - 1))) {
      end -= 1;
    }
  } else {
    while (end > 0 && chars.indexOf(input.charAt(end - 1)) !== -1) {
      end -= 1;
    }
  }
  return input.slice(0, end);
};

/**
 * Remove every `<...>` span from a string, with the output of
 * `input.replace(/<[^>]+>/g, '')`, or of `/<[^>]*>/g` (which also removes
 * `<>`) when `allowEmpty` is true. Linear in the input length, where those
 * regexes take quadratic time when many `<` have no `>` after them. Used by
 * the flavor filters.
 * @param  {string}  input
 * @param  {boolean} [allowEmpty] Remove `<>` too.
 * @return {string}
 */
exports.stripTags = function (input, allowEmpty) {
  var out = '',
    from = 0,
    lt = input.indexOf('<'),
    gt;
  while (lt !== -1) {
    gt = input.indexOf('>', lt + 1);
    if (gt === -1) {
      break;
    }
    if (gt === lt + 1 && !allowEmpty) {
      lt = input.indexOf('<', lt + 1);
      continue;
    }
    out += input.slice(from, lt);
    from = gt + 1;
    lt = input.indexOf('<', from);
  }
  return out + input.slice(from);
};

/**
 * Remove every `<!-- ... -->` comment from a string, with the output of
 * `input.replace(/<!--[\s\S]*?-->/g, '')`. Linear in the input length, where
 * that regex takes quadratic time when many `<!--` have no `-->` after them.
 * Used by the flavor filters.
 * @param  {string} input
 * @return {string}
 */
exports.stripComments = function (input) {
  var out = '',
    from = 0,
    open = input.indexOf('<!--'),
    close;
  while (open !== -1) {
    close = input.indexOf('-->', open + 4);
    if (close === -1) {
      break;
    }
    out += input.slice(from, open);
    from = close + 3;
    open = input.indexOf('<!--', from);
  }
  return out + input.slice(from);
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
 * Iterate over an array or object like {@link each}, awaiting each call of
 * `fn` before the next, so the items run one after another. The async render
 * path uses it for a loop whose body awaits (an include inside a for).
 * @param  {array|object} obj Enumerable object.
 * @param  {Function}     fn  Callback; it may return a Promise, and a result
 *                            of `false` stops the iteration.
 * @return {Promise}          Resolves with the original input object.
 */
exports.eachAsync = async function (obj, fn) {
  var i, l;

  if (isArray(obj)) {
    l = obj.length;
    for (i = 0; i < l; i += 1) {
      if ((await fn(obj[i], i, obj)) === false) {
        break;
      }
    }
  } else {
    for (i in obj) {
      if (obj.hasOwnProperty(i)) {
        if ((await fn(obj[i], i, obj)) === false) {
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
 * Render a block on the async render path. When `blocks`, the overrides an
 * extending template passed down, holds a function of that name, that
 * function renders the block with `own`, this template's version, as its
 * parent block (the one {% parent %} renders); otherwise `own` renders it.
 * @param  {object}   blocks Overrides by block name, or undefined.
 * @param  {string}   name   Block name.
 * @param  {object}   ctx    Render context.
 * @param  {Function} own    async function (ctx, parentBlock) rendering this template's version.
 * @return {Promise<string>} The rendered block.
 */
exports.callBlock = function (blocks, name, ctx, own) {
  if (blocks && Object.prototype.hasOwnProperty.call(blocks, name) && typeof blocks[name] === 'function') {
    return blocks[name](ctx, own);
  }
  return own(ctx);
};

/*!
 * The override `fn` with `mine` as its parent block; `mine` keeps the parent
 * block that the template above passes.
 * @private
 */
function chainBlock(fn, mine) {
  return function (ctx, parentBlock) {
    return fn(ctx, function (c) {
      return mine(c, parentBlock);
    });
  };
}

/**
 * Merge a template's own block functions with the overrides of the template
 * that extends it, on the async render path. An override wins, and its
 * parent block is this template's version, whose own parent block is the one
 * the template above passes when it renders the block.
 * @param  {object} local     This template's block functions by name.
 * @param  {object} inherited Overrides from the extending template, or undefined.
 * @return {object}           The merged block functions by name.
 */
exports.chainBlocks = function (local, inherited) {
  var has = Object.prototype.hasOwnProperty, merged = {}, name;
  for (name in local) {
    if (has.call(local, name)) {
      merged[name] = local[name];
    }
  }
  for (name in inherited) {
    if (has.call(inherited, name)) {
      merged[name] = has.call(local, name) ? chainBlock(inherited[name], local[name]) : inherited[name];
    }
  }
  return merged;
};

/**
 * Copy a render's context object: the same prototype and the same own
 * enumerable properties, each read once. A plain or null-prototype object is
 * copied by assignment, except an own "__proto__" key (JSON.parse makes one),
 * which an assignment would turn into the copy's prototype; an object with
 * another prototype may inherit setters or read-only properties, so its keys
 * are defined on the copy instead.
 * @param  {object} src Context object to copy.
 * @return {object}     The copy.
 */
exports.copyContext = function (src) {
  var proto = Object.getPrototypeOf(src),
    plain = proto === Object.prototype || proto === null,
    out = (proto === Object.prototype) ? {} : Object.create(proto),
    keys = Object.keys(src),
    i,
    k;
  for (i = 0; i < keys.length; i += 1) {
    k = keys[i];
    if (plain && k !== '__proto__') {
      out[k] = src[k];
    } else {
      Object.defineProperty(out, k, { value: src[k], writable: true, enumerable: true, configurable: true });
    }
  }
  return out;
};

/*!
 * Wrap a macro an imported template exports so the names its template bound
 * (`scope`) are in `ctx` while it runs, and the values they hid are back
 * afterwards. Own-property checks go through Object.prototype.hasOwnProperty
 * and the maps have no prototype, so a null-prototype context, or an own
 * "__proto__" key, works.
 * @private
 */
function withScope(fn, ctx, scope) {
  var has = Object.prototype.hasOwnProperty, names = Object.keys(scope);
  var wrapped = function () {
    var had = Object.create(null), saved = Object.create(null), i, k;
    for (i = 0; i < names.length; i += 1) {
      k = names[i];
      had[k] = has.call(ctx, k);
      saved[k] = ctx[k];
      ctx[k] = scope[k];
    }
    try {
      return fn.apply(this, arguments);
    } finally {
      for (i = 0; i < names.length; i += 1) {
        k = names[i];
        if (had[k]) {
          ctx[k] = saved[k];
        } else {
          delete ctx[k];
        }
      }
    }
  };
  wrapped.safe = fn.safe;
  return wrapped;
}

/**
 * Run an import on the async render path without leaving the imported
 * template's own bindings in the importer's context. The imported template
 * runs with the importer's context, so its macros read the importer's
 * variables; what it binds there (its macros, its sets, its own imports) is
 * taken back out when it returns, as the sync path keeps them out of the
 * importer, and its exported macros see those names only while they run.
 * @param  {object}   ctx The importer's context.
 * @param  {Function} run async function () returning the imported template's exports.
 * @return {Promise<object>} The exports, their macros wrapped when the import bound names.
 */
exports.importIsolated = async function (ctx, run) {
  var has = Object.prototype.hasOwnProperty, before = Object.create(null), scope = Object.create(null), exp, out = {};
  Object.keys(ctx).forEach(function (k) {
    before[k] = ctx[k];
  });
  function restore() {
    var putBack = [];
    Object.keys(ctx).forEach(function (k) {
      var v = ctx[k], had = has.call(before, k);
      // A name the import left as the importer had it (a loop's names put
      // back, as undefined when the importer had none) is not part of its
      // scope: it must not hide the caller's value while a macro runs.
      if (!had && v === undefined) {
        putBack.push(k);
      } else if (!had || before[k] !== v) {
        scope[k] = v;
      }
    });
    putBack.forEach(function (k) {
      delete ctx[k];
    });
    Object.keys(scope).forEach(function (k) {
      if (has.call(before, k)) {
        ctx[k] = before[k];
      } else {
        delete ctx[k];
      }
    });
    Object.keys(before).forEach(function (k) {
      if (!has.call(ctx, k)) {
        ctx[k] = before[k];
      }
    });
  }
  try {
    exp = await run();
  } finally {
    restore();
  }
  if (!Object.keys(scope).length) {
    return exp;
  }
  Object.keys(exp || {}).forEach(function (k) {
    var v = exp[k];
    out[k] = (typeof v === 'function') ? withScope(v, ctx, scope) : v;
  });
  return out;
};

/**
 * Run an import on the sync render path. `run` binds the imported file's own
 * imports and macros on `scope`, an object of the import, and on closure
 * variables of the function it is (see backend.syncImport), so the import
 * writes nothing in the importer's context; the exports are the named macros.
 * A macro reaches a name of the scope through its closure variable while the
 * importer's context lacks that name; when the context holds it, or the name
 * has no closure variable, each export is wrapped so the scope's value is in
 * the context while it runs (see whenHidden).
 * @param  {object}   ctx   The importer's context.
 * @param  {Function} run   function (scope) binding the imports and macros on scope.
 * @param  {string[]} names Names of the macros to export.
 * @param  {string[]} refs  Names of the scope the macros read or write in the context.
 * @param  {string[]} vars  Names of the scope that are closure variables of `run`.
 * @return {object}         The exports.
 */
exports.importScope = function (ctx, run, names, refs, vars) {
  var has = Object.prototype.hasOwnProperty, scope = Object.create(null), need = [], closure = [], exp = {};
  run(scope);
  (refs || []).forEach(function (k) {
    if (has.call(scope, k) && need.indexOf(k) === -1) {
      need.push(k);
      closure.push((vars || []).indexOf(k) !== -1);
    }
  });
  names.forEach(function (k) {
    var v = scope[k];
    exp[k] = (need.length && typeof v === 'function') ? whenHidden(v, ctx, scope, need, closure) : v;
  });
  return exp;
};

/*!
 * Wrap a macro a sync import exports. A name of the import's scope that the
 * macros read resolves through its closure variable unless the importer's
 * context holds that name, which a lookup reads first: such a name, and one
 * that has no closure variable (`closure[i]` false), is put in the context
 * while the macro runs, and the context's own value, or its absence, is back
 * afterwards. A call that needs none of them runs the macro directly.
 * @private
 */
function whenHidden(fn, ctx, scope, need, closure) {
  var has = Object.prototype.hasOwnProperty;
  var wrapped = function () {
    var put = null, i, k;
    for (i = 0; i < need.length; i += 1) {
      k = need[i];
      if (ctx[k] !== scope[k] && (ctx[k] !== undefined || !closure[i])) {
        if (!put) {
          put = [];
        }
        put.push(k, has.call(ctx, k), ctx[k]);
        ctx[k] = scope[k];
      }
    }
    if (!put) {
      return fn.apply(this, arguments);
    }
    try {
      return fn.apply(this, arguments);
    } finally {
      for (i = put.length - 3; i >= 0; i -= 3) {
        if (put[i + 1]) {
          ctx[put[i]] = put[i + 2];
        } else {
          delete ctx[put[i]];
        }
      }
    }
  };
  wrapped.safe = fn.safe;
  return wrapped;
}

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
 * Get the values of an object's own enumerable properties, in key order.
 * @param  {object} obj
 * @return {array}
 */
exports.values = function (obj) {
  var out = [];
  exports.each(exports.keys(obj), function (k) {
    out.push(obj[k]);
  });
  return out;
};

/**
 * The values a two-name loop binds from one item of a list, as Python
 * unpacks it: a list gives its own items, a string its characters (code
 * points, a surrogate pair kept together), a mapping its keys, anything else
 * nothing. The loop reads the first two, so a missing value is undefined and
 * extra values are ignored.
 * @param  {*} item
 * @return {array}
 */
exports.unpack = function (item) {
  var out, i = 0, c, d;
  if (isArray(item)) {
    return item;
  }
  out = [];
  if (typeof item === 'string') {
    while (i < item.length && out.length < 2) {
      c = item.charCodeAt(i);
      d = i + 1 < item.length ? item.charCodeAt(i + 1) : 0;
      if (c >= 0xD800 && c <= 0xDBFF && d >= 0xDC00 && d <= 0xDFFF) {
        out.push(item.slice(i, i + 2));
        i += 2;
      } else {
        out.push(item.charAt(i));
        i += 1;
      }
    }
    return out;
  }
  if (item !== null && typeof item === 'object') {
    return exports.keys(item);
  }
  return out;
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
 * The largest number of elements a builder creates from a number in the
 * data: the values of a numeric range (swig-twig's `a..b`), the columns of
 * swig-jinja2's `slice` filter and the padding of the `batch` filters. A
 * larger size gives an empty range or slice, as an infinite one does, and
 * leaves a batch unpadded, since building it could exhaust the heap and
 * abort the process.
 *
 * @type {number}
 */
exports.maxSize = 1000000;

/**
 * Inclusive range generator. Mirrors Twig's `..` operator semantics and
 * PHP's range(): numeric bounds produce [from, from±1, ..., to]; single-
 * character string bounds produce a char array across the charCode span.
 * Descending when `from > to`. Mismatched or unsupported argument shapes,
 * a numeric bound that is not finite, and a numeric range of more than
 * `maxSize` elements return an empty array so compiled templates degrade
 * silently rather than throwing at render time. From 2^53 on, adding 1 no
 * longer changes a number, so a range whose values reach 2^53 counts as
 * longer than `maxSize`.
 *
 * @param  {number|string} from
 * @param  {number|string} to
 * @return {Array}
 */
exports.range = function (from, to) {
  var out = [], i, fc, tc;
  if (typeof from === 'number' && typeof to === 'number') {
    // An infinite bound is never reached, so the loop below ran until the
    // array overflowed (seconds, and gigabytes, before a RangeError); plain
    // JSON yields Infinity for a number such as 1e999. PHP 8.3's range()
    // rejects such a bound; the range is empty here, as for NaN.
    if (!isFinite(from) || !isFinite(to)) {
      return out;
    }
    // A range of more than maxSize elements could build an array until the
    // heap ran out (under a 256 MB heap a bound of 1e8 from the data aborted
    // the process), and from 2^53 on i += 1 no longer changes i, so such a
    // loop never ended. The loop now stops before element maxSize + 1 and the
    // range is empty, as for an infinite bound; a range of up to maxSize
    // elements is unchanged.
    if (from <= to) {
      // for (i = from; i <= to; i += 1) { out.push(i); }
      for (i = from; i <= to; i += 1) {
        if (out.length >= exports.maxSize) { return []; }
        out.push(i);
      }
    } else {
      // for (i = from; i >= to; i -= 1) { out.push(i); }
      for (i = from; i >= to; i -= 1) {
        if (out.length >= exports.maxSize) { return []; }
        out.push(i);
      }
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

/*!
 * Item equality for `isIn`. Jinja2 and Django compare with `===` and treat
 * null and a missing value as equal (Django reads both as None). Twig
 * compares two scalars with `==`, as swig-twig's `==` does, and anything
 * else by identity. @private
 */
function sameItem(a, b, twig) {
  if (a === b) {
    return true;
  }
  if (!twig) {
    return (a === null || a === undefined) && (b === null || b === undefined);
  }
  if ((a !== null && typeof a === 'object') || (b !== null && typeof b === 'object') ||
      typeof a === 'function' || typeof b === 'function') {
    return false;
  }
  return a == b;
}

/*!
 * The membership test of `isIn`: true or false, or null when Jinja2 and
 * Django cannot run it, where Python raises a TypeError: a container that is
 * not a list, a string or a mapping, a needle that is not a string tested
 * against a string, or a list or an object tested against a mapping's keys.
 * Twig runs every test. @private
 */
function membership(needle, haystack, twig) {
  var keys, i;
  if (typeof haystack === 'string') {
    if (typeof needle === 'string' || (twig && typeof needle === 'number')) {
      return haystack.indexOf(String(needle)) !== -1;
    }
    return twig ? false : null;
  }
  if (haystack === null || typeof haystack !== 'object') {
    return twig ? false : null;
  }
  if (exports.isArray(haystack)) {
    for (i = 0; i < haystack.length; i += 1) {
      if (sameItem(needle, haystack[i], twig)) {
        return true;
      }
    }
    return false;
  }
  if (twig) {
    keys = Object.keys(haystack);
    for (i = 0; i < keys.length; i += 1) {
      if (sameItem(needle, haystack[keys[i]], true)) {
        return true;
      }
    }
    return false;
  }
  if (typeof needle === 'string' || typeof needle === 'number') {
    return Object.prototype.hasOwnProperty.call(haystack, String(needle));
  }
  return (needle !== null && typeof needle === 'object') ? null : false;
}

/**
 * Membership test behind the `in` operator of the Twig, Jinja2 and Django
 * frontends, which set `IRBinaryOp.membership` to their flavor name; native
 * swig keeps the JavaScript `in` operator, which tests keys. Each flavor
 * follows its reference engine:
 *
 * - Jinja2 and Django (Python's `in`): a list holds an equal item, a string
 *   a substring (the needle must be a string), a mapping a key (a number
 *   needle tests the key with the same digits).
 * - Twig: a list or a mapping holds an equal value, compared loosely; a
 *   string holds a string or number needle as a substring.
 *
 * A test the engine cannot run (Jinja2 raises; Django's if tag reads it as
 * false) gives false, as does any other container, rather than an error.
 * With `negate` (the `not in` operator) the result is negated, except that
 * Django reads a test it cannot run as false for `not in` too.
 *
 * @param  {*}       needle
 * @param  {*}       haystack
 * @param  {string}  mode      "twig", "jinja2" or "django".
 * @param  {boolean} [negate]  The `not in` form.
 * @return {boolean}
 */
exports.isIn = function (needle, haystack, mode, negate) {
  var found = membership(needle, haystack, mode === 'twig');
  if (found === null) {
    return negate === true && mode !== 'django';
  }
  return negate === true ? !found : found;
};
