var swig = require('../../lib/swig'),
  twig = require('../../packages/swig-twig'),
  jinja2 = require('../../packages/swig-jinja2'),
  django = require('../../packages/swig-django'),
  loaders = require('../../packages/swig-core/lib/loaders'),
  expect = require('../lib/expect.js');

/*!
 * An included template given a function with `only` as its whole context
 * reads the keys the function holds, as it reads those of an object: after a
 * loop named like a JavaScript global the function keeps its own key of that
 * name, and its own key of such a name holding null reads as empty; an object
 * context is the control.
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

function withAfter(c, loc, out) { return c.after ? out + ' ' + c.after(loc) : out; }

function renderSync(c) {
  var loc = c.loc(), out;
  try { out = make(c.flavor, c.src, c.files, false).renderFile('/page.html', loc); } catch (e) { out = 'THROW ' + e.message; }
  return withAfter(c, loc, out);
}

function renderAsync(c) {
  var loc = c.loc();
  return new Promise(function (resolve) {
    try {
      make(c.flavor, c.src, c.files, true).renderFile('/page.html', loc, function (err, out) {
        resolve(withAfter(c, loc, err ? 'THROW ' + err.message : out));
      });
    } catch (e) { resolve(withAfter(c, loc, 'THROW ' + e.message)); }
  });
}

var GROUPS = [
  {
    name: "An include given a function or an object with only",
    cases: [
      {
        label: "function context: a loop named module",
        flavor: "native",
        src: "{% include \"p.html\" with fn only %}",
        files: {"/p.html":"[{{ module }}]{% for module in xs %}{% endfor %}[{{ module }}]"},
        loc: function () { var f = function () { return 0; }; f.module = 'M'; f.xs = [1]; f.JSON = null; return { fn: f }; },
        after: function (L) { return '(module in fn: ' + ('module' in L.fn) + ')'; },
        expect: ["[M][M] (module in fn: true)", "[M][M] (module in fn: true)"]
      },
      {
        label: "function context: a loop named module",
        flavor: "twig",
        src: "{% include \"p.html\" with fn only %}",
        files: {"/p.html":"[{{ module }}]{% for module in xs %}{% endfor %}[{{ module }}]"},
        loc: function () { var f = function () { return 0; }; f.module = 'M'; f.xs = [1]; f.JSON = null; return { fn: f }; },
        after: function (L) { return '(module in fn: ' + ('module' in L.fn) + ')'; },
        expect: ["[M][M] (module in fn: true)", "[M][M] (module in fn: true)"]
      },
      {
        label: "object context: a loop named module (control)",
        flavor: "native",
        src: "{% include \"p.html\" with fn only %}",
        files: {"/p.html":"[{{ module }}]{% for module in xs %}{% endfor %}[{{ module }}]"},
        loc: function () { return { fn: { module: 'M', xs: [1], JSON: null } }; },
        after: function (L) { return '(module in fn: ' + ('module' in L.fn) + ')'; },
        expect: ["[M][M] (module in fn: true)", "[M][M] (module in fn: true)"]
      },
      {
        label: "object context: a loop named module (control)",
        flavor: "twig",
        src: "{% include \"p.html\" with fn only %}",
        files: {"/p.html":"[{{ module }}]{% for module in xs %}{% endfor %}[{{ module }}]"},
        loc: function () { return { fn: { module: 'M', xs: [1], JSON: null } }; },
        after: function (L) { return '(module in fn: ' + ('module' in L.fn) + ')'; },
        expect: ["[M][M] (module in fn: true)", "[M][M] (module in fn: true)"]
      },
      {
        label: "function context: a JSON key holding null",
        flavor: "native",
        src: "{% include \"p.html\" with fn only %}",
        files: {"/p.html":"[{{ JSON }}]"},
        loc: function () { var f = function () { return 0; }; f.module = 'M'; f.xs = [1]; f.JSON = null; return { fn: f }; },
        expect: ["[]", "[]"]
      },
      {
        label: "function context: a JSON key holding null",
        flavor: "twig",
        src: "{% include \"p.html\" with fn only %}",
        files: {"/p.html":"[{{ JSON }}]"},
        loc: function () { var f = function () { return 0; }; f.module = 'M'; f.xs = [1]; f.JSON = null; return { fn: f }; },
        expect: ["[]", "[]"]
      },
      {
        label: "object context: a JSON key holding null (control)",
        flavor: "native",
        src: "{% include \"p.html\" with fn only %}",
        files: {"/p.html":"[{{ JSON }}]"},
        loc: function () { return { fn: { module: 'M', xs: [1], JSON: null } }; },
        expect: ["[]", "[]"]
      },
      {
        label: "object context: a JSON key holding null (control)",
        flavor: "twig",
        src: "{% include \"p.html\" with fn only %}",
        files: {"/p.html":"[{{ JSON }}]"},
        loc: function () { return { fn: { module: 'M', xs: [1], JSON: null } }; },
        expect: ["[]", "[]"]
      }
    ]
  }
];

describe('An include given a function as its whole context', function () {
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
