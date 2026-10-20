var utils = require('@rhinostone/swig-core/lib/utils'),
  twig = require('@rhinostone/swig-twig'),
  expect = require('../lib/expect.js');

/*!
 * `_utils.range` backs swig-twig's `a..b`. A bound that is not finite is
 * never reached, so the loop would run until the array overflows; the range
 * is empty instead, as for the other bounds it does not support. Plain JSON
 * produces Infinity for a number such as 1e999, so the bound can come from
 * the data.
 */
describe('swig-core utils.range bounds', function () {
  it('builds an inclusive numeric range in either direction', function () {
    expect(utils.range(1, 3)).to.eql([1, 2, 3]);
    expect(utils.range(3, 1)).to.eql([3, 2, 1]);
  });

  it('returns an empty range for an infinite bound', function () {
    expect(utils.range(1, Infinity)).to.eql([]);
    expect(utils.range(1, -Infinity)).to.eql([]);
    expect(utils.range(Infinity, 1)).to.eql([]);
    expect(utils.range(-Infinity, 1)).to.eql([]);
  });

  it('returns an empty range for NaN', function () {
    expect(utils.range(NaN, 3)).to.eql([]);
    expect(utils.range(1, NaN)).to.eql([]);
  });
});

describe('swig-twig a..b with a bound from the data', function () {
  var tpl = '{% for i in 1..n %}{{ i }}{% endfor %}';

  it('renders a finite range', function () {
    expect(twig.render(tpl, { locals: { n: 3 } })).to.equal('123');
  });

  it('renders nothing for a bound that JSON parses as Infinity', function () {
    expect(twig.render(tpl, { locals: JSON.parse('{"n": 1e999}') })).to.equal('');
  });
});
