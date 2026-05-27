var jinja2 = require('@rhinostone/swig-jinja2'),
  expect = require('expect.js');


/*!
 * Package surface smoke tests.
 *
 * Verifies the workspace package resolves and exposes its scaffold
 * surface: the flavor name and a parse stub. The full per-instance render
 * API (installed via `engine.install`) and the parser/tags/filters
 * registries are asserted here as the carve lands.
 */
describe('@rhinostone/swig-jinja2 — package surface', function () {

  it('exports the flavor name as "jinja2"', function () {
    expect(jinja2.name).to.equal('jinja2');
  });

  it('exposes a parse entry point', function () {
    expect(jinja2.parse).to.be.a('function');
  });

  it('throws a clear not-implemented error from the parse stub', function () {
    expect(function () {
      jinja2.parse('{{ name }}');
    }).to.throwError(/not yet implemented/);
  });

});
