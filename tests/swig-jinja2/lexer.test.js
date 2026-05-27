var lexer = require('@rhinostone/swig-jinja2/lib/lexer'),
  TYPES = require('@rhinostone/swig-jinja2/lib/tokentypes'),
  expect = require('expect.js');


/*!
 * Jinja2 lexer over the swig-shared token subset.
 *
 * Asserts each shared token class survives the read() round-trip with the
 * right type and the right post-replace match value. The Jinja2-only
 * operators (`~`, `**`, `//`, `is` / `is not`) are not wired up in this
 * commit; their positive tests land alongside the rules in the next
 * commit.
 */
describe('@rhinostone/swig-jinja2 — lexer (shared token subset)', function () {

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

  it('lexes unsigned integers and decimals as NUMBER; signed forms emit OPERATOR + NUMBER', function () {
    var tokens = nonWhitespace(lex('42 3.14 -7'));
    expect(typesOf(tokens)).to.eql([TYPES.NUMBER, TYPES.NUMBER, TYPES.OPERATOR, TYPES.NUMBER]);
    expect(tokens[0].match).to.equal('42');
    expect(tokens[1].match).to.equal('3.14');
    expect(tokens[2].match).to.equal('-');
    expect(tokens[3].match).to.equal('7');
  });

  it('lexes booleans as BOOL', function () {
    var t1 = nonWhitespace(lex('true'));
    expect(t1[0].type).to.equal(TYPES.BOOL);
    expect(t1[0].match).to.equal('true');

    var t2 = nonWhitespace(lex('false '));
    expect(t2[0].type).to.equal(TYPES.BOOL);
    expect(t2[0].match).to.equal('false');
  });

  /* ---- Identifiers & access ------------------------------------ */

  it('lexes a bare identifier as VAR', function () {
    var tokens = nonWhitespace(lex('name'));
    expect(tokens[0].type).to.equal(TYPES.VAR);
    expect(tokens[0].match).to.equal('name');
  });

  it('folds a dotted attribute path into a single VAR token', function () {
    var tokens = nonWhitespace(lex('user.profile.name'));
    expect(tokens).to.have.length(1);
    expect(tokens[0].type).to.equal(TYPES.VAR);
    expect(tokens[0].match).to.equal('user.profile.name');
  });

  it('emits DOTKEY after a bracket-access close', function () {
    var tokens = nonWhitespace(lex('arr[0].name'));
    expect(typesOf(tokens)).to.eql([
      TYPES.VAR, TYPES.BRACKETOPEN, TYPES.NUMBER, TYPES.BRACKETCLOSE, TYPES.DOTKEY
    ]);
    expect(tokens[4].match).to.equal('name');
  });

  /* ---- Operators ----------------------------------------------- */

  it('lexes math operators as OPERATOR', function () {
    var tokens = nonWhitespace(lex('1 + 2 - 3 * 4 / 5 % 6'));
    expect(typesOf(tokens)).to.eql([
      TYPES.NUMBER, TYPES.OPERATOR, TYPES.NUMBER, TYPES.OPERATOR,
      TYPES.NUMBER, TYPES.OPERATOR, TYPES.NUMBER, TYPES.OPERATOR,
      TYPES.NUMBER, TYPES.OPERATOR, TYPES.NUMBER
    ]);
  });

  it('lexes comparators including the `in` keyword', function () {
    var eq = nonWhitespace(lex('a == b'));
    expect(eq[1].type).to.equal(TYPES.COMPARATOR);
    expect(eq[1].match).to.equal('==');

    var inq = nonWhitespace(lex('x in items'));
    expect(typesOf(inq)).to.eql([TYPES.VAR, TYPES.COMPARATOR, TYPES.VAR]);
    expect(inq[1].match).to.equal('in');
  });

  it('normalizes `and` / `or` keywords to && / || LOGIC', function () {
    var tokens = nonWhitespace(lex('a and b or c'));
    expect(typesOf(tokens)).to.eql([TYPES.VAR, TYPES.LOGIC, TYPES.VAR, TYPES.LOGIC, TYPES.VAR]);
    expect(tokens[1].match).to.equal('&&');
    expect(tokens[3].match).to.equal('||');
  });

  it('normalizes the `not` keyword to ! NOT', function () {
    var kw = nonWhitespace(lex('not done'));
    expect(kw[0].type).to.equal(TYPES.NOT);
    expect(kw[0].match).to.equal('!');

    var bang = nonWhitespace(lex('!done'));
    expect(bang[0].type).to.equal(TYPES.NOT);
    expect(bang[0].match).to.equal('!');
  });

  it('lexes assignment operators as ASSIGNMENT', function () {
    var eq = nonWhitespace(lex('x = 1'));
    expect(eq[1].type).to.equal(TYPES.ASSIGNMENT);
    expect(eq[1].match).to.equal('=');

    var pluseq = nonWhitespace(lex('x += 1'));
    expect(pluseq[1].type).to.equal(TYPES.ASSIGNMENT);
    expect(pluseq[1].match).to.equal('+=');
  });

  /* ---- Filters & functions ------------------------------------- */

  it('lexes a filter with args as FILTER and without args as FILTEREMPTY', function () {
    var withArgs = nonWhitespace(lex('x|join(", ")'));
    expect(withArgs[1].type).to.equal(TYPES.FILTER);
    expect(withArgs[1].match).to.equal('join');

    var noArgs = nonWhitespace(lex('x|upper'));
    expect(noArgs[1].type).to.equal(TYPES.FILTEREMPTY);
    expect(noArgs[1].match).to.equal('upper');
  });

  it('lexes a function call as FUNCTION and an empty call as FUNCTIONEMPTY', function () {
    var withArgs = nonWhitespace(lex('range(10)'));
    expect(withArgs[0].type).to.equal(TYPES.FUNCTION);
    expect(withArgs[0].match).to.equal('range');

    var noArgs = nonWhitespace(lex('now()'));
    expect(noArgs[0].type).to.equal(TYPES.FUNCTIONEMPTY);
    expect(noArgs[0].match).to.equal('now');
  });

  /* ---- Grouping & literals ------------------------------------- */

  it('lexes parentheses and brackets', function () {
    var parens = nonWhitespace(lex('(a)'));
    expect(typesOf(parens)).to.eql([TYPES.PARENOPEN, TYPES.VAR, TYPES.PARENCLOSE]);

    var brackets = nonWhitespace(lex('[1, 2]'));
    expect(typesOf(brackets)).to.eql([
      TYPES.BRACKETOPEN, TYPES.NUMBER, TYPES.COMMA, TYPES.NUMBER, TYPES.BRACKETCLOSE
    ]);
  });

  it('lexes object-literal braces with COLON separator', function () {
    var tokens = nonWhitespace(lex('{ "k": 1 }'));
    expect(typesOf(tokens)).to.eql([
      TYPES.CURLYOPEN, TYPES.STRING, TYPES.COLON, TYPES.NUMBER, TYPES.CURLYCLOSE
    ]);
  });

  /* ---- Jinja2-only operators ----------------------------------- */

  it('lexes the ~ string-concatenation operator as TILDE', function () {
    var tokens = nonWhitespace(lex('a ~ b'));
    expect(typesOf(tokens)).to.eql([TYPES.VAR, TYPES.TILDE, TYPES.VAR]);
    expect(tokens[1].match).to.equal('~');
  });

  it('lexes the ** power operator as POWER, not two OPERATOR stars', function () {
    var tokens = nonWhitespace(lex('2 ** 3'));
    expect(typesOf(tokens)).to.eql([TYPES.NUMBER, TYPES.POWER, TYPES.NUMBER]);
    expect(tokens[1].match).to.equal('**');
  });

  it('still lexes a single * as OPERATOR', function () {
    var tokens = nonWhitespace(lex('2 * 3'));
    expect(typesOf(tokens)).to.eql([TYPES.NUMBER, TYPES.OPERATOR, TYPES.NUMBER]);
    expect(tokens[1].match).to.equal('*');
  });

  it('lexes the // floor-division operator as FLOORDIV, not two OPERATOR slashes', function () {
    var tokens = nonWhitespace(lex('7 // 2'));
    expect(typesOf(tokens)).to.eql([TYPES.NUMBER, TYPES.FLOORDIV, TYPES.NUMBER]);
    expect(tokens[1].match).to.equal('//');
  });

  it('still lexes a single / as OPERATOR', function () {
    var tokens = nonWhitespace(lex('7 / 2'));
    expect(typesOf(tokens)).to.eql([TYPES.NUMBER, TYPES.OPERATOR, TYPES.NUMBER]);
    expect(tokens[1].match).to.equal('/');
  });

  /* ---- Fail-close ---------------------------------------------- */

  it('throws on an unrecognised character', function () {
    expect(function () { lexer.read('@'); }).to.throwError(/Unexpected token/);
  });

});
