var jinja2 = require('@rhinostone/swig-jinja2'),
  expect = require('expect.js');


/*!
 * Per-tag render tests. Each tag is exercised end-to-end through the
 * engine.install() pipeline so the IR shape and its runtime emission are
 * both verified.
 */
describe('@rhinostone/swig-jinja2 — tags', function () {

  function render(src, locals) {
    return jinja2.render(src, { locals: locals || {} });
  }

  describe('{% set %}', function () {

    it('assigns a literal and interpolates it', function () {
      expect(render('{% set x = 5 %}{{ x }}')).to.equal('5');
    });

    it('assigns an expression', function () {
      expect(render("{% set x = 'a' ~ 'b' %}{{ x }}")).to.equal('ab');
      expect(render('{% set x = 2 ** 3 %}{{ x }}')).to.equal('8');
    });

    it('assigns from locals', function () {
      expect(render('{% set y = x %}{{ y }}', { x: 'hi' })).to.equal('hi');
    });

    it('supports the body-capture form', function () {
      expect(render('{% set greeting %}hello{% endset %}{{ greeting }}')).to.equal('hello');
    });

    it('rejects bracket-notation assignment', function () {
      expect(function () {
        render('{% set x["a"] = 1 %}');
      }).to.throwError(/Bracket-notation assignment is not supported/);
    });

    it('blocks a dangerous assignment target', function () {
      expect(function () {
        render('{% set __proto__ = 1 %}');
      }).to.throwError(/CVE-2023-25345/);
    });

  });

  describe('{% if %} / {% elif %} / {% else %}', function () {

    it('renders the body when the condition is truthy', function () {
      expect(render('{% if flag %}on{% endif %}', { flag: true })).to.equal('on');
      expect(render('{% if flag %}on{% endif %}', { flag: false })).to.equal('');
    });

    it('walks an if / elif / else chain', function () {
      var tpl = '{% if a %}A{% elif b %}B{% else %}C{% endif %}';
      expect(render(tpl, { a: true, b: false })).to.equal('A');
      expect(render(tpl, { a: false, b: true })).to.equal('B');
      expect(render(tpl, { a: false, b: false })).to.equal('C');
    });

    it('supports multiple elif branches', function () {
      var tpl = '{% if n == 1 %}one{% elif n == 2 %}two{% elif n == 3 %}three{% else %}many{% endif %}';
      expect(render(tpl, { n: 2 })).to.equal('two');
      expect(render(tpl, { n: 3 })).to.equal('three');
      expect(render(tpl, { n: 9 })).to.equal('many');
    });

    it('honours `not` and logic operators', function () {
      expect(render('{% if not done %}pending{% endif %}', { done: false })).to.equal('pending');
      expect(render('{% if a and b %}both{% endif %}', { a: true, b: true })).to.equal('both');
    });

    it('integrates `is defined` tests', function () {
      expect(render('{% if x is defined %}yes{% else %}no{% endif %}', { x: 'hi' })).to.equal('yes');
      expect(render('{% if x is defined %}yes{% else %}no{% endif %}', {})).to.equal('no');
    });

    it('nests conditionals', function () {
      var tpl = '{% if a %}{% if b %}AB{% else %}A{% endif %}{% else %}none{% endif %}';
      expect(render(tpl, { a: true, b: true })).to.equal('AB');
      expect(render(tpl, { a: true, b: false })).to.equal('A');
      expect(render(tpl, { a: false, b: true })).to.equal('none');
    });

    it('rejects elif / else outside an if', function () {
      expect(function () { render('{% elif x %}y{% endif %}'); }).to.throwError(/"elif" is only valid inside an "if"/);
      expect(function () { render('{% else %}y'); }).to.throwError(/"else" is only valid inside/);
    });

    it('rejects a malformed chain (elif after else)', function () {
      expect(function () {
        render('{% if a %}A{% else %}B{% elif c %}C{% endif %}');
      }).to.throwError(/"elif" after "else"/);
    });

  });

  describe('{% for %}', function () {

    it('iterates an array', function () {
      expect(render('{% for n in items %}{{ n }}{% endfor %}', { items: [1, 2, 3] })).to.equal('123');
    });

    it('iterates a literal array', function () {
      expect(render('{% for n in [1, 2, 3] %}{{ n }};{% endfor %}')).to.equal('1;2;3;');
    });

    it('exposes loop.index / loop.first / loop.last / loop.length', function () {
      expect(render('{% for n in items %}{{ loop.index }}{% endfor %}', { items: ['a', 'b', 'c'] })).to.equal('123');
      expect(render('{% for n in items %}{{ loop.index0 }}{% endfor %}', { items: ['a', 'b', 'c'] })).to.equal('012');
      expect(render('{% for n in items %}{% if loop.first %}[{% endif %}{{ n }}{% if loop.last %}]{% endif %}{% endfor %}', { items: ['a', 'b', 'c'] })).to.equal('[abc]');
      expect(render('{% for n in items %}{{ loop.length }}{% endfor %}', { items: ['a', 'b'] })).to.equal('22');
    });

    it('binds key, value over an object', function () {
      expect(render('{% for k, v in obj %}{{ k }}={{ v }};{% endfor %}', { obj: { a: 1, b: 2 } })).to.equal('a=1;b=2;');
    });

    it('runs the else branch when the iterable is empty', function () {
      expect(render('{% for n in items %}{{ n }}{% else %}empty{% endfor %}', { items: [] })).to.equal('empty');
      expect(render('{% for n in items %}{{ n }}{% else %}empty{% endfor %}', { items: [1] })).to.equal('1');
      expect(render('{% for n in missing %}{{ n }}{% else %}empty{% endfor %}')).to.equal('empty');
    });

    it('restores the outer loop state after a nested loop', function () {
      var tpl = '{% for i in outer %}{% for j in inner %}{{ i }}{{ j }}{% endfor %}|{% endfor %}';
      expect(render(tpl, { outer: [1, 2], inner: ['a', 'b'] })).to.equal('1a1b|2a2b|');
    });

    it('rejects a dangerous loop variable', function () {
      expect(function () { render('{% for __proto__ in items %}x{% endfor %}'); }).to.throwError(/CVE-2023-25345/);
    });

    it('rejects a dotted loop variable', function () {
      expect(function () { render('{% for a.b in items %}x{% endfor %}'); }).to.throwError(/must be a bare identifier/);
    });

  });

  describe('{% block %}', function () {

    it('renders its body when standalone (no extends)', function () {
      expect(render('{% block content %}hi{% endblock %}')).to.equal('hi');
    });

    it('renders interpolated content inside a block', function () {
      expect(render('{% block greeting %}Hello {{ name }}{% endblock %}', { name: 'Ada' })).to.equal('Hello Ada');
    });

    it('rejects a dangerous block name', function () {
      expect(function () { render('{% block __proto__ %}x{% endblock %}'); }).to.throwError(/CVE-2023-25345/);
    });

    it('rejects a dotted block name', function () {
      expect(function () { render('{% block a.b %}x{% endblock %}'); }).to.throwError(/must be a bare identifier/);
    });

  });

  describe('{% extends %} / inheritance', function () {

    function instance(templates) {
      return new jinja2.Jinja2({ loader: jinja2.loaders.memory(templates) });
    }

    it('overrides a parent block', function () {
      var mj = instance({
        'layout.html': 'A{% block content %}default{% endblock %}B',
        'child.html': '{% extends "layout.html" %}{% block content %}over{% endblock %}'
      });
      expect(mj.renderFile('child.html', {})).to.equal('AoverB');
    });

    it('keeps the parent block when not overridden', function () {
      var mj = instance({
        'layout.html': 'A{% block content %}default{% endblock %}B',
        'child.html': '{% extends "layout.html" %}'
      });
      expect(mj.renderFile('child.html', {})).to.equal('AdefaultB');
    });

    it('resolves a multi-level inheritance chain', function () {
      var mj = instance({
        'base.html': '[{% block body %}base{% endblock %}]',
        'mid.html': '{% extends "base.html" %}{% block body %}mid{% endblock %}',
        'leaf.html': '{% extends "mid.html" %}{% block body %}leaf{% endblock %}'
      });
      expect(mj.renderFile('leaf.html', {})).to.equal('[leaf]');
    });

    it('rejects dynamic extends', function () {
      expect(function () {
        render('{% extends parent_var %}', { parent_var: 'x' });
      }).to.throwError(/Dynamic "extends" is not supported/);
    });

  });

  describe('{% include %}', function () {

    function instance(templates) {
      return new jinja2.Jinja2({ loader: jinja2.loaders.memory(templates) });
    }

    it('includes a partial that sees the caller context by default', function () {
      var mj = instance({
        'page.html': 'A{% include "p.html" %}B',
        'p.html': '[{{ x }}]'
      });
      expect(mj.renderFile('page.html', { x: 'hi' })).to.equal('A[hi]B');
    });

    it('isolates the partial with `without context`', function () {
      var mj = instance({
        'page.html': '{% include "p.html" without context %}',
        'p.html': '[{{ x }}]'
      });
      expect(mj.renderFile('page.html', { x: 'hi' })).to.equal('[]');
    });

    it('passes context explicitly with `with context`', function () {
      var mj = instance({
        'page.html': '{% include "p.html" with context %}',
        'p.html': '[{{ x }}]'
      });
      expect(mj.renderFile('page.html', { x: 'hi' })).to.equal('[hi]');
    });

    it('swallows a missing template with `ignore missing`', function () {
      var mj = instance({ 'page.html': 'A{% include "nope.html" ignore missing %}B' });
      expect(mj.renderFile('page.html', {})).to.equal('AB');
    });

    it('throws on a missing template without `ignore missing`', function () {
      var mj = instance({ 'page.html': 'A{% include "nope.html" %}B' });
      expect(function () { mj.renderFile('page.html', {}); }).to.throwError();
    });

  });

});
