var twig = require('@rhinostone/swig-twig'),
  expect = require('expect.js');


/*!
 * Phase 3 Session 1 smoke test — the @rhinostone/swig-twig scaffold.
 *
 * Verifies the empty package is workspace-resolvable and exposes the
 * documented surface: a flavor name plus a parse() entry point that
 * throws until the Twig source-to-IR lowering lands. Subsequent
 * sessions replace the throw with real Twig parsing.
 *
 * See .claude/architecture/multi-flavor-ir.md § Phase 3 for scope.
 */
describe('@rhinostone/swig-twig — scaffold', function () {

  it('exports the flavor name as "twig"', function () {
    expect(twig.name).to.equal('twig');
  });

  it('exposes parse() as a function', function () {
    expect(twig.parse).to.be.a('function');
  });

  it('parse() throws because the Twig frontend is not yet implemented', function () {
    expect(function () {
      twig.parse('{{ hello }}');
    }).to.throwException(/not yet implemented/);
  });

});
