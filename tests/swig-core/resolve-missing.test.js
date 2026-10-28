var utils = require('@rhinostone/swig-core/lib/utils'),
  backend = require('@rhinostone/swig-core/lib/backend'),
  ir = require('@rhinostone/swig-core/lib/ir'),
  expect = require('../lib/expect.js');


/*!
 * `utils.resolve` with a value for a failed lookup, and the opt-in
 * `missingAsEmpty` flag on a resolve VarRef that passes it. The Django render
 * tests are in tests/swig-django/missing-variable.test.js.
 */
describe('swig-core utils.resolve — the value of a failed lookup', function () {

  it('gives the value for a missing name, key or index', function () {
    expect(utils.resolve({}, ['x'], '')).to.be('');
    expect(utils.resolve({ x: {} }, ['x', 'y'], '')).to.be('');
    expect(utils.resolve({ x: {} }, ['x', 'y', 'z'], '')).to.be('');
    expect(utils.resolve({ x: [] }, ['x', '0'], '')).to.be('');
  });

  it('gives the value for a null value that a later segment reads', function () {
    expect(utils.resolve({ x: null }, ['x', 'y'], '')).to.be('');
    expect(utils.resolve({ x: { y: null } }, ['x', 'y', 'z'], '')).to.be('');
  });

  it('keeps a null leaf and every resolved value', function () {
    expect(utils.resolve({ x: null }, ['x'], '')).to.be(null);
    expect(utils.resolve({ x: { y: null } }, ['x', 'y'], '')).to.be(null);
    expect(utils.resolve({ x: 0 }, ['x'], '')).to.be(0);
    expect(utils.resolve({ x: false }, ['x'], '')).to.be(false);
    expect(utils.resolve({ x: { y: 'v' } }, ['x', 'y'], '')).to.be('v');
  });

  it('gives the value for a callable leaf that throws', function () {
    var obj = { f: function () { throw new Error('needs an argument'); } };
    expect(utils.resolve({ x: obj }, ['x', 'f'], '')).to.be('');
  });

  it('keeps null and undefined without a third argument', function () {
    expect(utils.resolve({}, ['x'])).to.be(undefined);
    expect(utils.resolve({ x: null }, ['x', 'y'])).to.be(null);
    expect(utils.resolve({ x: {} }, ['x', 'y'])).to.be(undefined);
  });
});

describe('swig-core backend — the missingAsEmpty flag on a VarRef', function () {

  function varRef(path, flags) {
    var n = ir.varRef(path);
    utils.each(Object.keys(flags || {}), function (k) { n[k] = flags[k]; });
    return n;
  }

  it('passes "" to _utils.resolve when the VarRef also has resolve', function () {
    expect(backend.emitExpr(varRef(['x', 'y'], { resolve: true, missingAsEmpty: true })))
      .to.equal('_utils.resolve(_ctx, ["x","y"], "")');
  });

  it('keeps the two-argument call without the flag', function () {
    expect(backend.emitExpr(varRef(['x'], { resolve: true }))).to.equal('_utils.resolve(_ctx, ["x"])');
  });

  it('ignores the flag on a VarRef without resolve', function () {
    expect(backend.emitExpr(varRef(['x'], { missingAsEmpty: true }))).to.equal(backend.emitExpr(varRef(['x'])));
  });
});
