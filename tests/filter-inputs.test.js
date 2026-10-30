var swig = require('../lib/swig'),
  filters = require('../lib/filters'),
  expect = require('./lib/expect.js');

// Direct calls with sample arguments. The filters left out of EMPTY pass an undefined or null
// input through; an output or the next filter in a chain reads it as an empty string.
var ARGS = { date: ['Y'], replace: ['a', 'b'], join: [','], 'default': ['d'], groupBy: ['k'] };
var EMPTY = ['addslashes', 'capitalize', 'date', 'first', 'last', 'lower', 'replace', 'striptags', 'title', 'upper', 'url_encode', 'url_decode'];

function call(name, input) {
  return filters[name].apply(null, [input].concat(ARGS[name] || []));
}

// Each shape: [template, locals factory, expected output].
function noop() {}
function nul() { return null; }
var SHAPES = [
  ['[{{ items|first|lower }}]', function () { return { items: [] }; }, '[]'],
  ['[{{ items|first|upper }}]', function () { return { items: [] }; }, '[]'],
  ['[{{ items|last|title }}]', function () { return { items: [] }; }, '[]'],
  ['[{{ items|first|upper }}]', function () { return { items: [null] }; }, '[]'],
  ['[{{ items|first|capitalize }}]', function () { return { items: [] }; }, '[]'],
  ['[{{ items|first|addslashes }}]', function () { return { items: [] }; }, '[]'],
  ['[{{ items|first|striptags }}]', function () { return { items: [] }; }, '[]'],
  ['[{{ items|first|url_encode }}]', function () { return { items: [] }; }, '[]'],
  ['[{{ items|first|url_decode }}]', function () { return { items: [] }; }, '[]'],
  ['[{{ items|first|first }}]', function () { return { items: [] }; }, '[]'],
  ['[{{ items|first|last }}]', function () { return { items: [] }; }, '[]'],
  ['[{{ items|first|length }}]', function () { return { items: [] }; }, '[0]'],
  ['[{{ items|first|replace("a", "b") }}]', function () { return { items: [] }; }, '[]'],
  ['[{{ items|first|date("Y") }}]', function () { return { items: [] }; }, '[]'],
  ['[{{ f()|upper }}]', function () { return { f: noop }; }, '[]'],
  ['[{{ f()|upper }}]', function () { return { f: nul }; }, '[]'],
  ['[{{ f()|first }}]', function () { return { f: noop }; }, '[]'],
  ['[{{ f()|length }}]', function () { return { f: nul }; }, '[0]'],
  ['[{{ o.m()|lower }}]', function () { return { o: { m: noop } }; }, '[]'],
  ['{% if items|first|lower %}Y{% endif %}.', function () { return { items: [] }; }, '.'],
  ['{% set y = items|first|lower %}[{{ y }}]', function () { return { items: [] }; }, '[]'],
  ['{% for c in items|first|lower %}{{ c }}{% endfor %}.', function () { return { items: [] }; }, '.'],
  ['[{{ l|upper|join(",") }}]', function () { return { l: ['a', null, undefined] }; }, '[A,,]'],
  ['[{{ o|upper|json }}]', function () { return { o: { a: 'x', b: null } }; }, '[{"a":"X","b":""}]'],
  ['[{{ x|date("Y") }}]', function () { return {}; }, '[]'],
  ['[{{ x|date("Y") }}]', function () { return { x: null }; }, '[]'],
  ['[{{ x|date("Y") }}]', function () { return { x: '' }; }, '[]'],
  ['[{{ x|date("Y") }}]', function () { return { x: 'nope' }; }, '[]'],
  ['[{{ x|date("Y") }}]', function () { return { x: new Date(Date.UTC(2020, 5, 15)) }; }, '[2020]'],
  ['[{{ "abc"|replace("b", arr[0]) }}]', function () { return { arr: [] }; }, '[ac]'],
  ['[{{ "abc"|replace("b", f()) }}]', function () { return { f: nul }; }, '[ac]'],
  ['[{{ "abc"|replace("b", "x") }}]', function () { return {}; }, '[axc]'],
  ['[{{ n|replace("5", "6") }}]', function () { return { n: 5 }; }, '[6]'],
  ['[{{ n|addslashes }}]', function () { return { n: 5 }; }, '[5]'],
  ['[{{ f()|upper }}]', function () { return { f: function () { return 'ab'; } }; }, '[AB]'],
  ['[{{ s|upper }}]', function () { return { s: 'ab' }; }, '[AB]'],
  ['[{{ items|first|upper }}]', function () { return { items: ['ab'] }; }, '[AB]']
];

