var swig = require('../lib/swig'),
  expect = require('expect.js'),
  _ = require('lodash'),
  Swig = swig.Swig;

var n = new Swig(),
  oDefaults = n.options;

function resetOptions() {
  swig.setDefaults(oDefaults);
  swig.invalidateCache();
}

var cases = {
  'can be output': [
    { c: '{{ ap }}, {{ bu }}', e: 'apples, burritos' }
  ],
  'can be string and number literals': [
    { c: '{{ "a" }}', e: 'a' },
    { c: '{{ 1 }}', e: '1' },
    { c: '{{ 1.5 }}', e: '1.5' },
    { c: '{{ true }}', e: 'true' }
  ],
  'return empty string if undefined': [
    { c: '"{{ u }}"', e: '""' }
  ],
  'return empty string if null': [
    { c: '"{{ n }}"', e: '""' },
    { c: '"{{ o3.n }}"', e: '""' }
  ],
  'can use operators': [
    { c: '{{ a + 3 }}', e: '4' },
    { c: '{{ a * 3 }}', e: '3' },
    { c: '{{ a / 3 }}', e: String(1 / 3) },
    { c: '{{ 3 - a }}', e: '2' },
    { c: '{{ a % 3 }}', e: '1' }
  ],
  'can include objects': [
    { c: '{{ {0: 1, a: "b"} }}', e: '[object Object]' },
    { c: '{{ Object.keys({ 0: 1, a: "b" }) }}', e: '0,a' },
    { c: '{{ o.foo() }}', e: 'bar'},
    { c: '{{ o2.foo() }}', e: 'bar'},
    { c: '{{ o2.foo("foobar") }}', e: 'foobar'},
    { c: '{{ o2.bar }}', e: ''},
    { c: '{{ o2.$bar }}', e: 'bar'}
  ],
  'can include arrays': [
    { c: '{{ [0, 1, 3] }}', e: '0,1,3' }
  ],
  'are escaped by default': [
    { c: '{{ foo }}', e: '&lt;blah&gt;' }
  ],
  'can execute functions': [
    { c: '{{ c() }}', e: 'foobar' },
    { c: '{{ c(1) }}', e: 'barfoo' },
    { c: '{{ d(1)|default("tacos")|replace("tac", "churr") }}', e: 'churros' },
    { c: '{{ d()|default("tacos") }}', e: 'tacos' },
    { c: '{{ e.f(4, "blah") }}', e: 'eeeee' },
    { c: '{{ q.r(4, "blah") }}', e: '' },
    { c: '{{ e["f"](4, "blah") }}', e: 'eeeee' },
    { c: '{{ chalupa().bar() }}', e: 'chalupas' },
    { c: '{{ { foo: "bar" }.foo }}', e: 'bar' }
  ],
  'can run multiple filters': [
    { c: '{{ a|default("")|default(1) }}', e: '1' }
  ],
  'can have filters with operators': [
    { c: '{{ a|default("1") + b|default("2") }}', e: '12' }
  ],
  'can use both notation types': [
    { c: '{{ food.a }}', e: 'tacos' },
    { c: '{{ food["a"] }}', e: 'tacos' },
    { c: '{{ g[0][h.g.i]["c"].b[i] }}', e: 'hi!' }
  ],
  'can do some logical operations': [
    { c: '{{ ap === "apples" }}', e: 'true' },
    { c: '{{ not a }}', e: 'false' },
    { c: '{{ a <= 4 }}', e: 'true' }
  ],
  'null objects': [
    { c: '{{ n }}', e: '' }
  ]
};

