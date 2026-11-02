var utils = require('@rhinostone/swig-core/lib/utils'),
  vm = require('vm'),
  expect = require('../lib/expect.js');

/*!
 * `_utils.pyEq` is Python's `==`, behind the comparisons of swig-jinja2 and
 * swig-django; `_utils.isIn` uses the same equality for their `in`.
 */
describe('swig-core utils.pyEq', function () {

  function nested(depth) {
    var v = 1, i;
    for (i = 0; i < depth; i += 1) {
      v = [v];
    }
    return v;
  }

  it('compares numbers and booleans as Python does', function () {
    expect(utils.pyEq(1, true)).to.be(true);
    expect(utils.pyEq(true, 1)).to.be(true);
    expect(utils.pyEq(0, false)).to.be(true);
    expect(utils.pyEq(2, true)).to.be(false);
    expect(utils.pyEq(true, false)).to.be(false);
    expect(utils.pyEq(1.5, 1.5)).to.be(true);
    expect(utils.pyEq(0, -0)).to.be(true);
    expect(utils.pyEq(NaN, NaN)).to.be(false);
  });

  it('never equates a string with a number or a boolean', function () {
    expect(utils.pyEq('1', 1)).to.be(false);
    expect(utils.pyEq(1, '1')).to.be(false);
    expect(utils.pyEq('', 0)).to.be(false);
    expect(utils.pyEq('', false)).to.be(false);
    expect(utils.pyEq('True', true)).to.be(false);
    expect(utils.pyEq('a', 'a')).to.be(true);
    expect(utils.pyEq('a', 'A')).to.be(false);
  });

  it('compares a BigInt with a number or a boolean by value', function () {
    var big = global.BigInt;
    expect(utils.pyEq(big(5), 5)).to.be(true);
    expect(utils.pyEq(5, big(5))).to.be(true);
    expect(utils.pyEq(big(1), true)).to.be(true);
    expect(utils.pyEq(big(5), big(5))).to.be(true);
    expect(utils.pyEq(big(5), '5')).to.be(false);
  });

  it('equates null and undefined, both read as None', function () {
    expect(utils.pyEq(null, undefined)).to.be(true);
    expect(utils.pyEq(undefined, null)).to.be(true);
    expect(utils.pyEq(undefined, undefined)).to.be(true);
    expect(utils.pyEq(null, null)).to.be(true);
    expect(utils.pyEq(null, 0)).to.be(false);
    expect(utils.pyEq(0, null)).to.be(false);
    expect(utils.pyEq(undefined, '')).to.be(false);
    expect(utils.pyEq([null], [undefined])).to.be(true);
    expect(utils.pyEq({ k: null }, { k: undefined })).to.be(true);
  });

  it('compares lists and mappings item by item', function () {
    expect(utils.pyEq([1, [2, { k: 'v' }]], [1, [2, { k: 'v' }]])).to.be(true);
    expect(utils.pyEq([1, 2], [2, 1])).to.be(false);
    expect(utils.pyEq([1], [1, 2])).to.be(false);
    expect(utils.pyEq([true], [1])).to.be(true);
    expect(utils.pyEq([1], ['1'])).to.be(false);
    expect(utils.pyEq({ a: 1, b: 2 }, { b: 2, a: 1 })).to.be(true);
    expect(utils.pyEq({ a: 1 }, { a: 1, b: 2 })).to.be(false);
    expect(utils.pyEq({ a: 1, b: null }, { a: 1, c: null })).to.be(false);
    expect(utils.pyEq({ a: 1, b: undefined }, { a: 1, c: undefined }, true)).to.be(false);
    expect(utils.pyEq({ k: [1] }, { k: [true] })).to.be(true);
    expect(utils.pyEq([], {})).to.be(false);
    expect(utils.pyEq({}, [])).to.be(false);
    expect(utils.pyEq([], [])).to.be(true);
  });

  it('takes plain objects from Object.create(null), JSON with an own __proto__ key and another realm', function () {
    var a = Object.create(null), b = Object.create(null);
    a.k = 1;
    b.k = 1;
    expect(utils.pyEq(a, b)).to.be(true);
    expect(utils.pyEq(a, { k: 1 })).to.be(true);
    expect(utils.pyEq(JSON.parse('{"__proto__": [1], "k": 2}'), JSON.parse('{"k": 2, "__proto__": [1]}'))).to.be(true);
    expect(utils.pyEq(JSON.parse('{"__proto__": [1]}'), JSON.parse('{"__proto__": [2]}'))).to.be(false);
    expect(utils.pyEq(JSON.parse('{"__proto__": [1]}'), {})).to.be(false);
    expect(utils.pyEq(vm.runInNewContext('({ k: [1, { n: null }] })'), { k: [1, { n: null }] })).to.be(true);
    expect(utils.pyEq(vm.runInNewContext('[1, [2]]'), [1, [2]])).to.be(true);
    expect(utils.pyEq(vm.runInNewContext('new Date(0)'), new Date(0))).to.be(true);
  });

  it('compares a Date by its time, and anything else by identity', function () {
    var m = new Map(), s = new Set(), f = function () { return 1; };
    function C() { this.k = 1; }
    expect(utils.pyEq(new Date(5), new Date(5))).to.be(true);
    expect(utils.pyEq(new Date(5), new Date(6))).to.be(false);
    expect(utils.pyEq(new Date(5), 5)).to.be(false);
    expect(utils.pyEq(new Date(0), {})).to.be(false);
    expect(utils.pyEq({}, new Date(0))).to.be(false);
    expect(utils.pyEq(new Map(), new Map())).to.be(false);
    expect(utils.pyEq(m, m)).to.be(true);
    expect(utils.pyEq(new Set(), new Set())).to.be(false);
    expect(utils.pyEq(s, s)).to.be(true);
    expect(utils.pyEq(new C(), new C())).to.be(false);
    expect(utils.pyEq(new C(), { k: 1 })).to.be(false);
    expect(utils.pyEq({ k: 1 }, new C())).to.be(false);
    expect(utils.pyEq(f, f)).to.be(true);
    expect(utils.pyEq(f, function () { return 1; })).to.be(false);
  });

  it('stops at a depth of 1000, so two different cycles read as not equal', function () {
    var a = [], b = [], o = {}, p = {};
    a.push(a);
    b.push(b);
    o.k = o;
    p.k = p;
    expect(utils.pyEq(nested(1000), nested(1000))).to.be(true);
    expect(utils.pyEq(nested(1001), nested(1001))).to.be(false);
    expect(utils.pyEq(a, b)).to.be(false);
    expect(utils.pyEq(o, p)).to.be(false);
    expect(utils.pyEq(a, a)).to.be(true);
    expect(utils.pyEq(o, o)).to.be(true);
  });

  it('is the item equality of isIn in Jinja2 and Django', function () {
    expect(utils.isIn([1, 2], [[1, 2]], 'jinja2')).to.be(true);
    expect(utils.isIn({ k: 1 }, [{ k: true }], 'django')).to.be(true);
    expect(utils.isIn(undefined, [undefined], 'jinja2')).to.be(true);
    expect(utils.isIn(undefined, [null], 'jinja2')).to.be(true);
    expect(utils.isIn([1], [[1]], 'twig')).to.be(false);
  });
});
