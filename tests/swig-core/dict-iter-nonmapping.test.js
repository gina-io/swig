var utils = require('@rhinostone/swig-core/lib/utils'),
  expect = require('../lib/expect.js');


/*!
 * `utils.dictIter` on a value that is not a mapping: Django finds no `items`,
 * `keys` or `values` method on a list, a string, a number or a boolean, so a
 * for loop over one runs no item. The Django render tests are in
 * tests/swig-django/for-dict-nonmapping.test.js.
 */
describe('swig-core utils.dictIter — a value that is not a mapping', function () {

  it('gives nothing for a list, a string, a number or a boolean, for all three names', function () {
    utils.each(['keys', 'values', 'items'], function (name) {
      expect(utils.dictIter([1, 2], name)).to.eql([]);
      expect(utils.dictIter([['a', 1]], name)).to.eql([]);
      expect(utils.dictIter('ab', name)).to.eql([]);
      expect(utils.dictIter(5, name)).to.eql([]);
      expect(utils.dictIter(true, name)).to.eql([]);
    });
  });

  it('gives nothing to a one-name items loop over a list holding pairs', function () {
    expect(utils.dictIter([['a', 1], ['b', 2]], 'items', true)).to.eql([]);
  });

  it('keeps the dict methods of a mapping', function () {
    expect(utils.dictIter({ a: 1, b: 2 }, 'keys')).to.eql(['a', 'b']);
    expect(utils.dictIter({ a: 1, b: 2 }, 'values')).to.eql([1, 2]);
    expect(utils.dictIter({ a: 1 }, 'items', true)).to.eql([['a', 1]]);
  });
});