describe('Variables', function () {
  var opts = { locals: {
    ap: 'apples',
    bu: 'burritos',
    a: 1,
    foo: '<blah>',
    chalupa: function () { return { bar: function () { return 'chalupas'; }}; },
    c: function (b) { return (b) ? 'barfoo' : 'foobar'; },
    d: function (c) { return; },
    e: { f: function () { return 'eeeee'; } },
    food: { a: 'tacos' },
    g: { '0': { q: { c: { b: { foo: 'hi!' }}}}},
    h: { g: {  i: 'q' } },
    i: 'foo',
    n: null,
    o: Object.create({ foo: function () { return 'bar'; } }),
    o2: { a: 'bar', foo: function (b) { return b || this.a; }, $bar: 'bar' },
    o3: { n: null }
  }};
  _.each(cases, function (cases, description) {
    describe(description, function () {
      _.each(cases, function (c) {
        it(c.c, function () {
          expect(swig.render(c.c, opts)).to.equal(c.e);
        });
      });
    });
  });

  describe('can throw errors when parsing', function () {
    var oDefaults;
    beforeEach(resetOptions);
    afterEach(resetOptions);

    it('with left open state', function () {
      expect(function () {
        swig.render('{{ a(asdf }}');
      }).to.throwError(/Unable to parse "a\(asdf" on line 1\./);
      expect(function () {
        swig.render('{{ a[foo }}');
      }).to.throwError(/Unable to parse "a\[foo" on line 1\./);
    });

    it('with unknown filters', function () {
      expect(function () {
        swig.render('\n\n{{ a|bar() }}');
      }).to.throwError(/Invalid filter "bar" on line 3\./);
    });

    it('with weird closing characters', function () {
      expect(function () {
        swig.render('\n{{ a) }}\n');
      }).to.throwError(/Mismatched nesting state on line 2\./);
      expect(function () {
        swig.render('\n\n{{ a] }}');
      }).to.throwError(/Unexpected closing square bracket on line 3\./);
      expect(function () {
        swig.render('\n\n{{ a} }}');
      }).to.throwError(/Unexpected closing curly brace on line 3\./);
    });

    it('with colons outside of objects', function () {
      expect(function () {
        swig.render('{{ foo:bar }}');
      }).to.throwError(/Unexpected colon on line 1\./);
    });

    it('with random dots', function () {
      expect(function () {
        swig.render('{{ .a }}');
      }).to.throwError(/Unexpected key "a" on line 1\./);

      expect(function () {
        swig.render('{{ {a.foo: "1"} }}');
      }).to.throwError(/Unexpected dot on line 1\./);
    });

    it('with bad commas', function () {
      expect(function () {
        swig.setDefaults({ autoescape: false });
        swig.render('{{ foo, bar }}');
      }).to.throwError(/Unexpected comma on line 1\./);
    });

    it('reserved JS words', function () {
      _.each(['break', 'case', 'catch', 'continue', 'debugger', 'default', 'delete', 'do', 'else', 'finally', 'for', 'function', 'if', 'in', 'instanceof', 'new', 'return', 'switch', 'this', 'throw', 'try', 'typeof', 'var', 'void', 'while', 'with'], function (r) {
        expect(function () {
          swig.render('{{ ' + r + ' }}', { filename: r + '.html' });
        }).to.throwError(/Reserved keyword "\w+" attempted to be used as a variable on line 1 in file \w+\.html\./);
      });
    });

    it('invalid logic', function () {
      expect(function () {
        swig.render('{{ === foo }}');
      }).to.throwError(/Unexpected logic on line 1\./);
    });
  });

  describe('inline-if ternary expression', function () {
    /*
     * Jinja2/Nunjucks-style ternary inside {{ … }}. Anchored at the loosest
     * precedence level so nested ternaries require parentheses (Python rules).
     * The else clause is optional — omitted yields the empty string on the
     * falsy branch, matching Nunjucks output for `{{ x if cond }}`.
     */
    it('renders the truthy branch when condition is truthy', function () {
      expect(swig.render('{{ "yes" if x else "no" }}', { locals: { x: true } })).to.equal('yes');
    });

    it('renders the falsy branch when condition is falsy', function () {
      expect(swig.render('{{ "yes" if x else "no" }}', { locals: { x: false } })).to.equal('no');
    });

    it('omitted else renders the truthy branch or empty string', function () {
      expect(swig.render('{{ "checked" if x }}', { locals: { x: true } })).to.equal('checked');
      expect(swig.render('{{ "checked" if x }}', { locals: { x: false } })).to.equal('');
    });

    it('common attribute-context pattern: no-else ternary inside an HTML attribute', function () {
      var tpl = '<input {{ "checked" if isChecked }}>';
      expect(swig.render(tpl, { locals: { isChecked: true } })).to.equal('<input checked>');
      expect(swig.render(tpl, { locals: { isChecked: false } })).to.equal('<input >');
    });

    it('supports `not` and compound conditions', function () {
      expect(swig.render('{{ "disabled" if not enabled }}', { locals: { enabled: false } })).to.equal('disabled');
      expect(swig.render('{{ "ok" if a and b else "bad" }}', { locals: { a: true, b: true } })).to.equal('ok');
      expect(swig.render('{{ "ok" if a or b else "bad" }}', { locals: { a: false, b: true } })).to.equal('ok');
    });

    it('supports comparisons in the condition', function () {
      expect(swig.render('{{ "match" if v == 5 else "miss" }}', { locals: { v: 5 } })).to.equal('match');
      expect(swig.render('{{ "match" if v == 5 else "miss" }}', { locals: { v: 4 } })).to.equal('miss');
    });

    it('ternary result chains into a filter (parenthesised)', function () {
      expect(swig.render('{{ ("yes" if x else "no") | upper }}', { locals: { x: true } })).to.equal('YES');
    });

    it('nested ternaries via parens are right-associative', function () {
      var tpl = '{{ "A" if x else ("B" if y else "C") }}';
      expect(swig.render(tpl, { locals: { x: true, y: false } })).to.equal('A');
      expect(swig.render(tpl, { locals: { x: false, y: true } })).to.equal('B');
      expect(swig.render(tpl, { locals: { x: false, y: false } })).to.equal('C');
    });

    it('does not affect block-form {% if %}…{% endif %}', function () {
      expect(swig.render('{% if x %}yes{% else %}no{% endif %}', { locals: { x: true } })).to.equal('yes');
      expect(swig.render('{% if x %}yes{% else %}no{% endif %}', { locals: { x: false } })).to.equal('no');
    });

    it('still rejects `if` / `else` as a lead variable token', function () {
      expect(function () { swig.render('{{ if }}', { filename: 'if.html' }); })
        .to.throwError(/Reserved keyword "if"/);
      expect(function () { swig.render('{{ else }}', { filename: 'else.html' }); })
        .to.throwError(/Reserved keyword "else"/);
    });
  });
});
