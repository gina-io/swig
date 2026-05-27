var jinja2 = require('@rhinostone/swig-jinja2'),
  expect = require('expect.js');


/*!
 * Filter catalog render tests. Each filter is exercised end-to-end through
 * a `{{ … }}` expression so its IR lowering and runtime behavior are both
 * verified. Numeric-returning filters are asserted against String(...)
 * because `_output +=` stringifies on the way out.
 */
describe('@rhinostone/swig-jinja2 — filters', function () {

  function render(src, locals) {
    return jinja2.render(src, { locals: locals || {} });
  }

  describe('escaping (bootstrap)', function () {
    it('escape / e HTML-escape by default', function () {
      expect(render('{{ "<b>"|escape }}')).to.equal('&lt;b&gt;');
      expect(render('{{ x }}', { x: '<b>' })).to.equal('&lt;b&gt;');
    });
    it('safe bypasses autoescape', function () {
      expect(render('{{ "<b>x</b>"|safe }}')).to.equal('<b>x</b>');
    });
    it('upper / lower', function () {
      expect(render('{{ "swig"|upper }}')).to.equal('SWIG');
      expect(render('{{ "SWIG"|lower }}')).to.equal('swig');
    });
  });

  describe('length / count', function () {
    it('counts string characters', function () {
      expect(render('{{ "Tacos"|length }}')).to.equal('5');
    });
    it('counts array items', function () {
      expect(render('{{ items|length }}', { items: [1, 2, 3] })).to.equal('3');
    });
    it('counts object keys', function () {
      expect(render('{{ o|length }}', { o: { a: 1, b: 2 } })).to.equal('2');
    });
    it('count is an alias of length', function () {
      expect(render('{{ items|count }}', { items: [1, 2, 3, 4] })).to.equal('4');
    });
  });

  describe('first / last', function () {
    it('first of an array / string', function () {
      expect(render('{{ items|first }}', { items: ['a', 'b'] })).to.equal('a');
      expect(render('{{ "abc"|first }}')).to.equal('a');
    });
    it('last of an array / string', function () {
      expect(render('{{ items|last }}', { items: ['a', 'b', 'c'] })).to.equal('c');
      expect(render('{{ "abc"|last }}')).to.equal('c');
    });
  });

  describe('join', function () {
    it('defaults to an empty glue', function () {
      expect(render('{{ [1, 2, 3]|join }}')).to.equal('123');
    });
    it('joins with an explicit glue', function () {
      expect(render('{{ items|join(", ") }}', { items: ['foo', 'bar', 'baz'] })).to.equal('foo, bar, baz');
    });
    it('joins a mapping by its keys', function () {
      expect(render('{{ o|join(",") }}', { o: { a: 1, b: 2 } })).to.equal('a,b');
    });
  });

  describe('reverse', function () {
    it('reverses an array without sorting', function () {
      expect(render('{{ [1, 3, 2]|reverse|join(",") }}')).to.equal('2,3,1');
    });
    it('reverses a string', function () {
      expect(render('{{ "abc"|reverse }}')).to.equal('cba');
    });
    it('does not mutate the input array', function () {
      var locals = { items: [1, 2, 3] };
      render('{{ items|reverse }}', locals);
      expect(locals.items).to.eql([1, 2, 3]);
    });
  });

  describe('sort', function () {
    it('sorts numbers numerically (not lexicographically)', function () {
      expect(render('{{ [3, 1, 10, 2]|sort|join(",") }}')).to.equal('1,2,3,10');
    });
    it('sorts strings case-insensitively', function () {
      expect(render('{{ ["B", "a", "C"]|sort|join(",") }}')).to.equal('a,B,C');
    });
    it('sorts descending with a truthy argument', function () {
      expect(render('{{ [3, 1, 2]|sort(true)|join(",") }}')).to.equal('3,2,1');
    });
    it('does not mutate the input array', function () {
      var locals = { items: [3, 1, 2] };
      render('{{ items|sort }}', locals);
      expect(locals.items).to.eql([3, 1, 2]);
    });
    it('composes in a filter chain', function () {
      expect(render('{{ items|sort|first }}', { items: [3, 1, 2] })).to.equal('1');
    });
  });

});
