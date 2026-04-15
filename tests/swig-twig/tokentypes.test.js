var TYPES = require('@rhinostone/swig-twig/lib/tokentypes'),
  CORE_TYPES = require('@rhinostone/swig-core/lib/tokentypes'),
  expect = require('expect.js');


/*!
 * Phase 3 Session 2 — Twig token type enum stability.
 *
 * The Twig lexer and parser dispatch on these IDs; the layout must stay
 * stable across sessions to avoid silent reshuffles between in-flight
 * Twig commits. Shared-range IDs (0–25, 100) intentionally mirror
 * @rhinostone/swig-core/lib/tokentypes so flavor-agnostic consumers
 * (e.g. backend.compile splice-through paths, _dangerousProps
 * enforcement) see the same numeric layout regardless of frontend.
 *
 * Twig-only IDs (30–37) are reserved here for Session 3+; the lexer
 * rules for `~`, `..`, `is`, `?:`, `??`, and `#{}` interpolation are
 * not yet wired up.
 *
 * See .claude/architecture/multi-flavor-ir.md § Phase 3.
 */
describe('@rhinostone/swig-twig — token type enum', function () {

  it('mirrors swig-core IDs for the shared-range tokens', function () {
    var sharedNames = [
      'WHITESPACE', 'STRING', 'FILTER', 'FILTEREMPTY', 'FUNCTION',
      'FUNCTIONEMPTY', 'PARENOPEN', 'PARENCLOSE', 'COMMA', 'VAR',
      'NUMBER', 'OPERATOR', 'BRACKETOPEN', 'BRACKETCLOSE', 'DOTKEY',
      'ARRAYOPEN', 'CURLYOPEN', 'CURLYCLOSE', 'COLON', 'COMPARATOR',
      'LOGIC', 'NOT', 'BOOL', 'ASSIGNMENT', 'METHODOPEN', 'UNKNOWN'
    ];
    sharedNames.forEach(function (name) {
      expect(TYPES[name]).to.be.a('number');
      expect(TYPES[name]).to.equal(CORE_TYPES[name]);
    });
  });

  it('reserves the Twig-only IDs above the shared range', function () {
    expect(TYPES.TILDE).to.equal(30);
    expect(TYPES.RANGE).to.equal(31);
    expect(TYPES.IS).to.equal(32);
    expect(TYPES.ISNOT).to.equal(33);
    expect(TYPES.QMARK).to.equal(34);
    expect(TYPES.NULLCOALESCE).to.equal(35);
    expect(TYPES.INTERP_OPEN).to.equal(36);
    expect(TYPES.INTERP_CLOSE).to.equal(37);
  });

  it('keeps every numeric ID unique', function () {
    var seen = {};
    Object.keys(TYPES).forEach(function (name) {
      var id = TYPES[name];
      expect(seen.hasOwnProperty(id)).to.be(false);
      seen[id] = name;
    });
  });

  it('keeps Twig-only IDs distinct from every shared-range ID', function () {
    var twigOnly = [
      TYPES.TILDE, TYPES.RANGE, TYPES.IS, TYPES.ISNOT,
      TYPES.QMARK, TYPES.NULLCOALESCE,
      TYPES.INTERP_OPEN, TYPES.INTERP_CLOSE
    ];
    var coreIds = Object.keys(CORE_TYPES).map(function (k) { return CORE_TYPES[k]; });
    twigOnly.forEach(function (id) {
      expect(coreIds.indexOf(id)).to.equal(-1);
    });
  });

});
