var jinja2 = require('@rhinostone/swig-jinja2'),
  filters = require('@rhinostone/swig-jinja2/lib/filters'),
  expect = require('../lib/expect.js');

// Generated. Each output equals Jinja2 3.1.6's, except where Jinja2 raises and swig is lenient, where a
// None value reads as an empty string in swig (documented) and Jinja2 prints None or raises, and for the date
// filter, which Jinja2 does not have. Each shape: [template, locals factory, expected output].
var SHAPES = [
  ["[{{ items|first|lower }}]", function () { return { items: [] }; }, "[]"],
  ["[{{ items|first|upper }}]", function () { return { items: [] }; }, "[]"],
  ["[{{ items|first|title }}]", function () { return { items: [] }; }, "[]"],
  ["[{{ items|first|capitalize }}]", function () { return { items: [] }; }, "[]"],
  ["[{{ items|first|trim }}]", function () { return { items: [] }; }, "[]"],
  ["[{{ items|first|striptags }}]", function () { return { items: [] }; }, "[]"],
  ["[{{ items|first|urlencode }}]", function () { return { items: [] }; }, "[]"],
  ["[{{ items|first|truncate(5) }}]", function () { return { items: [] }; }, "[]"],
  ["[{{ items|first|center(4) }}]", function () { return { items: [] }; }, "[    ]"],
  ["[{{ items|first|length }}]", function () { return { items: [] }; }, "[0]"],
  ["[{{ items|first|count }}]", function () { return { items: [] }; }, "[0]"],
  ["[{{ items|first|first }}]", function () { return { items: [] }; }, "[]"],
  ["[{{ items|first|last }}]", function () { return { items: [] }; }, "[]"],
  ["[{{ items|first|escape }}]", function () { return { items: [] }; }, "[]"],
  ["[{{ items|first|e }}]", function () { return { items: [] }; }, "[]"],
  ["[{{ items|first|default(\"d\") }}]", function () { return { items: [] }; }, "[d]"],
  ["[{{ items|first|wordcount }}]", function () { return { items: [] }; }, "[0]"],
  ["[{{ items|first|random }}]", function () { return { items: [] }; }, "[]"],
  ["[{{ items|first|max }}]", function () { return { items: [] }; }, "[]"],
  ["[{{ items|first|min }}]", function () { return { items: [] }; }, "[]"],
  ["[{{ items|first|format }}]", function () { return { items: [] }; }, "[]"],
  ["[{{ items|first|join(\",\") }}]", function () { return { items: [] }; }, "[]"],
  ["[{{ items|first|replace(\"a\", \"b\") }}]", function () { return { items: [] }; }, "[]"],
  ["[{{ items|first|wordwrap(5) }}]", function () { return { items: [] }; }, "[]"],
  ["[{{ items|first|indent(2) }}]", function () { return { items: [] }; }, "[]"],
  ["[{{ items|first|round(1) }}]", function () { return { items: [] }; }, "[]"],
  ["[{{ items|first|abs }}]", function () { return { items: [] }; }, "[]"],
  ["[{{ x|lower }}]", function () { return {}; }, "[]"],
  ["[{{ x|upper }}]", function () { return {}; }, "[]"],
  ["[{{ x|length }}]", function () { return {}; }, "[0]"],
  ["[{{ x|count }}]", function () { return {}; }, "[0]"],
  ["[{{ x|truncate(5) }}]", function () { return {}; }, "[]"],
  ["[{{ x|center(4) }}]", function () { return {}; }, "[    ]"],
  ["[{{ x|urlencode }}]", function () { return {}; }, "[]"],
  ["[{{ x|title }}]", function () { return {}; }, "[]"],
  ["[{{ x|capitalize }}]", function () { return {}; }, "[]"],
  ["[{{ x|indent(2) }}]", function () { return {}; }, "[]"],
  ["[{{ \"\"|length }}]", function () { return {}; }, "[0]"],
  ["[{{ \"\"|count }}]", function () { return {}; }, "[0]"],
  ["[{{ s|length }}]", function () { return { s: 'abc' }; }, "[3]"],
  ["[{{ l|length }}]", function () { return { l: [1, 2] }; }, "[2]"],
  ["[{{ o|length }}]", function () { return { o: { a: 1 } }; }, "[1]"],
  ["[{{ x|lower }}]", function () { return { x: null }; }, "[]"],
  ["[{{ f()|lower }}]", function () { return { f: function () { return null; } }; }, "[]"],
  ["[{{ items|first|lower }}]", function () { return { items: [null] }; }, "[]"],
  ["[{{ x|upper }}]", function () { return { x: null }; }, "[]"],
  ["[{{ f()|upper }}]", function () { return { f: function () { return null; } }; }, "[]"],
  ["[{{ items|first|upper }}]", function () { return { items: [null] }; }, "[]"],
  ["[{{ x|title }}]", function () { return { x: null }; }, "[]"],
  ["[{{ f()|title }}]", function () { return { f: function () { return null; } }; }, "[]"],
  ["[{{ items|first|title }}]", function () { return { items: [null] }; }, "[]"],
  ["[{{ x|capitalize }}]", function () { return { x: null }; }, "[]"],
  ["[{{ f()|capitalize }}]", function () { return { f: function () { return null; } }; }, "[]"],
  ["[{{ items|first|capitalize }}]", function () { return { items: [null] }; }, "[]"],
  ["[{{ x|trim }}]", function () { return { x: null }; }, "[]"],
  ["[{{ f()|trim }}]", function () { return { f: function () { return null; } }; }, "[]"],
  ["[{{ items|first|trim }}]", function () { return { items: [null] }; }, "[]"],
  ["[{{ x|striptags }}]", function () { return { x: null }; }, "[]"],
  ["[{{ f()|striptags }}]", function () { return { f: function () { return null; } }; }, "[]"],
  ["[{{ items|first|striptags }}]", function () { return { items: [null] }; }, "[]"],
  ["[{{ x|urlencode }}]", function () { return { x: null }; }, "[]"],
  ["[{{ f()|urlencode }}]", function () { return { f: function () { return null; } }; }, "[]"],
  ["[{{ items|first|urlencode }}]", function () { return { items: [null] }; }, "[]"],
  ["[{{ x|truncate(5) }}]", function () { return { x: null }; }, "[]"],
  ["[{{ f()|truncate(5) }}]", function () { return { f: function () { return null; } }; }, "[]"],
  ["[{{ items|first|truncate(5) }}]", function () { return { items: [null] }; }, "[]"],
  ["[{{ x|indent(2) }}]", function () { return { x: null }; }, "[]"],
  ["[{{ f()|indent(2) }}]", function () { return { f: function () { return null; } }; }, "[]"],
  ["[{{ items|first|indent(2) }}]", function () { return { items: [null] }; }, "[]"],
  ["[{{ f()|lower }}]", function () { return { f: function () {} }; }, "[]"],
  ["[{{ f()|upper }}]", function () { return { f: function () {} }; }, "[]"],
  ["[{{ f()|title }}]", function () { return { f: function () {} }; }, "[]"],
  ["[{{ f()|capitalize }}]", function () { return { f: function () {} }; }, "[]"],
  ["[{{ f()|trim }}]", function () { return { f: function () {} }; }, "[]"],
  ["[{{ f()|striptags }}]", function () { return { f: function () {} }; }, "[]"],
  ["[{{ f()|urlencode }}]", function () { return { f: function () {} }; }, "[]"],
  ["[{{ f()|truncate(5) }}]", function () { return { f: function () {} }; }, "[]"],
  ["[{{ x|center(6) }}]", function () { return { x: null }; }, "[      ]"],
  ["[{{ f()|center(6) }}]", function () { return { f: function () { return null; } }; }, "[      ]"],
  ["[{{ f()|length }}]", function () { return { f: function () { return null; } }; }, "[0]"],
  ["[{{ x|length }}]", function () { return { x: null }; }, "[0]"],
  ["[{{ f()|first }}]", function () { return { f: function () { return null; } }; }, "[]"],
  ["[{{ f()|last }}]", function () { return { f: function () {} }; }, "[]"],
  ["{% if items|first|lower %}Y{% endif %}.", function () { return { items: [] }; }, "."],
  ["{% set y = items|first|lower %}[{{ y }}]", function () { return { items: [] }; }, "[]"],
  ["{% for c in items|first|lower %}{{ c }}{% endfor %}.", function () { return { items: [] }; }, "."],
  ["[{{ \"ab\"|upper }}]", function () { return {}; }, "[AB]"],
  ["[{{ \"abcdefghijkl\"|truncate(9, True, \"\", 0) }}]", function () { return {}; }, "[abcdefghi]"],
  ["[{{ \"ab\"|center(4) }}]", function () { return {}; }, "[ ab ]"],
  ["[{{ \"a b\"|urlencode }}]", function () { return {}; }, "[a%20b]"],
  ["[{{ s|indent(2, True) }}]", function () { return { s: 'a' }; }, "[  a]"],
  ["[{{ f()|upper }}]", function () { return { f: function () { return 'ab'; } }; }, "[AB]"],
  ["[{{ items|first|upper }}]", function () { return { items: ['ab'] }; }, "[AB]"],
  ["[{{ x|date(\"Y\") }}]", function () { return {}; }, "[]"],
  ["[{{ x|date(\"Y\") }}]", function () { return { x: null }; }, "[]"],
  ["[{{ x|date(\"Y\") }}]", function () { return { x: '' }; }, "[]"],
  ["[{{ x|date(\"Y\") }}]", function () { return { x: 'nope' }; }, "[]"],
  ["[{{ x|date(\"Y\") }}]", function () { return { x: new Date(Date.UTC(2020, 5, 15)) }; }, "[2020]"],
  ["[{{ f()|date(\"Y\") }}]", function () { return { f: function () {} }; }, "[]"],
  ["[{{ f()|date(\"Y\") }}]", function () { return { f: function () { return null; } }; }, "[]"],
  ["[{{ items|first|date(\"Y\") }}]", function () { return { items: [] }; }, "[]"]
];

