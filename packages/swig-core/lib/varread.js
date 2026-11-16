/*!
 * Compile-time classes of a template variable name, deciding whether a read
 * of it may fall back to a JavaScript identifier of the same name when the
 * context holds no value for it:
 * - 'none': a reserved word that is a syntax error as an identifier, a member
 *   of Object.prototype, or a name the emitted code declares around template
 *   code: no fallback;
 * - 'global': a standard JavaScript global (Math, JSON ...) or a name a macro
 *   may hand to other code (_ctx, _exports, __ctx): the fallback only while
 *   the context has no such key;
 * - 'plain': any other name: the fallback, as before.
 * A path that holds no name of the first two classes and no Object.prototype
 * member compiles to the same code as before.
 * @private
 */
var hasOwn = Object.prototype.hasOwnProperty;

/*!
 * Reserved words that are a syntax error as an identifier reference
 * (`typeof class`), in a plain function or (await) in an AsyncFunction.
 * @private
 */
var SYNTAX = ('break case catch class const continue debugger default delete do else enum export extends ' +
  'finally for function if import in instanceof new return super switch throw try typeof var void while with ' +
  'await').split(' ');

/*!
 * Names emitted code declares or receives around template code. A name
 * starting with `__` is one too (`__l`, `__len`, `__k`, `__ctx` ...).
 * @private
 */
var INTERNAL = ('_swig _ctx _filters _utils _fn _ext _output _exports _blocks _parentBlock _ownBlocks _nearer ' +
  '_scope _imp _parentTpl _parentResult arguments').split(' ');

/*!
 * The standard globals of the backend's NOT_CLOSURE list: read through the
 * fallback only when the context has no such key ("<name>" in _ctx; an own
 * key holding undefined, such as a loop item, does not fall back).
 * @private
 */
var GLOBALS = ('undefined NaN Infinity globalThis Object Function Array String Number Boolean Symbol BigInt Math JSON ' +
  'Date RegExp Error EvalError RangeError ReferenceError SyntaxError TypeError URIError Promise Proxy Reflect ' +
  'Map Set WeakMap WeakSet ArrayBuffer DataView parseInt parseFloat isNaN isFinite encodeURI encodeURIComponent ' +
  'decodeURI decodeURIComponent escape unescape console require module exports process Buffer window self ' +
  'document eval').split(' ');

/*!
 * True for a name an object gets from Object.prototype (toString, constructor ...).
 * @private
 */
function protoName(name) {
  return typeof name === 'string' && hasOwn.call(Object.prototype, name);
}

/*!
 * The names a macro may hand to other code by name ({{ fn(_ctx) }}, __ctx,
 * _exports; see passesCtx in the backend) keep the fallback when the context
 * has no such key; the other compiled-code names get none.
 * @private
 */
var HANDED = ['_ctx', '_exports', '__ctx'];

/*!
 * The class of a path's head: 'none', 'global' or 'plain' (see above).
 * @private
 */
function closureClass(head) {
  if (SYNTAX.indexOf(head) !== -1 || protoName(head)) {
    return 'none';
  }
  if (GLOBALS.indexOf(head) !== -1 || HANDED.indexOf(head) !== -1) {
    return 'global';
  }
  if (INTERNAL.indexOf(head) !== -1 || head.slice(0, 2) === '__') {
    return 'none';
  }
  return 'plain';
}

/*!
 * True for a name of the global class, whose read falls back only while the
 * context has no such key; the For emit restores such a loop name by deleting
 * a key the context did not have.
 * @private
 */
exports.globalName = function (name) {
  return typeof name === 'string' && closureClass(name) === 'global';
};

/*!
 * A `(typeof <head> !== "undefined" && <head> !== null && ...)` walk of a
 * path under a prefix ('_ctx.' or ''), with an own-member test on each
 * Object.prototype name, so such a member the value only inherits reads as
 * missing.
 * @private
 */
function walk(path, prefix) {
  var c = prefix + path[0],
    build = '(typeof ' + c + ' !== "undefined" && ' + c + ' !== null',
    i;
  if (prefix && protoName(path[0])) {
    build += ' && !_utils.protoMember(_ctx, "' + path[0] + '")';
  }
  for (i = 1; i < path.length; i += 1) {
    build += ' && ' + c + '.' + path[i] + ' !== undefined && ' + c + '.' + path[i] + ' !== null';
    if (protoName(path[i])) {
      build += ' && !_utils.protoMember(' + c + ', "' + path[i] + '")';
    }
    c += '.' + path[i];
  }
  return build + ')';
}

