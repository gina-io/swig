var twig = require('@rhinostone/swig-twig'),
  expect = require('expect.js');


/*!
 * Phase 3 — package surface smoke tests.
 *
 * Verifies the workspace package resolves and exposes the documented
 * surface: flavor name, parser module, tags registry, and the per-instance
 * render API installed via `engine.install`. The legacy `exports.parse`
 * wrapper (Path B) is retained as a soft-deprecated shim — see the
 * dedicated suite below.
 *
 * See .claude/architecture/multi-flavor-ir.md § Phase 3 for scope.
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

});

describe('@rhinostone/swig-twig — exports.parse soft-deprecation', function () {

  // Each test reloads the module so the one-shot deprecation flag starts fresh.
  function freshTwig() {
    var key = require.resolve('@rhinostone/swig-twig');
    delete require.cache[key];
    return require('@rhinostone/swig-twig');
  }

  it('still returns a parse-tree shape for plain source', function () {
    var t = freshTwig();
    var origWarn = console.warn;
    console.warn = function () {};
    try {
      var tree = t.parse('{{ hello }}');
      expect(tree).to.have.property('tokens');
      expect(tree.tokens).to.have.length(1);
      expect(tree.tokens[0].type).to.equal('Output');
    } finally {
      console.warn = origWarn;
    }
  });

  it('emits a one-shot console.warn on first call', function () {
    var t = freshTwig();
    var origWarn = console.warn;
    var calls = [];
    console.warn = function (msg) { calls.push(msg); };
    try {
      t.parse('{{ a }}');
      t.parse('{{ b }}');
      t.parse('{{ c }}');
    } finally {
      console.warn = origWarn;
    }
    expect(calls).to.have.length(1);
    expect(calls[0]).to.contain('deprecated');
    expect(calls[0]).to.contain('@rhinostone/swig-twig');
  });

});
