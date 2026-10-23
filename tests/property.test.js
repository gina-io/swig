var fc = require('fast-check'),
  swig = require('../lib/swig'),
  nativeFilters = require('../lib/filters'),
  twig = require('@rhinostone/swig-twig'),
  jinja2 = require('@rhinostone/swig-jinja2'),
  django = require('@rhinostone/swig-django'),
  utils = require('@rhinostone/swig-core/lib/utils');

/*!
 * Property-based tests: each property is checked on many generated inputs
 * rather than on a few chosen ones. The seed is fixed, so every run checks
 * the same inputs and a failure reproduces. To explore other inputs, set
 * SWIG_PROPERTY_SEED and SWIG_PROPERTY_RUNS, for example
 * SWIG_PROPERTY_SEED=7 SWIG_PROPERTY_RUNS=20000 make test tests=tests/property.test.js
 */
var params = {
  seed: Number(process.env.SWIG_PROPERTY_SEED) || 20261023,
  numRuns: Number(process.env.SWIG_PROPERTY_RUNS) || 1000
};

function check(property) {
  fc.assert(property, params);
}

/*!
 * Strings rich in the characters that matter here (markup, entity
 * fragments, quotes, backslashes, line endings, U+2028, U+2029, NUL and lone
 * surrogates), mixed with any code point and any printable ASCII character.
 */
var C = String.fromCharCode,
  specials = ['&', '<', '>', '"', '\'', ';', '#', '%', '}', '}}', '%}', '#}', 'amp;', 'lt;', 'gt;', 'quot;',
    '#39;', '&amp;', '&lt;', '&#39', '&quot', '\\', '\\"', '\n', '\r', '\r\n', '\t', C(0), C(0x2028),
    C(0x2029), C(0xD800), C(0xDC00)],
  text = fc.string({
    unit: fc.oneof(
      fc.constantFrom.apply(fc, specials),
      fc.string({ unit: 'binary', minLength: 1, maxLength: 1 }),
      fc.string({ unit: 'grapheme-ascii', minLength: 1, maxLength: 1 })
    ),
    maxLength: 30
  }),
  // Without a brace, no variable, tag or comment can open.
  plainText = text.map(function (s) { return s.replace(/\{/g, '('); });

var flavors = [
  { name: 'swig', Ctor: swig.Swig, filters: nativeFilters },
  { name: 'swig-twig', Ctor: twig.Twig, filters: twig.filters },
  { name: 'swig-jinja2', Ctor: jinja2.Jinja2, filters: jinja2.filters },
  { name: 'swig-django', Ctor: django.Django, filters: django.filters }
];

/*!
 * The parsers read CRLF as LF, and the code generator writes a lone CR as
 * LF, so text and filenames are compared with line endings normalised.
 */
function eol(s) {
  return s.replace(/\r\n?/g, '\n');
}

function crToLf(s) {
  return s.replace(/\r/g, '\n');
}

flavors.forEach(function (f) {
  var e = f.filters.e;

  describe(f.name + ' — properties', function () {
    it('the e filter is idempotent', function () {
      check(fc.property(text, function (s) {
        return e(e(s)) === e(s);
      }));
    });

    it('the e filter leaves no raw < > " \' and every & starts an entity', function () {
      check(fc.property(text, function (s) {
        var out = e(s);
        return !/[<>"']/.test(out) && !/&(?!amp;|lt;|gt;|quot;|#39;)/.test(out);
      }));
    });

    it('{{ x }} renders the escaped string', function () {
      var tpl = new f.Ctor({ cache: false }).compile('{{ x }}');
      check(fc.property(text, function (s) {
        return tpl({ x: s }) === e(s);
      }));
    });

    it('text with no tag renders unchanged, apart from line endings', function () {
      var inst = new f.Ctor({ cache: false }),
        input = plainText;
      if (f.name === 'swig') {
        // Native swig drops a text chunk that ends with the comment close
        // #} (inherited from the original project); the other flavors keep
        // it. Such text is left out here until that is fixed.
        input = plainText.filter(function (s) { return !/#\}$/.test(s); });
      }
      check(fc.property(input, function (s) {
        return eol(inst.render(s)) === eol(s);
      }));
    });

    it('any template filename reaches the loader unchanged through an include', function () {
      // The include writes the filename into a string literal of the
      // compiled template: no character of it may end that literal early.
      var seen = [],
        inst = new f.Ctor({
          cache: false,
          loader: {
            resolve: function (to, from) {
              seen.push(from);
              return to;
            },
            load: function (id, cb) {
              var src = id === 'b.html' ? 'B' : '';
              if (cb) {
                cb(null, src);
                return;
              }
              return src;
            }
          }
        });
      check(fc.property(text, function (s) {
        var out;
        seen.length = 0;
        out = inst.compile('{% include "b.html" %}', { filename: s })({});
        return out === 'B' && seen.length === 1 && typeof seen[0] === 'string' && crToLf(seen[0]) === crToLf(s);
      }));
    });
  });
});

describe('swig-core isIn — properties', function () {
  var item = fc.oneof(
      fc.integer({ min: -3, max: 3 }),
      fc.constantFrom('', '0', '1', '-1', '2', 'a', ' '),
      fc.string({ maxLength: 2 })
    ),
    list = fc.array(item, { maxLength: 6 });

  ['jinja2', 'django'].forEach(function (mode) {
    it(mode + ': a list holds x when an item is === x, and not in negates in', function () {
      check(fc.property(item, list, function (x, arr) {
        var found = utils.isIn(x, arr, mode);
        return found === arr.some(function (y) { return y === x; }) && utils.isIn(x, arr, mode, true) === !found;
      }));
    });
  });

  it('twig: a list holds x when an item is == x, and not in negates in', function () {
    check(fc.property(item, list, function (x, arr) {
      var found = utils.isIn(x, arr, 'twig');
      return found === arr.some(function (y) { return y == x; }) && utils.isIn(x, arr, 'twig', true) === !found;
    }));
  });
});
