var jinja2 = require('@rhinostone/swig-jinja2'),
  expect = require('../lib/expect.js');


/*!
 * Package surface smoke tests.
 *
 * Verifies the workspace package resolves and exposes its documented
 * surface: the flavor name, the parser module, the tags registry, and the
 * per-instance render API installed via `engine.install`.
 */
describe('@rhinostone/swig-jinja2 — package surface', function () {

  it('exports the flavor name as "jinja2"', function () {
    expect(jinja2.name).to.equal('jinja2');
  });

  it('exposes the parser module', function () {
    expect(jinja2.parser).to.be.an('object');
    expect(jinja2.parser.parse).to.be.a('function');
    expect(jinja2.parser.parseExpr).to.be.a('function');
  });

  it('exposes the built-in tags registry', function () {
    expect(jinja2.tags).to.be.an('object');
  });

  it('exposes the per-instance render API', function () {
    expect(jinja2.render).to.be.a('function');
    expect(jinja2.precompile).to.be.a('function');
    expect(jinja2.compile).to.be.a('function');
    expect(jinja2.Jinja2).to.be.a('function');
  });

  it('does not expose a top-level parse wrapper', function () {
    expect(jinja2.parse).to.be(undefined);
  });

});
