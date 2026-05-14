var swig = require('../lib/swig'),
  expect = require('expect.js'),
  fs = require('fs');

describe('Regressions', function () {
  it('gh-285: preserves forward-slashes in text', function () {
    expect(swig.render('foo\\ blah \\ and stuff'))
      .to.equal('foo\\ blah \\ and stuff');
  });

  it('gh-303: sets work in loops', function () {
    var opts = { locals: { b: [1] }};
    expect(swig.render('{% set foo = "old" %}{% for a in b %}{% if a %}{% set foo = "new" %}{% endif %}{% endfor %}{{ foo }}', opts))
      .to.equal('new');
  });

  it('gh-322: logic words are not partially matched', function () {
    expect(swig.render('{{ org }}', { locals: { org: 'foo' }})).to.equal('foo');
    expect(swig.render('{{ andif }}', { locals: { andif: 'foo' }})).to.equal('foo');
    expect(swig.render('{{ note }}', { locals: { note: 'foo' }})).to.equal('foo');
    expect(swig.render('{{ truestuff }}', { locals: { truestuff: 'foo' }})).to.equal('foo');
    expect(swig.render('{{ falsey }}', { locals: { falsey: 'foo' }})).to.equal('foo');
  });

  it('gh-323: stuff', function () {
    var tpl = "{% set foo = {label:'account.label',value:page.code} %}",
      opts = { locals: { page: { code: 'tacos' }}};
    expect(swig.render(tpl + '{{ foo.value }}', opts)).to.equal('tacos');
  });

  // The following tests should *not* run in the browser
  if (!fs || !fs.readFileSync) {
    return;
  }

  it('gh-287: Options object overwrite exposure', function () {
    var opts = {};
    swig.compileFile(__dirname + '/cases/extends_1.test.html', opts);
    expect(Object.keys(opts)).to.eql([]);
  });

  it('CVE-2023-25345: __proto__ access is blocked in templates', function () {
    expect(function () { swig.render('{{ __proto__ }}'); }).to.throwError(/Unsafe access/);
    expect(function () { swig.render('{{ constructor }}'); }).to.throwError(/Unsafe access/);
    expect(function () { swig.render('{{ prototype }}'); }).to.throwError(/Unsafe access/);
    expect(function () { swig.render('{{ foo.__proto__ }}'); }).to.throwError(/Unsafe access/);
    expect(function () { swig.render('{{ foo.constructor }}'); }).to.throwError(/Unsafe access/);
    expect(function () { swig.render('{{ constructor.constructor }}'); }).to.throwError(/Unsafe access/);
  });

  it('CVE-2023-25345: __proto__ assignment is blocked via set tag', function () {
    expect(function () { swig.render('{% set __proto__ = "x" %}'); }).to.throwError(/Unsafe assignment/);
    expect(function () { swig.render('{% set constructor = "x" %}'); }).to.throwError(/Unsafe assignment/);
    expect(function () { swig.render('{% set foo.__proto__ = "x" %}'); }).to.throwError(/Unsafe assignment/);
  });

  it('CVE-2023-25345: bracket-notation prototype access is blocked', function () {
    expect(function () { swig.render('{{ foo["__proto__"] }}', { locals: { foo: {} } }); }).to.throwError(/Unsafe access/);
    expect(function () { swig.render('{{ foo["constructor"] }}', { locals: { foo: {} } }); }).to.throwError(/Unsafe access/);
    expect(function () { swig.render('{{ foo["prototype"] }}', { locals: { foo: {} } }); }).to.throwError(/Unsafe access/);
    // Single quotes
    expect(function () { swig.render("{{ foo['__proto__'] }}", { locals: { foo: {} } }); }).to.throwError(/Unsafe access/);
    // Chained brackets
    expect(function () { swig.render('{{ foo["bar"]["__proto__"] }}', { locals: { foo: { bar: {} } } }); }).to.throwError(/Unsafe access/);
    // Array literals containing dangerous strings must NOT be blocked
    expect(swig.render('{{ items[0] }}', { locals: { items: ['__proto__'] } })).to.equal('__proto__');
  });

  it('CVE-2023-25345: bracket-notation assignment is blocked in set tag', function () {
    expect(function () { swig.render('{% set foo["__proto__"] = "x" %}'); }).to.throwError(/Unsafe assignment/);
    expect(function () { swig.render('{% set foo["constructor"] = "x" %}'); }).to.throwError(/Unsafe assignment/);
    expect(function () { swig.render('{% set foo["prototype"] = "x" %}'); }).to.throwError(/Unsafe assignment/);
  });

  it('CVE-2023-25345: dangerous loop variable names are blocked in for tag', function () {
    expect(function () { swig.render('{% for __proto__ in items %}x{% endfor %}', { locals: { items: [1] } }); }).to.throwError(/Unsafe loop variable/);
    expect(function () { swig.render('{% for constructor in items %}x{% endfor %}', { locals: { items: [1] } }); }).to.throwError(/Unsafe loop variable/);
    expect(function () { swig.render('{% for prototype in items %}x{% endfor %}', { locals: { items: [1] } }); }).to.throwError(/Unsafe loop variable/);
    // Key variable
    expect(function () { swig.render('{% for __proto__, val in items %}{{ val }}{% endfor %}', { locals: { items: [1] } }); }).to.throwError(/Unsafe loop variable/);
  });

  it('CVE-2023-25345: dotted-path loop variables are rejected in for tag', function () {
    // The lexer folds dotted paths into a single VAR token, so a loop
    // variable like `foo.__proto__` slips past the _dangerousProps indexOf
    // check against the whole match. Loop variables bind to `_ctx.<name>` —
    // bare identifiers only.
    expect(function () { swig.render('{% for foo.__proto__ in items %}x{% endfor %}', { locals: { items: [1] } }); }).to.throwError(/must be a bare identifier/);
    expect(function () { swig.render('{% for foo.constructor in items %}x{% endfor %}', { locals: { items: [1] } }); }).to.throwError(/must be a bare identifier/);
    expect(function () { swig.render('{% for a.b, c in items %}x{% endfor %}', { locals: { items: [1] } }); }).to.throwError(/must be a bare identifier/);
    expect(function () { swig.render('{% for k, v.x in items %}x{% endfor %}', { locals: { items: [1] } }); }).to.throwError(/must be a bare identifier/);
  });

  it('CVE-2023-25345: dangerous macro names are blocked', function () {
    expect(function () { swig.render('{% macro __proto__() %}test{% endmacro %}'); }).to.throwError(/Unsafe macro name/);
    expect(function () { swig.render('{% macro constructor() %}test{% endmacro %}'); }).to.throwError(/Unsafe macro name/);
    expect(function () { swig.render('{% macro prototype() %}test{% endmacro %}'); }).to.throwError(/Unsafe macro name/);
    // No-args variant
    expect(function () { swig.render('{% macro __proto__() %}test{% endmacro %}'); }).to.throwError(/Unsafe macro name/);
  });

  it('CVE-2023-25345: dangerous import aliases are blocked', function () {
    var s = new swig.Swig({ loader: swig.loaders.memory({ 'macros.html': '{% macro foo() %}test{% endmacro %}' }) });
    expect(function () { s.render('{% import "macros.html" as __proto__ %}', { filename: '/test.html' }); }).to.throwError(/Unsafe import alias/);
    expect(function () { s.render('{% import "macros.html" as constructor %}', { filename: '/test.html' }); }).to.throwError(/Unsafe import alias/);
    expect(function () { s.render('{% import "macros.html" as prototype %}', { filename: '/test.html' }); }).to.throwError(/Unsafe import alias/);
  });

  it('lexer NUMBER rule does not greedy-eat a leading sign in bracket-access expressions', function () {
    var locals = { arr: [10, 20, 30], idx: 2 };
    // Without the fix, the lexer matched `-1` as a single NUMBER token,
    // so `arr[arr.length-1]` lexed VAR + DOTKEY + NUMBER(-1) + `]`,
    // and the parser then bailed with "Unexpected closing square bracket".
    expect(swig.render('{% set a = arr[arr.length-1] %}{{ a }}', { locals: locals })).to.equal('30');
    expect(swig.render('{% set a = arr[arr.length - 1] %}{{ a }}', { locals: locals })).to.equal('30');
    expect(swig.render('{% set a = arr[idx-1] %}{{ a }}', { locals: locals })).to.equal('20');
    expect(swig.render('{% set a = arr[idx - 1] %}{{ a }}', { locals: locals })).to.equal('20');
    // Symmetric `+` shape — same trap, same fix.
    expect(swig.render('{% set a = arr[idx+0] %}{{ a }}', { locals: locals })).to.equal('30');
    expect(swig.render('{% set a = arr[idx-2] %}{{ a }}', { locals: locals })).to.equal('10');
    // The `*` / `/` / `%` operators don't share the trap (the NUMBER regex
    // never had `*?` / `/?` / `%?` prefix), but assert the round-trip so
    // a future lexer change can't silently regress them.
    expect(swig.render('{% set a = arr[idx*1] %}{{ a }}', { locals: locals })).to.equal('30');
    expect(swig.render('{% set a = arr[idx/1] %}{{ a }}', { locals: locals })).to.equal('30');
  });

  it('lexer NUMBER fix preserves unary-minus paths the parser folds via parsePrimary', function () {
    expect(swig.render('{% set x = -5 %}{{ x }}')).to.equal('-5');
    expect(swig.render('{% set x = -1.5 %}{{ x }}')).to.equal('-1.5');
    expect(swig.render('{{ a + -5 }}', { locals: { a: 10 } })).to.equal('5');
    expect(swig.render('{{ a - -5 }}', { locals: { a: 10 } })).to.equal('15');
  });

  it('varStrip / tagStrip do not greedy-eat a leading - of negative-number expressions', function () {
    // Before the fix, lib/parser.js's varStrip / tagStrip regex used
    // `^{{-?\s*-?|-?\s*-?}}$` — the second `-?` after `\s*` matched the
    // leading `-` of a negative-number expression as if it were a
    // whitespace-control marker. `{{ -5 }}` rendered as "5" (sign eaten
    // before the lexer ever saw it).
    expect(swig.render('{{ -5 }}')).to.equal('-5');
    expect(swig.render('{{ -1.5 }}')).to.equal('-1.5');
    expect(swig.render('{{ -5.0 }}')).to.equal('-5');
    // Strip-control still composes with negative-number expressions —
    // `{{-` and `-}}` consume only the strip marker (immediately adjacent
    // to the open / close), the expression's `-` survives.
    expect(swig.render('a\n{{- -5 -}}\nb')).to.equal('a-5b');
    expect(swig.render('a\n{{- -5 }}\nb')).to.equal('a-5\nb');
    expect(swig.render('a\n{{ -5 -}}\nb')).to.equal('a\n-5b');
    // Existing strip-control on regular variables still works.
    expect(swig.render('a\n{{- x -}}\nb', { locals: { x: 'y' } })).to.equal('ayb');
  });

  it('CVE-2021-44906: optimist is no longer a direct dependency', function () {
    // swig -> optimist@0.6.1 -> minimist@~0.0.1 was vulnerable to
    // prototype pollution. optimist was first replaced by yargs (v1.4.5),
    // and yargs in turn by a zero-dependency CLI argument parser. Verify
    // the vulnerable optimist path is gone.
    var deps = require('../package.json').dependencies;
    expect(deps).to.not.have.property('optimist');
  });

  it('keeps the runtime dependency surface to @rhinostone/swig-core only', function () {
    // CLI-only tooling (argument parsing, the --minify minifier) must not
    // sit in production `dependencies` — a library install of swig should
    // pull in nothing but @rhinostone/swig-core. A new runtime dependency
    // tripping this assertion should be a deliberate decision, not an
    // unnoticed regression in the supply-chain surface.
    var deps = require('../package.json').dependencies;
    expect(Object.keys(deps)).to.eql(['@rhinostone/swig-core']);
  });
});
