var jinja2 = require('@rhinostone/swig-jinja2'),
  filters = require('@rhinostone/swig-jinja2/lib/filters'),
  expect = require('../lib/expect.js');

/*!
 * The filters attr, filesizeformat, forceescape, items, string and urlize:
 * what the Jinja2 parity cases do not show. The prototype-chain guard in
 * attr, the safe flags, the ASCII classes an engine without Unicode property
 * escapes gets, and the time urlize and filesizeformat take on long input.
 */
describe('@rhinostone/swig-jinja2 — attr, filesizeformat, forceescape, items, string and urlize', function () {

  function render(src, locals, opts) {
    var engine = new jinja2.Jinja2(opts || {});
    return engine.render(src, { locals: locals || {} });
  }

  describe('string', function () {
    it('gives an empty string for undefined and null', function () {
      expect(filters.string(undefined)).to.equal('');
      expect(filters.string(null)).to.equal('');
      expect(filters.string(0)).to.equal('0');
    });
  });

  describe('attr', function () {
    it('reads a key of a mapping or a JavaScript property, as `value.name` does', function () {
      var o = Object.create({ get g() { return 'G'; } });
      expect(filters.attr({ a: 1 }, 'a')).to.equal(1);
      expect(filters.attr('abc', 'length')).to.equal(3);
      expect(filters.attr(o, 'g')).to.equal('G');
      expect(render('{{ o|attr("g") }}|{{ o.g }}', { o: o })).to.equal('G|G');
      expect(render('[{{ o|attr(n) }}]', { o: { k: 'v' }, n: 'k' })).to.equal('[v]');
    });

    it('gives undefined for __proto__, constructor and prototype, from a literal or from data', function () {
      ['__proto__', 'constructor', 'prototype'].forEach(function (n) {
        expect(filters.attr({}, n)).to.be(undefined);
        expect(filters.attr(function () { return 1; }, n)).to.be(undefined);
        expect(render('[{{ o|attr(n) }}][{{ f|attr(n) }}]', { o: {}, f: function () { return 1; }, n: n })).to.equal('[][]');
      });
      expect(filters.attr({ constructor: 'own' }, 'constructor')).to.be(undefined);
      expect(render('[{{ o|attr("constructor") }}]', { o: {} })).to.equal('[]');
    });

    it('gives undefined for a name that is not a string', function () {
      expect(filters.attr(['x', 'y'], 1)).to.be(undefined);
      expect(filters.attr(['x', 'y'], '1')).to.equal('y');
      expect(filters.attr({ 'true': 1 }, true)).to.be(undefined);
      expect(filters.attr({ 'null': 1 }, null)).to.be(undefined);
      expect(filters.attr({ a: 1 }, ['a'])).to.be(undefined);
      expect(filters.attr({ a: 1 })).to.be(undefined);
    });

    it('gives undefined for an undefined or null value', function () {
      expect(filters.attr(undefined, 'k')).to.be(undefined);
      expect(filters.attr(null, 'k')).to.be(undefined);
      expect(render('[{{ x|attr("k") }}][{{ none|attr("k") }}]')).to.equal('[][]');
    });
  });

  describe('the safe flags', function () {
    it('forceescape and urlize are safe; string, items, attr and filesizeformat are not', function () {
      expect(filters.forceescape.safe).to.be(true);
      expect(filters.urlize.safe).to.be(true);
      ['string', 'items', 'attr', 'filesizeformat'].forEach(function (name) {
        expect(filters[name].safe).to.be(undefined);
      });
    });

    it('under a js escape strategy, the output of forceescape and urlize is not escaped again', function () {
      var lt = '\\' + 'u003C', gt = '\\' + 'u003E',
        out = render('{{ x|forceescape }}|{{ x|urlize }}|{{ x|string }}', { x: '<b> www.a.com' }, { autoescape: 'js' });
      expect(out).to.equal('&lt;b&gt; www.a.com|&lt;b&gt; <a href="https://www.a.com" rel="noopener">www.a.com</a>|' + lt + 'b' + gt + ' www.a.com');
    });
  });

  describe('an engine without Unicode property escapes', function () {
    var fallback, refusals = 0;

    // Load a second copy of the filters while RegExp refuses `\p{...}`, as an
    // engine without ES2018 property escapes does; RegExp and the module
    // cache are put back whatever happens.
    before(function () {
      var file = require.resolve('@rhinostone/swig-jinja2/lib/filters'),
        cached = require.cache[file],
        Real = RegExp;
      function NoPropertyEscapes(src, flags) {
        if (String(src).indexOf('\\p{') !== -1) {
          refusals += 1;
          throw new SyntaxError('Invalid escape');
        }
        return new Real(src, flags);
      }
      NoPropertyEscapes.prototype = Real.prototype;
      delete require.cache[file];
      global.RegExp = NoPropertyEscapes;
      try {
        fallback = require(file);
      } finally {
        global.RegExp = Real;
        require.cache[file] = cached;
      }
    });

    it('builds the ASCII classes after the property escapes are refused', function () {
      expect(refusals).to.be.greaterThan(0);
      expect(fallback).not.to.be(filters);
      expect(fallback.urlize).to.be.a('function');
    });

    it('urlize links ASCII text as with property escapes', function () {
      ['see www.example.com.', 'http://192.168.0.1:8080/x', 'http://[2001:db8::1]:80/a', 'user@example.com',
        'mailto:user@example.com', '(http://example.com/foo_(bar)).', 'www.example.com,', 'foo.io', 'x@y',
        'https://example.com:8080', 'HTTP://EXAMPLE.COM', '<script>alert(1)</script> www.x.com'].forEach(function (s) {
        expect(fallback.urlize(s)).to.equal(filters.urlize(s));
      });
      expect(fallback.urlize('http://192.168.0.1:8080/x')).to.equal('<a href="http://192.168.0.1:8080/x" rel="noopener">http://192.168.0.1:8080/x</a>');
    });

    it('urlize still reads the letters Python adds to i, s and k', function () {
      ['www.example.' + String.fromCharCode(0x131) + 'o', 'example.m' + String.fromCharCode(0x130) + 'l',
        'http' + String.fromCharCode(0x17f) + '://example.com', 'www.example.' + String.fromCharCode(0x212a) + 'o'].forEach(function (s) {
        expect(fallback.urlize(s)).to.equal(filters.urlize(s));
        expect(fallback.urlize(s).indexOf('<a href=')).to.equal(0);
      });
    });

    it('filesizeformat reads ASCII digits, and gives other decimal digits back unchanged', function () {
      var arabic = String.fromCharCode(0x661, 0x662, 0x663, 0x664);
      expect(fallback.filesizeformat('1234')).to.equal('1.2 kB');
      expect(fallback.filesizeformat(' 1_234 ')).to.equal('1.2 kB');
      expect(fallback.filesizeformat(arabic)).to.equal(arabic);
      expect(filters.filesizeformat(arabic)).to.equal('1.2 kB');
    });
  });

  describe('linear time on long template data', function () {
    var n = 100000;

    function msFor(fn) {
      var t0 = Date.now();
      fn();
      return Date.now() - t0;
    }

    // Jinja2's urlize takes time quadratic in a long run of ) at the end of a
    // word (5 s for 20 000 characters in Jinja2 3.1.6); none of these shapes
    // is a link.
    it('urlize on long runs of brackets, escaped brackets, dots and colons', function () {
      [')'.repeat(n) + 'x)', '('.repeat(n) + 'x', 'x' + '('.repeat(n / 2) + ')'.repeat(n / 2), 'www.' + 'a.'.repeat(n / 2) + '!',
        'a@a' + '.a'.repeat(n / 2) + '!', 'http://[' + '1:'.repeat(n / 2)].forEach(function (s) {
        var out;
        expect(msFor(function () { out = filters.urlize(s); })).to.be.lessThan(500);
        expect(out).to.equal(s);
      });
      var gts = '&gt;'.repeat(n / 4) + 'x', out;
      expect(msFor(function () { out = filters.urlize(gts); })).to.be.lessThan(500);
      expect(out).to.equal('&amp;gt;'.repeat(n / 4) + 'x');
    });

    it('urlize on a long text of links', function () {
      var s = 'see www.a.com '.repeat(n / 10), out;
      expect(msFor(function () { out = filters.urlize(s); })).to.be.lessThan(500);
      expect(out.split('<a href="https://www.a.com" rel="noopener">www.a.com</a>').length - 1).to.equal(n / 10);
    });

    it('filesizeformat on long runs of spaces, underscores and decimal digits', function () {
      [' '.repeat(n) + 'x', '1' + ' '.repeat(n) + '2', '1_'.repeat(n / 2) + 'x', String.fromCharCode(0x3000).repeat(n) + 'x'].forEach(function (s) {
        var out;
        expect(msFor(function () { out = filters.filesizeformat(s); })).to.be.lessThan(500);
        expect(out).to.equal(s);
      });
      [String.fromCharCode(0x661).repeat(n), String.fromCodePoint(0x1d7ff).repeat(n / 2)].forEach(function (s) {
        var out;
        expect(msFor(function () { out = filters.filesizeformat(s); })).to.be.lessThan(500);
        expect(out).to.equal('inf YB');
      });
    });
  });
});
