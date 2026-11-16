var swig = require('../../lib/swig'),
  twig = require('../../packages/swig-twig'),
  jinja2 = require('../../packages/swig-jinja2'),
  django = require('../../packages/swig-django'),
  loaders = require('../../packages/swig-core/lib/loaders'),
  expect = require('../lib/expect.js');

/*!
 * An included template given a string or a number with `only` as its whole
 * context still reads a JavaScript global (Math, JSON) a template names; an
 * object context and names the context lacks are the controls.
 * Each case runs on the sync and the async render paths; the expectations
 * are generated and were checked against recorded renders of the same shapes.
 */
var CTORS = { native: swig.Swig, twig: twig.Twig, jinja2: jinja2.Jinja2, django: django.Django };

function fnT() { return 'T'; }
function fnTrue() { return true; }
function fnList() { return [1, 2]; }

// A native tag that writes the argument fragments it receives into the output.
function showParse(str, line, parser) { return parser && true; }
function showCompile(compiler, args) { return '_output += String(' + args.join('') + ');\n'; }

function make(f, src, files, isAsync) {
  var map = { '/page.html': src }, mem, loader, s;
  Object.keys(files || {}).forEach(function (k) { map[k] = files[k]; });
  mem = loaders.memory(map, '/');
  loader = mem;
  if (isAsync) {
    loader = {
      async: true,
      resolve: mem.resolve,
      load: function (id, cb) {
        if (!cb) { return mem.load(id); }
        setImmediate(function () {
          var text;
          try { text = mem.load(id); } catch (e) { cb(e); return; }
          cb(null, text);
        });
      }
    };
  }
  s = new CTORS[f]({ loader: loader, cache: false });
  if (f === 'native') { s.setTag('show', showParse, showCompile, false, false); }
  return s;
}

function renderSync(c) {
  try { return make(c.flavor, c.src, c.files, false).renderFile('/page.html', c.loc()); } catch (e) { return 'THROW ' + e.message; }
}

function renderAsync(c) {
  return new Promise(function (resolve) {
    try {
      make(c.flavor, c.src, c.files, true).renderFile('/page.html', c.loc(), function (err, out) {
        resolve(err ? 'THROW ' + err.message : out);
      });
    } catch (e) { resolve('THROW ' + e.message); }
  });
}

var GROUPS = [
  {
    name: "An include given a string or a number with only",
    cases: [
      {
        label: "include with s only, s a string: Math.round",
        flavor: "native",
        src: "{% include \"p.html\" with s only %}",
        files: {"/p.html":"[{{ Math.round(1.5) }}]"},
        loc: function () { return { s: 'abc' }; },
        expect: ["[2]", "[2]"]
      },
      {
        label: "include with s only, s a string: Math.round",
        flavor: "twig",
        src: "{% include \"p.html\" with s only %}",
        files: {"/p.html":"[{{ Math.round(1.5) }}]"},
        loc: function () { return { s: 'abc' }; },
        expect: ["[2]", "[2]"]
      },
      {
        label: "include with n only, n a number: JSON",
        flavor: "native",
        src: "{% include \"p.html\" with n only %}",
        files: {"/p.html":"[{{ JSON.stringify(1) }}]"},
        loc: function () { return { n: 5 }; },
        expect: ["[1]", "[1]"]
      },
      {
        label: "include with n only, n a number: JSON",
        flavor: "twig",
        src: "{% include \"p.html\" with n only %}",
        files: {"/p.html":"[{{ JSON.stringify(1) }}]"},
        loc: function () { return { n: 5 }; },
        expect: ["[1]", "[1]"]
      },
      {
        label: "include with s only: for Math in",
        flavor: "native",
        src: "{% include \"p.html\" with s only %}",
        files: {"/p.html":"{% for Math in [1] %}[{{ Math }}]{% endfor %}"},
        loc: function () { return { s: 'abc' }; },
        expect: ["THROW Cannot set properties of undefined (setting 'key')", "THROW Cannot set properties of undefined (setting 'key')"]
      },
      {
        label: "include with s only: for Math in",
        flavor: "twig",
        src: "{% include \"p.html\" with s only %}",
        files: {"/p.html":"{% for Math in [1] %}[{{ Math }}]{% endfor %}"},
        loc: function () { return { s: 'abc' }; },
        expect: ["THROW Cannot set properties of undefined (setting 'key')", "THROW Cannot set properties of undefined (setting 'key')"]
      },
      {
        label: "include with o only, o {} (control)",
        flavor: "native",
        src: "{% include \"p.html\" with o only %}",
        files: {"/p.html":"[{{ Math.round(1.5) }}]"},
        loc: function () { return { o: {} }; },
        expect: ["[2]", "[2]"]
      },
      {
        label: "include with o only, o {} (control)",
        flavor: "twig",
        src: "{% include \"p.html\" with o only %}",
        files: {"/p.html":"[{{ Math.round(1.5) }}]"},
        loc: function () { return { o: {} }; },
        expect: ["[2]", "[2]"]
      },
      {
        label: "include with s only: zz (control)",
        flavor: "native",
        src: "{% include \"p.html\" with s only %}",
        files: {"/p.html":"[{{ zz }}][{{ length }}]"},
        loc: function () { return { s: 'abc' }; },
        expect: ["[][3]", "[][3]"]
      },
      {
        label: "include with s only: zz (control)",
        flavor: "twig",
        src: "{% include \"p.html\" with s only %}",
        files: {"/p.html":"[{{ zz }}][{{ length }}]"},
        loc: function () { return { s: 'abc' }; },
        expect: ["[][3]", "[][3]"]
      }
    ]
  }
];

describe('A template rendered with a context that is not an object', function () {
  GROUPS.forEach(function (g) {
    describe(g.name, function () {
      g.cases.forEach(function (c) {
        it(c.label + ' (' + c.flavor + ', sync)', function () {
          expect(renderSync(c)).to.equal(c.expect[0]);
        });
        it(c.label + ' (' + c.flavor + ', async)', function () {
          return renderAsync(c).then(function (out) { expect(out).to.equal(c.expect[1]); });
        });
      });
    });
  });
});
