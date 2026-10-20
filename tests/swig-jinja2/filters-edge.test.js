var jinja2 = require('@rhinostone/swig-jinja2'),
  filters = require('@rhinostone/swig-jinja2/lib/filters'),
  expect = require('../lib/expect.js');


/*!
 * Edge inputs of the Jinja2 filter catalog: scalars passed to sequence
 * filters, arrays passed to string filters, and the rarer format
 * conversions. Each expectation is the result Python Jinja2 3.1.6 gives for
 * the same call, except in two cases. Where Jinja2 raises on the input, the
 * test pins the value swig-jinja2 returns instead of throwing. String filters
 * map over the elements of an array, as the Jinja2 parity documentation states
 * for upper and lower. Filters are called directly when the type of the result
 * matters and rendered when only the output does.
 */
describe('@rhinostone/swig-jinja2 — filter edge inputs', function () {

  function render(src, locals) {
    return jinja2.render(src, { locals: locals || {} });
  }

  describe('arrays passed to string filters', function () {
    it('upper and lower map over each element', function () {
      expect(filters.upper(['ab', 'cd'])).to.eql(['AB', 'CD']);
      expect(filters.lower(['AB', 'CD'])).to.eql(['ab', 'cd']);
    });
    it('capitalize and striptags map over each element', function () {
      expect(filters.capitalize(['hELLO', 'wORLD'])).to.eql(['Hello', 'World']);
      expect(filters.striptags(['<b>a</b>', '<i>b</i>'])).to.eql(['a', 'b']);
    });
  });

  describe('escape("js")', function () {
    it('turns markup, punctuation and control characters into \\u escapes', function () {
      var input = '<a>&=-;' + String.fromCharCode(92, 10, 39, 34);
      expect(filters.escape(input, 'js')).to.equal('\\u003Ca\\u003E\\u0026\\u003D\\u002D\\u003B\\u005C\\u000A\\u0027\\u0022');
    });
  });

  describe('scalars passed to sequence filters', function () {
    it('first, last, join, reverse, sort and unique return a number unchanged', function () {
      expect(filters.first(5)).to.equal(5);
      expect(filters.last(5)).to.equal(5);
      expect(filters.join(5, ',')).to.equal(5);
      expect(filters.reverse(5)).to.equal(5);
      expect(filters.sort(5)).to.equal(5);
      expect(filters.unique(5)).to.equal(5);
    });
    it('min, max and random return a scalar unchanged', function () {
      expect(filters.min(5)).to.equal(5);
      expect(filters.max(true)).to.equal(true);
      expect(filters.random(5)).to.equal(5);
    });
    it('format and wordwrap return a non-string unchanged', function () {
      expect(filters.format(5, 'a')).to.equal(5);
      expect(filters.wordwrap(5)).to.equal(5);
    });
    it('dictsort and groupby return a value that is not a mapping unchanged', function () {
      var list = [3, 1, 2];
      expect(filters.dictsort(list)).to.be(list);
      expect(list).to.eql([3, 1, 2]);
      expect(filters.dictsort('abc')).to.equal('abc');
      expect(filters.groupby('abc', 'x')).to.equal('abc');
    });
    it('length of a number is an empty string', function () {
      expect(filters.length(5)).to.equal('');
    });
    it('tojson of undefined is an empty string', function () {
      expect(filters.tojson(undefined)).to.equal('');
    });
    it('batch and slice of a number are empty lists', function () {
      expect(filters.batch(5, 2)).to.eql([]);
      expect(filters.slice(5, 2)).to.eql([]);
    });
    it('slice into zero or infinitely many columns is an empty list', function () {
      expect(filters.slice([1, 2, 3], 0)).to.eql([]);
      // Without the finite-size guard, an infinite size never leaves the column loop.
      expect(filters.slice([1, 2, 3], Infinity)).to.eql([]);
    });
    it('sum of a string is the start value', function () {
      expect(filters.sum('123', '', 10)).to.equal(10);
    });
    it('trim, and replace with no match, render a number as its digits', function () {
      expect(render('{{ n|trim }}', { n: 5 })).to.equal('5');
      expect(render('{{ n|replace("z", "X") }}', { n: 5 })).to.equal('5');
    });
    it('urlencode turns a number into a string', function () {
      expect(filters.urlencode(5)).to.equal('5');
    });
    it('random of an empty list is undefined and renders nothing', function () {
      expect(filters.random([])).to.be(undefined);
      expect(render('[{{ s|random }}]', { s: [] })).to.equal('[]');
    });
  });

  describe('strings passed to sequence filters', function () {
    it('unique, min and random take the characters', function () {
      expect(filters.unique('aAbBa')).to.eql(['a', 'b']);
      expect(filters.min('dcba')).to.equal('a');
      expect(filters.random('aaa')).to.equal('a');
    });
    it('slice spreads the characters across columns', function () {
      expect(filters.slice('abcdef', 2)).to.eql([['a', 'b', 'c'], ['d', 'e', 'f']]);
    });
  });

  describe('mappings', function () {
    it('sort returns the sorted keys', function () {
      expect(filters.sort({ b: 1, a: 2 })).to.eql(['a', 'b']);
    });
  });

  describe('format conversions', function () {
    it('%e, %E and %.2e', function () {
      expect(filters.format('%e|%E|%.2e', 1e21, 1e21, 1.5e20)).to.equal('1.000000e+21|1.000000E+21|1.50e+20');
    });
    it('%g and %G', function () {
      expect(filters.format('%g|%G', 1e21, 1e21)).to.equal('1e+21|1E+21');
    });
    it('%X, %o and %c', function () {
      expect(filters.format('%X|%o|%c', 255, 64, 65)).to.equal('FF|100|A');
    });
  });

  describe('urlencode', function () {
    it('percent-encodes the characters encodeURIComponent leaves alone', function () {
      expect(filters.urlencode('(a)!*')).to.equal('%28a%29%21%2A');
    });
  });
});
