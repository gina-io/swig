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

  describe('{% macro %}', function () {

    it('defines and calls a no-argument macro', function () {
      expect(render('{% macro hi() %}hello{% endmacro %}{{ hi() }}')).to.equal('hello');
    });

    it('defines and calls a macro with positional parameters', function () {
      expect(render('{% macro greet(name) %}Hi {{ name }}{% endmacro %}{{ greet("Ada") }}')).to.equal('Hi Ada');
    });

    it('applies a parameter default when the argument is omitted', function () {
      var tpl = '{% macro greet(name, punct="!") %}Hi {{ name }}{{ punct }}{% endmacro %}';
      expect(render(tpl + '{{ greet("Ada") }}')).to.equal('Hi Ada!');
    });

    it('lets an explicit argument override a parameter default', function () {
      var tpl = '{% macro greet(name, punct="!") %}Hi {{ name }}{{ punct }}{% endmacro %}';
      expect(render(tpl + '{{ greet("Ada", "?") }}')).to.equal('Hi Ada?');
    });

    it('preserves an explicit falsy argument over the default', function () {
      var tpl = '{% macro tag(n, show=true) %}{% if show %}{{ n }}{% endif %}{% endmacro %}';
      expect(render(tpl + '{{ tag("x", false) }}')).to.equal('');
      expect(render(tpl + '{{ tag("x") }}')).to.equal('x');
    });

    it('allows a default that references an earlier parameter', function () {
      var tpl = '{% macro pair(a, b=a) %}{{ a }}-{{ b }}{% endmacro %}';
      expect(render(tpl + '{{ pair(5) }}')).to.equal('5-5');
      expect(render(tpl + '{{ pair(5, 9) }}')).to.equal('5-9');
    });

    it('allows a default that is a full expression', function () {
      var tpl = '{% macro box(w, area=w * w) %}{{ area }}{% endmacro %}';
      expect(render(tpl + '{{ box(4) }}')).to.equal('16');
    });

    it('rejects a dangerous macro name', function () {
      expect(function () { render('{% macro __proto__() %}x{% endmacro %}'); }).to.throwError(/CVE-2023-25345/);
    });

    it('rejects a dangerous parameter name', function () {
      expect(function () { render('{% macro f(constructor) %}x{% endmacro %}'); }).to.throwError(/CVE-2023-25345/);
    });

    it('rejects a dotted macro name', function () {
      expect(function () { render('{% macro a.b() %}x{% endmacro %}'); }).to.throwError(/must be a bare identifier/);
    });

  });

  describe('{% import %}', function () {

    function instance(templates) {
      return new jinja2.Jinja2({ loader: jinja2.loaders.memory(templates) });
    }

    it('imports a file\'s macros into a namespace and calls one', function () {
      var mj = instance({
        'forms.html': '{% macro label(name) %}[{{ name }}]{% endmacro %}',
        'page.html': '{% import "forms.html" as f %}{{ f.label("email") }}'
      });
      expect(mj.renderFile('page.html', {})).to.equal('[email]');
    });

    it('resolves a sibling-macro reference inside the imported file', function () {
      var mj = instance({
        'forms.html': '{% macro a() %}A{% endmacro %}{% macro b() %}[{{ a() }}]{% endmacro %}',
        'page.html': '{% import "forms.html" as f %}{{ f.b() }}'
      });
      expect(mj.renderFile('page.html', {})).to.equal('[A]');
    });

    it('re-homes a nested import under the alias without leaking it bare', function () {
      // sub imports base and defines greet() calling base.hi(). The nested
      // import is carried through and re-homed under `sub`; the inner alias
      // `base` must not leak bare into the caller scope.
      var mj = instance({
        'base.html': '{% macro hi() %}HELLO{% endmacro %}',
        'sub.html': '{% import "base.html" as base %}{% macro greet() %}[{{ base.hi() }}]{% endmacro %}',
        'page.html': '{% import "sub.html" as sub %}{{ sub.greet() }}|{{ base }}'
      });
      expect(mj.renderFile('page.html', {})).to.equal('[HELLO]|');
    });

    it('re-homes nested imports across depth without leaking any inner alias', function () {
      var mj = instance({
        'gb.html': '{% macro g() %}GRAND{% endmacro %}',
        'b.html': '{% import "gb.html" as gb %}{% macro hi() %}{{ gb.g() }}{% endmacro %}',
        's.html': '{% import "b.html" as base %}{% macro greet() %}[{{ base.hi() }}]{% endmacro %}',
        'page.html': '{% import "s.html" as sub %}{{ sub.greet() }}|{{ base }}|{{ gb }}'
      });
      expect(mj.renderFile('page.html', {})).to.equal('[GRAND]||');
    });

    it('rejects a dynamic import path', function () {
      expect(function () {
        render('{% import dyn as f %}', { dyn: 'forms.html' });
      }).to.throwError(/Dynamic "import" is not supported/);
    });

    it('rejects a dangerous import alias', function () {
      var mj = instance({
        'forms.html': '{% macro a() %}A{% endmacro %}',
        'page.html': '{% import "forms.html" as __proto__ %}'
      });
      expect(function () { mj.renderFile('page.html', {}); }).to.throwError(/CVE-2023-25345/);
    });

    it('rejects a dotted import alias', function () {
      var mj = instance({
        'forms.html': '{% macro a() %}A{% endmacro %}',
        'page.html': '{% import "forms.html" as a.b %}'
      });
      expect(function () { mj.renderFile('page.html', {}); }).to.throwError(/must be a bare identifier/);
    });

  });

  describe('{% from import %}', function () {

    function instance(templates) {
      return new jinja2.Jinja2({ loader: jinja2.loaders.memory(templates) });
    }

    it('imports a single macro by bare name', function () {
      var mj = instance({
        'forms.html': '{% macro label(name) %}[{{ name }}]{% endmacro %}',
        'page.html': '{% from "forms.html" import label %}{{ label("x") }}'
      });
      expect(mj.renderFile('page.html', {})).to.equal('[x]');
    });

    it('imports multiple macros, with and without aliases', function () {
      var mj = instance({
        'forms.html': '{% macro a() %}A{% endmacro %}{% macro b() %}B{% endmacro %}',
        'page.html': '{% from "forms.html" import a as x, b %}{{ x() }}{{ b() }}'
      });
      expect(mj.renderFile('page.html', {})).to.equal('AB');
    });

    it('does not surface unimported macros', function () {
      var mj = instance({
        'forms.html': '{% macro a() %}A{% endmacro %}{% macro b() %}B{% endmacro %}',
        'page.html': '{% from "forms.html" import a %}{{ a() }}|{{ b }}'
      });
      expect(mj.renderFile('page.html', {})).to.equal('A|');
    });

    it('re-homes a nested from-import under a private slot (no bare leak)', function () {
      var mj = instance({
        'base.html': '{% macro hi() %}HELLO{% endmacro %}',
        'sub.html': '{% from "base.html" import hi %}{% macro greet() %}[{{ hi() }}]{% endmacro %}',
        'page.html': '{% from "sub.html" import greet %}{{ greet() }}|{{ hi }}'
      });
      expect(mj.renderFile('page.html', {})).to.equal('[HELLO]|');
    });

    it('throws when a requested macro is not found', function () {
      var mj = instance({
        'forms.html': '{% macro a() %}A{% endmacro %}',
        'page.html': '{% from "forms.html" import zzz %}'
      });
      expect(function () { mj.renderFile('page.html', {}); }).to.throwError(/Macro "zzz" not found/);
    });

    it('rejects a dynamic from path', function () {
      expect(function () {
        render('{% from dyn import a %}', { dyn: 'forms.html' });
      }).to.throwError(/Dynamic "from" is not supported/);
    });

    it('rejects a dangerous import alias', function () {
      var mj = instance({
        'forms.html': '{% macro a() %}A{% endmacro %}',
        'page.html': '{% from "forms.html" import a as __proto__ %}'
      });
      expect(function () { mj.renderFile('page.html', {}); }).to.throwError(/CVE-2023-25345/);
    });

  });

  describe('{% raw %}', function () {

    it('emits variable and tag syntax verbatim', function () {
      expect(render('{% raw %}{{ x }} and {% if y %}{% endraw %}', { x: 'V' })).to.equal('{{ x }} and {% if y %}');
    });

    it('preserves comment syntax verbatim', function () {
      expect(render('{% raw %}{# note #}{% endraw %}')).to.equal('{# note #}');
    });

    it('renders surrounding content normally', function () {
      expect(render('a{% raw %}{{ b }}{% endraw %}c', { b: 'B' })).to.equal('a{{ b }}c');
      expect(render('{% raw %}{{ a }}{% endraw %}-{{ a }}', { a: 'Z' })).to.equal('{{ a }}-Z');
    });

    it('rejects tokens after the raw keyword', function () {
      expect(function () { render('{% raw extra %}x{% endraw %}'); }).to.throwError(/Unexpected token "extra" after "raw"/);
    });

  });

  describe('{% filter %}', function () {

    it('pipes the body through a single filter', function () {
      expect(render('{% filter upper %}hello{% endfilter %}')).to.equal('HELLO');
    });

    it('pipes the body through a left-to-right filter chain', function () {
      expect(render('{% filter lower|upper %}MixEd{% endfilter %}')).to.equal('MIXED');
    });

    it('filters interpolated body content', function () {
      expect(render('{% filter upper %}hi {{ n }}{% endfilter %}', { n: 'bob' })).to.equal('HI BOB');
    });

    it('passes arguments to a filter', function () {
      var mj = new jinja2.Jinja2();
      mj.setFilter('repeat', function (input, n) {
        var s = '';
        for (var i = 0; i < n; i += 1) { s += input; }
        return s;
      });
      expect(mj.render('{% filter repeat(3) %}ab{% endfilter %}')).to.equal('ababab');
      expect(mj.render('{% filter repeat(2)|upper %}xy{% endfilter %}')).to.equal('XYXY');
    });

    it('requires a filter name', function () {
      expect(function () { render('{% filter %}x{% endfilter %}'); }).to.throwError(/Expected filter name/);
    });

    it('rejects a dangerous filter name', function () {
      expect(function () { render('{% filter __proto__ %}x{% endfilter %}'); }).to.throwError(/CVE-2023-25345/);
    });

  });

});
