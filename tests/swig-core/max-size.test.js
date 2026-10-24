var utils = require('@rhinostone/swig-core/lib/utils'),
  runCapped = require('../lib/run-capped.js'),
  expect = require('../lib/expect.js');

/*!
 * `utils.maxSize` caps the arrays the builders create from a number in the
 * data. `_utils.range`, which swig-twig's `a..b` calls, returns an empty range
 * when it would hold more than maxSize elements, so a bound such as 1e8 no
 * longer builds an array until the heap runs out. From 2^53 on, adding 1 no
 * longer changes a JavaScript number, so a range whose values reach 2^53 never
 * ended; the same check makes it empty. The huge cases run in a child process
 * whose heap is capped at 64 MB, so a missing guard aborts that child instead
 * of the test run.
 */
var UTILS = JSON.stringify(require.resolve('@rhinostone/swig-core/lib/utils'));

function rangeInChild(args) {
  return runCapped('var r = require(' + UTILS + ').range(' + args + ');' +
    'console.log(JSON.stringify(r.length > 4 ? r.length : r));');
}

describe('swig-core utils.maxSize', function () {
  it('is 1,000,000', function () {
    expect(utils.maxSize).to.be(1000000);
  });
});

describe('swig-core utils.range size cap', function () {
  it('builds a range of exactly maxSize elements in either direction', function () {
    var up = utils.range(1, 1000000),
      down = utils.range(1000000, 1);
    expect(up.length).to.be(1000000);
    expect(up[0]).to.be(1);
    expect(up[999999]).to.be(1000000);
    expect(down.length).to.be(1000000);
    expect(down[999999]).to.be(1);
  });

  it('returns an empty range one element past maxSize', function () {
    expect(utils.range(0, 1000000)).to.eql([]);
    expect(utils.range(1000000, 0)).to.eql([]);
  });

  it('returns an empty range for a huge bound without exhausting the heap', function () {
    expect(rangeInChild('1, 1e8')).to.equal('null 0 []');
    expect(rangeInChild('1, 1e20')).to.equal('null 0 []');
    expect(rangeInChild('1e8, 1')).to.equal('null 0 []');
  });

  it('returns an empty range whose values reach 2^53, which never ended', function () {
    expect(rangeInChild('9007199254740992, 9007199254740992')).to.equal('null 0 []');
    expect(rangeInChild('9007199254740990, 9007199254740994')).to.equal('null 0 []');
    expect(rangeInChild('-9007199254740992, -9007199254740994')).to.equal('null 0 []');
  });

  it('keeps a range past 2^53 that ends', function () {
    expect(rangeInChild('9007199254740994, 9007199254740992')).to.equal('null 0 [9007199254740994,9007199254740992]');
    expect(utils.range(0.5, 3)).to.eql([0.5, 1.5, 2.5]);
  });
});
