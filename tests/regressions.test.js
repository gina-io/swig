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

  it('CVE-2021-44906: minimist is pinned to a non-vulnerable version', function () {
    // swig -> optimist@0.6.1 -> minimist@~0.0.1 is vulnerable to
    // prototype pollution. The package.json "overrides" block pins
    // minimist to ^1.2.8 (CVE fixed in 1.2.6, hardened in 1.2.7/8).
    // Requires npm >= 8.3 to honour `overrides`.
    var version = require('minimist/package.json').version;
    var parts = version.split('.').map(Number);
    var major = parts[0], minor = parts[1], patch = parts[2];
    var safe = major > 1
      || (major === 1 && minor > 2)
      || (major === 1 && minor === 2 && patch >= 6);
    expect(safe).to.be(true);
  });
});
