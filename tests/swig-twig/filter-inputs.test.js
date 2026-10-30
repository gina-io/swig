var twig = require('@rhinostone/swig-twig'),
  filters = require('@rhinostone/swig-twig/lib/filters'),
  expect = require('../lib/expect.js');

function noop() {}
function nul() { return null; }

// The output of a date format over the current date, read before and after the call so that
// a year or a day that turns during the test does not fail it.
function isCurrent(fn) {
  var before = filters.date(new Date(), 'Y'),
    out = fn(),
    after = filters.date(new Date(), 'Y');
  expect(out === before || out === after).to.equal(true);
}

// Each shape: [template, locals factory, expected output]; CURRENT stands for the current year.
var CURRENT = {};
var SHAPES = [
  ['[{{ items|first|lower }}]', function () { return { items: [] }; }, '[]'],
  ['[{{ items|first|upper }}]', function () { return { items: [] }; }, '[]'],
  ['[{{ items|last|upper }}]', function () { return { items: [] }; }, '[]'],
  ['[{{ items|first|upper }}]', function () { return { items: [null] }; }, '[]'],
  ['[{{ items|first|striptags }}]', function () { return { items: [] }; }, '[]'],
  ['[{{ items|first|url_encode }}]', function () { return { items: [] }; }, '[]'],
  ['[{{ items|first|first }}]', function () { return { items: [] }; }, '[]'],
  ['[{{ items|first|last }}]', function () { return { items: [] }; }, '[]'],
  ['[{{ items|first|length }}]', function () { return { items: [] }; }, '[0]'],
  ['[{{ items|first|replace({"a": "b"}) }}]', function () { return { items: [] }; }, '[]'],
  ['[{{ f()|upper }}]', function () { return { f: noop }; }, '[]'],
  ['[{{ f()|upper }}]', function () { return { f: nul }; }, '[]'],
  ['[{{ f()|first }}]', function () { return { f: noop }; }, '[]'],
  ['[{{ f()|last }}]', function () { return { f: nul }; }, '[]'],
  ['[{{ f()|length }}]', function () { return { f: noop }; }, '[0]'],
  ['[{{ f()|trim|upper }}]', function () { return { f: noop }; }, '[]'],
  ['[{{ o.m()|lower }}]', function () { return { o: { m: noop } }; }, '[]'],
  ['{% if items|first|lower %}Y{% endif %}.', function () { return { items: [] }; }, '.'],
  ['{% set y = items|first|lower %}[{{ y }}]', function () { return { items: [] }; }, '[]'],
  ['{% for c in items|first|lower %}{{ c }}{% endfor %}.', function () { return { items: [] }; }, '.'],
  ['[{{ l|upper|join(",") }}]', function () { return { l: ['a', null, undefined] }; }, '[A,,]'],
  ['[{{ x|length }}]', function () { return {}; }, '[0]'],
  ['[{{ x|length }}]', function () { return { x: null }; }, '[0]'],
  ['[{{ ""|length }}]', function () { return {}; }, '[0]'],
  ['[{{ s|length }}]', function () { return { s: 'abc' }; }, '[3]'],
  ['[{{ l|length }}]', function () { return { l: [1, 2] }; }, '[2]'],
  ['[{{ "abc"|replace({"b": arr[0]}) }}]', function () { return { arr: [] }; }, '[ac]'],
  ['[{{ "abc"|replace({"b": f()}) }}]', function () { return { f: nul }; }, '[ac]'],
  ['[{{ "abc"|replace({"b": "x"}) }}]', function () { return {}; }, '[axc]'],
  ['[{{ "abc"|replace({"b": 0}) }}]', function () { return {}; }, '[a0c]'],
  ['[{{ x|date("Y") }}]', function () { return {}; }, CURRENT],
  ['[{{ x|date("Y") }}]', function () { return { x: null }; }, CURRENT],
  ['[{{ x|date("Y") }}]', function () { return { x: '' }; }, CURRENT],
  ['[{{ x|date("Y") }}]', function () { return { x: 'now' }; }, CURRENT],
  ['[{{ "now"|date("Y") }}]', function () { return {}; }, CURRENT],
  ['[{{ f()|date("Y") }}]', function () { return { f: noop }; }, CURRENT],
  ['[{{ f()|date("Y") }}]', function () { return { f: nul }; }, CURRENT],
  ['[{{ items|first|date("Y") }}]', function () { return { items: [] }; }, CURRENT],
  ['[{{ x|date("Y") }}]', function () { return { x: 'nope' }; }, '[]'],
  ['[{{ x|date("Y") }}]', function () { return { x: new Date(Date.UTC(2020, 5, 15)) }; }, '[2020]'],
  ['[{{ f()|upper }}]', function () { return { f: function () { return 'ab'; } }; }, '[AB]'],
  ['[{{ items|first|upper }}]', function () { return { items: ['ab'] }; }, '[AB]']
];

