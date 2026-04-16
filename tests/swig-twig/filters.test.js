var filters = require('@rhinostone/swig-twig/lib/filters'),
  expect = require('expect.js');


/*!
 * Phase 3 — Twig filter catalog (A-bucket: behavior parity with swig-core).
 *
 * Verifies the 13 filters shipped in Session 13 Commit 1: length, lower,
 * upper, first, last, join, reverse, sort, striptags, url_encode,
 * json_encode, raw, escape (+ `e` alias). All 13 are the "copy-paste with
 * tweaks" bucket — behavior matches native swig with three documented
 * divergences: (a) Twig's `reverse` does NOT sort first (Twig semantics —
 * reverses input order), (b) Twig's `sort` has no `reverse=true` arg
 * (Twig's `sort` is ascending-only; pipe through `reverse` for descending),
 * (c) Twig has no `safe` filter — `raw` is the only autoescape-bypass name.
 *
 * `.safe = true` convention check: only `raw` carries it this session.
 * `json_encode` and `url_encode` deliberately do NOT — per the session
 * scope decision, Twig matches swig-core's actual flagging, not the stale
 * architecture-doc claim. See .claude/architecture/tags-and-filters.md for
 * follow-up.
 *
 * See .claude/architecture/multi-flavor-ir.md § Phase 3 and
 * .claude/architecture/tags-and-filters.md § Filters.
 */
