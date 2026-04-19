/**
 * @rhinostone/swig-twig — built-in test runtime helpers.
 *
 * Twig `is <name>` / `is not <name>` expressions lower to
 * `_ext._test_<name>(subject, ...args)` at the IR layer. The Twig
 * constructor registers each export here via `self.setExtension('_test_'
 * + name, fn)`, which installs the helper onto the per-instance
 * `_swig.extensions` map — so Path A (`new Twig().render(...)`) honors
 * per-instance overrides without leaking cross-instance.
 *
 * Two tests (`defined`, `null`) are additionally special-cased in the
 * Twig parser when the subject is a VarRef with no args: both route
 * through IRVarRefExists to preserve the defined/undefined signal that
 * `emitVarRef` coerces to "". The helpers below still run for non-VarRef
 * subjects (literals, BinaryOp, FnCall) where the coercion isn't in
 * play. See packages/swig-twig/lib/parser.js `parseExpression` IS/ISNOT
 * branch for the special-case logic.
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
 * `foo is null` — true when the subject is `null` or `undefined`. The
 * VarRef-subject path bypasses this helper and uses `!IRVarRefExists`.
 *
 * @param  {*} v
 * @return {boolean}
 */
exports['null'] = function (v) {
  return v === null || typeof v === 'undefined';
};

/**
 * `foo is empty` — true for `null`, `undefined`, `""`, empty arrays,
 * and objects with no own-enumerable keys.
 *
 * @param  {*} v
 * @return {boolean}
 */
exports['empty'] = function (v) {
  if (v === null || typeof v === 'undefined') { return true; }
  if (typeof v === 'string') { return v.length === 0; }
  if (Object.prototype.toString.call(v) === '[object Array]') { return v.length === 0; }
  if (typeof v === 'object') {
    for (var k in v) {
      if (Object.prototype.hasOwnProperty.call(v, k)) { return false; }
    }
    return true;
  }
  return false;
};

/**
 * `foo is iterable` — true for arrays and non-null objects (mirrors
 * Twig's rule that dicts iterate by key).
 *
 * @param  {*} v
 * @return {boolean}
 */
exports['iterable'] = function (v) {
  if (v === null || typeof v === 'undefined') { return false; }
  if (Object.prototype.toString.call(v) === '[object Array]') { return true; }
  return typeof v === 'object';
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
 * `n is even` — true for numbers whose remainder mod 2 is zero.
 *
 * @param  {number} v
 * @return {boolean}
 */
exports['even'] = function (v) {
  return isNumber(v) && v % 2 === 0;
};

/**
 * `n is divisibleby(m)` — true when `m` is a non-zero number and `n % m
 * === 0`. Twig's canonical name for the test.
 *
 * @param  {number} v
 * @param  {number} n
 * @return {boolean}
 */
exports['divisibleby'] = function (v, n) {
  return isNumber(v) && isNumber(n) && n !== 0 && v % n === 0;
};
