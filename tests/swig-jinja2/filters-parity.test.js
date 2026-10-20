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
});
