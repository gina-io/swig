var django = require('@rhinostone/swig-django'),
  expect = require('../lib/expect.js');


/*!
 * Expression and tag edge cases of the Django frontend: list and object
 * literals, subscripts and slices, filter arguments, and the error each
 * malformed form raises. Django itself has no list literals, subscripts or
 * method calls; swig-django accepts them as a superset.
 */
describe('@rhinostone/swig-django — parser edge cases', function () {

  function render(src, locals) {
    return django.render(src, { locals: locals || {} });
  }

  function renderer(src) {
    return function () { render(src); };
  }

  describe('list and object literals', function () {
    it('an empty list has length 0', function () {
      expect(render('{{ []|length }}')).to.equal('0');
    });
    it('a list literal feeds a filter', function () {
      expect(render('{{ [1, 2, 3]|join:"-" }}')).to.equal('1-2-3');
    });
    it('a list literal needs commas between items', function () {
      expect(renderer('{{ [1 2] }}')).to.throwException(/Expected comma or closing delimiter/);
    });
    it('object literals take string, name and number keys', function () {
      expect(render('{{ {} }}')).to.equal('[object Object]');
      expect(render('{{ {"a": 1, b: 2, 3: 4}["a"] }}')).to.equal('1');
      expect(render('{{ {"k": "v"}.k }}')).to.equal('v');
    });
    it('a malformed object literal names the problem', function () {
      expect(renderer('{{ { }}')).to.throwException(/Unclosed object literal/);
      expect(renderer('{{ {a: 1 }}')).to.throwException(/Unclosed object literal/);
      expect(renderer('{{ {a.b: 1} }}')).to.throwException(/Unexpected dot/);
      expect(renderer('{{ {True: 1} }}')).to.throwException(/Unexpected object key/);
      expect(renderer('{{ {a 1} }}')).to.throwException(/Expected colon in object literal/);
      expect(renderer('{{ {a: 1 b: 2} }}')).to.throwException(/Expected comma or closing curly brace/);
    });
  });

  describe('subscripts and slices', function () {
    var a = [0, 1, 2, 3, 4];

    it('a numeric subscript', function () {
      expect(render('{{ a[0] }}', { a: ['Z0'] })).to.equal('Z0');
    });
    it('a subscript needs its closing bracket', function () {
      expect(renderer('{{ a[0 }}')).to.throwException(/Expected closing square bracket/);
    });
    it('slices with a start, a stop, both, or a step', function () {
      expect(render('{{ a[1:]|join:"," }}', { a: a })).to.equal('1,2,3,4');
      expect(render('{{ a[:2]|join:"," }}', { a: a })).to.equal('0,1');
      expect(render('{{ a[0:2]|join:"," }}', { a: a })).to.equal('0,1');
      expect(render('{{ a[::2]|join:"," }}', { a: a })).to.equal('0,2,4');
      expect(render('{{ a[1::]|join:"," }}', { a: a })).to.equal('1,2,3,4');
    });
  });

  describe('filter arguments', function () {
    var swig = new django.Django();
    swig.setFilter('probe', function (input, arg) {
      return arg === null ? 'NULL' : typeof arg + ':' + arg;
    });

    it('True and None arrive as a boolean and null', function () {
      expect(swig.render('{{ 1|probe:True }}')).to.equal('boolean:true');
      expect(swig.render('{{ 1|probe:None }}')).to.equal('NULL');
    });
    it('a sign before True or None is refused', function () {
      expect(function () { swig.render('{{ 1|probe:-True }}'); }).to.throwException(/Unexpected "-" before boolean filter argument/);
      expect(function () { swig.render('{{ 1|probe:-None }}'); }).to.throwException(/Unexpected "-" before None filter argument/);
    });
    it('an argument that is not a value is refused', function () {
      expect(renderer('{{ x|default:( }}')).to.throwException(/Unexpected filter argument "\("/);
    });
  });

  describe('other expression forms', function () {
    it('a dot after a parenthesised expression or a literal', function () {
      expect(render('{{ (a).b }}|{{ "abc".length }}', { a: { b: 'VR' } })).to.equal('VR|3');
    });
    it('a method call', function () {
      expect(render('{{ a.b() }}', { a: { b: function () { return 'CALLED'; } } })).to.equal('CALLED');
    });
    it('not and unary minus', function () {
      expect(render('{% if not x %}Y{% else %}N{% endif %}', { x: false })).to.equal('Y');
      expect(render('{{ -x }}', { x: 5 })).to.equal('-5');
    });
    it('a reserved word cannot be a variable', function () {
      expect(renderer('{{ new }}')).to.throwException(/Reserved keyword "new" attempted to be used as a variable/);
    });
    it('an operator alone, or two names in a row, is an unexpected token', function () {
      expect(renderer('{{ * }}')).to.throwException(/Unexpected token "\*"/);
      expect(renderer('{{ a b }}')).to.throwException(/Unexpected token "b"/);
    });
  });

  describe('options', function () {
    it('autoescape "js" escapes output with \\u escapes', function () {
      expect(django.render('{{ x }}', { autoescape: 'js', locals: { x: '<a>' } })).to.equal('\\u003Ca\\u003E');
    });
  });

  describe('tags', function () {
    it('a custom tag whose parse returns false is an unexpected tag', function () {
      var swig = new django.Django();
      swig.setTag('nope', function () { return false; }, function () {});
      expect(function () { swig.render('{% nope %}'); }).to.throwException(/Unexpected tag "nope" on line 1/);
    });
    it('a malformed tag names the problem', function () {
      expect(renderer('{% autoescape on extra %}{% endautoescape %}')).to.throwException(/Unexpected token "extra" in "autoescape" tag/);
      expect(renderer('{% block %}{% endblock %}')).to.throwException(/Expected block name in "block" tag/);
      expect(renderer('{% extends "base.html" extra %}')).to.throwException(/Unexpected token "extra" after parent path in "extends" tag/);
      expect(renderer('{% for %}{% endfor %}')).to.throwException(/Expected loop variable in "for" tag/);
      expect(renderer('{% if %}{% endif %}')).to.throwException(/Expected conditional expression in "if" tag/);
      expect(renderer('{% if x %}{% elif %}{% endif %}')).to.throwException(/Expected conditional expression in "elif" tag/);
    });
    it('elif and else outside an if are refused', function () {
      expect(renderer('{% elif x %}')).to.throwException(/"elif" is only valid inside an "if" tag/);
      expect(renderer('{% else %}')).to.throwException(/"else" is only valid inside an "if" tag/);
    });
    it('the elif, else and empty markers refuse to compile on their own', function () {
      expect(function () { django.tags.elif.compile(); }).to.throwException(/"elif" used outside an "if" tag/);
      expect(function () { django.tags['else'].compile(); }).to.throwException(/"else" used outside an "if" tag/);
      expect(function () { django.tags.empty.compile(); }).to.throwException(/"empty" used outside a "for" tag/);
    });
    it('with and include assignments need a bare name and an "="', function () {
      expect(renderer('{% include "p.html" with a.b=1 %}')).to.throwException(/"with" assignment target "a\.b" must be a bare identifier in "include" tag/);
      expect(renderer('{% with a.b=1 %}{% endwith %}')).to.throwException(/"with" assignment target "a\.b" must be a bare identifier/);
      expect(renderer('{% with 1=2 %}{% endwith %}')).to.throwException(/Expected an assignment name in "with" tag/);
      expect(renderer('{% with a %}{% endwith %}')).to.throwException(/Expected "=" after "a" in "with" tag/);
    });
    it('for over a dotted path that is not keys, values or items iterates the path', function () {
      expect(render('{% for x in a.b %}{{ x }}{% endfor %}', { a: { b: [1, 2] } })).to.equal('12');
    });
  });
});