describe('@rhinostone/swig-twig — filters (A-bucket)', function () {

  describe('length', function () {
    it('counts string characters', function () {
      expect(filters.length('Tacos')).to.equal(5);
    });
    it('counts array elements', function () {
      expect(filters.length([1, 2, 3])).to.equal(3);
    });
    it('counts object keys', function () {
      expect(filters.length({ a: 1, b: 2 })).to.equal(2);
    });
    it('returns empty string for length-less input', function () {
      expect(filters.length(42)).to.equal('');
    });
  });

  describe('lower', function () {
    it('lowercases strings', function () {
      expect(filters.lower('FOOBAR')).to.equal('foobar');
    });
    it('maps over arrays via iterateFilter', function () {
      expect(filters.lower(['FOO', 'BAR'])).to.eql(['foo', 'bar']);
    });
    it('maps over object values via iterateFilter', function () {
      expect(filters.lower({ a: 'FOO', b: 'BAR' })).to.eql({ a: 'foo', b: 'bar' });
    });
  });

  describe('upper', function () {
    it('uppercases strings', function () {
      expect(filters.upper('tacos')).to.equal('TACOS');
    });
    it('maps over arrays via iterateFilter', function () {
      expect(filters.upper(['foo', 'bar'])).to.eql(['FOO', 'BAR']);
    });
  });

  describe('first', function () {
    it('returns the first character of a string', function () {
      expect(filters.first('tacos')).to.equal('t');
    });
    it('returns the first element of an array', function () {
      expect(filters.first([1, 2, 3])).to.equal(1);
    });
    it('returns the first value of an object', function () {
      expect(filters.first({ a: 1, b: 2 })).to.equal(1);
    });
  });

  describe('last', function () {
    it('returns the last character of a string', function () {
      expect(filters.last('tacos')).to.equal('s');
    });
    it('returns the last element of an array', function () {
      expect(filters.last([1, 2, 3])).to.equal(3);
    });
    it('returns the last value of an object', function () {
      expect(filters.last({ a: 1, b: 2 })).to.equal(2);
    });
  });

  describe('join', function () {
    it('joins arrays with a glue string', function () {
      expect(filters.join(['foo', 'bar', 'baz'], ', ')).to.equal('foo, bar, baz');
    });
    it('joins object values with a glue string', function () {
      expect(filters.join({ a: 'foo', b: 'bar' }, '-')).to.equal('foo-bar');
    });
    it('returns non-array non-object input unchanged', function () {
      expect(filters.join('hi', ', ')).to.equal('hi');
    });
  });

  describe('reverse', function () {
    it('reverses an array without sorting (Twig semantics)', function () {
      expect(filters.reverse([3, 1, 2])).to.eql([2, 1, 3]);
    });
    it('does not mutate the input array', function () {
      var input = [1, 2, 3];
      filters.reverse(input);
      expect(input).to.eql([1, 2, 3]);
    });
    it('reverses a string character-by-character', function () {
      expect(filters.reverse('abc')).to.equal('cba');
    });
    it('returns non-array non-string input unchanged', function () {
      expect(filters.reverse(42)).to.equal(42);
    });
  });

  describe('sort', function () {
    it('sorts an array ascending', function () {
      expect(filters.sort([3, 1, 2])).to.eql([1, 2, 3]);
    });
    it('does not mutate the input array', function () {
      var input = [3, 1, 2];
      filters.sort(input);
      expect(input).to.eql([3, 1, 2]);
    });
    it('sorts string characters', function () {
      expect(filters.sort('cab')).to.equal('abc');
    });
    it('returns sorted keys for an object', function () {
      expect(filters.sort({ b: 1, a: 2, c: 3 })).to.eql(['a', 'b', 'c']);
    });
  });

  describe('striptags', function () {
    it('strips HTML tags from strings', function () {
      expect(filters.striptags('<p>hi</p>')).to.equal('hi');
    });
    it('maps over arrays via iterateFilter', function () {
      expect(filters.striptags(['<b>a</b>', '<i>b</i>'])).to.eql(['a', 'b']);
    });
  });

  describe('url_encode', function () {
    it('url-encodes a string', function () {
      expect(filters.url_encode('a=1&b=2')).to.equal('a%3D1%26b%3D2');
    });
    it('maps over arrays via iterateFilter', function () {
      expect(filters.url_encode(['a b', 'c d'])).to.eql(['a%20b', 'c%20d']);
    });
    it('is NOT marked safe (matches swig-core flagging)', function () {
      expect(filters.url_encode.safe).to.be(undefined);
    });
  });

  describe('json_encode', function () {
    it('stringifies objects', function () {
      expect(filters.json_encode({ a: 1 })).to.equal('{"a":1}');
    });
    it('stringifies arrays', function () {
      expect(filters.json_encode([1, 2])).to.equal('[1,2]');
    });
    it('accepts an indent width', function () {
      expect(filters.json_encode({ a: 1 }, 2)).to.equal('{\n  "a": 1\n}');
    });
    it('is NOT marked safe (matches swig-core flagging)', function () {
      expect(filters.json_encode.safe).to.be(undefined);
    });
  });

  describe('raw', function () {
    it('passes input through untouched', function () {
      expect(filters.raw('<b>bold</b>')).to.equal('<b>bold</b>');
    });
    it('is marked safe so autoescape suppresses the trailing `e`', function () {
      expect(filters.raw.safe).to.equal(true);
    });
  });

  describe('slice', function () {
    it('slices a string by start and length', function () {
      expect(filters.slice('Hello, World', 7, 5)).to.equal('World');
    });
    it('slices an array by start and length', function () {
      expect(filters.slice([1, 2, 3, 4, 5], 1, 2)).to.eql([2, 3]);
    });
    it('slices a string to the end when length is omitted', function () {
      expect(filters.slice('Hello, World', 7)).to.equal('World');
    });
    it('slices an array to the end when length is null', function () {
      expect(filters.slice([1, 2, 3, 4, 5], 2, null)).to.eql([3, 4, 5]);
    });
    it('handles negative start (string)', function () {
      expect(filters.slice('Hello', -3)).to.equal('llo');
    });
    it('handles negative start (array)', function () {
      expect(filters.slice([1, 2, 3, 4, 5], -2)).to.eql([4, 5]);
    });
    it('handles negative length (array — stop N from end)', function () {
      expect(filters.slice([1, 2, 3, 4, 5], 1, -1)).to.eql([2, 3, 4]);
    });
    it('handles negative length (string)', function () {
      expect(filters.slice('Hello', 1, -1)).to.equal('ell');
    });
    it('clamps start past the end to empty', function () {
      expect(filters.slice('abc', 100, 2)).to.equal('');
    });
    it('returns input unchanged for non-string non-array', function () {
      expect(filters.slice(42, 0, 1)).to.equal(42);
    });
    it('is NOT marked safe', function () {
      expect(filters.slice.safe).to.be(undefined);
    });
  });

  describe('number_format', function () {
    it('formats with defaults (0 decimals, "." decimal, "," thousand)', function () {
      expect(filters.number_format(1234567)).to.equal('1,234,567');
    });
    it('rounds to the requested decimals', function () {
      expect(filters.number_format(9800.333, 2)).to.equal('9,800.33');
    });
    it('accepts custom decimal point and thousand separator', function () {
      expect(filters.number_format(1234.5, 2, ',', '.')).to.equal('1.234,50');
    });
    it('handles negatives', function () {
      expect(filters.number_format(-1234.5, 2)).to.equal('-1,234.50');
    });
    it('handles small numbers without a thousand separator', function () {
      expect(filters.number_format(42, 0)).to.equal('42');
    });
    it('returns non-finite input unchanged', function () {
      expect(isNaN(filters.number_format(NaN))).to.equal(true);
      expect(filters.number_format(Infinity)).to.equal(Infinity);
    });
    it('is NOT marked safe', function () {
      expect(filters.number_format.safe).to.be(undefined);
    });
  });

  describe('default', function () {
    it('returns fallback for undefined', function () {
      expect(filters['default'](undefined, 'x')).to.equal('x');
    });
    it('returns fallback for null', function () {
      expect(filters['default'](null, 'x')).to.equal('x');
    });
    it('returns fallback for false', function () {
      expect(filters['default'](false, 'x')).to.equal('x');
    });
    it('returns fallback for empty string', function () {
      expect(filters['default']('', 'x')).to.equal('x');
    });
    it('returns fallback for empty array', function () {
      expect(filters['default']([], 'x')).to.equal('x');
    });
    it('returns fallback for empty object', function () {
      expect(filters['default']({}, 'x')).to.equal('x');
    });
    it('passes through 0 (NOT considered empty)', function () {
      expect(filters['default'](0, 'x')).to.equal(0);
    });
    it('passes through string "0" (NOT considered empty)', function () {
      expect(filters['default']('0', 'x')).to.equal('0');
    });
    it('passes through non-empty string', function () {
      expect(filters['default']('hi', 'x')).to.equal('hi');
    });
    it('passes through non-empty array', function () {
      expect(filters['default']([1], 'x')).to.eql([1]);
    });
    it('passes through non-empty object', function () {
      expect(filters['default']({ a: 1 }, 'x')).to.eql({ a: 1 });
    });
    it('is NOT marked safe', function () {
      expect(filters['default'].safe).to.be(undefined);
    });
  });

  describe('escape / e', function () {
    it('HTML-escapes by default', function () {
      expect(filters.escape('<b>')).to.equal('&lt;b&gt;');
    });
    it('escapes quotes and apostrophes', function () {
      expect(filters.escape('"hi"')).to.equal('&quot;hi&quot;');
      expect(filters.escape("it's")).to.equal('it&#39;s');
    });
    it('supports JS escaping with type="js"', function () {
      expect(filters.escape('<b>', 'js')).to.equal('\\u003Cb\\u003E');
    });
    it('passes through non-string input', function () {
      expect(filters.escape(42)).to.equal(42);
    });
    it('exposes `e` as an alias for escape', function () {
      expect(filters.e).to.equal(filters.escape);
    });
  });

});
