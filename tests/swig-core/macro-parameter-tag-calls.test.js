var swig = require('../../lib/swig'),
  twig = require('../../packages/swig-twig'),
  jinja2 = require('../../packages/swig-jinja2'),
  django = require('../../packages/swig-django'),
  loaders = require('../../packages/swig-core/lib/loaders'),
  expect = require('../lib/expect.js');

/*!
 * A native tag registered with setTag receives the arguments of its call as
 * fragments of compiled code. A call there of a macro parameter named like a
 * JavaScript global, a name the compiled code uses or an Object.prototype
 * member, which the compiled macro binds in the context, renders an empty
 * string when the call gave no argument for it, as the call of a name that
 * holds nothing does; a plain name is the control.
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
    name: "A custom-tag call of a parameter that the call gave no argument",
    cases: [
      {
        label: "m(escape) show escape(\"x\")",
        flavor: "native",
        src: "{% macro m(escape) %}[{% show escape(\"x\") %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(_ext) show _ext(\"x\")",
        flavor: "native",
        src: "{% macro m(_ext) %}[{% show _ext(\"x\") %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(toString) show toString(\"x\")",
        flavor: "native",
        src: "{% macro m(toString) %}[{% show toString(\"x\") %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(zz) show zz(\"x\") (control)",
        flavor: "native",
        src: "{% macro m(zz) %}[{% show zz(\"x\") %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      }
    ]
  }
];

describe('A custom tag that calls a macro parameter that the call gave no argument', function () {
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
