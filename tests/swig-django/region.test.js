var django = require('@rhinostone/swig-django'),
  expect = require('../lib/expect.js');


/*!
 * Django region tags: `{% with %}`, `{% autoescape %}`, `{% spaceless %}`,
 * `{% comment %}`, `{% verbatim %}`.
 *
 * autoescape + verbatim/comment lean on parser machinery scaffolded in S1
 * (the escape-value stack and the `inRaw` raw-skip flag — comment joins
 * verbatim on the `inRaw` path). with/spaceless are flavor-local tags over
 * the shared backend's With / legacyJS emit.
 */
describe('@rhinostone/swig-django — region tags', function () {

  function r(src, locals) {
    return django.render(src, { locals: locals || {} });
  }
  function threw(fn) {
    try { fn(); return false; } catch (e) { return e.message; }
  }

  /* ---- with --------------------------------------------------- */

  it('binds space-separated name=value pairs', function () {
    expect(r('{% with a=1 b=2 %}{{ a }}{{ b }}{% endwith %}')).to.equal('12');
  });

  it('binds an expression value', function () {
    expect(r('{% with t=x %}{{ t }}{% endwith %}', { x: 'V' })).to.equal('V');
  });

  it('supports the legacy "expr as name" form', function () {
    expect(r('{% with x as t %}{{ t }}{% endwith %}', { x: 'AS' })).to.equal('AS');
  });

  it('does not leak bindings past endwith', function () {
    expect(r('{% with a=9 %}{{ a }}{% endwith %}[{{ a }}]')).to.equal('9[]');
  });

  it('keeps the outer context visible inside (merge, not isolate)', function () {
    expect(r('{% with a=1 %}{{ a }}{{ outer }}{% endwith %}', { outer: 'O' })).to.equal('1O');
  });

  it('rejects a dangerous with-assignment name', function () {
    expect(threw(function () { r('{% with __proto__=1 %}x{% endwith %}'); })).to.contain('CVE-2023-25345');
  });

  it('rejects a bare with tag (no assignments)', function () {
    expect(threw(function () { r('{% with %}x{% endwith %}'); })).to.contain('at least one assignment');
  });

  /* ---- autoescape --------------------------------------------- */

  it('disables escaping with `off`', function () {
    expect(r('{% autoescape off %}{{ h }}{% endautoescape %}', { h: '<b>' })).to.equal('<b>');
  });

  it('enables escaping with `on`', function () {
    expect(r('{% autoescape on %}{{ h }}{% endautoescape %}', { h: '<b>' })).to.equal('&lt;b&gt;');
  });

  it('toggles escaping per region and restores after', function () {
    expect(r('{{ h }}|{% autoescape off %}{{ h }}{% endautoescape %}|{{ h }}', { h: '<b>' }))
      .to.equal('&lt;b&gt;|<b>|&lt;b&gt;');
  });

  it('rejects a non on/off argument', function () {
    expect(threw(function () { r('{% autoescape maybe %}x{% endautoescape %}'); })).to.contain('on" or "off');
  });

  /* ---- spaceless ---------------------------------------------- */

  it('collapses whitespace between HTML tags', function () {
    expect(r('{% spaceless %}<p>\n  <a>x</a>\n</p>{% endspaceless %}')).to.equal('<p><a>x</a></p>');
  });

  it('only affects its own region, not surrounding output', function () {
    expect(r('A  B{% spaceless %}<p> <a>x</a> </p>{% endspaceless %}C  D')).to.equal('A  B<p><a>x</a></p>C  D');
  });

  it('rejects a token after spaceless', function () {
    expect(threw(function () { r('{% spaceless x %}<a>1</a>{% endspaceless %}'); })).to.contain('after "spaceless"');
  });

  /* ---- comment ------------------------------------------------ */

  it('discards its body', function () {
    expect(r('A{% comment %}hidden{% endcomment %}B')).to.equal('AB');
  });

  it('does not parse its body (broken tags inside are safe)', function () {
    expect(r('A{% comment %}{{ broken }}{% bogus_tag %}{% endcomment %}B')).to.equal('AB');
  });

  it('accepts and ignores an optional note', function () {
    expect(r('A{% comment "why this is here" %}x{% endcomment %}B')).to.equal('AB');
  });

  /* ---- verbatim ----------------------------------------------- */

  it('renders its body literally without parsing', function () {
    expect(r('{% verbatim %}{{ x }} and {% if y %}{% endverbatim %}', { x: 'V' })).to.equal('{{ x }} and {% if y %}');
  });

  it('parses outside the block but not inside', function () {
    expect(r('{{ x }}|{% verbatim %}{{ x }}{% endverbatim %}', { x: 'V' })).to.equal('V|{{ x }}');
  });

  it('rejects a token after verbatim', function () {
    expect(threw(function () { r('{% verbatim x %}a{% endverbatim %}'); })).to.contain('after "verbatim"');
  });
});
