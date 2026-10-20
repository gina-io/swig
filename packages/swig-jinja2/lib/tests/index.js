/**
 * @rhinostone/swig-jinja2 — built-in test runtime helpers.
 *
 * Jinja2 `is <name>` / `is not <name>` expressions lower to
 * `_ext._test_<name>(subject, ...args)` at the IR layer. The Jinja2
 * constructor registers each export here via `self.setExtension('_test_'
 * + name, fn)`, which installs the helper onto the per-instance
 * `_swig.extensions` map — so Path A (`new Jinja2().render(...)`) honors
 * per-instance overrides without leaking cross-instance.
 *
 * Three tests (`defined`, `none`, `undefined`) are additionally
 * special-cased in the parser when the subject is a VarRef with no args:
 * they route through IRVarRefExists to preserve the defined/undefined
 * signal that `emitVarRef` coerces to "". The helpers below still run for
 * non-VarRef subjects (literals, BinaryOp, FnCall) where the coercion is
 * not in play. See parser.js `parseExpression` IS/ISNOT branch.
 *
 * JS / Python impedance notes (documented divergences):
 *   - No int/float distinction in JS, so `is integer` / `is float` are not
 *     provided; use `is number`.
 *   - `is sequence` is array-or-string (ordered, integer-indexed); a dict
 *     is `is mapping` (not `is sequence`). `is iterable` covers arrays,
 *     strings, and objects, matching the `{% for %}` iterate-by-key rule.
 */

/*!
 * Array detection without depending on the runtime's Array.isArray (kept
 * browser-safe and consistent with the other per-flavor test helpers).
 * @private
 */
function isArr(v) {
  return Object.prototype.toString.call(v) === '[object Array]';
}

/*!
 * Finite-number guard shared by the numeric tests. @private
 */
function isNumber(v) {
  return typeof v === 'number' && !isNaN(v);
}

/**
 * `foo is defined` — true when the subject is not `undefined`. The
 * VarRef-subject path bypasses this helper and uses IRVarRefExists.
 *
 * @param  {*} v
 * @return {boolean}
 */
exports['defined'] = function (v) {
  return typeof v !== 'undefined';
};

/**
 * `foo is undefined` — true when the subject is `undefined`. The
 * VarRef-subject path bypasses this helper and uses `!IRVarRefExists`.
 *
 * @param  {*} v
 * @return {boolean}
 */
exports['undefined'] = function (v) {
  return typeof v === 'undefined';
};

/**
 * `foo is none` — true when the subject is `null` or `undefined` (Python
 * `None`). The VarRef-subject path bypasses this helper.
 *
 * @param  {*} v
 * @return {boolean}
 */
exports['none'] = function (v) {
  return v === null || typeof v === 'undefined';
};

/**
 * `foo is boolean` — true for a JS boolean.
 *
 * @param  {*} v
 * @return {boolean}
 */
exports['boolean'] = function (v) {
  return typeof v === 'boolean';
};

/**
 * `foo is number` — true for a finite number.
 *
 * @param  {*} v
 * @return {boolean}
 */
exports['number'] = function (v) {
  return isNumber(v);
};

/**
 * `foo is string` — true for a string.
 *
 * @param  {*} v
 * @return {boolean}
 */
exports['string'] = function (v) {
  return typeof v === 'string';
};

/**
 * `foo is mapping` — true for a plain object (a dict), excluding arrays
 * and null.
 *
 * @param  {*} v
 * @return {boolean}
 */
exports['mapping'] = function (v) {
  return typeof v === 'object' && v !== null && !isArr(v);
};

/**
 * `foo is sequence` — true for an array or string (ordered,
 * integer-indexed). A dict is `mapping`, not `sequence`.
 *
 * @param  {*} v
 * @return {boolean}
 */
exports['sequence'] = function (v) {
  return isArr(v) || typeof v === 'string';
};

/**
 * `foo is iterable` — true for arrays, strings, and non-null objects
 * (mirrors the `{% for %}` rule that dicts iterate by key).
 *
 * @param  {*} v
 * @return {boolean}
 */
exports['iterable'] = function (v) {
  if (v === null || typeof v === 'undefined') { return false; }
  if (isArr(v) || typeof v === 'string') { return true; }
  return typeof v === 'object';
};

/**
 * `foo is callable` — true for a function.
 *
 * @param  {*} v
 * @return {boolean}
 */
exports['callable'] = function (v) {
  return typeof v === 'function';
};

/**
 * `foo is sameas(bar)` — strict identity check (`foo === bar`).
 *
 * @param  {*} v
 * @param  {*} other
 * @return {boolean}
 */
exports['sameas'] = function (v, other) {
  return v === other;
};

/*!
 * Unicode case properties for `lower` / `upper`, as Python's
 * `str.islower` / `str.isupper` read them: a string needs at least one
 * cased letter, and none of the other case (a titlecase letter counts
 * against both). Built in a try/catch because an engine without Unicode
 * property escapes (ES2018) throws on them; it keeps the case-mapping
 * fallback below. @private
 */
var caseProps = (function () {
  try {
    return {
      lower: new RegExp('\\p{Lowercase}', 'u'),
      upper: new RegExp('\\p{Uppercase}', 'u'),
      notLower: new RegExp('[\\p{Uppercase}\\p{Lt}]', 'u'),
      notUpper: new RegExp('[\\p{Lowercase}\\p{Lt}]', 'u')
    };
  } catch (e) {
    return null;
  }
}());

/**
 * `foo is lower` — true when the subject is a string with at least one
 * cased letter and no uppercase or titlecase letter, as Python's
 * `str.islower`: `''`, `'123'` and `'-'` are neither lower nor upper.
 *
 * @param  {*} v
 * @return {boolean}
 */
exports['lower'] = function (v) {
  if (typeof v !== 'string') { return false; }
  if (caseProps) { return !caseProps.notLower.test(v) && caseProps.lower.test(v); }
  return v === v.toLowerCase() && v !== v.toUpperCase();
};

/**
 * `foo is upper` — true when the subject is a string with at least one
 * cased letter and no lowercase or titlecase letter, as Python's
 * `str.isupper`.
 *
 * @param  {*} v
 * @return {boolean}
 */
exports['upper'] = function (v) {
  if (typeof v !== 'string') { return false; }
  if (caseProps) { return !caseProps.notUpper.test(v) && caseProps.upper.test(v); }
  return v === v.toUpperCase() && v !== v.toLowerCase();
};

/**
 * `n is even` — true for numbers whose remainder mod 2 is zero.
 *
 * @param  {number} v
 * @return {boolean}
 */
exports['even'] = function (v) {
  return isNumber(v) && v % 2 === 0;
};

/**
 * `n is odd` — true for numbers whose remainder mod 2 is non-zero.
 *
 * @param  {number} v
 * @return {boolean}
 */
exports['odd'] = function (v) {
  return isNumber(v) && v % 2 !== 0;
};

/**
 * `n is divisibleby(m)` — true when `m` is a non-zero number and `n % m
 * === 0`.
 *
 * @param  {number} v
 * @param  {number} n
 * @return {boolean}
 */
exports['divisibleby'] = function (v, n) {
  return isNumber(v) && isNumber(n) && n !== 0 && v % n === 0;
};
