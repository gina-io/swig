var django = require('@rhinostone/swig-django'),
  expect = require('../lib/expect.js');


/*!
 * Django output tags: `{% firstof %}` and `{% cycle %}`.
 *
 * Both produce output that is autoescaped per the enclosing region (read
 * from the parser's `token.escape`, the same escape state `{{ … }}` uses).
 * firstof lowers to an IROutput (`a || b || … || ""`); cycle emits a stateful
 * per-occurrence counter on `_ctx`. The named/`silent` cycle forms and the
 * `firstof … as var` form are deferred and rejected clearly.
 */
describe('@rhinostone/swig-django — firstof / cycle', function () {

  function r(src, locals) {
    return django.render(src, { locals: locals || {} });
  }
  function threw(fn) {
    try { fn(); return false; } catch (e) { return e.message; }
  }

  /* ---- firstof ------------------------------------------------ */

  it('outputs the first truthy value', function () {
    expect(r('{% firstof a b c %}', { a: '', b: 'B', c: 'C' })).to.equal('B');
  });

  it('outputs the first value when all are present', function () {
    expect(r('{% firstof a b %}', { a: 'A', b: 'B' })).to.equal('A');
  });

  it('outputs empty when every value is falsy', function () {
    expect(r('[{% firstof a b %}]', { a: '', b: '' })).to.equal('[]');
  });

  it('treats a missing variable as falsy', function () {
    expect(r('{% firstof a b %}', { b: 'B' })).to.equal('B');
  });

  it('uses a trailing literal as the fallback', function () {
    expect(r('{% firstof a b "def" %}', { a: '', b: '' })).to.equal('def');
  });

  it('autoescapes its output by default', function () {
    expect(r('{% firstof a %}', { a: '<b>' })).to.equal('&lt;b&gt;');
  });

  it('does not escape inside autoescape off', function () {
    expect(r('{% autoescape off %}{% firstof a %}{% endautoescape %}', { a: '<b>' })).to.equal('<b>');
  });

  it('rejects the deferred "as var" form', function () {
    expect(threw(function () { r('{% firstof a b as v %}', { a: 'A' }); })).to.contain('not yet supported');
  });

  it('rejects an empty firstof', function () {
    expect(threw(function () { r('{% firstof %}'); })).to.contain('at least one value');
  });

  /* ---- cycle -------------------------------------------------- */

  it('alternates values across loop iterations', function () {
    expect(r('{% for x in items %}{% cycle "odd" "even" %};{% endfor %}', { items: [1, 2, 3, 4, 5] }))
      .to.equal('odd;even;odd;even;odd;');
  });

  it('cycles through three values', function () {
    expect(r('{% for x in items %}{% cycle "a" "b" "c" %}{% endfor %}', { items: [1, 2, 3, 4, 5, 6, 7] }))
      .to.equal('abcabca');
  });

  it('outputs the first value when used standalone', function () {
    expect(r('{% cycle "x" "y" %}')).to.equal('x');
  });

  it('evaluates expression values each iteration', function () {
    expect(r('{% for i in items %}{% cycle p q %};{% endfor %}', { items: [1, 2, 3], p: 'P', q: 'Q' }))
      .to.equal('P;Q;P;');
  });

  it('keeps two cycles in one loop independent', function () {
    expect(r('{% for i in items %}{% cycle "1" "2" %}{% cycle "a" "b" "c" %} {% endfor %}', { items: [1, 2, 3, 4] }))
      .to.equal('1a 2b 1c 2a ');
  });

  it('autoescapes its output by default', function () {
    expect(r('{% cycle a b %}', { a: '<x>' })).to.equal('&lt;x&gt;');
  });

  it('rejects the deferred "as name" form', function () {
    expect(threw(function () { r('{% cycle "a" "b" as rc %}'); })).to.contain('Named cycles');
  });

  it('rejects the deferred "silent" modifier', function () {
    expect(threw(function () { r('{% cycle "a" "b" silent %}'); })).to.contain('silent');
  });

  it('rejects an empty cycle', function () {
    expect(threw(function () { r('{% cycle %}'); })).to.contain('at least one value');
  });
});