/*!
 * The bare-closure walk of a path, or null when its head's class allows no
 * fallback.
 * @private
 */
function closureWalk(path) {
  var cls = closureClass(path[0]),
    w;
  if (cls === 'none') {
    return null;
  }
  w = walk(path, '');
  return cls === 'global' ? '(!("' + path[0] + '" in _ctx) && ' + w + ')' : w;
}

/*!
 * The read of a variable for output: the context walk, then the closure walk
 * when allowed, then "".
 * @private
 */
exports.matchExpr = function (path) {
  var leaf = path.join('.'),
    ctx = walk(path, '_ctx.'),
    cl = closureWalk(path);
  if (!cl) {
    return '(' + ctx + ' ? _ctx.' + leaf + ' : "")';
  }
  return '(' + ctx + ' ? _ctx.' + leaf + ' : (' + cl + ' ? ' + leaf + ' : ""))';
};

/*!
 * The existence test of a variable (`is defined`, `??`).
 * @private
 */
exports.existsExpr = function (path) {
  var ctx = walk(path, '_ctx.'),
    cl = closureWalk(path);
  return '(' + ctx + (cl ? ' || ' + cl : '') + ')';
};

/*!
 * The raw read of a variable, for an operand of Python's `==`, `!=` or `in`:
 * a null leaf stays null and a missing path gives undefined.
 * @private
 */
exports.rawExpr = function (path) {
  var leaf = path.join('.'),
    head,
    last = path[path.length - 1],
    cls = closureClass(path[0]),
    ctxPart,
    clPart;
  if (path.length === 1) {
    ctxPart = 'typeof _ctx.' + leaf + ' !== "undefined"';
    if (protoName(leaf)) {
      ctxPart = '(' + ctxPart + ' && !_utils.protoMember(_ctx, "' + leaf + '"))';
    }
    if (cls === 'none') {
      return '(' + ctxPart + ' ? _ctx.' + leaf + ' : undefined)';
    }
    if (cls === 'global') {
      return '(' + ctxPart + ' ? _ctx.' + leaf + ' : (!("' + leaf + '" in _ctx) && typeof ' + leaf + ' !== "undefined" ? ' + leaf + ' : undefined))';
    }
    return '(' + ctxPart + ' ? _ctx.' + leaf + ' : (typeof ' + leaf + ' !== "undefined" ? ' + leaf + ' : undefined))';
  }
  head = path.slice(0, -1);
  ctxPart = walk(head, '_ctx.') + ' && _ctx.' + leaf + ' !== undefined';
  if (protoName(last)) {
    ctxPart += ' && !_utils.protoMember(_ctx.' + head.join('.') + ', "' + last + '")';
  }
  if (cls === 'none') {
    return '((' + ctxPart + ') ? _ctx.' + leaf + ' : undefined)';
  }
  clPart = walk(head, '') + ' && ' + leaf + ' !== undefined';
  if (protoName(last)) {
    clPart += ' && !_utils.protoMember(' + head.join('.') + ', "' + last + '")';
  }
  if (cls === 'global') {
    clPart = '!("' + path[0] + '" in _ctx) && ' + clPart;
  }
  return '((' + ctxPart + ') ? _ctx.' + leaf + ' : ((' + clPart + ') ? ' + leaf + ' : undefined))';
};

/*!
 * The callee of a one-segment call, up to the argument list; _fn when nothing
 * is found.
 * @private
 */
exports.callHead = function (name) {
  var test = 'typeof _ctx.' + name + ' !== "undefined"';
  if (protoName(name)) {
    test += ' && !_utils.protoMember(_ctx, "' + name + '")';
  }
  if (closureClass(name) === 'none') {
    return '((' + test + ') ? _ctx.' + name + ' : _fn)';
  }
  if (closureClass(name) === 'global') {
    return '((' + test + ') ? _ctx.' + name + ' : ((!("' + name + '" in _ctx) && typeof ' + name + ' !== "undefined") ? ' + name + ' : _fn))';
  }
  return '((' + test + ') ? _ctx.' + name + ' : ((typeof ' + name + ' !== "undefined") ? ' + name + ' : _fn))';
};
