var swig = require('../../lib/swig'),
  twig = require('../../packages/swig-twig'),
  jinja2 = require('../../packages/swig-jinja2'),
  django = require('../../packages/swig-django'),
  loaders = require('../../packages/swig-core/lib/loaders'),
  expect = require('../lib/expect.js');

/*!
 * A macro parameter or a macro of a sync import named like an Object.prototype
 * member (toString, valueOf, hasOwnProperty) or like a name the compiled code
 * uses (_parentTpl, _parentResult) reads its argument or the macro; after a
 * loop over such a name the context no longer holds it. Plain names, a global
 * (Math) and own keys are the controls.
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
    name: "Macro parameters and macros of a sync import",
    cases: [
      {
        label: "macro m(toString) read",
        flavor: "native",
        src: "{% macro m(toString) %}[{{ toString }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "macro m(toString) read",
        flavor: "twig",
        src: "{% macro m(toString) %}[{{ toString }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "macro m(toString) read",
        flavor: "jinja2",
        src: "{% macro m(toString) %}[{{ toString }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "macro m(valueOf) read",
        flavor: "native",
        src: "{% macro m(valueOf) %}[{{ valueOf }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "macro m(valueOf) read",
        flavor: "twig",
        src: "{% macro m(valueOf) %}[{{ valueOf }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "macro m(valueOf) read",
        flavor: "jinja2",
        src: "{% macro m(valueOf) %}[{{ valueOf }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "macro m(hasOwnProperty) read",
        flavor: "native",
        src: "{% macro m(hasOwnProperty) %}[{{ hasOwnProperty }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "macro m(hasOwnProperty) read",
        flavor: "twig",
        src: "{% macro m(hasOwnProperty) %}[{{ hasOwnProperty }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "macro m(hasOwnProperty) read",
        flavor: "jinja2",
        src: "{% macro m(hasOwnProperty) %}[{{ hasOwnProperty }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "macro m(_parentTpl) read",
        flavor: "native",
        src: "{% macro m(_parentTpl) %}[{{ _parentTpl }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "macro m(_parentTpl) read",
        flavor: "twig",
        src: "{% macro m(_parentTpl) %}[{{ _parentTpl }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "macro m(_parentTpl) read",
        flavor: "jinja2",
        src: "{% macro m(_parentTpl) %}[{{ _parentTpl }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "macro m(_parentResult) read",
        flavor: "native",
        src: "{% macro m(_parentResult) %}[{{ _parentResult }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "macro m(_parentResult) read",
        flavor: "twig",
        src: "{% macro m(_parentResult) %}[{{ _parentResult }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "macro m(_parentResult) read",
        flavor: "jinja2",
        src: "{% macro m(_parentResult) %}[{{ _parentResult }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "macro m(zz) read (control)",
        flavor: "native",
        src: "{% macro m(zz) %}[{{ zz }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "macro m(zz) read (control)",
        flavor: "twig",
        src: "{% macro m(zz) %}[{{ zz }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "macro m(zz) read (control)",
        flavor: "jinja2",
        src: "{% macro m(zz) %}[{{ zz }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "macro m(Math) read (control, renamed)",
        flavor: "native",
        src: "{% macro m(Math) %}[{{ Math }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "macro m(Math) read (control, renamed)",
        flavor: "twig",
        src: "{% macro m(Math) %}[{{ Math }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "macro m(Math) read (control, renamed)",
        flavor: "jinja2",
        src: "{% macro m(Math) %}[{{ Math }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "macro m(toString) call",
        flavor: "native",
        src: "{% macro m(toString) %}[{{ toString() }}]{% endmacro %}{{ m(f) }}",
        loc: function () { return { f: fnT }; },
        expect: ["[T]", "[T]"]
      },
      {
        label: "macro m(toString) call",
        flavor: "twig",
        src: "{% macro m(toString) %}[{{ toString() }}]{% endmacro %}{{ m(f) }}",
        loc: function () { return { f: fnT }; },
        expect: ["[T]", "[T]"]
      },
      {
        label: "macro m(toString) call",
        flavor: "jinja2",
        src: "{% macro m(toString) %}[{{ toString() }}]{% endmacro %}{{ m(f) }}",
        loc: function () { return { f: fnT }; },
        expect: ["[T]", "[T]"]
      },
      {
        label: "macro m(_parentTpl) call",
        flavor: "native",
        src: "{% macro m(_parentTpl) %}[{{ _parentTpl() }}]{% endmacro %}{{ m(f) }}",
        loc: function () { return { f: fnT }; },
        expect: ["[T]", "[T]"]
      },
      {
        label: "macro m(_parentTpl) call",
        flavor: "twig",
        src: "{% macro m(_parentTpl) %}[{{ _parentTpl() }}]{% endmacro %}{{ m(f) }}",
        loc: function () { return { f: fnT }; },
        expect: ["[T]", "[T]"]
      },
      {
        label: "macro m(_parentTpl) call",
        flavor: "jinja2",
        src: "{% macro m(_parentTpl) %}[{{ _parentTpl() }}]{% endmacro %}{{ m(f) }}",
        loc: function () { return { f: fnT }; },
        expect: ["[T]", "[T]"]
      },
      {
        label: "import: sibling macro _parentTpl()",
        flavor: "native",
        src: "{% import \"imp.html\" as s %}{{ s.a() }}",
        files: {"/imp.html":"{% macro _parentTpl() %}P{% endmacro %}{% macro a() %}[{{ _parentTpl() }}]{% endmacro %}"},
        loc: function () { return {}; },
        expect: ["[P]", "[P]"]
      },
      {
        label: "import: sibling macro _parentTpl()",
        flavor: "twig",
        src: "{% import \"imp.html\" as s %}{{ s.a() }}",
        files: {"/imp.html":"{% macro _parentTpl() %}P{% endmacro %}{% macro a() %}[{{ _parentTpl() }}]{% endmacro %}"},
        loc: function () { return {}; },
        expect: ["[P]", "[P]"]
      },
      {
        label: "import: sibling macro _parentTpl()",
        flavor: "jinja2",
        src: "{% import \"imp.html\" as s %}{{ s.a() }}",
        files: {"/imp.html":"{% macro _parentTpl() %}P{% endmacro %}{% macro a() %}[{{ _parentTpl() }}]{% endmacro %}"},
        loc: function () { return {}; },
        expect: ["[P]", "[P]"]
      },
      {
        label: "import: sibling macro _parentResult()",
        flavor: "native",
        src: "{% import \"imp.html\" as s %}{{ s.a() }}",
        files: {"/imp.html":"{% macro _parentResult() %}P{% endmacro %}{% macro a() %}[{{ _parentResult() }}]{% endmacro %}"},
        loc: function () { return {}; },
        expect: ["[P]", "[P]"]
      },
      {
        label: "import: sibling macro _parentResult()",
        flavor: "twig",
        src: "{% import \"imp.html\" as s %}{{ s.a() }}",
        files: {"/imp.html":"{% macro _parentResult() %}P{% endmacro %}{% macro a() %}[{{ _parentResult() }}]{% endmacro %}"},
        loc: function () { return {}; },
        expect: ["[P]", "[P]"]
      },
      {
        label: "import: sibling macro _parentResult()",
        flavor: "jinja2",
        src: "{% import \"imp.html\" as s %}{{ s.a() }}",
        files: {"/imp.html":"{% macro _parentResult() %}P{% endmacro %}{% macro a() %}[{{ _parentResult() }}]{% endmacro %}"},
        loc: function () { return {}; },
        expect: ["[P]", "[P]"]
      },
      {
        label: "import: sibling macro toString()",
        flavor: "native",
        src: "{% import \"imp.html\" as s %}{{ s.a() }}",
        files: {"/imp.html":"{% macro toString() %}P{% endmacro %}{% macro a() %}[{{ toString() }}]{% endmacro %}"},
        loc: function () { return {}; },
        expect: ["[P]", "[P]"]
      },
      {
        label: "import: sibling macro toString()",
        flavor: "twig",
        src: "{% import \"imp.html\" as s %}{{ s.a() }}",
        files: {"/imp.html":"{% macro toString() %}P{% endmacro %}{% macro a() %}[{{ toString() }}]{% endmacro %}"},
        loc: function () { return {}; },
        expect: ["[P]", "[P]"]
      },
      {
        label: "import: sibling macro toString()",
        flavor: "jinja2",
        src: "{% import \"imp.html\" as s %}{{ s.a() }}",
        files: {"/imp.html":"{% macro toString() %}P{% endmacro %}{% macro a() %}[{{ toString() }}]{% endmacro %}"},
        loc: function () { return {}; },
        expect: ["[P]", "[P]"]
      },
      {
        label: "import: sibling macro zz()",
        flavor: "native",
        src: "{% import \"imp.html\" as s %}{{ s.a() }}",
        files: {"/imp.html":"{% macro zz() %}P{% endmacro %}{% macro a() %}[{{ zz() }}]{% endmacro %}"},
        loc: function () { return {}; },
        expect: ["[P]", "[P]"]
      },
      {
        label: "import: sibling macro zz()",
        flavor: "twig",
        src: "{% import \"imp.html\" as s %}{{ s.a() }}",
        files: {"/imp.html":"{% macro zz() %}P{% endmacro %}{% macro a() %}[{{ zz() }}]{% endmacro %}"},
        loc: function () { return {}; },
        expect: ["[P]", "[P]"]
      },
      {
        label: "import: sibling macro zz()",
        flavor: "jinja2",
        src: "{% import \"imp.html\" as s %}{{ s.a() }}",
        files: {"/imp.html":"{% macro zz() %}P{% endmacro %}{% macro a() %}[{{ zz() }}]{% endmacro %}"},
        loc: function () { return {}; },
        expect: ["[P]", "[P]"]
      },
      {
        label: "for toString in xs, in the loop (control)",
        flavor: "native",
        src: "{% for toString in xs %}[{{ toString }}]{% endfor %}",
        loc: function () { return { xs: [1] }; },
        expect: ["[1]", "[1]"]
      },
      {
        label: "for toString in xs, in the loop (control)",
        flavor: "twig",
        src: "{% for toString in xs %}[{{ toString }}]{% endfor %}",
        loc: function () { return { xs: [1] }; },
        expect: ["[1]", "[1]"]
      },
      {
        label: "for toString in xs, in the loop (control)",
        flavor: "jinja2",
        src: "{% for toString in xs %}[{{ toString }}]{% endfor %}",
        loc: function () { return { xs: [1] }; },
        expect: ["[1]", "[1]"]
      },
      {
        label: "for toString in xs, in the loop (control)",
        flavor: "django",
        src: "{% for toString in xs %}[{{ toString }}]{% endfor %}",
        loc: function () { return { xs: [1] }; },
        expect: ["[1]", "[1]"]
      }
    ]
  },
  {
    name: "The context after a loop over such a name",
    cases: [
      {
        label: "read before and after for toString",
        flavor: "native",
        src: "[{{ toString }}]{% for toString in xs %}{% endfor %}[{{ toString }}]",
        loc: function () { return { xs: [1] }; },
        expect: ["[][]", "[][]"]
      },
      {
        label: "read before and after for toString",
        flavor: "twig",
        src: "[{{ toString }}]{% for toString in xs %}{% endfor %}[{{ toString }}]",
        loc: function () { return { xs: [1] }; },
        expect: ["[][]", "[][]"]
      },
      {
        label: "read before and after for toString",
        flavor: "jinja2",
        src: "[{{ toString }}]{% for toString in xs %}{% endfor %}[{{ toString }}]",
        loc: function () { return { xs: [1] }; },
        expect: ["[][]", "[][]"]
      },
      {
        label: "read before and after for toString",
        flavor: "django",
        src: "[{{ toString }}]{% for toString in xs %}{% endfor %}[{{ toString }}]",
        loc: function () { return { xs: [1] }; },
        expect: ["[][]", "[][]"]
      },
      {
        label: "read before and after for valueOf",
        flavor: "native",
        src: "[{{ valueOf }}]{% for valueOf in xs %}{% endfor %}[{{ valueOf }}]",
        loc: function () { return { xs: [1] }; },
        expect: ["[][]", "[][]"]
      },
      {
        label: "read before and after for valueOf",
        flavor: "twig",
        src: "[{{ valueOf }}]{% for valueOf in xs %}{% endfor %}[{{ valueOf }}]",
        loc: function () { return { xs: [1] }; },
        expect: ["[][]", "[][]"]
      },
      {
        label: "read before and after for valueOf",
        flavor: "jinja2",
        src: "[{{ valueOf }}]{% for valueOf in xs %}{% endfor %}[{{ valueOf }}]",
        loc: function () { return { xs: [1] }; },
        expect: ["[][]", "[][]"]
      },
      {
        label: "read before and after for valueOf",
        flavor: "django",
        src: "[{{ valueOf }}]{% for valueOf in xs %}{% endfor %}[{{ valueOf }}]",
        loc: function () { return { xs: [1] }; },
        expect: ["[][]", "[][]"]
      },
      {
        label: "read before and after for hasOwnProperty",
        flavor: "native",
        src: "[{{ hasOwnProperty }}]{% for hasOwnProperty in xs %}{% endfor %}[{{ hasOwnProperty }}]",
        loc: function () { return { xs: [1] }; },
        expect: ["[][]", "[][]"]
      },
      {
        label: "read before and after for hasOwnProperty",
        flavor: "twig",
        src: "[{{ hasOwnProperty }}]{% for hasOwnProperty in xs %}{% endfor %}[{{ hasOwnProperty }}]",
        loc: function () { return { xs: [1] }; },
        expect: ["[][]", "[][]"]
      },
      {
        label: "read before and after for hasOwnProperty",
        flavor: "jinja2",
        src: "[{{ hasOwnProperty }}]{% for hasOwnProperty in xs %}{% endfor %}[{{ hasOwnProperty }}]",
        loc: function () { return { xs: [1] }; },
        expect: ["[][]", "[][]"]
      },
      {
        label: "read before and after for hasOwnProperty",
        flavor: "django",
        src: "[{{ hasOwnProperty }}]{% for hasOwnProperty in xs %}{% endfor %}[{{ hasOwnProperty }}]",
        loc: function () { return { xs: [1] }; },
        expect: ["[][]", "[][]"]
      },
      {
        label: "if valueOf after its loop",
        flavor: "native",
        src: "{% for valueOf in xs %}{% endfor %}[{% if valueOf %}Y{% endif %}]",
        loc: function () { return { xs: [1] }; },
        expect: ["[]", "[]"]
      },
      {
        label: "if valueOf after its loop",
        flavor: "twig",
        src: "{% for valueOf in xs %}{% endfor %}[{% if valueOf %}Y{% endif %}]",
        loc: function () { return { xs: [1] }; },
        expect: ["[]", "[]"]
      },
      {
        label: "if valueOf after its loop",
        flavor: "jinja2",
        src: "{% for valueOf in xs %}{% endfor %}[{% if valueOf %}Y{% endif %}]",
        loc: function () { return { xs: [1] }; },
        expect: ["[]", "[]"]
      },
      {
        label: "if valueOf after its loop",
        flavor: "django",
        src: "{% for valueOf in xs %}{% endfor %}[{% if valueOf %}Y{% endif %}]",
        loc: function () { return { xs: [1] }; },
        expect: ["[]", "[]"]
      },
      {
        label: "loop filter, read after",
        flavor: "jinja2",
        src: "{% for toString in xs if toString %}{% endfor %}[{{ toString }}]",
        loc: function () { return { xs: [1] }; },
        expect: ["[]", "[]"]
      },
      {
        label: "read after for zz (control)",
        flavor: "native",
        src: "[{{ zz }}]{% for zz in xs %}{% endfor %}[{{ zz }}]",
        loc: function () { return { xs: [1] }; },
        expect: ["[][]", "[][]"]
      },
      {
        label: "read after for zz (control)",
        flavor: "twig",
        src: "[{{ zz }}]{% for zz in xs %}{% endfor %}[{{ zz }}]",
        loc: function () { return { xs: [1] }; },
        expect: ["[][]", "[][]"]
      },
      {
        label: "read after for zz (control)",
        flavor: "jinja2",
        src: "[{{ zz }}]{% for zz in xs %}{% endfor %}[{{ zz }}]",
        loc: function () { return { xs: [1] }; },
        expect: ["[][]", "[][]"]
      },
      {
        label: "read after for zz (control)",
        flavor: "django",
        src: "[{{ zz }}]{% for zz in xs %}{% endfor %}[{{ zz }}]",
        loc: function () { return { xs: [1] }; },
        expect: ["[][]", "[][]"]
      },
      {
        label: "read after for Math (control)",
        flavor: "native",
        src: "{% for Math in xs %}{% endfor %}[{{ Math.PI }}]",
        loc: function () { return { xs: [1] }; },
        expect: ["[3.141592653589793]", "[3.141592653589793]"]
      },
      {
        label: "read after for Math (control)",
        flavor: "twig",
        src: "{% for Math in xs %}{% endfor %}[{{ Math.PI }}]",
        loc: function () { return { xs: [1] }; },
        expect: ["[3.141592653589793]", "[3.141592653589793]"]
      },
      {
        label: "read after for Math (control)",
        flavor: "jinja2",
        src: "{% for Math in xs %}{% endfor %}[{{ Math.PI }}]",
        loc: function () { return { xs: [1] }; },
        expect: ["[3.141592653589793]", "[3.141592653589793]"]
      }
    ]
  }
];

describe('Bindings named like Object.prototype members or names the compiled code uses', function () {
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
