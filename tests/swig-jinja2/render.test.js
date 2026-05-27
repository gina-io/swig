var jinja2 = require('@rhinostone/swig-jinja2'),
  expect = require('expect.js');


/*!
 * Path A render-surface tests.
 *
 * End-to-end render through the engine.install() pipeline: variable
 * output, autoescape, comments, and whitespace control. Tag-level render
 * coverage grows alongside each tag.
 */
describe('@rhinostone/swig-jinja2 — render', function () {

  it('renders plain text verbatim', function () {
    expect(jinja2.render('Hello, world')).to.equal('Hello, world');
  });

  it('interpolates a variable', function () {
    expect(jinja2.render('Hello {{ name }}', { locals: { name: 'world' } })).to.equal('Hello world');
  });

  it('resolves a dotted path', function () {
    expect(jinja2.render('{{ user.name }}', { locals: { user: { name: 'Ada' } } })).to.equal('Ada');
  });

  it('applies a filter chain', function () {
    expect(jinja2.render('{{ name|upper }}', { locals: { name: 'swig' } })).to.equal('SWIG');
  });

  it('autoescapes variable output by default', function () {
    expect(jinja2.render('{{ s }}', { locals: { s: '<b>' } })).to.equal('&lt;b&gt;');
  });

  it('suppresses autoescape for a |safe value', function () {
    expect(jinja2.render('{{ s|safe }}', { locals: { s: '<b>' } })).to.equal('<b>');
  });

  it('evaluates arithmetic and the Jinja2 operators', function () {
    expect(jinja2.render('{{ 2 ** 3 }}')).to.equal('8');
    expect(jinja2.render('{{ 7 // 2 }}')).to.equal('3');
    expect(jinja2.render("{{ 'a' ~ 'b' ~ 'c' }}")).to.equal('abc');
  });

  it('evaluates an inline-if expression', function () {
    expect(jinja2.render("{{ 'yes' if flag else 'no' }}", { locals: { flag: true } })).to.equal('yes');
    expect(jinja2.render("{{ 'yes' if flag else 'no' }}", { locals: { flag: false } })).to.equal('no');
    expect(jinja2.render("{{ 'yes' if flag }}", { locals: { flag: true } })).to.equal('yes');
  });

  it('slices arrays and strings', function () {
    // Array output coerces to a comma-joined string via JS toString.
    expect(jinja2.render('{{ items[1:3] }}', { locals: { items: ['a', 'b', 'c', 'd'] } })).to.equal('b,c');
    expect(jinja2.render('{{ name[::-1] }}', { locals: { name: 'abc' } })).to.equal('cba');
  });

  it('drops comments', function () {
    expect(jinja2.render('a{# this is a comment #}b')).to.equal('ab');
  });

  it('strips whitespace with {{- -}} controls', function () {
    expect(jinja2.render('a   {{- x -}}   b', { locals: { x: 'Y' } })).to.equal('aYb');
  });

  it('keeps a per-instance environment isolated', function () {
    var noEscape = new jinja2.Jinja2({ autoescape: false });
    expect(noEscape.render('{{ s }}', { locals: { s: '<b>' } })).to.equal('<b>');
    // Default instance still autoescapes.
    expect(jinja2.render('{{ s }}', { locals: { s: '<b>' } })).to.equal('&lt;b&gt;');
  });

  describe('null / undefined output coercion', function () {

    it('renders a function returning undefined / null as ""', function () {
      expect(jinja2.render('[{{ f() }}]', { locals: { f: function () { return undefined; } } })).to.equal('[]');
      expect(jinja2.render('[{{ f() }}]', { locals: { f: function () { return null; } } })).to.equal('[]');
    });

    it('coerces even under |safe and with autoescape off', function () {
      expect(jinja2.render('[{{ f()|safe }}]', { locals: { f: function () { return undefined; } } })).to.equal('[]');
      var noEscape = new jinja2.Jinja2({ autoescape: false });
      expect(noEscape.render('[{{ f() }}]', { locals: { f: function () { return undefined; } } })).to.equal('[]');
    });

    it('renders an inline-if with no else and a false condition as ""', function () {
      expect(jinja2.render("[{{ 'x' if cond }}]", { locals: { cond: false } })).to.equal('[]');
    });

    it('preserves real falsy values (0, false)', function () {
      expect(jinja2.render('{{ f() }}', { locals: { f: function () { return 0; } } })).to.equal('0');
      expect(jinja2.render('{{ f() }}', { locals: { f: function () { return false; } } })).to.equal('false');
    });

    it('leaves plain variable output (already coerced) unchanged', function () {
      expect(jinja2.render('[{{ missing }}]')).to.equal('[]');
      expect(jinja2.render('{{ name }}', { locals: { name: 'Ada' } })).to.equal('Ada');
    });

  });

});
