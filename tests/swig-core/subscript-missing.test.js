var swig = require('../../lib/swig'),
  twig = require('@rhinostone/swig-twig'),
  jinja2 = require('@rhinostone/swig-jinja2'),
  utils = require('@rhinostone/swig-core/lib/utils'),
  expect = require('../lib/expect.js');

/*!
 * A subscript or a member of a missing value gives undefined instead of
 * throwing, and reads as "" where it enters a filter or an arithmetic, `~`
 * or unary operand, as a missing variable does; a native or Twig output
 * that comes out undefined or null renders "". The Jinja2 expectations are
 * Jinja2 3.1's output for the same template, or "" where Jinja2 raises
 * UndefinedError; the Twig ones follow Twig, where a missing value is null
 * and null renders as "".
 */
var engines = { native: swig.Swig, twig: twig.Twig, jinja2: jinja2.Jinja2 },
  all = ['native', 'twig', 'jinja2'];

function render(flavor, src, locals) {
  return new engines[flavor]({ cache: false }).render(src, { locals: locals });
}

function renderAsync(flavor, src, locals, done) {
  var files = { '/t.html': src },
    eng = new engines[flavor]({
      cache: false,
      loader: {
        async: true,
        resolve: function (to) { return to; },
        load: function (id, cb) { setImmediate(function () { cb(null, files[id]); }); }
      }
    });
  eng.renderFile('/t.html', locals, done);
}

function check(cases) {
  cases.forEach(function (c) {
    c[0].forEach(function (flavor) {
      it(flavor + ': ' + c[1] + ' with ' + JSON.stringify(c[2]) + ' renders ' + c[3], function () {
        expect(render(flavor, c[1], c[2])).to.equal(c[3]);
      });
    });
  });
}

