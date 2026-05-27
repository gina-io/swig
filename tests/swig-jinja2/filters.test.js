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

  describe('title', function () {
    it('title-cases each word', function () {
      expect(render('{{ s|title }}', { s: 'hello world' })).to.equal('Hello World');
    });
    it('treats hyphens and brackets as word boundaries', function () {
      expect(render('{{ s|title }}', { s: 'foo-bar baz' })).to.equal('Foo-Bar Baz');
      expect(render('{{ s|title }}', { s: '(parenthetical) [bracket]' })).to.equal('(Parenthetical) [Bracket]');
    });
    it('does not split on an apostrophe (escaped on output by autoescape)', function () {
      expect(render('{{ s|title }}', { s: "don't stop me" })).to.equal('Don&#39;t Stop Me');
    });
    it('lowercases the rest of each word', function () {
      expect(render('{{ s|title }}', { s: 'this is soME text' })).to.equal('This Is Some Text');
    });
    it('maps over arrays', function () {
      expect(render('{{ items|title|join("|") }}', { items: ['foo bar', 'baz qux'] })).to.equal('Foo Bar|Baz Qux');
    });
  });

  describe('capitalize', function () {
    it('uppercases the first character and lowercases the rest', function () {
      expect(render('{{ s|capitalize }}', { s: 'hello WORLD' })).to.equal('Hello world');
      expect(render('{{ s|capitalize }}', { s: 'i like Burritos' })).to.equal('I like burritos');
    });
  });

  describe('striptags', function () {
    it('strips tags and collapses whitespace', function () {
      expect(render('{{ "<p>hi</p>"|striptags }}')).to.equal('hi');
      expect(render('{{ s|striptags }}', { s: '<p>a</p>   <b>b</b>' })).to.equal('a b');
    });
    it('collapses newlines and trims the ends', function () {
      expect(render('{{ s|striptags }}', { s: '<p>line1\n\n  line2</p>' })).to.equal('line1 line2');
      expect(render('{{ s|striptags }}', { s: '  <x>foo</x>  ' })).to.equal('foo');
    });
  });

  describe('trim', function () {
    it('strips surrounding whitespace by default', function () {
      expect(render('{{ s|trim }}', { s: '  hi  ' })).to.equal('hi');
    });
    it('strips a custom character set from both ends', function () {
      expect(render('{{ "xxhixx"|trim("x") }}')).to.equal('hi');
    });
  });

  describe('replace', function () {
    it('replaces all occurrences of a literal substring', function () {
      expect(render('{{ s|replace("Hello", "Goodbye") }}', { s: 'Hello World Hello' })).to.equal('Goodbye World Goodbye');
    });
    it('honours an occurrence count', function () {
      expect(render('{{ s|replace("o", "0", 1) }}', { s: 'foo boo' })).to.equal('f0o boo');
    });
    it('replaces non-overlapping multi-character matches', function () {
      expect(render('{{ "aaaa"|replace("aa", "b") }}')).to.equal('bb');
    });
    it('defaults the replacement to empty when omitted', function () {
      expect(render('{{ "abc"|replace("b") }}')).to.equal('ac');
    });
  });

  describe('format', function () {
    it('substitutes %s and %d placeholders in order', function () {
      expect(render('{{ "%s is %d"|format("age", 42) }}')).to.equal('age is 42');
    });
    it('honours width, precision, and zero-pad flags', function () {
      expect(render('{{ "%05.2f"|format(n) }}', { n: 3.14159 })).to.equal('03.14');
      expect(render('{{ "%.2f"|format(n) }}', { n: 3.14159 })).to.equal('3.14');
      expect(render('{{ "%5d"|format(42) }}')).to.equal('   42');
    });
    it('left-justifies with the - flag and signs with +', function () {
      expect(render('{{ "%-5s|"|format("ab") }}')).to.equal('ab   |');
      expect(render('{{ "%+d"|format(5) }}')).to.equal('+5');
    });
    it('formats hexadecimal with %x', function () {
      expect(render('{{ "%x"|format(255) }}')).to.equal('ff');
    });
    it('emits a literal percent for %%', function () {
      expect(render('{{ "100%%"|format() }}')).to.equal('100%');
    });
  });

  describe('wordcount', function () {
    it('counts words', function () {
      expect(render('{{ "foo bar baz"|wordcount }}')).to.equal('3');
    });
    it('counts word runs across punctuation', function () {
      expect(render('{{ s|wordcount }}', { s: 'one, two; three!' })).to.equal('3');
    });
  });

  describe('wordwrap', function () {
    it('wraps text greedily at the given width', function () {
      expect(render('{{ s|wordwrap(10) }}', { s: 'the quick brown fox jumps' })).to.equal('the quick\nbrown fox\njumps');
    });
    it('breaks a word longer than the width', function () {
      expect(render('{{ s|wordwrap(5) }}', { s: 'abcdefghij k' })).to.equal('abcde\nfghij\nk');
    });
  });

  describe('indent', function () {
    it('indents every line but the first by default', function () {
      expect(render('{{ s|indent }}', { s: 'line1\nline2\nline3' })).to.equal('line1\n    line2\n    line3');
    });
    it('indents the first line too when first is true', function () {
      expect(render('{{ s|indent(2, true) }}', { s: 'line1\nline2' })).to.equal('  line1\n  line2');
    });
    it('leaves blank lines unindented by default', function () {
      expect(render('{{ s|indent(2, false, false) }}', { s: 'a\n\nb' })).to.equal('a\n\n  b');
    });
    it('indents blank lines when blank is true', function () {
      expect(render('{{ s|indent(2, true, true) }}', { s: 'a\n\nb' })).to.equal('  a\n  \n  b');
    });
  });

  describe('center', function () {
    it('centers within the width, extra space on the right', function () {
      expect(render('{{ "foo"|center(9) }}')).to.equal('   foo   ');
      expect(render('{{ "foo"|center(8) }}')).to.equal('  foo   ');
    });
    it('returns the input unchanged when wider than the field', function () {
      expect(render('{{ "foo"|center(2) }}')).to.equal('foo');
    });
  });

  describe('list', function () {
    it('converts a string to a list of characters', function () {
      expect(render('{{ "abc"|list|join("-") }}')).to.equal('a-b-c');
    });
    it('copies an array', function () {
      expect(render('{{ s|list|join("-") }}', { s: [1, 2, 3] })).to.equal('1-2-3');
    });
    it('lists a mapping by its keys', function () {
      expect(render('{{ s|list|join("-") }}', { s: { x: 1, y: 2 } })).to.equal('x-y');
    });
  });

  describe('unique', function () {
    it('removes duplicates preserving first-seen order', function () {
      expect(render('{{ s|unique|join(",") }}', { s: [1, 2, 2, 3, 1] })).to.equal('1,2,3');
    });
    it('compares strings case-insensitively by default', function () {
      expect(render('{{ s|unique|join(",") }}', { s: ['a', 'A', 'b', 'a'] })).to.equal('a,b');
    });
    it('compares exactly when caseSensitive is truthy', function () {
      expect(render('{{ s|unique(true)|join(",") }}', { s: ['a', 'A', 'a'] })).to.equal('a,A');
    });
  });

  describe('batch', function () {
    it('batches items into rows of the given size', function () {
      expect(render('{% for row in s|batch(2) %}[{{ row|join(",") }}]{% endfor %}', { s: [1, 2, 3, 4, 5] })).to.equal('[1,2][3,4][5]');
    });
    it('pads the last row with a fill value', function () {
      expect(render('{% for row in s|batch(2,"x") %}[{{ row|join(",") }}]{% endfor %}', { s: [1, 2, 3, 4, 5] })).to.equal('[1,2][3,4][5,x]');
    });
  });

  describe('slice (column batcher)', function () {
    it('distributes items across columns, extras in front', function () {
      expect(render('{% for c in s|slice(3) %}[{{ c|join(",") }}]{% endfor %}', { s: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] })).to.equal('[1,2,3,4][5,6,7][8,9,10]');
    });
    it('pads shorter columns with a fill value', function () {
      expect(render('{% for c in s|slice(3,"x") %}[{{ c|join(",") }}]{% endfor %}', { s: [1, 2, 3, 4, 5, 6, 7] })).to.equal('[1,2,3][4,5,x][6,7,x]');
    });
  });

  describe('dictsort', function () {
    it('sorts a mapping by key into [key, value] pairs', function () {
      expect(render('{% for p in d|dictsort %}{{ p[0] }}={{ p[1] }};{% endfor %}', { d: { b: 2, a: 1, c: 3 } })).to.equal('a=1;b=2;c=3;');
    });
    it('sorts by value when by is "value"', function () {
      expect(render('{% for p in d|dictsort(false,"value") %}{{ p[0] }}={{ p[1] }};{% endfor %}', { d: { b: 2, a: 3, c: 1 } })).to.equal('c=1;b=2;a=3;');
    });
    it('reverses with the reverse flag', function () {
      expect(render('{% for p in d|dictsort(false,"key",true) %}{{ p[0] }};{% endfor %}', { d: { b: 2, a: 1, c: 3 } })).to.equal('c;b;a;');
    });
    it('compares keys case-insensitively by default', function () {
      expect(render('{% for p in d|dictsort %}{{ p[0] }};{% endfor %}', { d: { B: 2, a: 1, C: 3 } })).to.equal('a;B;C;');
    });
  });

  describe('sum', function () {
    it('sums a list of numbers', function () {
      expect(render('{{ [1, 2, 3]|sum }}')).to.equal('6');
    });
    it('sums a dotted attribute of each item', function () {
      expect(render('{{ s|sum("v") }}', { s: [{ v: 1 }, { v: 2 }] })).to.equal('3');
    });
    it('adds a start value (empty attribute skips attribute lookup)', function () {
      expect(render('{{ [1, 2, 3]|sum("", 10) }}')).to.equal('16');
    });
  });

  describe('min / max', function () {
    it('returns the smallest / largest number', function () {
      expect(render('{{ [3, 1, 2]|min }}')).to.equal('1');
      expect(render('{{ [3, 1, 2]|max }}')).to.equal('3');
    });
    it('compares strings case-insensitively by default', function () {
      expect(render('{{ s|min }}', { s: ['B', 'a'] })).to.equal('a');
      expect(render('{{ s|max }}', { s: ['B', 'a'] })).to.equal('B');
    });
    it('compares exactly when caseSensitive is truthy', function () {
      expect(render('{{ s|min(true) }}', { s: ['B', 'a'] })).to.equal('B');
    });
  });

});