function renderAsync(src, locals) {
  return new Promise(function (resolve, reject) {
    var loader = { async: true, resolve: function (to) { return to; },
      load: function (id, cb) { if (!cb) { return src; } setImmediate(function () { cb(null, src); }); } };
    new jinja2.Jinja2({ cache: false, loader: loader }).renderFile('p.html', locals, function (err, out) {
      if (err) { reject(err); } else { resolve(out); }
    });
  });
}

describe('swig-jinja2 filter inputs that are undefined or null', function () {
  describe('direct calls', function () {
    ['lower', 'upper', 'title', 'capitalize', 'striptags', 'urlencode', 'truncate', 'indent'].forEach(function (name) {
      it(name + ' gives an empty string', function () {
        expect(filters[name](undefined)).to.equal('');
        expect(filters[name](null)).to.equal('');
      });
    });

    it('length and count give 0 for undefined, null and an empty string', function () {
      [filters.length, filters.count].forEach(function (fn) {
        expect(fn(undefined)).to.equal(0);
        expect(fn(null)).to.equal(0);
        expect(fn('')).to.equal(0);
        expect(fn('abc')).to.equal(3);
      });
    });

    it('wordcount gives 0', function () {
      expect(filters.wordcount(undefined)).to.equal(0);
      expect(filters.wordcount(null)).to.equal(0);
      expect(filters.wordcount('a b')).to.equal(2);
    });

    it('center pads an empty string', function () {
      expect(filters.center(undefined, 3)).to.equal('   ');
      expect(filters.center(null, 3)).to.equal('   ');
    });

    it('date gives an empty string for a value that is no date', function () {
      [undefined, null, '', 'nope', new Date(NaN)].forEach(function (input) {
        expect(filters.date(input, 'Y')).to.equal('');
      });
    });

    it('date still formats a date, a date string and a number', function () {
      expect(filters.date(new Date(Date.UTC(2020, 5, 15)), 'Y')).to.equal('2020');
      expect(filters.date('2020-06-15T00:00:00Z', 'Y')).to.equal('2020');
      expect(filters.date(0, 'Y')).to.equal('1970');
    });
  });

  describe('sync render', function () {
    SHAPES.forEach(function (shape) {
      it(shape[0] + ' over ' + JSON.stringify(shape[1]()) + ' gives ' + shape[2], function () {
        expect(new jinja2.Jinja2({ cache: false }).render(shape[0], { locals: shape[1]() })).to.equal(shape[2]);
      });
    });
  });

  describe('async render', function () {
    SHAPES.forEach(function (shape) {
      it(shape[0] + ' over ' + JSON.stringify(shape[1]()) + ' gives ' + shape[2], function () {
        return renderAsync(shape[0], shape[1]()).then(function (out) {
          expect(out).to.equal(shape[2]);
        });
      });
    });
  });
});
