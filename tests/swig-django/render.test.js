var django = require('@rhinostone/swig-django'),
  expect = require('../lib/expect.js');


/*!
 * Django Path-A render-surface tests.
 *
 * End-to-end render through the engine.install() pipeline: plain text,
 * variable output, autoescape, `{# … #}` comments, colon-filters, and basic
 * `{% if %}` / `{% elif %}` / `{% else %}` conditionals (the S1 surface).
 * Tag-level coverage (for / block / extends / include / …) grows alongside
 * each tag in later commits.
 */
describe('@rhinostone/swig-django — render', function () {

  function r(src, locals) {
    return django.render(src, { locals: locals || {} });
  }

  /* ---- Text / variables --------------------------------------- */

  it('renders plain text verbatim', function () {
    expect(r('Hello, world')).to.equal('Hello, world');
  });

  it('interpolates a variable', function () {
    expect(r('Hello {{ name }}', { name: 'world' })).to.equal('Hello world');
  });

  it('resolves a dotted path', function () {
    expect(r('{{ user.name }}', { user: { name: 'Ada' } })).to.equal('Ada');
  });

  it('coerces a missing variable to the empty string', function () {
    expect(r('[{{ missing }}]')).to.equal('[]');
  });

  /* ---- Autoescape --------------------------------------------- */

  it('autoescapes variable output by default', function () {
    expect(r('{{ x }}', { x: '<b>&"\'' })).to.equal('&lt;b&gt;&amp;&quot;&#39;');
  });

  it('does not double-escape an existing entity', function () {
    expect(r('{{ x }}', { x: 'a &amp; b' })).to.equal('a &amp; b');
  });

  it('the safe filter bypasses autoescape', function () {
    expect(r('{{ x|safe }}', { x: '<b>bold</b>' })).to.equal('<b>bold</b>');
  });

  it('honors a per-instance autoescape:false option', function () {
    var inst = new django.Django({ autoescape: false });
    expect(inst.render('{{ x }}', { locals: { x: '<b>' } })).to.equal('<b>');
  });

  /* ---- Filters (colon-args) ----------------------------------- */

  it('applies a no-argument filter', function () {
    expect(r('{{ name|upper }}', { name: 'swig' })).to.equal('SWIG');
  });

  it('applies a colon-filter with a string argument', function () {
    expect(r('{{ x|default:"nothing" }}', { x: '' })).to.equal('nothing');
    expect(r('{{ x|default:"nothing" }}', { x: 'set' })).to.equal('set');
  });

  it('applies a colon-filter with a numeric argument', function () {
    expect(r('{{ n|add:2 }}', { n: 4 })).to.equal('6');
  });

  it('applies a colon-filter with a variable argument', function () {
    expect(r('{{ a|add:b }}', { a: 3, b: 4 })).to.equal('7');
  });

  it('joins a list with a string separator', function () {
    expect(r('{{ list|join:", " }}', { list: ['a', 'b', 'c'] })).to.equal('a, b, c');
  });

  it('applies a chained filter (escape tail stays idempotent)', function () {
    expect(r('{{ s|upper|safe }}', { s: '<x>' })).to.equal('<X>');
  });

  /* ---- Comments ----------------------------------------------- */

  it('drops a comment', function () {
    expect(r('a{# this is dropped #}b')).to.equal('ab');
  });

  /* ---- Conditionals ------------------------------------------- */

  it('renders a basic if (true / false)', function () {
    expect(r('{% if x %}yes{% else %}no{% endif %}', { x: true })).to.equal('yes');
    expect(r('{% if x %}yes{% else %}no{% endif %}', { x: false })).to.equal('no');
  });

  it('renders an if / elif / else chain', function () {
    var tpl = '{% if a %}A{% elif b %}B{% else %}C{% endif %}';
    expect(r(tpl, { a: true, b: false })).to.equal('A');
    expect(r(tpl, { a: false, b: true })).to.equal('B');
    expect(r(tpl, { a: false, b: false })).to.equal('C');
  });

  it('evaluates `is None` / `is not None` identity in a condition', function () {
    expect(r('{% if x is None %}none{% else %}set{% endif %}', { x: null })).to.equal('none');
    expect(r('{% if x is None %}none{% else %}set{% endif %}', {})).to.equal('none');
    expect(r('{% if x is None %}none{% else %}set{% endif %}', { x: 5 })).to.equal('set');
    expect(r('{% if x is not None %}set{% else %}none{% endif %}', { x: 5 })).to.equal('set');
  });

  it('evaluates comparison and boolean-logic conditions', function () {
    expect(r('{% if n == 5 %}five{% endif %}', { n: 5 })).to.equal('five');
    expect(r('{% if a and b %}both{% endif %}', { a: true, b: true })).to.equal('both');
    expect(r('{% if a or b %}either{% endif %}', { a: false, b: true })).to.equal('either');
  });

  /* ---- Security ----------------------------------------------- */

  it('throws on a CVE-2023-25345 dangerous access at render time', function () {
    expect(function () { r('{{ __proto__ }}'); }).to.throwError();
    expect(function () { r('{{ foo.constructor }}', { foo: {} }); }).to.throwError();
  });

  /* ---- Errors ------------------------------------------------- */

  it('throws on an unknown tag', function () {
    expect(function () { r('{% bogus %}'); }).to.throwError(/Unexpected tag/);
  });

  it('throws on a missing end tag', function () {
    expect(function () { r('{% if x %}unterminated'); }).to.throwError(/Missing end tag/);
  });

});