function check(out, want) {
  if (want === CURRENT) {
    isCurrent(function () { return out.replace(/^\[|\]$/g, ''); });
  } else {
    expect(out).to.equal(want);
  }
}

function label(shape) {
  return shape[0] + ' over ' + JSON.stringify(shape[1]()) + ' gives ' + (shape[2] === CURRENT ? 'the current date' : shape[2]);
}

function renderAsync(src, locals) {
  return new Promise(function (resolve, reject) {
    var loader = { async: true, resolve: function (to) { return to; },
      load: function (id, cb) { if (!cb) { return src; } setImmediate(function () { cb(null, src); }); } };
    new twig.Twig({ cache: false, loader: loader }).renderFile('p.html', locals, function (err, out) {
      if (err) { reject(err); } else { resolve(out); }
    });
  });
}

describe('swig-twig filter inputs that are undefined or null', function () {
  describe('direct calls', function () {
    ['first', 'last', 'lower', 'upper', 'striptags', 'url_encode'].forEach(function (name) {
      it(name + ' gives an empty string', function () {
        expect(filters[name](undefined)).to.equal('');
        expect(filters[name](null)).to.equal('');
      });
    });

    it('length gives 0 for undefined, null and an empty string', function () {
      expect(filters.length(undefined)).to.equal(0);
      expect(filters.length(null)).to.equal(0);
      expect(filters.length('')).to.equal(0);
      expect(filters.length('abc')).to.equal(3);
    });

    it('date gives the current date for undefined, null, an empty string and now', function () {
      [undefined, null, '', 'now'].forEach(function (input) {
        isCurrent(function () { return filters.date(input, 'Y'); });
      });
    });

    it('date gives an empty string for a value that is no date', function () {
      expect(filters.date('nope', 'Y')).to.equal('');
      expect(filters.date(new Date(NaN), 'Y')).to.equal('');
    });

    it('date still formats a date, a date string and a number', function () {
      expect(filters.date(new Date(Date.UTC(2020, 5, 15)), 'Y')).to.equal('2020');
      expect(filters.date('2020-06-15T00:00:00Z', 'Y')).to.equal('2020');
      expect(filters.date(0, 'Y')).to.equal('1970');
    });

    it('replace writes a replacement that is undefined or null as an empty string', function () {
      expect(filters.replace('abc', { b: undefined })).to.equal('ac');
      expect(filters.replace('abc', { b: null })).to.equal('ac');
      expect(filters.replace('abc', { b: 0 })).to.equal('a0c');
    });
  });

  describe('sync render', function () {
    SHAPES.forEach(function (shape) {
      it(label(shape), function () {
        check(new twig.Twig({ cache: false }).render(shape[0], { locals: shape[1]() }), shape[2]);
      });
    });
  });

  describe('async render', function () {
    SHAPES.forEach(function (shape) {
      it(label(shape), function () {
        return renderAsync(shape[0], shape[1]()).then(function (out) {
          check(out, shape[2]);
        });
      });
    });
  });
});
