var twig = require('@rhinostone/swig-twig'),
  filters = require('@rhinostone/swig-twig/lib/filters'),
  runCapped = require('../lib/run-capped.js'),
  expect = require('../lib/expect.js');

/*!
 * swig-twig builds arrays from numbers in the data in two places: `a..b` (the
 * swig-core range helper) and the padding of `batch`. Each stops at
 * swig-core's `utils.maxSize` (1,000,000): a longer range is empty, and a
 * larger batch size leaves the last chunk unpadded. The huge cases run in a
 * child process whose heap is capped at 64 MB, so a missing guard aborts that
 * child instead of the test run.
 */
var TWIG = JSON.stringify(require.resolve('@rhinostone/swig-twig')),
  FILTERS = JSON.stringify(require.resolve('@rhinostone/swig-twig/lib/filters'));

function batchInChild(args) {
  return runCapped('var r = require(' + FILTERS + ').batch(' + args + ');' +
    'console.log(JSON.stringify(r));');
}

function renderInChild(src, json) {
  return runCapped('var r = require(' + TWIG + ').render(' + JSON.stringify(src) + ', ' +
    '{ locals: JSON.parse(' + JSON.stringify(json) + ') });console.log(JSON.stringify(r));');
}

describe('@rhinostone/swig-twig — batch size cap', function () {
  it('pads the last chunk up to a size of exactly maxSize', function () {
    var out = filters.batch([1], 1000000, 0);
    expect(out.length).to.be(1);
    expect(out[0].length).to.be(1000000);
    expect(out[0][0]).to.be(1);
    expect(out[0][999999]).to.be(0);
  });

  it('leaves the last chunk unpadded for a size past maxSize', function () {
    expect(filters.batch([1, 2], 1000001, 0)).to.eql([[1, 2]]);
    expect(filters.batch([1, 2], 1000000.5, 0)).to.eql([[1, 2]]);
  });

  it('does not exhaust the heap for a huge size, numeric or string', function () {
    expect(batchInChild('[1], 1e8, 0')).to.equal('null 0 [[1]]');
    expect(batchInChild('[1], "1e8", 0')).to.equal('null 0 [[1]]');
    expect(batchInChild('[1], 1e20, 0')).to.equal('null 0 [[1]]');
  });

  it('renders a batch with a huge size from the data', function () {
    expect(renderInChild('{% for row in items|batch(n, 0) %}{{ row|length }};{% endfor %}',
      '{"items": [1, 2, 3], "n": 1e8}')).to.equal('null 0 "3;"');
  });
});

describe('@rhinostone/swig-twig — a..b size cap', function () {
  var tpl = '{% for i in a..b %}{{ i }},{% endfor %}';

  it('renders a range from the data', function () {
    expect(twig.render(tpl, { locals: JSON.parse('{"a": 1, "b": 3}') })).to.equal('1,2,3,');
  });

  it('renders nothing for a range longer than maxSize', function () {
    expect(renderInChild(tpl, '{"a": 1, "b": 1e8}')).to.equal('null 0 ""');
  });

  it('renders nothing for a range whose values reach 2^53, which never ended', function () {
    expect(renderInChild(tpl, '{"a": 9007199254740992, "b": 9007199254740992}')).to.equal('null 0 ""');
  });
});
