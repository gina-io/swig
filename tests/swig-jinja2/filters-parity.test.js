var jinja2 = require('@rhinostone/swig-jinja2'),
  filters = require('@rhinostone/swig-jinja2/lib/filters'),
  expect = require('../lib/expect.js');


/*!
 * Filter outputs checked against Python Jinja2 3.1.6. Each expectation is
 * the result Jinja2 gives for the same call or template, except in the
 * tests that say Jinja2 raises: there the test pins the value swig-jinja2
 * returns instead of throwing.
 */
describe('@rhinostone/swig-jinja2 — filter parity with Jinja2', function () {

  function render(src, locals) {
    return jinja2.render(src, { locals: locals || {} });
  }

  describe('a mapping passed to a sequence filter gives its keys', function () {
    it('first and last give the first and last key', function () {
      expect(filters.first({ a: 1, b: 2 })).to.equal('a');
      expect(filters.last({ a: 1, b: 2 })).to.equal('b');
      expect(filters.first({})).to.be(undefined);
      expect(filters.last({})).to.be(undefined);
    });
    it('reverse gives the keys in reverse order', function () {
      expect(filters.reverse({ a: 1, b: 2 })).to.eql(['b', 'a']);
      expect(filters.reverse({})).to.eql([]);
    });
    it('unique gives the unique keys, case-insensitive by default', function () {
      expect(filters.unique({ a: 1, b: 1 })).to.eql(['a', 'b']);
      expect(filters.unique({ A: 1, a: 2 })).to.eql(['A']);
      expect(filters.unique({ A: 1, a: 2 }, true)).to.eql(['A', 'a']);
      expect(filters.unique({})).to.eql([]);
    });
    it('min and max compare the keys', function () {
      expect(filters.min({ a: 3, b: 7, c: 5 })).to.equal('a');
      expect(filters.max({ a: 3, b: 7, c: 5 })).to.equal('c');
      expect(filters.min({ B: 1, a: 2 })).to.equal('a');
      expect(filters.min({ B: 1, a: 2 }, true)).to.equal('B');
      expect(filters.max({ B: 1, a: 2 })).to.equal('B');
      expect(filters.min({})).to.be(undefined);
    });
    it('slice distributes the keys', function () {
      expect(filters.slice({ a: 1, b: 2, c: 3 }, 2)).to.eql([['a', 'b'], ['c']]);
      expect(filters.slice({ a: 1, b: 2, c: 3 }, 2, 'x')).to.eql([['a', 'b'], ['c', 'x']]);
    });
    it('sum and random keep their results where Jinja2 raises', function () {
      expect(filters.sum({ a: 1, b: 2 })).to.equal(3);
      expect(filters.random({ a: 1 })).to.eql({ a: 1 });
    });
    it('renders the keys in template order', function () {
      expect(render('{{ m|first }},{{ m|last }},{{ m|min }},{{ m|max }}|{{ m|reverse|join("-") }}|{{ m|unique|join("-") }}', { m: { b: 1, a: 2, c: 3 } })).to.equal('b,c,a,c|c-a-b|b-a-c');
      expect(render('{% for col in m|slice(2) %}[{{ col|join }}]{% endfor %}', { m: { b: 1, a: 2, c: 3 } })).to.equal('[ba][c]');
    });
  });

  describe('batch', function () {
    it('a size that no row length can equal gives a single row', function () {
      expect(filters.batch([1, 2, 3], 'x')).to.eql([[1, 2, 3]]);
      expect(filters.batch([1, 2, 3], -1)).to.eql([[1, 2, 3]]);
      expect(filters.batch([1, 2, 3], 2.5)).to.eql([[1, 2, 3]]);
      expect(filters.batch([1, 2, 3], '2')).to.eql([[1, 2, 3]]);
    });
    it('a size of 0 gives an empty first row', function () {
      expect(filters.batch([1, 2, 3], 0)).to.eql([[], [1, 2, 3]]);
      expect(filters.batch([], 0)).to.eql([]);
      expect(filters.batch('ab', 0)).to.eql([[], ['a', 'b']]);
    });
    it('a mapping batches its keys', function () {
      expect(filters.batch({ a: 1, b: 2, c: 3 }, 2)).to.eql([['a', 'b'], ['c']]);
      expect(filters.batch({ a: 1, b: 2, c: 3 }, 2, 'x')).to.eql([['a', 'b'], ['c', 'x']]);
    });
    it('a string batches its characters', function () {
      expect(filters.batch('abcde', 2)).to.eql([['a', 'b'], ['c', 'd'], ['e']]);
      expect(filters.batch('abcde', 2, 'x')).to.eql([['a', 'b'], ['c', 'd'], ['e', 'x']]);
      expect(filters.batch('', 2)).to.eql([]);
      expect(filters.batch('\uD83D\uDE00a', 1)).to.eql([['\uD83D\uDE00'], ['a']]);
    });
    it('pads only up to a finite numeric size, where Jinja2 raises', function () {
      expect(filters.batch([1, 2, 3], Infinity, 'x')).to.eql([[1, 2, 3]]);
      expect(filters.batch([1], '5', 'x')).to.eql([[1]]);
    });
    it('renders rows of characters and keys', function () {
      expect(render('{% for r in "abcde"|batch(2) %}[{{ r|join }}]{% endfor %}')).to.equal('[ab][cd][e]');
      expect(render('{% for r in m|batch(2, "x") %}[{{ r|join }}]{% endfor %}', { m: { a: 1, b: 2, c: 3 } })).to.equal('[ab][cx]');
    });
  });

  describe('sort', function () {
    it('a string gives its characters as a sorted list', function () {
      expect(filters.sort('cba')).to.eql(['a', 'b', 'c']);
      expect(filters.sort('cba', true)).to.eql(['c', 'b', 'a']);
      expect(filters.sort('bAc')).to.eql(['A', 'b', 'c']);
      expect(render('{{ "cba"|sort|join("-") }}')).to.equal('a-b-c');
    });
  });

  describe('replace', function () {
    it('a number input is converted to a string', function () {
      expect(filters.replace(5, '5', 'X')).to.equal('X');
      expect(filters.replace(1.5, '.', 'X')).to.equal('1X5');
      expect(render('{{ n|replace("5", "X") }}', { n: 5 })).to.equal('X');
    });
    it('an empty search string inserts the replacement before each character and at the end', function () {
      expect(filters.replace('abc', '', 'X')).to.equal('XaXbXcX');
      expect(filters.replace('abc', '', 'X', 0)).to.equal('abc');
      expect(filters.replace('abc', '', 'X', 2)).to.equal('XaXbc');
      expect(filters.replace('', '', 'X')).to.equal('X');
      expect(filters.replace('\uD83D\uDE00', '', '|')).to.equal('|\uD83D\uDE00|');
    });
    it('a negative count replaces every occurrence', function () {
      expect(filters.replace('aaa', 'a', 'b', -1)).to.equal('bbb');
      expect(filters.replace('aaa', 'a', '', -2)).to.equal('');
      expect(filters.replace('abc', '', 'X', -1)).to.equal('XaXbXcX');
      expect(filters.replace(5, '5', 'X', -1)).to.equal('X');
      expect(render('{{ "aaa"|replace("a", "b", -1) }}')).to.equal('bbb');
    });
  });

  describe('format', function () {
    it('%e and %E print at least two exponent digits', function () {
      expect(filters.format('%e|%E|%.2e', 12345.678, 0, 1.5)).to.equal('1.234568e+04|0.000000E+00|1.50e+00');
      expect(filters.format('%e', 1e-07)).to.equal('1.000000e-07');
      expect(filters.format('%e', 1e+100)).to.equal('1.000000e+100');
      expect(filters.format('%.3E', -0.000123)).to.equal('-1.230E-04');
    });
    it('%g and %G choose the notation as Python does', function () {
      expect(filters.format('%g', 1234567)).to.equal('1.23457e+06');
      expect(filters.format('%g', 1e-05)).to.equal('1e-05');
      expect(filters.format('%G', 1e-05)).to.equal('1E-05');
      expect(filters.format('%g', 100000)).to.equal('100000');
      expect(filters.format('%g', 123456)).to.equal('123456');
      expect(filters.format('%g', 0.0001)).to.equal('0.0001');
      expect(filters.format('%g', 1.5)).to.equal('1.5');
      expect(filters.format('%g', 0)).to.equal('0');
      expect(filters.format('%g', -1234567)).to.equal('-1.23457e+06');
      expect(filters.format('%g', 999999.5)).to.equal('1e+06');
    });
    it('a precision sets the significant digits of %g', function () {
      expect(filters.format('%.3g', 1234567)).to.equal('1.23e+06');
      expect(filters.format('%.0g', 123)).to.equal('1e+02');
      expect(filters.format('%.2g', 0.000123456)).to.equal('0.00012');
      expect(filters.format('%10.3g|', 1234567)).to.equal('  1.23e+06|');
      expect(filters.format('%+g', 1.5)).to.equal('+1.5');
      expect(filters.format('%-8g|', 0.5)).to.equal('0.5     |');
      expect(render('{{ "%g|%e"|format(x, x) }}', { x: 1234567 })).to.equal('1.23457e+06|1.234567e+06');
    });
    it('a precision above 100 digits does not throw', function () {
      expect(filters.format('%.200g', 1.5)).to.equal('1.5');
      expect(filters.format('%.120g', 0.1)).to.equal('0.1000000000000000055511151231257827021181583404541015625');
      expect(filters.format('%.150g', 1e-05)).to.equal('1.0000000000000000818030539140313095458623138256371021270751953125e-05');
    });
  });
});
