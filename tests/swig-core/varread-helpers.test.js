var varread = require('../../packages/swig-core/lib/varread'),
  expect = require('../lib/expect.js');

/*!
 * Direct checks of absentTest, which the For emit calls with each loop name
 * it restores after the loop: it gives the test, in emitted code, that the
 * context holds no key of a name read through a JavaScript global or an
 * Object.prototype member, and null for any other name, and for a value that
 * is not a string (a one-name loop has no key name).
 */
describe('varread.absentTest', function () {
  it('gives a test for a name read through a global', function () {
    expect(varread.absentTest('Math')).to.be.a('string');
  });

  it('gives a test for an Object.prototype member', function () {
    expect(varread.absentTest('toString')).to.be.a('string');
  });

  it('gives null for a plain name', function () {
    expect(varread.absentTest('zz')).to.equal(null);
  });

  it('gives null for a value that is not a string', function () {
    [undefined, null, 5, {}, ['Math']].forEach(function (v) {
      expect(varread.absentTest(v)).to.equal(null);
    });
  });
});
