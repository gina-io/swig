var twig = require('@rhinostone/swig-twig'),
  expect = require('expect.js');


/*!
 * Phase 3 — package surface smoke tests.
 *
 * Verifies the workspace package resolves and exposes the documented
 * surface: a flavor name, a parser module, a tags registry, and the
 * convenience `parse(source, options)` wrapper. The wrapper delegates
 * to `parser.parse(swig, source, options, tags, filters)` with the
 * built-in tags registry as the default `tags` map.
 *
 * See .claude/architecture/multi-flavor-ir.md § Phase 3 for scope.
 */
describe('@rhinostone/swig-twig — package surface', function () {

  it('exports the flavor name as "twig"', function () {
    expect(twig.name).to.equal('twig');
  });

  it('exposes parse() as a function', function () {
    expect(twig.parse).to.be.a('function');
  });

  it('exposes the parser module', function () {
    expect(twig.parser).to.be.an('object');
    expect(twig.parser.parse).to.be.a('function');
    expect(twig.parser.parseExpr).to.be.a('function');
  });

  it('exposes the built-in tags registry', function () {
    expect(twig.tags).to.be.an('object');
  });

  it('parse() returns a parse-tree shape for plain source', function () {
    var tree = twig.parse('{{ hello }}');
    expect(tree).to.have.property('tokens');
    expect(tree.tokens).to.have.length(1);
    expect(tree.tokens[0].type).to.equal('Output');
  });

});