function renderAsync(src, locals) {
  return new Promise(function (resolve, reject) {
    var loader = { async: true, resolve: function (to) { return to; },
      load: function (id, cb) { if (!cb) { return src; } setImmediate(function () { cb(null, src); }); } };
    new swig.Swig({ cache: false, loader: loader }).renderFile('p.html', locals, function (err, out) {
      if (err) { reject(err); } else { resolve(out); }
    });
  });
}

describe('Filter inputs that are undefined or null', function () {
  describe('direct calls', function () {
    EMPTY.forEach(function (name) {
      it(name + ' gives an empty string', function () {
        expect(call(name, undefined)).to.equal('');
        expect(call(name, null)).to.equal('');
      });
    });

    it('length gives 0', function () {
      expect(filters.length(undefined)).to.equal(0);
      expect(filters.length(null)).to.equal(0);
    });

    it('replace and addslashes take a number', function () {
      expect(filters.replace(5, '5', '6')).to.equal('6');
      expect(filters.addslashes(5)).to.equal('5');
      expect(filters.addslashes(true)).to.equal('true');
    });

    it('replace still fails on an array or an object without a replace method', function () {
      expect(function () { filters.replace(['a'], 'a', 'b'); }).to.throwError(/input\.replace is not a function/);
      expect(function () { filters.replace({ k: 'a' }, 'a', 'b'); }).to.throwError(/input\.replace is not a function/);
      expect(function () { swig.render('{{ a|replace("a", "b") }}', { locals: { a: ['a'] } }); }).to.throwError(/input\.replace is not a function/);
    });

    it('replace still calls the replace method of an object that has one', function () {
      expect(filters.replace({ replace: function () { return 'own'; } }, 'a', 'b')).to.equal('own');
      expect(filters.replace(Object('abc'), 'b', 'x')).to.equal('axc');
    });

    it('replace reads a missing replacement as an empty string', function () {
      expect(filters.replace('abc', 'b', undefined)).to.equal('ac');
      expect(filters.replace('abc', 'b', null)).to.equal('ac');
      expect(filters.replace('abc', 'b', '')).to.equal('ac');
      expect(filters.replace('abc', 'b', 0)).to.equal('a0c');
    });

    it('date gives an empty string for a value that is no date', function () {
      expect(filters.date('', 'Y')).to.equal('');
      expect(filters.date('nope', 'Y')).to.equal('');
      expect(filters.date(new Date(NaN), 'Y')).to.equal('');
    });

    it('date still formats a date, a date string and a number', function () {
      expect(filters.date(new Date(Date.UTC(2020, 5, 15)), 'Y')).to.equal('2020');
      expect(filters.date('2020-06-15T00:00:00Z', 'Y')).to.equal('2020');
      expect(filters.date(0, 'Y')).to.equal('1970');
    });

    it('no catalog filter throws on undefined, null, a number or a boolean', function () {
      Object.keys(filters).forEach(function (name) {
        [undefined, null, 5, true].forEach(function (input) {
          expect(function () { call(name, input); }).to.not.throwError();
        });
      });
    });
  });

  describe('sync render', function () {
    SHAPES.forEach(function (shape) {
      it(shape[0] + ' over ' + JSON.stringify(shape[1]()) + ' gives ' + shape[2], function () {
        expect(new swig.Swig({ cache: false }).render(shape[0], { locals: shape[1]() })).to.equal(shape[2]);
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
