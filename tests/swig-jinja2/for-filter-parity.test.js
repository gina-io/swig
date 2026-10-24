var jinja2 = require('@rhinostone/swig-jinja2'),
  expect = require('../lib/expect.js');


/*!
 * Loop filters ({% for x in xs if cond %}) checked against Python Jinja2
 * 3.1.6. Each expectation is the output Jinja2 gives for the same template,
 * except in the tests that say Jinja2 raises or does otherwise: there the
 * test pins what swig-jinja2 renders or throws.
 */
describe('@rhinostone/swig-jinja2 — for-loop filter parity with Jinja2', function () {

  function render(src, locals) {
    return jinja2.render(src, { locals: locals || {} });
  }

  describe('a loop filter keeps the items its test holds for', function () {
    it('keeps the items the test holds for', function () {
      expect(render('{% for x in xs if x > 1 %}{{ x }}{% endfor %}', { xs: [1, 2, 3] })).to.equal('23');
      expect(render('{% for x in xs if x is odd %}{{ x }}{% endfor %}', { xs: [1, 2, 3, 4] })).to.equal('13');
      expect(render('{% for x in xs if x|length > 1 %}[{{ x }}]{% endfor %}', { xs: ['a', 'bc', 'def'] })).to.equal('[bc][def]');
      expect(render('{% for x in xs if x in ys %}{{ x }}{% endfor %}', { xs: [1, 2, 3], ys: [2, 3] })).to.equal('23');
      expect(render('{% for x in xs if not x %}[{{ x }}]{% endfor %}', { xs: [0, 1, '', 2] })).to.equal('[0][]');
    });
    it('filters the iterable after its own filters, subscripts and parentheses', function () {
      expect(render('{% for x in xs|reverse if x > 1 %}{{ x }}{% endfor %}', { xs: [1, 2, 3] })).to.equal('32');
      expect(render('{% for x in xs|batch(2) if x|length > 1 %}{{ x|join(",") }};{% endfor %}', { xs: [1, 2, 3] })).to.equal('1,2;');
      expect(render('{% for x in [1, 2, 3][1:] if x > 2 %}{{ x }}{% endfor %}')).to.equal('3');
      expect(render('{% for x in (xs if y else ys) if x > 1 %}{{ x }}{% endfor %}', { xs: [1, 2], ys: [3], y: true })).to.equal('2');
      expect(render('{% for x in xs|default(ys if c else zs) if x > 1 %}{{ x }}{% endfor %}', { ys: [1, 2, 3], zs: [], c: true })).to.equal('23');
      expect(render('{% macro f(a) %}{{ a }}{% endmacro %}{% for x in f("ab" if c else "cd") if x != "b" %}{{ x }}{% endfor %}', { c: true })).to.equal('a');
    });
    it('binds the loop names as the body does', function () {
      expect(render('{% for x in d if x != "a" %}[{{ x }}]{% endfor %}', { d: { a: 1, b: 2, c: 3 } })).to.equal('[b][c]');
      expect(render('{% for x in s if x != "b" %}{{ x }}{% endfor %}', { s: 'abc' })).to.equal('ac');
      expect(render('{% for k, v in d|dictsort if v > 1 %}[{{ k }}={{ v }}]{% endfor %}', { d: { b: 2, a: 1, c: 3 } })).to.equal('[b=2][c=3]');
      expect(render('{% for k, v in p if k != "a" %}[{{ k }}={{ v }}]{% endfor %}', { p: [['a', 1], ['b', 2]] })).to.equal('[b=2]');
    });
    it('the loop counts only the kept items', function () {
      expect(render('{% for x in xs if x > 1 %}{{ loop.index }}/{{ loop.length }}{% if loop.first %}F{% endif %}{% if loop.last %}L{% endif %};{% endfor %}', { xs: [1, 2, 3] })).to.equal('1/2F;2/2L;');
      expect(render('{% for x in xs if x > 1 %}{{ loop.index0 }}{{ loop.revindex }}{{ loop.revindex0 }};{% endfor %}', { xs: [1, 2, 3] })).to.equal('021;110;');
    });
    it('the else branch runs when no item is kept, and only then', function () {
      expect(render('{% for x in xs if x > 5 %}{{ x }}{% else %}E{% endfor %}', { xs: [1, 2] })).to.equal('E');
      expect(render('{% for x in xs if x > 1 %}{{ x }}{% else %}E{% endfor %}', { xs: [1, 2] })).to.equal('2');
      expect(render('{% for x in xs if x %}{{ x }}{% else %}E{% endfor %}', { xs: [] })).to.equal('E');
    });
    it('the test sees the enclosing loop', function () {
      expect(render('{% for a in [1, 2] %}{% for b in [10, 20] if loop.index == 1 %}{{ b }}{% endfor %};{% endfor %}')).to.equal('1020;;');
      expect(render('{% for a in [1, 2] %}{% for b in [10, 20] if b > loop.index * 10 %}{{ b }}{% endfor %};{% endfor %}')).to.equal('20;;');
    });
    it('the test may be parenthesized, written if(, or hold an inline-if or a string "if"', function () {
      expect(render('{% for x in xs if (x > 1) %}{{ x }}{% endfor %}', { xs: [1, 2, 3] })).to.equal('23');
      expect(render('{% for x in xs if(x > 1) %}{{ x }}{% endfor %}', { xs: [1, 2, 3] })).to.equal('23');
      expect(render('{% for x in xs if(x > 1) and x < 3 %}{{ x }}{% endfor %}', { xs: [1, 2, 3] })).to.equal('2');
      expect(render('{% for x in xs if x > 1 if y else false %}{{ x }}{% endfor %}', { xs: [1, 2, 3], y: true })).to.equal('23');
      expect(render('{% for x in xs if "if" in x %}[{{ x }}]{% endfor %}', { xs: ['a', 'if', 'gift'] })).to.equal('[if][gift]');
    });
    it('restores the outer names', function () {
      expect(render('{% for x in xs if x > 1 %}{{ x }}{% endfor %}{{ x }}', { xs: [1, 2], x: 'X' })).to.equal('2X');
      expect(render('{% for x in xs if x > 5 %}{{ x }}{% else %}{{ x }}{% endfor %}', { xs: [1], x: 'X' })).to.equal('X');
    });
    it('escapes the kept values', function () {
      expect(render('{% for x in xs if x != "a" %}{{ x }}{% endfor %}', { xs: ['a', '<&'] })).to.equal('&lt;&amp;');
    });
  });

  describe('lenient where Jinja2 raises', function () {
    it('an inline-if iterable keeps compiling, where Jinja2 wants parentheses', function () {
      expect(render('{% for x in a if c else b %}{{ x }}{% endfor %}', { a: [1], b: [2], c: false })).to.equal('2');
      expect(render('{% for x in a if c else b %}{{ x }}{% endfor %}', { a: [1], b: [2], c: true })).to.equal('1');
      expect(render('{% for x in xs if c else ys if d %}{{ x }}{% endfor %}', { xs: [1], ys: [2], c: false, d: true })).to.equal('2');
    });
    it('a value that cannot be iterated runs the else branch', function () {
      expect(render('{% for x in n if x %}{{ x }}{% else %}E{% endfor %}', { n: 5 })).to.equal('E');
    });
    it('loop in the test of an outermost loop is undefined', function () {
      expect(render('{% for x in xs if loop.index > 1 %}{{ x }}{% endfor %}', { xs: [1, 2] })).to.equal('');
    });
    it('two names over a mapping test the key and the value, where Jinja2 unpacks each key', function () {
      expect(render('{% for k, v in d if v > 1 %}[{{ k }}={{ v }}]{% endfor %}', { d: { a: 1, b: 2 } })).to.equal('[b=2]');
    });
    it('a missing condition, a missing iterable, and if() fail at compile time', function () {
      expect(function () { render('{% for x in xs if %}{{ x }}{% endfor %}', { xs: [1] }); }).to.throwError(/Expected a condition after "if" in "for" tag/);
      expect(function () { render('{% for x in if x %}{{ x }}{% endfor %}'); }).to.throwError(/Expected iterable after "in" in "for" tag/);
      expect(function () { render('{% for x in xs if() %}{{ x }}{% endfor %}', { xs: [1] }); }).to.throwError(/Unexpected token "\)"/);
    });
  });
});
