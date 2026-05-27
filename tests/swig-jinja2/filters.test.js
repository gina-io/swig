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

  describe('default / d', function () {
    it('falls back when the value is missing or empty', function () {
      expect(render("{{ missing|default('anon') }}")).to.equal('anon');
      expect(render("{{ x|default('anon') }}", { x: '' })).to.equal('anon');
    });
    it('keeps a present value', function () {
      expect(render("{{ x|default('anon') }}", { x: 'Ada' })).to.equal('Ada');
    });
    it('preserves real falsy values (0, false) by default', function () {
      expect(render("{{ x|default('n/a') }}", { x: 0 })).to.equal('0');
      expect(render("{{ x|default('n/a') }}", { x: false })).to.equal('false');
    });
    it('falls back on any falsy value with the boolean argument', function () {
      expect(render("{{ x|default('n/a', true) }}", { x: 0 })).to.equal('n/a');
    });
    it('d is an alias of default', function () {
      expect(render("{{ missing|d('x') }}")).to.equal('x');
    });
  });

  describe('abs', function () {
    it('returns the absolute value', function () {
      expect(render('{{ x|abs }}', { x: -42 })).to.equal('42');
      expect(render('{{ x|abs }}', { x: -5.5 })).to.equal('5.5');
      expect(render('{{ (-42)|abs }}')).to.equal('42');
    });
  });

  describe('round', function () {
    it('rounds to the nearest integer by default', function () {
      expect(render('{{ x|round }}', { x: 2.7 })).to.equal('3');
    });
    it('rounds to a precision', function () {
      expect(render('{{ x|round(1) }}', { x: 42.55 })).to.equal('42.6');
    });
    it('supports floor and ceil methods', function () {
      expect(render("{{ x|round(1, 'floor') }}", { x: 42.55 })).to.equal('42.5');
      expect(render("{{ x|round(0, 'ceil') }}", { x: 42.1 })).to.equal('43');
    });
  });

  describe('int / float', function () {
    it('int parses an integer, truncating decimals', function () {
      expect(render("{{ '42.7'|int }}")).to.equal('42');
    });
    it('int returns the default on a bad value', function () {
      expect(render("{{ 'x'|int }}")).to.equal('0');
      expect(render("{{ 'x'|int(99) }}")).to.equal('99');
    });
    it('int honours a non-decimal base', function () {
      expect(render("{{ '1F'|int(0, 16) }}")).to.equal('31');
    });
    it('float parses a float', function () {
      expect(render("{{ '42.5'|float }}")).to.equal('42.5');
      expect(render("{{ 'x'|float }}")).to.equal('0');
    });
  });

  describe('truncate', function () {
    it('truncates at a word boundary and appends an ellipsis', function () {
      expect(render('{{ s|truncate(9) }}', { s: 'foo bar baz qux' })).to.equal('foo...');
    });
    it('leaves a short string whole (within leeway)', function () {
      expect(render('{{ s|truncate(9) }}', { s: 'short' })).to.equal('short');
    });
    it('cuts mid-word when killwords is true', function () {
      // 12 chars exceeds length(5) + default leeway(5), so it truncates;
      // killwords cuts at length - end.length = 4 chars, then appends "-".
      expect(render('{{ s|truncate(5, true, "-") }}', { s: 'abcdefghijkl' })).to.equal('abcd-');
    });
  });

  describe('tojson', function () {
    it('serializes a value to JSON', function () {
      expect(render('{{ d|tojson }}', { d: { a: 1, b: [2, 3] } })).to.equal('{"a":1,"b":[2,3]}');
    });
    it('escapes HTML-significant characters and is safe (not re-escaped)', function () {
      expect(render('{{ d|tojson }}', { d: { x: '<b>' } })).to.equal('{"x":"\\u003cb\\u003e"}');
    });
  });

  describe('groupby', function () {
    it('groups objects by an attribute into { grouper, list } records', function () {
      var tpl = "{% for g in users|groupby('dept') %}{{ g.grouper }}:{{ g.list|length }} {% endfor %}";
      expect(render(tpl, { users: [{ dept: 'a' }, { dept: 'b' }, { dept: 'a' }] })).to.equal('a:2 b:1 ');
    });
    it('supports a dotted attribute path', function () {
      var tpl = "{% for g in items|groupby('meta.kind') %}{{ g.grouper }}={{ g.list|length }};{% endfor %}";
      expect(render(tpl, { items: [{ meta: { kind: 'x' } }, { meta: { kind: 'x' } }, { meta: { kind: 'y' } }] })).to.equal('x=2;y=1;');
    });
  });

});
