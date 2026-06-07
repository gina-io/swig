var utils = require('@rhinostone/swig-core/lib/utils'),
  expect = require('../lib/expect.js');


/*!
 * utils.slice — Python-style slice for arrays and strings.
 *
 * Backs the Jinja2 `seq[start:stop:step]` subscript. Pins the CPython
 * slice semantics: negative indices, omitted bounds, positive/negative
 * step, and graceful degradation on a non-indexable input.
 */
describe('@rhinostone/swig-core — utils.slice', function () {

  var nums = [1, 2, 3, 4, 5];

  it('returns the [start:stop] window', function () {
    expect(utils.slice(nums, 1, 3)).to.eql([2, 3]);
  });

  it('defaults an omitted start to the beginning', function () {
    expect(utils.slice(nums, null, 3)).to.eql([1, 2, 3]);
  });

  it('defaults an omitted stop to the end', function () {
    expect(utils.slice(nums, 2, null)).to.eql([3, 4, 5]);
  });

  it('treats a negative start as counting from the end', function () {
    expect(utils.slice(nums, -3, null)).to.eql([3, 4, 5]);
  });

  it('treats a negative stop as counting from the end', function () {
    expect(utils.slice(nums, null, -1)).to.eql([1, 2, 3, 4]);
  });

  it('reverses with a step of -1', function () {
    expect(utils.slice(nums, null, null, -1)).to.eql([5, 4, 3, 2, 1]);
  });

  it('walks with a positive step', function () {
    expect(utils.slice(nums, null, null, 2)).to.eql([1, 3, 5]);
  });

  it('walks with a negative step from an explicit start', function () {
    expect(utils.slice(nums, 4, 0, -1)).to.eql([5, 4, 3, 2]);
  });

  it('clamps out-of-range bounds', function () {
    expect(utils.slice(nums, 0, 100)).to.eql([1, 2, 3, 4, 5]);
    expect(utils.slice(nums, -100, 100)).to.eql([1, 2, 3, 4, 5]);
  });

  it('returns an empty array for an empty window', function () {
    expect(utils.slice(nums, 3, 1)).to.eql([]);
  });

  it('slices strings and returns a string', function () {
    expect(utils.slice('hello', 1, 4)).to.equal('ell');
    expect(utils.slice('hello', null, null, -1)).to.equal('olleh');
    expect(utils.slice('hello', -2, null)).to.equal('lo');
  });

  it('degrades to an empty result on a null / non-indexable input', function () {
    expect(utils.slice(null, 0, 1)).to.eql([]);
    expect(utils.slice(undefined, 0, 1)).to.eql([]);
    expect(utils.slice(42, 0, 1)).to.eql([]);
  });

  it('treats a zero step as 1 rather than throwing', function () {
    expect(utils.slice(nums, 0, 3, 0)).to.eql([1, 2, 3]);
  });

});


/*!
 * utils.resolve — Django-style variable resolution (swig-core "change B").
 *
 * Per-segment property / attribute / index lookup, auto-call of callable
 * leaves (bound to the receiver) honoring alters_data /
 * do_not_call_in_templates, a runtime _dangerousProps guard, and raw
 * null/undefined preservation (coercion is deferred to the output drain).
 * Opted into per-VarRef by the Django frontend; dormant for the other flavors.
 */
describe('@rhinostone/swig-core — utils.resolve', function () {

  it('resolves a simple property', function () {
    expect(utils.resolve({ a: 'x' }, ['a'])).to.equal('x');
  });

  it('walks a dotted path', function () {
    expect(utils.resolve({ a: { b: { c: 'deep' } } }, ['a', 'b', 'c'])).to.equal('deep');
  });

  it('indexes an array by a numeric segment ({{ list.0 }})', function () {
    expect(utils.resolve({ list: [10, 20, 30] }, ['list', '0'])).to.equal(10);
    expect(utils.resolve({ list: [10, 20, 30] }, ['list', '2'])).to.equal(30);
  });

  it('indexes a string by a numeric segment', function () {
    expect(utils.resolve({ w: 'abc' }, ['w', '1'])).to.equal('b');
  });

  it('auto-calls a callable leaf with no arguments', function () {
    expect(utils.resolve({ fn: function () { return 'Y'; } }, ['fn'])).to.equal('Y');
  });

  it('auto-calls a method bound to its receiver (this)', function () {
    var user = { first: 'Jo', get_full_name: function () { return this.first + ' Doe'; } };
    expect(utils.resolve({ user: user }, ['user', 'get_full_name'])).to.equal('Jo Doe');
  });

  it('does not call a function flagged alters_data (yields undefined)', function () {
    var f = function () { return 'X'; };
    f.alters_data = true;
    expect(utils.resolve({ f: f }, ['f'])).to.be(undefined);
  });

  it('returns a function flagged do_not_call_in_templates uncalled', function () {
    var f = function () { return 'X'; };
    f.do_not_call_in_templates = true;
    expect(typeof utils.resolve({ f: f }, ['f'])).to.equal('function');
  });

  it('rejects __proto__ / constructor / prototype segments at runtime', function () {
    expect(utils.resolve({}, ['__proto__'])).to.be(undefined);
    expect(utils.resolve({ a: {} }, ['a', 'constructor'])).to.be(undefined);
    expect(utils.resolve({ a: {} }, ['a', 'prototype'])).to.be(undefined);
  });

  it('short-circuits to null when a segment is null', function () {
    expect(utils.resolve({ a: null }, ['a', 'b'])).to.be(null);
  });

  it('returns undefined for a missing segment', function () {
    expect(utils.resolve({}, ['nope'])).to.be(undefined);
  });

  it('yields undefined when an auto-call throws (Django string_if_invalid)', function () {
    var f = function () { throw new Error('boom'); };
    expect(utils.resolve({ f: f }, ['f'])).to.be(undefined);
  });

});
