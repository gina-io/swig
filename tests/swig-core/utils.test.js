var utils = require('@rhinostone/swig-core/lib/utils'),
  expect = require('expect.js');


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