describe('swig-core — a subscript of a missing value', function () {

  describe('renders an empty string', function () {
    check([
      [all, '[{{ arr[0] }}]', {}, '[]'],
      [all, '[{{ arr[0] }}]', { arr: [] }, '[]'],
      [all, '[{{ obj["k"] }}]', { obj: {} }, '[]'],
      [all, '[{{ arr[i] }}]', { arr: [], i: 0 }, '[]'],
      [all, '[{{ a.b[0] }}]', { a: {} }, '[]'],
      [all, '[{{ arr[0].x }}]', { arr: [] }, '[]'],
      [all, '[{{ obj["k"].x }}]', { obj: {} }, '[]'],
      [all, '[{{ arr[0][1] }}]', { arr: [] }, '[]'],
      [all, '[{{ arr[5] }}]', { arr: 'abc' }, '[]'],
      [['native', 'twig'], '[{{ arr[0] }}]', { arr: [null] }, '[]']
    ]);
  });

  describe('reads as "" where it enters a filter', function () {
    check([
      [all, '[{{ arr[0]|upper }}]', { arr: [] }, '[]'],
      [all, '[{{ arr[0].x|default("d") }}]', { arr: [] }, '[d]'],
      [['native'], '[{{ arr[0]|length }}]', { arr: [] }, '[0]'],
      [['native', 'twig'], '[{{ arr[0]|upper }}]', { arr: [null] }, '[]'],
      [['twig', 'jinja2'], '{% set y = arr[0]|upper %}[{{ y }}]', { arr: [] }, '[]']
    ]);
  });

  describe('reads as "" where it is an arithmetic, ~ or unary operand', function () {
    check([
      [['native'], '[{{ arr[0] + "x" }}]', { arr: [] }, '[x]'],
      [['twig', 'jinja2'], '[{{ arr[0] ~ "x" }}]', { arr: [] }, '[x]'],
      [['twig'], '[{{ arr[0] ~ "x" }}]', { arr: [null] }, '[x]'],
      [['twig', 'jinja2'], '[{{ (arr[0]|upper) ~ "y" }}]', { arr: [] }, '[y]'],
      [['native', 'twig'], '[{{ arr[0] * 2 }}]', { arr: [] }, '[0]'],
      [['native', 'twig'], '[{{ arr[0] + 1 }}]', { arr: [] }, '[1]'],
      [['native', 'twig'], '[{{ -arr[0] }}]', { arr: [] }, '[0]']
    ]);
  });

  describe('keeps the value where it is tested or compared', function () {
    check([
      [['twig'], '[{{ arr[0] ?? "d" }}]', { arr: [] }, '[d]'],
      [['twig'], '[{{ arr[0] ?? "d" }}]', { arr: [0] }, '[0]'],
      [['jinja2'], '[{% if arr[0] is defined %}Y{% else %}N{% endif %}]', { arr: [] }, '[N]'],
      [['jinja2'], '[{% if arr[0] is none %}Y{% else %}N{% endif %}]', { arr: [null] }, '[Y]'],
      [all, '[{% if arr[0] == "" %}Y{% endif %}]', { arr: [] }, '[]'],
      [all, '[{{ arr[0]|upper }}]', { arr: ['ab'] }, '[AB]'],
      [all, '[{{ arr[0] * 2 }}]', { arr: [3] }, '[6]'],
      [all, '[{{ arr[0][0]|upper }}]', { arr: [['q']] }, '[Q]']
    ]);
  });

  describe('calls on a subscript', function () {
    check([
      [all, '[{{ arr[0].toUpperCase() }}]', { arr: ['ab'] }, '[AB]'],
      [all, '[{{ arr[0].foo() }}]', { arr: [] }, '[]'],
      [all, '[{{ arr[0].length() }}]', { arr: ['ab'] }, '[]']
    ]);
    all.forEach(function (flavor) {
      it(flavor + ': a function in a list is called with the list as its receiver', function () {
        expect(render(flavor, '[{{ fns[0](1) }}]', { fns: [function (a) { return this.length + a; }] })).to.equal('[2]');
      });
      it(flavor + ': a dangerous string key on a call still fails to compile', function () {
        expect(function () { render(flavor, '{{ x["constructor"]() }}', {}); }).to.throwException(/prototype-chain guard/);
      });
    });
  });

  describe('a native or Twig output that comes out undefined or null', function () {
    check([
      [['native', 'twig'], '[{{ c ? arr[0] : "y" }}]', { c: true, arr: [] }, '[]'],
      [['native', 'twig'], '[{{ c ? arr[0] : "y" }}]', { c: true, arr: [null] }, '[]']
    ]);
    ['native', 'twig'].forEach(function (flavor) {
      it(flavor + ': a function returning undefined or null renders ""', function () {
        expect(render(flavor, '[{{ f() }}|{{ g() }}]', { f: function () {}, g: function () { return null; } })).to.equal('[|]');
      });
    });
  });

  describe('on the async render path', function () {
    all.forEach(function (flavor) {
      ['[{{ arr[0].x }}]', '[{{ arr[0]|upper }}]', '[{{ arr[0][1] }}]'].forEach(function (src) {
        it(flavor + ': ' + src + ' renders []', function (done) {
          renderAsync(flavor, src, { arr: [] }, function (err, out) {
            if (err) { return done(err); }
            expect(out).to.equal('[]');
            done();
          });
        });
      });
    });
  });

  describe('_utils.access and _utils.callAccess', function () {
    it('access gives undefined for a null or undefined object', function () {
      expect(utils.access(null, 'a')).to.be(undefined);
      expect(utils.access(undefined, 0)).to.be(undefined);
      expect(utils.access([5], 0)).to.equal(5);
      expect(utils.access('ab', 1)).to.equal('b');
    });
    it('callAccess gives "" when there is nothing to call, and keeps the receiver', function () {
      expect(utils.callAccess(null, 'f', [])).to.equal('');
      expect(utils.callAccess({}, 'f', [])).to.equal('');
      expect(utils.callAccess({ f: 1 }, 'f', [])).to.equal('');
      expect(utils.callAccess({ n: 2, f: function (a) { return this.n + a; } }, 'f', [3])).to.equal(5);
    });
  });
});
