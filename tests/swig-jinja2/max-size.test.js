var jinja2 = require('@rhinostone/swig-jinja2'),
  filters = require('@rhinostone/swig-jinja2/lib/filters'),
  runCapped = require('../lib/run-capped.js'),
  expect = require('../lib/expect.js');

/*!
 * swig-jinja2 builds arrays from numbers in the data in two filters: the
 * columns of `slice` and the padding of `batch`. Each stops at swig-core's
 * `utils.maxSize` (1,000,000): more columns give an empty list, as an
 * infinite count already did, and a larger batch size leaves the last row
 * unpadded. The huge cases run in a child process whose heap is capped at
 * 64 MB, so a missing guard aborts that child instead of the test run.
 */
var JINJA2 = JSON.stringify(require.resolve('@rhinostone/swig-jinja2')),
  FILTERS = JSON.stringify(require.resolve('@rhinostone/swig-jinja2/lib/filters'));

function filterInChild(name, args) {
  return runCapped('var r = require(' + FILTERS + ').' + name + '(' + args + ');' +
    'console.log(JSON.stringify(r));');
}

function renderInChild(src, json) {
  return runCapped('var r = require(' + JINJA2 + ').render(' + JSON.stringify(src) + ', ' +
    '{ locals: JSON.parse(' + JSON.stringify(json) + ') });console.log(JSON.stringify(r));');
}

describe('@rhinostone/swig-jinja2 — slice and batch size cap', function () {
  it('slice builds exactly maxSize columns', function () {
    var out = filters.slice([1, 2, 3], 1000000, 0);
    expect(out.length).to.be(1000000);
    expect(out[0]).to.eql([1]);
    expect(out[2]).to.eql([3]);
    expect(out[999999]).to.eql([0]);
  });

  it('slice returns an empty list for more columns than maxSize', function () {
    expect(filters.slice([1, 2, 3], 1000001)).to.eql([]);
    expect(filters.slice([1, 2, 3], 1000000.5)).to.eql([]);
  });

  it('slice does not exhaust the heap for a huge count, numeric or string', function () {
    expect(filterInChild('slice', '[1, 2, 3], 1e8')).to.equal('null 0 []');
    expect(filterInChild('slice', '[1, 2, 3], "1e8"')).to.equal('null 0 []');
    expect(filterInChild('slice', '[1, 2, 3], 1e20, 0')).to.equal('null 0 []');
  });

  it('batch pads the last row up to a size of exactly maxSize', function () {
    var out = filters.batch([1], 1000000, 0);
    expect(out.length).to.be(1);
    expect(out[0].length).to.be(1000000);
    expect(out[0][0]).to.be(1);
    expect(out[0][999999]).to.be(0);
  });

  it('batch leaves the last row unpadded for a size past maxSize', function () {
    expect(filters.batch([1, 2], 1000001, 0)).to.eql([[1, 2]]);
  });

  it('batch does not exhaust the heap for a huge size', function () {
    expect(filterInChild('batch', '[1], 1e8, 0')).to.equal('null 0 [[1]]');
    expect(filterInChild('batch', '[1], 1e20, 0')).to.equal('null 0 [[1]]');
  });

  it('renders slice and batch with a huge count from the data', function () {
    expect(renderInChild('{% for col in items|slice(n) %}x{% endfor %}',
      '{"items": [1, 2, 3], "n": 1e8}')).to.equal('null 0 ""');
    expect(renderInChild('{% for row in items|batch(n, 0) %}{{ row|length }};{% endfor %}',
      '{"items": [1, 2, 3], "n": 1e8}')).to.equal('null 0 "3;"');
  });
});
