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

  it('lexes the Twig null-coalescing operator `??` as NULLCOALESCE', function () {
    var tokens = nonWhitespace(lex('a ?? b'));
    expect(typesOf(tokens)).to.eql([TYPES.VAR, TYPES.NULLCOALESCE, TYPES.VAR]);
    expect(tokens[1].match).to.equal('??');
  });

  it('lexes the bare Twig ternary `?` as QMARK', function () {
    var tokens = nonWhitespace(lex('a ? b : c'));
    expect(typesOf(tokens)).to.eql([
      TYPES.VAR, TYPES.QMARK, TYPES.VAR, TYPES.COLON, TYPES.VAR
    ]);
    expect(tokens[1].match).to.equal('?');
  });

  it('lexes Twig Elvis shorthand `?:` as QMARK + COLON', function () {
    /*
     * No dedicated Elvis token. Parser disambiguates ternary (QMARK
     * followed by expression before COLON) from Elvis (QMARK
     * immediately followed by COLON) at grammar time.
     */
    var tokens = nonWhitespace(lex('a ?: b'));
    expect(typesOf(tokens)).to.eql([
      TYPES.VAR, TYPES.QMARK, TYPES.COLON, TYPES.VAR
    ]);
  });

  it('prefers NULLCOALESCE over QMARK+QMARK on `??`', function () {
    var tokens = nonWhitespace(lex('??'));
    expect(tokens).to.have.length(1);
    expect(tokens[0].type).to.equal(TYPES.NULLCOALESCE);
  });

  it('throws on a bare `#` outside a string', function () {
    expect(function () { lex('# foo'); }).to.throwException(/Unexpected token "#"/);
  });

  /* ---- Session 4 — `#{}` string interpolation --------------- */

  /*
   * Double-quoted strings containing unescaped `#{` are lexed into a
   * multi-token sequence: STRING(pre) + INTERP_OPEN + <inner tokens> +
   * INTERP_CLOSE + STRING(tail). Single-quoted strings stay literal.
   * Escape `\#{` suppresses interpolation verbatim. Empty `"#{}"`
   * throws at lex time.
   */

  it('lexes `"hello #{name}"` as STRING + INTERP_OPEN + VAR + INTERP_CLOSE + STRING', function () {
    var tokens = nonWhitespace(lex('"hello #{name}"'));
    expect(typesOf(tokens)).to.eql([
      TYPES.STRING, TYPES.INTERP_OPEN, TYPES.VAR, TYPES.INTERP_CLOSE, TYPES.STRING
    ]);
    expect(tokens[0].match).to.equal('"hello "');
    expect(tokens[1].match).to.equal('#{');
    expect(tokens[2].match).to.equal('name');
    expect(tokens[3].match).to.equal('}');
    expect(tokens[4].match).to.equal('""');
  });

  it('lexes multiple interpolations in one string', function () {
    var tokens = nonWhitespace(lex('"#{a} and #{b}"'));
    expect(typesOf(tokens)).to.eql([
      TYPES.STRING, TYPES.INTERP_OPEN, TYPES.VAR, TYPES.INTERP_CLOSE,
      TYPES.STRING, TYPES.INTERP_OPEN, TYPES.VAR, TYPES.INTERP_CLOSE,
      TYPES.STRING
    ]);
    expect(tokens[0].match).to.equal('""');
    expect(tokens[4].match).to.equal('" and "');
    expect(tokens[8].match).to.equal('""');
  });

  it('leaves an empty leading STRING when interpolation is at the start', function () {
    var tokens = nonWhitespace(lex('"#{name} tail"'));
    expect(typesOf(tokens)).to.eql([
      TYPES.STRING, TYPES.INTERP_OPEN, TYPES.VAR, TYPES.INTERP_CLOSE, TYPES.STRING
    ]);
    expect(tokens[0].match).to.equal('""');
    expect(tokens[4].match).to.equal('" tail"');
  });

  it('leaves an empty trailing STRING when interpolation is at the end', function () {
    var tokens = nonWhitespace(lex('"head #{name}"'));
    expect(typesOf(tokens)).to.eql([
      TYPES.STRING, TYPES.INTERP_OPEN, TYPES.VAR, TYPES.INTERP_CLOSE, TYPES.STRING
    ]);
    expect(tokens[0].match).to.equal('"head "');
    expect(tokens[4].match).to.equal('""');
  });

  it('tracks brace depth so nested `{...}` inside `#{}` does not close early', function () {
    /*
     * `{a: 1}` is an object literal inside the interpolation. Depth
     * starts at 1 when `#{` is consumed; inner `{` bumps to 2; inner
     * `}` drops back to 1; trailing `}` closes at depth 0.
     */
    var tokens = nonWhitespace(lex('"#{ {a: 1}.a }"'));
    expect(typesOf(tokens)).to.eql([
      TYPES.STRING, TYPES.INTERP_OPEN,
      TYPES.CURLYOPEN, TYPES.VAR, TYPES.COLON, TYPES.NUMBER, TYPES.CURLYCLOSE, TYPES.DOTKEY,
      TYPES.INTERP_CLOSE, TYPES.STRING
    ]);
  });

  it('skips over quoted strings inside the interpolation when scanning for the closing brace', function () {
    /*
     * The inner single-quoted `'x'` contains no `{` or `}`, but the
     * scanner must still treat it as an opaque span so any `}` that
     * *would* appear inside a longer inner string does not close the
     * interpolation prematurely. Pins the inner-string skip path.
     */
    var tokens = nonWhitespace(lex('"#{ foo(\'x\') }"'));
    expect(typesOf(tokens)).to.eql([
      TYPES.STRING, TYPES.INTERP_OPEN,
      TYPES.FUNCTION, TYPES.STRING, TYPES.PARENCLOSE,
      TYPES.INTERP_CLOSE, TYPES.STRING
    ]);
    expect(tokens[3].match).to.equal("'x'");
  });

  it('treats `\\#{` as an escape — the whole string stays a single STRING token', function () {
    var tokens = nonWhitespace(lex('"foo \\#{bar}"'));
    expect(tokens).to.have.length(1);
    expect(tokens[0].type).to.equal(TYPES.STRING);
    expect(tokens[0].match).to.equal('"foo \\#{bar}"');
  });

  it('does not interpolate inside single-quoted strings', function () {
    var tokens = nonWhitespace(lex("'hello #{name}'"));
    expect(tokens).to.have.length(1);
    expect(tokens[0].type).to.equal(TYPES.STRING);
    expect(tokens[0].match).to.equal("'hello #{name}'");
  });

  it('throws `Empty interpolation` on `"#{}"`', function () {
    expect(function () { lex('"#{}"'); }).to.throwException(/Empty interpolation/);
  });

  it('throws `Empty interpolation` on whitespace-only `"#{ }"`', function () {
    expect(function () { lex('"#{   }"'); }).to.throwException(/Empty interpolation/);
  });

  it('leaves a `#` without a following `{` as plain string content', function () {
    var tokens = nonWhitespace(lex('"hash # sign"'));
    expect(tokens).to.have.length(1);
    expect(tokens[0].type).to.equal(TYPES.STRING);
    expect(tokens[0].match).to.equal('"hash # sign"');
  });

  it('leaves a `{` without a preceding `#` as plain string content', function () {
    var tokens = nonWhitespace(lex('"brace { }"'));
    expect(tokens).to.have.length(1);
    expect(tokens[0].type).to.equal(TYPES.STRING);
    expect(tokens[0].match).to.equal('"brace { }"');
  });

  it('recursively lexes nested interpolation inside an inner double-quoted string', function () {
    /*
     * Outer scan: `"a #{ ... } e"` — the `...` is an inner double-quoted
     * string `"b #{c} d"` which itself contains an interpolation. The
     * inner-string skip walks past the inner `"..."` as an opaque span,
     * so the outer INTERP_CLOSE matches correctly. The captured inner
     * expression is then handed back to exports.read, which re-enters
     * the bypass for the inner string.
     */
    var tokens = nonWhitespace(lex('"a #{ "b #{c} d" } e"'));
    expect(typesOf(tokens)).to.eql([
      TYPES.STRING, TYPES.INTERP_OPEN,
        TYPES.STRING, TYPES.INTERP_OPEN, TYPES.VAR, TYPES.INTERP_CLOSE, TYPES.STRING,
      TYPES.INTERP_CLOSE, TYPES.STRING
    ]);
    expect(tokens[0].match).to.equal('"a "');
    expect(tokens[2].match).to.equal('"b "');
    expect(tokens[4].match).to.equal('c');
    expect(tokens[6].match).to.equal('" d"');
    expect(tokens[8].match).to.equal('" e"');
  });

  /* ---- IS / ISNOT keyword tests (Session 3 behaviour change) ---- */

  /*
   * BEHAVIOUR CHANGE: before Session 3, `is` lexed as VAR because the
   * shared VAR rule (`^[a-zA-Z_$]\w*`) matched it as a plain
   * identifier. After Session 3, `is` and `is not` are reserved Twig
   * keywords and hoist above VAR. Variables named `is`, `isnot`, or
   * starting with `is.` in template source become parse-level errors
   * downstream — but in Twig, `is` is already a reserved keyword, so
   * templates would not use it as a variable name anyway.
   */

  it('lexes `a is b` as VAR IS VAR', function () {
    var tokens = nonWhitespace(lex('a is b'));
    expect(typesOf(tokens)).to.eql([TYPES.VAR, TYPES.IS, TYPES.VAR]);
    expect(tokens[1].match).to.equal('is');
  });

  it('lexes `a is not b` as VAR ISNOT VAR (single ISNOT token)', function () {
    /*
     * `is not` is baked into a single ISNOT token rather than emitted
     * as IS + NOT. Precedent: swig-core's COMPARATOR bakes `in\s`, and
     * NOT bakes `not\s+`. Single-token shape keeps the parser grammar
     * simpler — no need to reassemble `IS + NOT` at parse time.
     */
    var tokens = nonWhitespace(lex('a is not b'));
    expect(typesOf(tokens)).to.eql([TYPES.VAR, TYPES.ISNOT, TYPES.VAR]);
  });

  it('prefers ISNOT over IS on `is not`', function () {
    var tokens = nonWhitespace(lex('is not'));
    expect(tokens).to.have.length(1);
    expect(tokens[0].type).to.equal(TYPES.ISNOT);
  });

  it('does not match IS inside identifiers — `isabel` stays VAR', function () {
    var tokens = nonWhitespace(lex('isabel'));
    expect(tokens).to.have.length(1);
    expect(tokens[0].type).to.equal(TYPES.VAR);
    expect(tokens[0].match).to.equal('isabel');
  });

  it('does not match ISNOT inside identifiers — `isnothing` stays VAR', function () {
    var tokens = nonWhitespace(lex('isnothing'));
    expect(tokens).to.have.length(1);
    expect(tokens[0].type).to.equal(TYPES.VAR);
    expect(tokens[0].match).to.equal('isnothing');
  });

  it('does not reassemble `is` + whitespace + word-starting-with-not-but-not-not`', function () {
    /*
     * `is nothing` must NOT match ISNOT — the `\b` boundary after `not`
     * is the gate: `nothing` continues with `\w`, so no boundary, no
     * ISNOT. Falls through to IS + WS + VAR.
     */
    var tokens = nonWhitespace(lex('is nothing'));
    expect(typesOf(tokens)).to.eql([TYPES.IS, TYPES.VAR]);
    expect(tokens[1].match).to.equal('nothing');
  });

});
