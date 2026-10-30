var swig = require('../../lib/swig'),
  twig = require('@rhinostone/swig-twig'),
  jinja2 = require('@rhinostone/swig-jinja2'),
  expect = require('../lib/expect.js');

// A filter or call result that is undefined or null reads as an empty string at an arithmetic, ~ or
// unary operand. The swig-jinja2 rows marked same equal Jinja2 3.1.6's output; on the others Jinja2
// prints None or raises, where swig reads a None value as an empty string.
function noop() {}
function nul() { return null; }
function two() { return 2; }
function locals() {
  return { u: noop, f: nul, two: two, n: 3, items: [], one: [1], o: { m: noop, k: nul }, x: 1 };
}

var FLAVORS = [
  ['swig', function (o) { return new swig.Swig(o); }, [
    ['[{{ 1 + u() }}]', '[1]'], ['[{{ 1 + f() }}]', '[1]'], ['[{{ u() + 1 }}]', '[1]'], ['[{{ f() + 1 }}]', '[1]'],
    ['[{{ u() * 2 }}]', '[0]'], ['[{{ f() - 1 }}]', '[-1]'], ['[{{ -u() }}]', '[0]'], ['[{{ -f() }}]', '[0]'], ['[{{ +u() }}]', '[0]'],
    ['[{{ o.m() + 1 }}]', '[1]'], ['[{{ o.k() + 1 }}]', '[1]'], ['[{{ -o.m() }}]', '[0]'],
    ['[{{ 1 + n|first }}]', '[1]'], ['[{{ n|last + 1 }}]', '[1]'], ['[{{ -n|first }}]', '[0]'], ['[{{ 1 + items|first }}]', '[1]'],
    ['{% set y = 1 + u() %}[{{ y }}]', '[1]'], ['{% set y = -u() %}[{{ y }}]', '[0]'],
    ['{% if u() + 1 %}Y{% endif %}.', 'Y.'], ['{% if u() %}Y{% endif %}.', '.'],
    ['[{{ two() + 1 }}]', '[3]'], ['[{{ 1 + one|first }}]', '[2]'], ['[{{ -two() }}]', '[-2]'], ['[{{ x + 1 }}]', '[2]'],
    ['[{{ u()|default("d") }}]', '[d]'], ['[{{ f()|default("d") }}]', '[d]'], ['[{{ u() ? "y" : "n" }}]', '[n]']
  ]],
  ['swig-twig', function (o) { return new twig.Twig(o); }, [
    ['[{{ u() ~ "a" }}]', '[a]'], ['[{{ "a" ~ u() }}]', '[a]'], ['[{{ f() ~ "a" }}]', '[a]'], ['[{{ "a" ~ f() }}]', '[a]'],
    ['[{{ items|first ~ "a" }}]', '[a]'], ['[{{ "a" ~ items|first }}]', '[a]'], ['[{{ o.m() ~ "a" }}]', '[a]'],
    ['[{{ 1 + u() }}]', '[1]'], ['[{{ f() + 1 }}]', '[1]'], ['[{{ -u() }}]', '[0]'], ['[{{ -f() }}]', '[0]'], ['[{{ 1 + items|first }}]', '[1]'],
    ['{% set y = u() ~ "a" %}[{{ y }}]', '[a]'],
    ['[{{ two() ~ "a" }}]', '[2a]'], ['[{{ one|first ~ "a" }}]', '[1a]'], ['[{{ -two() }}]', '[-2]'],
    ['[{{ u() ?? "d" }}]', '[d]'], ['[{{ f() ?? "d" }}]', '[d]'], ['{% if u() is null %}Y{% endif %}.', 'Y.']
  ]],
  ['swig-jinja2', function (o) { return new jinja2.Jinja2(o); }, [
    ['[{{ items|first ~ "a" }}]', '[a]'], ['[{{ "a" ~ items|first }}]', '[a]'], // same
    ['[{{ u() ~ "a" }}]', '[a]'], ['[{{ f() ~ "a" }}]', '[a]'], ['[{{ "a" ~ f() }}]', '[a]'], ['[{{ o.m() ~ "a" }}]', '[a]'],
    ['[{{ 1 + u() }}]', '[1]'], ['[{{ f() + 1 }}]', '[1]'], ['[{{ -u() }}]', '[0]'], ['[{{ -(items|first) }}]', '[0]'], ['[{{ 1 + items|first }}]', '[1]'],
    ['{% set y = items|first ~ "a" %}[{{ y }}]', '[a]'], // same
    ['[{{ two() ~ "a" }}]', '[2a]'], ['[{{ one|first ~ "a" }}]', '[1a]'], ['[{{ -two() }}]', '[-2]'], // same
    ['{% if u() is none %}Y{% endif %}.', 'Y.'], ['[{{ u()|default("d") }}]', '[d]']
  ]]
];

function renderAsync(make, src) {
  return new Promise(function (resolve, reject) {
    var loader = { async: true, resolve: function (to) { return to; },
      load: function (id, cb) { if (!cb) { return src; } setImmediate(function () { cb(null, src); }); } };
    make({ cache: false, loader: loader }).renderFile('p.html', locals(), function (err, out) {
      if (err) { reject(err); } else { resolve(out); }
    });
  });
}

describe('Filter and call results at operands', function () {
  FLAVORS.forEach(function (flavor) {
    describe(flavor[0], function () {
      flavor[2].forEach(function (shape) {
        it(shape[0] + ' gives ' + shape[1], function () {
          expect(flavor[1]({ cache: false }).render(shape[0], { locals: locals() })).to.equal(shape[1]);
        });

        it(shape[0] + ' gives ' + shape[1] + ' on the async path', function () {
          return renderAsync(flavor[1], shape[0]).then(function (out) {
            expect(out).to.equal(shape[1]);
          });
        });
      });
    });
  });
});
