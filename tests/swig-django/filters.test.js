var django = require('@rhinostone/swig-django'),
  expect = require('../lib/expect.js');


/*!
 * Django filter catalog. Each filter is cross-checked against Django 5.2
 * `defaultfilters.py` behavior. Filters are pure `(input, ...args)` functions
 * routed through `_filters["<name>"]`; the colon-filter argument path is
 * already leak-free (the per-iteration fargs reset added at carve time).
 *
 * Two render-layer interactions to keep in mind when reading expectations:
 *  - Autoescape is on by default, so a filter that is NOT `.safe` (most of
 *    them) has its output HTML-escaped. Filter-transformation tests that need
 *    to see raw output (e.g. addslashes' apostrophe) wrap in
 *    `{% autoescape off %}`.
 *  - A filter that returns a number renders as the coerced string.
 */
describe('@rhinostone/swig-django — filters', function () {

  // TZ-stable date construction (mirrors tests/filters.test.js): produce a
  // Date whose wall clock is fixed regardless of the machine timezone, so the
  // date filter (default tzOffset 0) renders deterministically across machines.
  function makeDate(tzOffset, y, m, d, h, i, s) {
    var date = new Date(y, m || 0, d || 0, h || 0, i || 0, s || 0),
      offset = date.getTimezoneOffset();
    if (offset !== tzOffset) {
      date = new Date(date.getTime() - ((offset * 60000) - (tzOffset * 60000)));
    }
    return date;
  }

  function r(src, locals) {
    return django.render(src, { locals: locals || {} });
  }
  function threw(fn) {
    try { fn(); return false; } catch (e) { return e.message; }
  }

  /* ============ string filters ================================== */

  describe('string', function () {

    it('upper / lower', function () {
      expect(r('{{ "swig"|upper }}')).to.equal('SWIG');
      expect(r('{{ "SWIG"|lower }}')).to.equal('swig');
    });

    it('title — first letter of each word up, rest down', function () {
      expect(r('{{ "my FIRST post"|title }}')).to.equal('My First Post');
    });

    it('capfirst — only the first character, rest unchanged', function () {
      expect(r('{{ "django"|capfirst }}')).to.equal('Django');
      expect(r('{{ "hELLO"|capfirst }}')).to.equal('HELLO');
    });

    it('cut — remove all occurrences of the argument', function () {
      expect(r('{{ "String with spaces"|cut:" " }}')).to.equal('Stringwithspaces');
    });

    it('addslashes — backslash-escape quotes (raw, autoescape off)', function () {
      expect(r('{% autoescape off %}{{ v|addslashes }}{% endautoescape %}', { v: 'I\'m "ok"' }))
        .to.equal('I\\\'m \\"ok\\"');
    });

    it('center / ljust / rjust', function () {
      expect(r('[{{ "Django"|center:15 }}]')).to.equal('[     Django    ]');
      expect(r('[{{ "Django"|ljust:10 }}]')).to.equal('[Django    ]');
      expect(r('[{{ "Django"|rjust:10 }}]')).to.equal('[    Django]');
    });

    it('truncatechars — length includes the ellipsis', function () {
      expect(r('{{ "Joel is a slug"|truncatechars:7 }}')).to.equal('Joel i…');
      expect(r('{{ "Joel is a slug"|truncatechars:20 }}')).to.equal('Joel is a slug');
    });

    it('truncatewords — space + ellipsis when truncated', function () {
      expect(r('{{ "Joel is a slug"|truncatewords:2 }}')).to.equal('Joel is …');
      expect(r('{{ "Joel is a slug"|truncatewords:9 }}')).to.equal('Joel is a slug');
    });

    it('wordcount', function () {
      expect(r('{{ "Joel is a slug"|wordcount }}')).to.equal('4');
      expect(r('{{ ""|wordcount }}')).to.equal('0');
    });

    it('wordwrap', function () {
      expect(r('{{ "the quick brown fox"|wordwrap:10 }}')).to.equal('the quick\nbrown fox');
    });

    it('make_list — characters of a string', function () {
      expect(r('{{ "Joel"|make_list|join:"-" }}')).to.equal('J-o-e-l');
    });

    it('phone2numeric', function () {
      expect(r('{{ "800-COLLECT"|phone2numeric }}')).to.equal('800-2655328');
    });

    it('slugify — lowercase, ascii-fold, hyphenate', function () {
      expect(r('{{ "Joel is a slug"|slugify }}')).to.equal('joel-is-a-slug');
      expect(r('{{ "Héllo Wörld!"|slugify }}')).to.equal('hello-world');
    });
  });

  /* ============ list / number filters =========================== */

  describe('list / number', function () {

    it('first / last', function () {
      expect(r('{{ list|first }}', { list: ['a', 'b', 'c'] })).to.equal('a');
      expect(r('{{ list|last }}', { list: ['a', 'b', 'c'] })).to.equal('c');
      expect(r('{{ "Joel"|first }}')).to.equal('J');
      expect(r('{{ "Joel"|last }}')).to.equal('l');
    });

    it('length', function () {
      expect(r('{{ "Tacos"|length }}')).to.equal('5');
      expect(r('{{ list|length }}', { list: [1, 2, 3] })).to.equal('3');
    });

    it('join', function () {
      expect(r('{{ list|join:", " }}', { list: ['a', 'b', 'c'] })).to.equal('a, b, c');
    });

    it('slice — Python start:stop:step subscript', function () {
      expect(r('{{ list|slice:":2"|join:"," }}', { list: ['a', 'b', 'c'] })).to.equal('a,b');
      expect(r('{{ list|slice:"1:"|join:"," }}', { list: ['a', 'b', 'c'] })).to.equal('b,c');
      expect(r('{{ "abc"|slice:"::-1" }}')).to.equal('cba');
    });

    it('default — fall back on any falsy value', function () {
      expect(r('{{ ""|default:"nothing" }}')).to.equal('nothing');
      expect(r('{{ "x"|default:"nothing" }}')).to.equal('x');
      expect(r('{{ z|default:"nothing" }}', { z: 0 })).to.equal('nothing');
    });

    it('default_if_none — only None falls back; 0 and "" pass through', function () {
      expect(r('{{ z|default_if_none:"x" }}', { z: 'present' })).to.equal('present');
      expect(r('{{ z|default_if_none:"x" }}', { z: 0 })).to.equal('0');
      expect(r('{{ z|default_if_none:"x" }}', { z: '' })).to.equal('');
    });

    it('add — numeric then concatenation', function () {
      expect(r('{{ z|add:2 }}', { z: 4 })).to.equal('6');
      expect(r('{{ z|add:"b" }}', { z: 'a' })).to.equal('ab');
    });

    it('get_digit — 1-based from the right', function () {
      expect(r('{{ z|get_digit:2 }}', { z: 123456789 })).to.equal('8');
      expect(r('{{ z|get_digit:1 }}', { z: 123456789 })).to.equal('9');
    });

    it('divisibleby — boolean, usable in if', function () {
      expect(r('{% if z|divisibleby:3 %}Y{% else %}N{% endif %}', { z: 21 })).to.equal('Y');
      expect(r('{% if z|divisibleby:3 %}Y{% else %}N{% endif %}', { z: 20 })).to.equal('N');
    });

    it('floatformat — default drops the decimal for whole numbers', function () {
      expect(r('{{ z|floatformat }}', { z: 34.23234 })).to.equal('34.2');
      expect(r('{{ z|floatformat }}', { z: 34.0 })).to.equal('34');
      expect(r('{{ z|floatformat }}', { z: 34.26 })).to.equal('34.3');
    });

    it('floatformat:N — always N decimals', function () {
      expect(r('{{ z|floatformat:3 }}', { z: 34.23234 })).to.equal('34.232');
      expect(r('{{ z|floatformat:3 }}', { z: 34.0 })).to.equal('34.000');
      expect(r('{{ z|floatformat:"0" }}', { z: 39.56 })).to.equal('40');
    });

    it('floatformat:-N — N decimals only when not whole', function () {
      expect(r('{{ z|floatformat:"-3" }}', { z: 34.23234 })).to.equal('34.232');
      expect(r('{{ z|floatformat:"-3" }}', { z: 34.0 })).to.equal('34');
      expect(r('{{ z|floatformat:-3 }}', { z: 34.26 })).to.equal('34.260');
    });

    it('filesizeformat — 1024-based, U+00A0 separator', function () {
      expect(r('{{ z|filesizeformat }}', { z: 123456789 })).to.equal('117.7 MB');
      expect(r('{{ z|filesizeformat }}', { z: 1024 })).to.equal('1.0 KB');
      expect(r('{{ z|filesizeformat }}', { z: 1 })).to.equal('1 byte');
      expect(r('{{ z|filesizeformat }}', { z: 512 })).to.equal('512 bytes');
      expect(r('{{ z|filesizeformat }}', { z: 0 })).to.equal('0 bytes');
    });

    it('pluralize — default and explicit forms', function () {
      expect(r('msg{{ z|pluralize }}', { z: 1 })).to.equal('msg');
      expect(r('msg{{ z|pluralize }}', { z: 2 })).to.equal('msgs');
      expect(r('walrus{{ z|pluralize:"es" }}', { z: 2 })).to.equal('walruses');
      expect(r('cherr{{ z|pluralize:"y,ies" }}', { z: 1 })).to.equal('cherry');
      expect(r('cherr{{ z|pluralize:"y,ies" }}', { z: 2 })).to.equal('cherries');
    });

    it('yesno — truthy / falsy mapping', function () {
      expect(r('{{ z|yesno:"yeah,no,maybe" }}', { z: true })).to.equal('yeah');
      expect(r('{{ z|yesno:"yeah,no,maybe" }}', { z: false })).to.equal('no');
      expect(r('{{ z|yesno:"yeah,no" }}', { z: true })).to.equal('yeah');
    });
  });

  /* ============ date / html / safety filters ==================== */

  describe('date / html / safety', function () {

    it('date — PHP-style format codes', function () {
      var d = makeDate(0, 2008, 0, 9, 12, 34, 56);
      expect(r('{{ v|date:"Y-m-d" }}', { v: d })).to.equal('2008-01-09');
      expect(r('{{ v|date:"D d M Y" }}', { v: d })).to.equal('Wed 09 Jan 2008');
      expect(r('{{ v|date:"H:i:s" }}', { v: d })).to.equal('12:34:56');
    });

    it('date — backslash escapes a literal character', function () {
      var d = makeDate(0, 2008, 0, 9, 12, 0, 0);
      expect(r('{{ v|date:"\\Y=Y" }}', { v: d })).to.equal('Y=2008');
    });

    it('date — null / empty renders empty', function () {
      expect(r('{{ v|date:"Y-m-d" }}', { v: null })).to.equal('');
    });

    it('time — formats the time portion', function () {
      var d = makeDate(0, 2008, 0, 9, 12, 34, 56);
      expect(r('{{ v|time:"H:i" }}', { v: d })).to.equal('12:34');
    });

    it('escape / e — entity-escape, idempotent', function () {
      expect(r('{{ "<b>"|escape }}')).to.equal('&lt;b&gt;');
      expect(r('{{ "<b>"|e }}')).to.equal('&lt;b&gt;');
    });

    it('escapejs — hex-encode for a JS string, safe', function () {
      expect(r('{{ "</script>"|escapejs }}')).to.equal('\\u003C/script\\u003E');
      expect(r('{{ "a&b"|escapejs }}')).to.equal('a\\u0026b');
    });

    it('force_escape — escape immediately, safe', function () {
      expect(r('{{ "<b>"|force_escape }}')).to.equal('&lt;b&gt;');
    });

    it('linebreaks — paragraphs + <br>, content escaped, safe', function () {
      expect(r('{{ v|linebreaks }}', { v: 'Joel\nis a slug' })).to.equal('<p>Joel<br>is a slug</p>');
      expect(r('{{ v|linebreaks }}', { v: 'a\n\nb' })).to.equal('<p>a</p>\n\n<p>b</p>');
      expect(r('{{ v|linebreaks }}', { v: '<b>' })).to.equal('<p>&lt;b&gt;</p>');
    });

    it('linebreaksbr — every newline to <br>, safe', function () {
      expect(r('{{ v|linebreaksbr }}', { v: 'a\nb' })).to.equal('a<br>b');
    });

    it('linenumbers — zero-padded line numbers, safe', function () {
      expect(r('{{ v|linenumbers }}', { v: 'one\ntwo' })).to.equal('1. one\n2. two');
    });

    it('striptags', function () {
      expect(r('{{ "<p>foobar</p>"|striptags }}')).to.equal('foobar');
    });

    it('urlencode — path-safe by default; arg overrides the safe set', function () {
      expect(r('{{ "a b/c"|urlencode }}')).to.equal('a%20b/c');
      expect(r('{{ "a/b"|urlencode:"" }}')).to.equal('a%2Fb');
    });

    it('iriencode — encode non-ASCII, preserve URI-reserved', function () {
      expect(r('{{ "?test=I ♥ Django"|iriencode }}')).to.equal('?test=I%20%E2%99%A5%20Django');
    });

    it('safe — bypass autoescape', function () {
      expect(r('{{ "<b>bold</b>"|safe }}')).to.equal('<b>bold</b>');
    });

    it('non-safe filter output is autoescaped', function () {
      expect(r('{{ "<b>x"|upper }}')).to.equal('&lt;B&gt;X');
    });
  });

  /* ============ security ======================================== */

  describe('security', function () {

    it('a dangerous prop in a filter input is rejected', function () {
      expect(threw(function () { r('{{ foo.__proto__|upper }}', { foo: {} }); }))
        .to.contain('CVE-2023-25345');
    });

    it('a filter chain does not leak an arg onto a later filter', function () {
      // cut consumes its " " arg; upper must run with no stray argument.
      expect(r('{{ "a b c"|cut:" "|upper }}')).to.equal('ABC');
    });
  });
});
