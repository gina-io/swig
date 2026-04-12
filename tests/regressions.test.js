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

  it('CVE-2021-44906: optimist is no longer a direct dependency', function () {
    // swig -> optimist@0.6.1 -> minimist@~0.0.1 was vulnerable to
    // prototype pollution. The fix was to replace optimist with yargs,
    // which has no minimist dependency. Verify the vulnerable path is gone.
    var deps = require('../package.json').dependencies;
    expect(deps).to.not.have.property('optimist');
    expect(deps).to.have.property('yargs');
  });
});
