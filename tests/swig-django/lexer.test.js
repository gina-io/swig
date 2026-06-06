var lexer = require('@rhinostone/swig-django/lib/lexer'),
  types = require('@rhinostone/swig-django/lib/tokentypes'),
  expect = require('../lib/expect.js');


/*!
 * Django lexer — token-level coverage.
 *
 * Locks in the Django-specific lexer decisions vs. the Jinja2 sibling:
 * single `|name` filter tokens (no `|name(` paren form), `:` as its own
 * COLON token (the filter-argument separator), `True` / `False` normalized
 * to JS `true` / `false`, a dedicated NONE token, `is` / `is not` kept, and
 * the absence of `~` / `**` / `//`.
 *
 * The raw lexer emits WHITESPACE tokens between operands; `seq()` drops them
 * so sequence assertions read against the meaningful token stream.
 */
describe('@rhinostone/swig-django — lexer', function () {

  function read(str) { return lexer.read(str); }

  function seq(str) {
    return read(str)
      .filter(function (t) { return t.type !== types.WHITESPACE; })
      .map(function (t) { return t.type; });
  }

  it('reads a bare identifier as VAR', function () {
    var toks = read('name');
    expect(toks.length).to.equal(1);
    expect(toks[0].type).to.equal(types.VAR);
    expect(toks[0].match).to.equal('name');
  });

  it('folds a dotted path into a single VAR token', function () {
    var toks = read('user.profile.name');
    expect(toks.length).to.equal(1);
    expect(toks[0].type).to.equal(types.VAR);
    expect(toks[0].match).to.equal('user.profile.name');
  });

  it('reads string and number literals', function () {
    expect(read('"hi"')[0].type).to.equal(types.STRING);
    expect(read("'hi'")[0].type).to.equal(types.STRING);
    expect(read('42')[0].type).to.equal(types.NUMBER);
    expect(read('3.5')[0].type).to.equal(types.NUMBER);
  });

  it('reads a no-arg filter as a single FILTEREMPTY token', function () {
    var toks = read('x|upper');
    expect(seq('x|upper')).to.eql([types.VAR, types.FILTEREMPTY]);
    expect(toks[1].match).to.equal('upper');
  });

  it('reads a colon-filter as FILTEREMPTY + COLON + arg (no paren-call form)', function () {
    var toks = read('x|date:"Y-m-d"');
    expect(seq('x|date:"Y-m-d"')).to.eql([types.VAR, types.FILTEREMPTY, types.COLON, types.STRING]);
    expect(toks[1].match).to.equal('date');
    expect(toks[3].match).to.equal('"Y-m-d"');
  });

  it('normalizes True / False to JS true / false (BOOL)', function () {
    var t = read('True'), f = read('False');
    expect(t[0].type).to.equal(types.BOOL);
    expect(t[0].match).to.equal('true');
    expect(f[0].type).to.equal(types.BOOL);
    expect(f[0].match).to.equal('false');
  });

  it('does not treat lowercase true / false as BOOL (Python casing only)', function () {
    // `true` / `false` lex as plain identifiers in Django.
    expect(read('true')[0].type).to.equal(types.VAR);
    expect(read('false')[0].type).to.equal(types.VAR);
  });

  it('reads None as a dedicated NONE token', function () {
    var toks = read('None');
    expect(toks[0].type).to.equal(types.NONE);
    expect(toks[0].match).to.equal('None');
  });

  it('does not let True / None gobble a longer identifier', function () {
    expect(read('Truthy')[0].type).to.equal(types.VAR);
    expect(read('Nonexistent')[0].type).to.equal(types.VAR);
  });

  it('reads is / is not as IS / ISNOT', function () {
    expect(seq('x is None')).to.eql([types.VAR, types.IS, types.NONE]);
    expect(seq('x is not None')).to.eql([types.VAR, types.ISNOT, types.NONE]);
  });

  it('does not let `is` gobble an identifier like `island`', function () {
    expect(read('island')[0].type).to.equal(types.VAR);
    expect(read('island')[0].match).to.equal('island');
  });

  it('normalizes and / or / not keywords (require trailing whitespace)', function () {
    expect(read('and ')[0].type).to.equal(types.LOGIC);
    expect(read('and ')[0].match).to.equal('&&');
    expect(read('or ')[0].type).to.equal(types.LOGIC);
    expect(read('or ')[0].match).to.equal('||');
    expect(read('not ')[0].type).to.equal(types.NOT);
    expect(read('not ')[0].match).to.equal('!');
  });

  it('reads comparators including the `in` keyword', function () {
    expect(read('==')[0].type).to.equal(types.COMPARATOR);
    expect(read('!=')[0].type).to.equal(types.COMPARATOR);
    expect(read('>=')[0].type).to.equal(types.COMPARATOR);
    expect(read('in ')[0].type).to.equal(types.COMPARATOR);
  });

  it('has no `**` power operator — lexes as two OPERATOR tokens', function () {
    expect(seq('2 ** 3')).to.eql([types.NUMBER, types.OPERATOR, types.OPERATOR, types.NUMBER]);
  });

  it('has no `//` floor-division operator — lexes as two OPERATOR tokens', function () {
    expect(seq('6 // 2')).to.eql([types.NUMBER, types.OPERATOR, types.OPERATOR, types.NUMBER]);
  });

  it('throws on the `~` concat operator (not Django syntax)', function () {
    expect(function () { read('a ~ b'); }).to.throwError();
  });

  it('throws on a wholly unrecognised character', function () {
    expect(function () { read('@'); }).to.throwError();
  });

});
