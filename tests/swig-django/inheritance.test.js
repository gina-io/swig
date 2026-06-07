var django = require('@rhinostone/swig-django'),
  expect = require('../lib/expect.js');


/*!
 * Django `{% block %}` / `{% extends %}` / `{% include %}` inheritance tests.
 *
 * The Django parser's splitter already collects `parent` / `parentExpr` /
 * `blocks` (S1 scaffold); these tags supply the parse/compile halves. Block
 * override resolution + the parent chain run through the shared swig-core
 * engine (`getParents` / `remapBlocks` / `importNonBlocks`), so Django
 * behaves identically to the native / Twig / Jinja2 frontends.
 *
 * `{{ block.super }}` (parent-block content) is a deferred follow-up —
 * consistent with the Jinja2 sibling, which ships without `{{ super() }}`.
 */
describe('@rhinostone/swig-django — block / extends / include', function () {

  function r(src, locals) {
    return django.render(src, { locals: locals || {} });
  }
  function threw(fn) {
    try { fn(); return false; } catch (e) { return e.message; }
  }
  function inst(templates) {
    return new django.Django({ loader: django.loaders.memory(templates) });
  }

  /* ---- block (standalone) ------------------------------------- */

  it('renders a standalone block body (no extends)', function () {
    expect(r('{% block content %}hi{% endblock %}')).to.equal('hi');
  });

  it('accepts an optional name on endblock', function () {
    expect(r('{% block content %}hi{% endblock content %}')).to.equal('hi');
  });

  it('interpolates inside a block', function () {
    expect(r('{% block g %}Hello {{ name }}{% endblock %}', { name: 'Ada' })).to.equal('Hello Ada');
  });

  it('rejects a dangerous block name', function () {
    expect(threw(function () { r('{% block __proto__ %}x{% endblock %}'); })).to.contain('CVE-2023-25345');
  });

  it('rejects a dotted block name', function () {
    expect(threw(function () { r('{% block a.b %}x{% endblock %}'); })).to.contain('bare identifier');
  });

  it('rejects an extra token after the block name', function () {
    expect(threw(function () { r('{% block a b %}x{% endblock %}'); })).to.contain('after block name');
  });

  /* ---- extends ------------------------------------------------ */

  it('overrides a parent block', function () {
    var m = inst({
      'layout.html': 'A{% block content %}default{% endblock %}B',
      'child.html': '{% extends "layout.html" %}{% block content %}over{% endblock %}'
    });
    expect(m.renderFile('child.html', {})).to.equal('AoverB');
  });

  it('falls back to the parent block when the child does not override', function () {
    var m = inst({
      'layout.html': 'A{% block content %}default{% endblock %}B',
      'child.html': '{% extends "layout.html" %}'
    });
    expect(m.renderFile('child.html', {})).to.equal('AdefaultB');
  });

  it('resolves a multi-level extends chain (child wins)', function () {
    var m = inst({
      'base.html': '[{% block body %}base{% endblock %}]',
      'mid.html': '{% extends "base.html" %}{% block body %}mid{% endblock %}',
      'leaf.html': '{% extends "mid.html" %}{% block body %}leaf{% endblock %}'
    });
    expect(m.renderFile('leaf.html', {})).to.equal('[leaf]');
  });

  it('throws a clear error for a dynamic extends path on the sync render path', function () {
    var m = inst({
      'layout.html': 'A{% block b %}d{% endblock %}B',
      'child.html': '{% extends pv %}{% block b %}o{% endblock %}'
    });
    expect(threw(function () { m.renderFile('child.html', { pv: 'layout.html' }); })).to.contain('async render path');
  });

  it('rejects an empty extends tag', function () {
    expect(threw(function () { r('{% extends %}x'); })).to.contain('Expected parent template path');
  });

  /* ---- include ------------------------------------------------ */

  it('includes a partial that sees the caller context by default', function () {
    var m = inst({ 'page.html': 'A{% include "p.html" %}B', 'p.html': '[{{ x }}]' });
    expect(m.renderFile('page.html', { x: 'hi' })).to.equal('A[hi]B');
  });

  it('merges with name=value pairs over the caller context', function () {
    var m = inst({ 'page.html': '{% include "p.html" with y="extra" %}', 'p.html': '[{{ x }}|{{ y }}]' });
    expect(m.renderFile('page.html', { x: 'hi' })).to.equal('[hi|extra]');
  });

  it('isolates the included template with `only`', function () {
    var m = inst({ 'page.html': '{% include "p.html" with y="extra" only %}', 'p.html': '[{{ x }}|{{ y }}]' });
    expect(m.renderFile('page.html', { x: 'hi' })).to.equal('[|extra]');
  });

  it('gives an empty isolated context for a bare `only`', function () {
    var m = inst({ 'page.html': '{% include "p.html" only %}', 'p.html': '[{{ x }}]' });
    expect(m.renderFile('page.html', { x: 'hi' })).to.equal('[]');
  });

  it('treats `only` as a value, not the keyword, when it is an assignment RHS', function () {
    var m = inst({ 'page.html': '{% include "p.html" with z=onlyvar %}', 'p.html': '[{{ z }}]' });
    expect(m.renderFile('page.html', { onlyvar: 'V' })).to.equal('[V]');
  });

  it('collects multiple with pairs', function () {
    var m = inst({ 'page.html': '{% include "p.html" with a=1 b=2 %}', 'p.html': '[{{ a }}{{ b }}]' });
    expect(m.renderFile('page.html', {})).to.equal('[12]');
  });

  it('resolves a dynamic include path at render time', function () {
    var m = inst({ 'page.html': '{% include partial %}', 'p.html': 'PARTIAL' });
    expect(m.renderFile('page.html', { partial: 'p.html' })).to.equal('PARTIAL');
  });

  it('rejects a dangerous with-assignment name', function () {
    var m = inst({ 'page.html': '{% include "p.html" with __proto__=1 %}', 'p.html': 'x' });
    expect(threw(function () { m.renderFile('page.html', {}); })).to.contain('CVE-2023-25345');
  });

  it('rejects a with clause with no assignments', function () {
    expect(threw(function () { r('{% include "p.html" with %}'); })).to.contain('Expected at least one');
  });

  it('rejects an empty include tag', function () {
    expect(threw(function () { r('{% include %}'); })).to.contain('Expected template path');
  });
});
