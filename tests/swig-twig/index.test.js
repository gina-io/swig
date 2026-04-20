var twig = require('@rhinostone/swig-twig'),
  expect = require('expect.js');


/*!
 * Package surface smoke tests.
 *
 * Verifies the workspace package resolves and exposes the documented
 * surface: flavor name, parser module, tags registry, and the per-instance
 * render API installed via `engine.install`.
 */
describe('@rhinostone/swig-twig — package surface', function () {

  it('exports the flavor name as "twig"', function () {
    expect(twig.name).to.equal('twig');
  });

  it('exposes the parser module', function () {
    expect(twig.parser).to.be.an('object');
    expect(twig.parser.parse).to.be.a('function');
    expect(twig.parser.parseExpr).to.be.a('function');
  });

  it('exposes the built-in tags registry', function () {
    expect(twig.tags).to.be.an('object');
  });

  it('exposes the per-instance render API', function () {
    expect(twig.render).to.be.a('function');
    expect(twig.precompile).to.be.a('function');
    expect(twig.compile).to.be.a('function');
    expect(twig.Twig).to.be.a('function');
  });

  it('does not expose the removed Path B exports.parse wrapper', function () {
    expect(twig.parse).to.be(undefined);
  });

});
