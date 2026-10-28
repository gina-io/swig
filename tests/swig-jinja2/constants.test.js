var jinja2 = require('@rhinostone/swig-jinja2'),
  expect = require('../lib/expect.js');


/*!
 * true, false and none (each also capitalised) are constants, as in Jinja2:
 * comparisons with none read like `is none`, `is true` and `is false` are
 * tests, batch and slice do not pad with none, and no tag binds one of the six
 * names. Expectations are Jinja2 3.1's output, except where Jinja2 prints
 * None, which swig renders as "": there none renders as a variable holding
 * None does. Left out: == none and is none on an undefined variable (true in
 * swig), default on None or "", and == False (JavaScript equality).
 */
describe('@rhinostone/swig-jinja2 — true, false and none', function () {

  function render(src, locals) {
    return jinja2.render(src, { locals: locals || {} });
  }

  function renderFiles(files, src, locals) {
    var map = {}, k;
    for (k in files) {
      if (files.hasOwnProperty(k)) {
        map['/' + k] = files[k];
      }
    }
    return new jinja2.Jinja2({ loader: jinja2.loaders.memory(map, '/'), cache: false })
      .render(src, { filename: '/t.html', locals: locals || {} });
  }

  describe('none and None', function () {
    it('== none and != none read like is none', function () {
      expect(render('{% if x == none %}Y{% else %}N{% endif %}', { x: null })).to.equal('Y');
      expect(render('{% if x == none %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('N');
      expect(render('{% if x == none %}Y{% else %}N{% endif %}', { x: '' })).to.equal('N');
      expect(render('{% if x == none %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('N');
      expect(render('{% if x == none %}Y{% else %}N{% endif %}', { x: true })).to.equal('N');
      expect(render('{% if x == none %}Y{% else %}N{% endif %}', { x: false })).to.equal('N');
      expect(render('{% if x == None %}Y{% else %}N{% endif %}', { x: null })).to.equal('Y');
      expect(render('{% if x == None %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('N');
      expect(render('{% if x == None %}Y{% else %}N{% endif %}', { x: '' })).to.equal('N');
      expect(render('{% if x == None %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('N');
      expect(render('{% if x == None %}Y{% else %}N{% endif %}', { x: true })).to.equal('N');
      expect(render('{% if x == None %}Y{% else %}N{% endif %}', { x: false })).to.equal('N');
      expect(render('{% if x != none %}Y{% else %}N{% endif %}', { x: null })).to.equal('N');
      expect(render('{% if x != none %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('Y');
      expect(render('{% if x != none %}Y{% else %}N{% endif %}', { x: '' })).to.equal('Y');
      expect(render('{% if x != none %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('Y');
      expect(render('{% if x != none %}Y{% else %}N{% endif %}', { x: true })).to.equal('Y');
      expect(render('{% if x != none %}Y{% else %}N{% endif %}', { x: false })).to.equal('Y');
      expect(render('{% if x != None %}Y{% else %}N{% endif %}', { x: null })).to.equal('N');
      expect(render('{% if x != None %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('Y');
      expect(render('{% if x != None %}Y{% else %}N{% endif %}', { x: '' })).to.equal('Y');
      expect(render('{% if x != None %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('Y');
      expect(render('{% if x != None %}Y{% else %}N{% endif %}', { x: true })).to.equal('Y');
      expect(render('{% if x != None %}Y{% else %}N{% endif %}', { x: false })).to.equal('Y');
      expect(render('{% if none == x %}Y{% else %}N{% endif %}', { x: null })).to.equal('Y');
      expect(render('{% if none == x %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('N');
      expect(render('{% if none == x %}Y{% else %}N{% endif %}', { x: '' })).to.equal('N');
      expect(render('{% if none == x %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('N');
      expect(render('{% if none == x %}Y{% else %}N{% endif %}', { x: true })).to.equal('N');
      expect(render('{% if none == x %}Y{% else %}N{% endif %}', { x: false })).to.equal('N');
      expect(render('{% if None != x %}Y{% else %}N{% endif %}', { x: null })).to.equal('N');
      expect(render('{% if None != x %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('Y');
      expect(render('{% if None != x %}Y{% else %}N{% endif %}', { x: '' })).to.equal('Y');
      expect(render('{% if None != x %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('Y');
      expect(render('{% if None != x %}Y{% else %}N{% endif %}', { x: true })).to.equal('Y');
      expect(render('{% if None != x %}Y{% else %}N{% endif %}', { x: false })).to.equal('Y');
    });
    it('is sameas none reads like is none', function () {
      expect(render('{% if x is sameas none %}Y{% else %}N{% endif %}', { x: null })).to.equal('Y');
      expect(render('{% if x is sameas none %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('N');
      expect(render('{% if x is sameas none %}Y{% else %}N{% endif %}', { x: '' })).to.equal('N');
      expect(render('{% if x is sameas none %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('N');
      expect(render('{% if x is sameas none %}Y{% else %}N{% endif %}', { x: true })).to.equal('N');
      expect(render('{% if x is sameas none %}Y{% else %}N{% endif %}', { x: false })).to.equal('N');
      expect(render('{% if x is sameas(None) %}Y{% else %}N{% endif %}', { x: null })).to.equal('Y');
      expect(render('{% if x is sameas(None) %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('N');
      expect(render('{% if x is sameas(None) %}Y{% else %}N{% endif %}', { x: '' })).to.equal('N');
      expect(render('{% if x is sameas(None) %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('N');
      expect(render('{% if x is sameas(None) %}Y{% else %}N{% endif %}', { x: true })).to.equal('N');
      expect(render('{% if x is sameas(None) %}Y{% else %}N{% endif %}', { x: false })).to.equal('N');
      expect(render('{% if x is not sameas none %}Y{% else %}N{% endif %}', { x: null })).to.equal('N');
      expect(render('{% if x is not sameas none %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('Y');
      expect(render('{% if x is not sameas none %}Y{% else %}N{% endif %}', { x: '' })).to.equal('Y');
      expect(render('{% if x is not sameas none %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('Y');
      expect(render('{% if x is not sameas none %}Y{% else %}N{% endif %}', { x: true })).to.equal('Y');
      expect(render('{% if x is not sameas none %}Y{% else %}N{% endif %}', { x: false })).to.equal('Y');
      expect(render('{% if none is sameas x %}Y{% else %}N{% endif %}', { x: null })).to.equal('Y');
      expect(render('{% if none is sameas x %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('N');
      expect(render('{% if none is sameas x %}Y{% else %}N{% endif %}', { x: '' })).to.equal('N');
      expect(render('{% if none is sameas x %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('N');
      expect(render('{% if none is sameas x %}Y{% else %}N{% endif %}', { x: true })).to.equal('N');
      expect(render('{% if none is sameas x %}Y{% else %}N{% endif %}', { x: false })).to.equal('N');
    });
    it('a constant, not a variable', function () {
      expect(render('{% set f = None %}{% if f is none %}Y{% else %}N{% endif %}', {})).to.equal('Y');
      expect(render('{% set n = none %}{% if n == none %}Y{% else %}N{% endif %}', {})).to.equal('Y');
      expect(render('{% set n = 0 %}{% if n == none %}Y{% else %}N{% endif %}', {})).to.equal('N');
      expect(render('{% if none %}Y{% else %}N{% endif %}', {})).to.equal('N');
      expect(render('{% if not none %}Y{% else %}N{% endif %}', {})).to.equal('Y');
      expect(render('[{{ none or "d" }}]', {})).to.equal('[d]');
      expect(render('{% if None is none %}Y{% else %}N{% endif %}', {})).to.equal('Y');
      expect(render('{% if none is defined %}Y{% else %}N{% endif %}', {})).to.equal('Y');
      expect(render('{% if none is undefined %}Y{% else %}N{% endif %}', {})).to.equal('N');
      expect(render('{% if none in [none] %}Y{% else %}N{% endif %}', {})).to.equal('Y');
      expect(render('{% macro m(a) %}{% if a is none %}Y{% else %}N{% endif %}{% endmacro %}{{ m(none) }}', {})).to.equal('Y');
      expect(render('{% if x|default(none) is none %}Y{% else %}N{% endif %}', {})).to.equal('Y');
      expect(render('{% if x|default(none) is none %}Y{% else %}N{% endif %}', { x: null })).to.equal('Y');
      expect(render('{% if x|default(none) is none %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('N');
      expect(render('{% if x|default(none) is none %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('N');
      expect(render('{% if x|default(none) is none %}Y{% else %}N{% endif %}', { x: true })).to.equal('N');
      expect(render('{% if x|default(none) is none %}Y{% else %}N{% endif %}', { x: false })).to.equal('N');
    });
    it('batch and slice do not pad with none', function () {
      expect(render('{% for r in [1,2,3]|batch(2, none) %}({{ r|length }}){% endfor %}', {})).to.equal('(2)(1)');
      expect(render('{% for r in [1,2,3]|batch(2, None) %}({{ r|length }}){% endfor %}', {})).to.equal('(2)(1)');
      expect(render('{% for c in [1,2,3]|slice(2, none) %}({{ c|length }}){% endfor %}', {})).to.equal('(2)(1)');
      expect(render('{% for r in [1,2,3]|batch(2, 0) %}({{ r|join(",") }}){% endfor %}', {})).to.equal('(1,2)(3,0)');
      expect(render('{% for c in [1,2,3]|slice(2, 0) %}({{ c|join(",") }}){% endfor %}', {})).to.equal('(1,2)(3,0)');
    });
    it('where a variable holding None reads as "", none does too', function () {
      expect(render('[{{ none ~ "x" }}]')).to.equal(render('[{{ n ~ "x" }}]', { n: null }));
      expect(render('[{{ "a" ~ None }}]')).to.equal(render('[{{ "a" ~ n }}]', { n: null }));
      expect(render('[{{ False ~ none }}]')).to.equal(render('[{{ False ~ n }}]', { n: null }));
      expect(render('[{{ none + "a" }}]')).to.equal(render('[{{ n + "a" }}]', { n: null }));
      expect(render('[{{ "a" + none }}]')).to.equal(render('[{{ "a" + n }}]', { n: null }));
      expect(render('[{{ none|upper }}]')).to.equal(render('[{{ n|upper }}]', { n: null }));
      expect(render('[{{ None|title }}]')).to.equal(render('[{{ n|title }}]', { n: null }));
      expect(render('[{{ none|tojson }}]')).to.equal(render('[{{ n|tojson }}]', { n: null }));
      expect(render('[{{ none|wordcount }}]')).to.equal(render('[{{ n|wordcount }}]', { n: null }));
      expect(render('[{{ none|center(5) }}]')).to.equal(render('[{{ n|center(5) }}]', { n: null }));
      expect(render('[{{ none["x"] }}|{{ None[0] }}|{{ none .x }}|{{ none.x }}]')).to.equal(render('[{{ n["x"] }}|{{ n[0] }}|{{ n .x }}|{{ n.x }}]', { n: null }));
    });
  });

  describe('true, false, True and False', function () {
    it('constants, not variables', function () {
      expect(render('{% if True %}Y{% else %}N{% endif %}', {})).to.equal('Y');
      expect(render('{% if False %}Y{% else %}N{% endif %}', {})).to.equal('N');
      expect(render('{% set f = True %}{% if f %}Y{% else %}N{% endif %}', {})).to.equal('Y');
      expect(render('{% if [true, false][0] %}Y{% else %}N{% endif %}', {})).to.equal('Y');
      expect(render('{% if [True, False][1] %}Y{% else %}N{% endif %}', {})).to.equal('N');
      expect(render('{% if True == 1 %}Y{% else %}N{% endif %}', {})).to.equal('Y');
      expect(render('[{{ True + 1 }}]', {})).to.equal('[2]');
      expect(render('{% if x == True %}Y{% else %}N{% endif %}', {})).to.equal('N');
      expect(render('{% if x == True %}Y{% else %}N{% endif %}', { x: null })).to.equal('N');
      expect(render('{% if x == True %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('N');
      expect(render('{% if x == True %}Y{% else %}N{% endif %}', { x: '' })).to.equal('N');
      expect(render('{% if x == True %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('Y');
      expect(render('{% if x == True %}Y{% else %}N{% endif %}', { x: true })).to.equal('Y');
      expect(render('{% if x == True %}Y{% else %}N{% endif %}', { x: false })).to.equal('N');
      expect(render('{% if x != true %}Y{% else %}N{% endif %}', {})).to.equal('Y');
      expect(render('{% if x != true %}Y{% else %}N{% endif %}', { x: null })).to.equal('Y');
      expect(render('{% if x != true %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('Y');
      expect(render('{% if x != true %}Y{% else %}N{% endif %}', { x: '' })).to.equal('Y');
      expect(render('{% if x != true %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('N');
      expect(render('{% if x != true %}Y{% else %}N{% endif %}', { x: true })).to.equal('N');
      expect(render('{% if x != true %}Y{% else %}N{% endif %}', { x: false })).to.equal('Y');
      expect(render('{% if x is sameas True %}Y{% else %}N{% endif %}', {})).to.equal('N');
      expect(render('{% if x is sameas True %}Y{% else %}N{% endif %}', { x: null })).to.equal('N');
      expect(render('{% if x is sameas True %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('N');
      expect(render('{% if x is sameas True %}Y{% else %}N{% endif %}', { x: '' })).to.equal('N');
      expect(render('{% if x is sameas True %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('N');
      expect(render('{% if x is sameas True %}Y{% else %}N{% endif %}', { x: true })).to.equal('Y');
      expect(render('{% if x is sameas True %}Y{% else %}N{% endif %}', { x: false })).to.equal('N');
      expect(render('{% if x is sameas(true) %}Y{% else %}N{% endif %}', {})).to.equal('N');
      expect(render('{% if x is sameas(true) %}Y{% else %}N{% endif %}', { x: null })).to.equal('N');
      expect(render('{% if x is sameas(true) %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('N');
      expect(render('{% if x is sameas(true) %}Y{% else %}N{% endif %}', { x: '' })).to.equal('N');
      expect(render('{% if x is sameas(true) %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('N');
      expect(render('{% if x is sameas(true) %}Y{% else %}N{% endif %}', { x: true })).to.equal('Y');
      expect(render('{% if x is sameas(true) %}Y{% else %}N{% endif %}', { x: false })).to.equal('N');
      expect(render('{% if x is sameas False %}Y{% else %}N{% endif %}', {})).to.equal('N');
      expect(render('{% if x is sameas False %}Y{% else %}N{% endif %}', { x: null })).to.equal('N');
      expect(render('{% if x is sameas False %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('N');
      expect(render('{% if x is sameas False %}Y{% else %}N{% endif %}', { x: '' })).to.equal('N');
      expect(render('{% if x is sameas False %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('N');
      expect(render('{% if x is sameas False %}Y{% else %}N{% endif %}', { x: true })).to.equal('N');
      expect(render('{% if x is sameas False %}Y{% else %}N{% endif %}', { x: false })).to.equal('Y');
      expect(render('{% if x|default(True) %}Y{% else %}N{% endif %}', {})).to.equal('Y');
      expect(render('{% if x|default(True) %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('N');
      expect(render('{% if x|default(True) %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('Y');
      expect(render('{% if x|default(True) %}Y{% else %}N{% endif %}', { x: true })).to.equal('Y');
      expect(render('{% if x|default(True) %}Y{% else %}N{% endif %}', { x: false })).to.equal('N');
      expect(render('{% if x|default(true) %}Y{% else %}N{% endif %}', {})).to.equal('Y');
      expect(render('{% if x|default(true) %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('N');
      expect(render('{% if x|default(true) %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('Y');
      expect(render('{% if x|default(true) %}Y{% else %}N{% endif %}', { x: true })).to.equal('Y');
      expect(render('{% if x|default(true) %}Y{% else %}N{% endif %}', { x: false })).to.equal('N');
    });
    it('is true and is false', function () {
      expect(render('{% if x is true %}Y{% else %}N{% endif %}', {})).to.equal('N');
      expect(render('{% if x is true %}Y{% else %}N{% endif %}', { x: null })).to.equal('N');
      expect(render('{% if x is true %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('N');
      expect(render('{% if x is true %}Y{% else %}N{% endif %}', { x: '' })).to.equal('N');
      expect(render('{% if x is true %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('N');
      expect(render('{% if x is true %}Y{% else %}N{% endif %}', { x: true })).to.equal('Y');
      expect(render('{% if x is true %}Y{% else %}N{% endif %}', { x: false })).to.equal('N');
      expect(render('{% if x is false %}Y{% else %}N{% endif %}', {})).to.equal('N');
      expect(render('{% if x is false %}Y{% else %}N{% endif %}', { x: null })).to.equal('N');
      expect(render('{% if x is false %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('N');
      expect(render('{% if x is false %}Y{% else %}N{% endif %}', { x: '' })).to.equal('N');
      expect(render('{% if x is false %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('N');
      expect(render('{% if x is false %}Y{% else %}N{% endif %}', { x: true })).to.equal('N');
      expect(render('{% if x is false %}Y{% else %}N{% endif %}', { x: false })).to.equal('Y');
      expect(render('{% if x is not true %}Y{% else %}N{% endif %}', {})).to.equal('Y');
      expect(render('{% if x is not true %}Y{% else %}N{% endif %}', { x: null })).to.equal('Y');
      expect(render('{% if x is not true %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('Y');
      expect(render('{% if x is not true %}Y{% else %}N{% endif %}', { x: '' })).to.equal('Y');
      expect(render('{% if x is not true %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('Y');
      expect(render('{% if x is not true %}Y{% else %}N{% endif %}', { x: true })).to.equal('N');
      expect(render('{% if x is not true %}Y{% else %}N{% endif %}', { x: false })).to.equal('Y');
      expect(render('{% if x is not false %}Y{% else %}N{% endif %}', {})).to.equal('Y');
      expect(render('{% if x is not false %}Y{% else %}N{% endif %}', { x: null })).to.equal('Y');
      expect(render('{% if x is not false %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('Y');
      expect(render('{% if x is not false %}Y{% else %}N{% endif %}', { x: '' })).to.equal('Y');
      expect(render('{% if x is not false %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('Y');
      expect(render('{% if x is not false %}Y{% else %}N{% endif %}', { x: true })).to.equal('Y');
      expect(render('{% if x is not false %}Y{% else %}N{% endif %}', { x: false })).to.equal('N');
      expect(render('{% if (x is true) %}Y{% else %}N{% endif %}', {})).to.equal('N');
      expect(render('{% if (x is true) %}Y{% else %}N{% endif %}', { x: null })).to.equal('N');
      expect(render('{% if (x is true) %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('N');
      expect(render('{% if (x is true) %}Y{% else %}N{% endif %}', { x: '' })).to.equal('N');
      expect(render('{% if (x is true) %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('N');
      expect(render('{% if (x is true) %}Y{% else %}N{% endif %}', { x: true })).to.equal('Y');
      expect(render('{% if (x is true) %}Y{% else %}N{% endif %}', { x: false })).to.equal('N');
      expect(render('{% if (x is false) %}Y{% else %}N{% endif %}', {})).to.equal('N');
      expect(render('{% if (x is false) %}Y{% else %}N{% endif %}', { x: null })).to.equal('N');
      expect(render('{% if (x is false) %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('N');
      expect(render('{% if (x is false) %}Y{% else %}N{% endif %}', { x: '' })).to.equal('N');
      expect(render('{% if (x is false) %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('N');
      expect(render('{% if (x is false) %}Y{% else %}N{% endif %}', { x: true })).to.equal('N');
      expect(render('{% if (x is false) %}Y{% else %}N{% endif %}', { x: false })).to.equal('Y');
      expect(render('{% if True is true %}Y{% else %}N{% endif %}', {})).to.equal('Y');
      expect(render('{% if 1 is true %}Y{% else %}N{% endif %}', {})).to.equal('N');
      expect(render('{% if False is false %}Y{% else %}N{% endif %}', {})).to.equal('Y');
      expect(render('{% if 0 is false %}Y{% else %}N{% endif %}', {})).to.equal('N');
    });
  });

  describe('no tag assigns to a constant, as in Jinja2', function () {
    it('set', function () {
      expect(function () { render('{% set none = 5 %}'); }).to.throwError(/Cannot assign to the constant/);
      expect(function () { render('{% set None = 5 %}'); }).to.throwError(/Cannot assign to the constant/);
      expect(function () { render('{% set True = 5 %}'); }).to.throwError(/Cannot assign to the constant/);
      expect(function () { render('{% set False %}x{% endset %}'); }).to.throwError(/Cannot assign to the constant/);
      expect(function () { render('{% set none.x = 1 %}'); }).to.throwError(/Cannot assign to the constant/);
      expect(function () { render('{% set true = 5 %}'); }).to.throwError(/Expected variable name/);
      expect(function () { jinja2.precompile('{% set ns.none = 1 %}'); }).to.not.throwError();
      expect(function () { jinja2.precompile('{% set nonex = 1 %}{% set Nones = 1 %}{% set none_ = 1 %}'); }).to.not.throwError();
    });
    it('for', function () {
      expect(function () { render('{% for none in [1] %}{% endfor %}'); }).to.throwError(/Cannot assign to the constant/);
      expect(function () { render('{% for k, None in [[1,2]] %}{% endfor %}'); }).to.throwError(/Cannot assign to the constant/);
      expect(function () { render('{% for true in [1] %}{% endfor %}'); }).to.throwError(/Expected loop variable/);
      expect(render('{% for k, nonex in [[1,2]] %}{{ nonex }}{% endfor %}', {})).to.equal('2');
    });
    it('macro', function () {
      expect(function () { render('{% macro m(none) %}{% endmacro %}'); }).to.throwError(/Cannot assign to the constant/);
      expect(function () { render('{% macro m(a, True=1) %}{% endmacro %}'); }).to.throwError(/Cannot assign to the constant/);
      expect(function () { render('{% macro None() %}{% endmacro %}'); }).to.throwError(/Cannot assign to the constant/);
      expect(function () { render('{% macro false(a) %}{% endmacro %}'); }).to.throwError(/Cannot assign to the constant/);
      expect(function () { render('{% macro m(true) %}{% endmacro %}'); }).to.throwError(/Cannot assign to the constant/);
      expect(render('{% macro truex(Truex) %}{{ Truex }}{% endmacro %}{{ truex(1) }}', {})).to.equal('1');
    });
    it('with', function () {
      expect(function () { render('{% with none = 1 %}{% endwith %}'); }).to.throwError(/Cannot assign to the constant/);
      expect(function () { render('{% with a = 1, False = 2 %}{% endwith %}'); }).to.throwError(/Cannot assign to the constant/);
      expect(render('{% with nonex = 1 %}{{ nonex }}{% endwith %}', {})).to.equal('1');
    });
    it('import and from', function () {
      expect(function () { render('{% import "m.html" as none %}'); }).to.throwError(/Cannot assign to the constant/);
      expect(function () { render('{% import "m.html" as True %}'); }).to.throwError(/Cannot assign to the constant/);
      expect(function () { render('{% from "m.html" import none %}'); }).to.throwError(/Cannot assign to the constant/);
      expect(function () { render('{% from "m.html" import x as None %}'); }).to.throwError(/Cannot assign to the constant/);
      expect(renderFiles({ 'm.html': '{% macro x() %}X{% endmacro %}' }, '{% from "m.html" import x as nonex %}{{ nonex() }}', {})).to.equal('X');
      expect(renderFiles({ 'm.html': '{% macro x() %}X{% endmacro %}' }, '{% import "m.html" as Truex %}{{ Truex.x() }}', {})).to.equal('X');
    });
  });
});
