var lexer = require('@rhinostone/swig-twig/lib/lexer'),
  TYPES = require('@rhinostone/swig-twig/lib/tokentypes'),
  expect = require('expect.js');


/*!
 * Phase 3 Session 2 — Twig lexer over the swig-shared token subset.
 *
 * Asserts each shared token class survives the read() round-trip with
 * the right type and the right post-replace match value. The Twig-only
 * operators (`~`, `..`, `is`/`is not`, `?:`, `??`, `#{}`) are not yet
 * wired up — they fall through to the unknown-token throw and a
 * dedicated test pins that behaviour so Session 3 can flip the
 * assertion when each rule lands.
 *
 * See .claude/architecture/multi-flavor-ir.md § Phase 3.
 */
describe('@rhinostone/swig-twig — lexer (shared token subset)', function () {

  function lex(str) { return lexer.read(str); }

  function typesOf(tokens) {
    return tokens.map(function (t) { return t.type; });
  }

  function nonWhitespace(tokens) {
    return tokens.filter(function (t) { return t.type !== TYPES.WHITESPACE; });
  }

  /* ---- Atoms --------------------------------------------------- */

  it('lexes whitespace as WHITESPACE', function () {
    var tokens = lex('   ');
    expect(tokens).to.have.length(1);
    expect(tokens[0].type).to.equal(TYPES.WHITESPACE);
  });

  it('lexes single- and double-quoted strings', function () {
    var double = nonWhitespace(lex('"hello"'));
    expect(double).to.have.length(1);
    expect(double[0].type).to.equal(TYPES.STRING);
    expect(double[0].match).to.equal('"hello"');

    var single = nonWhitespace(lex("'world'"));
    expect(single).to.have.length(1);
    expect(single[0].type).to.equal(TYPES.STRING);
    expect(single[0].match).to.equal("'world'");

    var empty = nonWhitespace(lex('""'));
    expect(empty).to.have.length(1);
    expect(empty[0].type).to.equal(TYPES.STRING);
  });

  it('lexes integers and decimals as NUMBER', function () {
    var tokens = nonWhitespace(lex('42 3.14 -7'));
    expect(typesOf(tokens)).to.eql([TYPES.NUMBER, TYPES.NUMBER, TYPES.NUMBER]);
    expect(tokens[0].match).to.equal('42');
    expect(tokens[1].match).to.equal('3.14');
    expect(tokens[2].match).to.equal('-7');
  });

  it('lexes booleans as BOOL with the boolean keyword as match', function () {
    var t1 = nonWhitespace(lex('true'));
    expect(t1[0].type).to.equal(TYPES.BOOL);
    expect(t1[0].match).to.equal('true');

    var t2 = nonWhitespace(lex('false '));
    expect(t2[0].type).to.equal(TYPES.BOOL);
    expect(t2[0].match).to.equal('false');
  });

  it('lexes identifiers and dot-paths as a single VAR token', function () {
    var simple = nonWhitespace(lex('foo'));
    expect(simple[0].type).to.equal(TYPES.VAR);
    expect(simple[0].match).to.equal('foo');

    var dotted = nonWhitespace(lex('user.name.first'));
    expect(dotted).to.have.length(1);
    expect(dotted[0].type).to.equal(TYPES.VAR);
    expect(dotted[0].match).to.equal('user.name.first');
  });

  /* ---- Punctuation -------------------------------------------- */

  it('lexes parens, brackets, curlies, comma, colon, dotkey', function () {
    var tokens = nonWhitespace(lex('(),[]:{}.key'));
    expect(typesOf(tokens)).to.eql([
      TYPES.PARENOPEN, TYPES.PARENCLOSE, TYPES.COMMA,
      TYPES.BRACKETOPEN, TYPES.BRACKETCLOSE, TYPES.COLON,
      TYPES.CURLYOPEN, TYPES.CURLYCLOSE, TYPES.DOTKEY
    ]);
    expect(tokens[8].match).to.equal('key');
  });

  /* ---- Calls --------------------------------------------------- */

  it('lexes function calls with and without arguments', function () {
    var withArgs = nonWhitespace(lex('foo(1, 2)'));
    expect(withArgs[0].type).to.equal(TYPES.FUNCTION);
    expect(withArgs[0].match).to.equal('foo');

    var noArgs = nonWhitespace(lex('bar()'));
    expect(noArgs[0].type).to.equal(TYPES.FUNCTIONEMPTY);
    expect(noArgs[0].match).to.equal('bar');
  });

  it('lexes filter pipes with and without arguments', function () {
    var withArgs = nonWhitespace(lex('x|default("y")'));
    expect(typesOf(withArgs)).to.eql([
      TYPES.VAR, TYPES.FILTER, TYPES.STRING, TYPES.PARENCLOSE
    ]);
    expect(withArgs[1].match).to.equal('default');

    var noArgs = nonWhitespace(lex('x|upper'));
    expect(typesOf(noArgs)).to.eql([TYPES.VAR, TYPES.FILTEREMPTY]);
    expect(noArgs[1].match).to.equal('upper');
  });

  /* ---- Operators ---------------------------------------------- */

  it('lexes math operators as OPERATOR', function () {
    var tokens = nonWhitespace(lex('a + b - c * d / e % f'));
    var ops = tokens.filter(function (t) { return t.type === TYPES.OPERATOR; });
    expect(ops.map(function (t) { return t.match; })).to.eql(['+', '-', '*', '/', '%']);
  });

  it('lexes comparators including JS-style and `in`', function () {
    var tokens = nonWhitespace(lex('a == b != c < d > e <= f >= g in h'));
    var comps = tokens.filter(function (t) { return t.type === TYPES.COMPARATOR; });
    expect(comps.map(function (t) { return t.match; })).to.eql(['==', '!=', '<', '>', '<=', '>=', 'in']);
  });

  it('lexes boolean logic with both keyword and symbol forms, normalised to JS', function () {
    var tokens = nonWhitespace(lex('a and b or c && d || e'));
    var logic = tokens.filter(function (t) { return t.type === TYPES.LOGIC; });
    expect(logic.map(function (t) { return t.match; })).to.eql(['&&', '||', '&&', '||']);
  });

  it('lexes negation with both keyword and symbol forms, normalised to JS', function () {
    var tokens = nonWhitespace(lex('not foo'));
    expect(tokens[0].type).to.equal(TYPES.NOT);
    expect(tokens[0].match).to.equal('!');

    var bang = nonWhitespace(lex('!foo'));
    expect(bang[0].type).to.equal(TYPES.NOT);
    expect(bang[0].match).to.equal('!');
  });

  it('lexes assignment operators', function () {
    var assigns = ['=', '+=', '-=', '*=', '/='];
    assigns.forEach(function (op) {
      var t = nonWhitespace(lex('a ' + op + ' b'));
      expect(t[1].type).to.equal(TYPES.ASSIGNMENT);
      expect(t[1].match).to.equal(op);
    });
  });

  /* ---- Twig-only tokens deferred to Session 3 ----------------- */

  it('lexes the Twig concat operator `~` as TILDE', function () {
    var tokens = nonWhitespace(lex('a ~ b'));
    expect(typesOf(tokens)).to.eql([TYPES.VAR, TYPES.TILDE, TYPES.VAR]);
    expect(tokens[1].match).to.equal('~');
  });

  it('lexes the Twig range operator `..` as RANGE', function () {
    var tokens = nonWhitespace(lex('1..3'));
    expect(typesOf(tokens)).to.eql([TYPES.NUMBER, TYPES.RANGE, TYPES.NUMBER]);
    expect(tokens[0].match).to.equal('1');
    expect(tokens[1].match).to.equal('..');
    expect(tokens[2].match).to.equal('3');
  });

  it('keeps DOTKEY working after RANGE — `foo.bar` still lexes as a single VAR', function () {
    var tokens = nonWhitespace(lex('foo.bar'));
    expect(tokens).to.have.length(1);
    expect(tokens[0].type).to.equal(TYPES.VAR);
    expect(tokens[0].match).to.equal('foo.bar');
  });

  it('throws on the Twig null-coalescing operator `??` (Session 3 gap)', function () {
    expect(function () { lex('a ?? b'); }).to.throwException(/Unexpected token "\?"/);
  });

  it('throws on a bare `#` outside a string (Session 3 will introduce `#{ }` re-entry inside double-quoted strings)', function () {
    expect(function () { lex('# foo'); }).to.throwException(/Unexpected token "#"/);
  });

  /*
   * NOTE: `is` / `is not` and other Twig-only keywords currently lex as
   * a sequence of VAR tokens — the shared VAR rule matches them as
   * plain identifiers. Session 3 hoists the rules above VAR. Not pinned
   * here as a throw test because nothing throws today; flipping the
   * assertion at Session 3 would be a behaviour change, not a gap-fix.
   */

});
