var swig = require('../../lib/swig'),
  twig = require('../../packages/swig-twig'),
  jinja2 = require('../../packages/swig-jinja2'),
  django = require('../../packages/swig-django'),
  loaders = require('../../packages/swig-core/lib/loaders'),
  expect = require('../lib/expect.js');

/*!
 * In swig-jinja2 a parameter default may read an earlier parameter, also one
 * named like a JavaScript global, a name the compiled code uses or an
 * Object.prototype member, which the compiled macro binds in the context;
 * plain names, a call without the argument, and such a parameter across a
 * recursive call or a loop over its name are the controls.
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
    name: "A default that reads an earlier parameter",
    cases: [
      {
        label: "m(process, b=process)",
        flavor: "jinja2",
        src: "{% macro m(process, b=process) %}[{{ b }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "m(_ext, b=_ext)",
        flavor: "jinja2",
        src: "{% macro m(_ext, b=_ext) %}[{{ b }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "m(toString, b=toString)",
        flavor: "jinja2",
        src: "{% macro m(toString, b=toString) %}[{{ b }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "m(__a0, b=__a0)",
        flavor: "jinja2",
        src: "{% macro m(__a0, b=__a0) %}[{{ b }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "m(zz, b=zz) (control)",
        flavor: "jinja2",
        src: "{% macro m(zz, b=zz) %}[{{ b }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "m(document, title=document.t)",
        flavor: "jinja2",
        src: "{% macro m(document, title=document.t) %}[{{ title }}]{% endmacro %}{{ m(d) }}",
        loc: function () { return { d: { t: 'T' } }; },
        expect: ["[T]", "[T]"]
      },
      {
        label: "m(process, b=process), the context holds process",
        flavor: "jinja2",
        src: "{% macro m(process, b=process) %}[{{ b }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return { process: 'CTX' }; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "m(zz, b=zz), the context holds zz (control)",
        flavor: "jinja2",
        src: "{% macro m(zz, b=zz) %}[{{ b }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return { zz: 'CTX' }; },
        expect: ["[CTX]", "[CTX]"]
      },
      {
        label: "m(document=\"D\"), its own default",
        flavor: "jinja2",
        src: "{% macro m(document=\"D\") %}[{{ document }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[D]", "[D]"]
      },
      {
        label: "m(process, b=process) called as m()",
        flavor: "jinja2",
        src: "{% macro m(process, b=process) %}[{{ b }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(_ext, b=_ext) called as m()",
        flavor: "jinja2",
        src: "{% macro m(_ext, b=_ext) %}[{{ b }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(toString, b=toString) called as m()",
        flavor: "jinja2",
        src: "{% macro m(toString, b=toString) %}[{{ b }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(__a0, b=__a0) called as m()",
        flavor: "jinja2",
        src: "{% macro m(__a0, b=__a0) %}[{{ b }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(zz, b=zz) called as m() (control)",
        flavor: "jinja2",
        src: "{% macro m(zz, b=zz) %}[{{ b }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(document, title=document.t) called as m()",
        flavor: "jinja2",
        src: "{% macro m(document, title=document.t) %}[{{ title }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      }
    ]
  },
  {
    name: "A renamed parameter across a recursive call or a loop over its name",
    cases: [
      {
        label: "m(document, n) across a recursive call",
        flavor: "native",
        src: "{% macro m(document, n) %}[{{ document }}{% if n %}{{ m(\"in\", 0) }}{{ document }}{% endif %}]{% endmacro %}{{ m(\"out\", 1) }}",
        loc: function () { return {}; },
        expect: ["[out[in]out]", "[out[in]out]"]
      },
      {
        label: "m(document, n) across a recursive call",
        flavor: "twig",
        src: "{% macro m(document, n) %}[{{ document }}{% if n %}{{ m(\"in\", 0) }}{{ document }}{% endif %}]{% endmacro %}{{ m(\"out\", 1) }}",
        loc: function () { return {}; },
        expect: ["[out[in]out]", "[out[in]out]"]
      },
      {
        label: "m(document, n) across a recursive call",
        flavor: "jinja2",
        src: "{% macro m(document, n) %}[{{ document }}{% if n %}{{ m(\"in\", 0) }}{{ document }}{% endif %}]{% endmacro %}{{ m(\"out\", 1) }}",
        loc: function () { return {}; },
        expect: ["[out[in]out]", "[out[in]out]"]
      },
      {
        label: "a loop over document inside m(document)",
        flavor: "native",
        src: "{% macro m(document) %}{% for document in xs %}{% endfor %}[{{ document }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return { xs: [1] }; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "a loop over document inside m(document)",
        flavor: "twig",
        src: "{% macro m(document) %}{% for document in xs %}{% endfor %}[{{ document }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return { xs: [1] }; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "a loop over document inside m(document)",
        flavor: "jinja2",
        src: "{% macro m(document) %}{% for document in xs %}{% endfor %}[{{ document }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return { xs: [1] }; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "m(toString, n) across a recursive call",
        flavor: "native",
        src: "{% macro m(toString, n) %}[{{ toString }}{% if n %}{{ m(\"in\", 0) }}{{ toString }}{% endif %}]{% endmacro %}{{ m(\"out\", 1) }}",
        loc: function () { return {}; },
        expect: ["[out[in]out]", "[out[in]out]"]
      },
      {
        label: "m(toString, n) across a recursive call",
        flavor: "twig",
        src: "{% macro m(toString, n) %}[{{ toString }}{% if n %}{{ m(\"in\", 0) }}{{ toString }}{% endif %}]{% endmacro %}{{ m(\"out\", 1) }}",
        loc: function () { return {}; },
        expect: ["[out[in]out]", "[out[in]out]"]
      },
      {
        label: "m(toString, n) across a recursive call",
        flavor: "jinja2",
        src: "{% macro m(toString, n) %}[{{ toString }}{% if n %}{{ m(\"in\", 0) }}{{ toString }}{% endif %}]{% endmacro %}{{ m(\"out\", 1) }}",
        loc: function () { return {}; },
        expect: ["[out[in]out]", "[out[in]out]"]
      },
      {
        label: "a loop over toString inside m(toString)",
        flavor: "native",
        src: "{% macro m(toString) %}{% for toString in xs %}{% endfor %}[{{ toString }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return { xs: [1] }; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "a loop over toString inside m(toString)",
        flavor: "twig",
        src: "{% macro m(toString) %}{% for toString in xs %}{% endfor %}[{{ toString }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return { xs: [1] }; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "a loop over toString inside m(toString)",
        flavor: "jinja2",
        src: "{% macro m(toString) %}{% for toString in xs %}{% endfor %}[{{ toString }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return { xs: [1] }; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "m(zz, n) across a recursive call (control)",
        flavor: "native",
        src: "{% macro m(zz, n) %}[{{ zz }}{% if n %}{{ m(\"in\", 0) }}{{ zz }}{% endif %}]{% endmacro %}{{ m(\"out\", 1) }}",
        loc: function () { return {}; },
        expect: ["[out[in]out]", "[out[in]out]"]
      },
      {
        label: "m(zz, n) across a recursive call (control)",
        flavor: "twig",
        src: "{% macro m(zz, n) %}[{{ zz }}{% if n %}{{ m(\"in\", 0) }}{{ zz }}{% endif %}]{% endmacro %}{{ m(\"out\", 1) }}",
        loc: function () { return {}; },
        expect: ["[out[in]out]", "[out[in]out]"]
      },
      {
        label: "m(zz, n) across a recursive call (control)",
        flavor: "jinja2",
        src: "{% macro m(zz, n) %}[{{ zz }}{% if n %}{{ m(\"in\", 0) }}{{ zz }}{% endif %}]{% endmacro %}{{ m(\"out\", 1) }}",
        loc: function () { return {}; },
        expect: ["[out[in]out]", "[out[in]out]"]
      },
      {
        label: "a loop over zz inside m(zz) (control)",
        flavor: "native",
        src: "{% macro m(zz) %}{% for zz in xs %}{% endfor %}[{{ zz }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return { xs: [1] }; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "a loop over zz inside m(zz) (control)",
        flavor: "twig",
        src: "{% macro m(zz) %}{% for zz in xs %}{% endfor %}[{{ zz }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return { xs: [1] }; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "a loop over zz inside m(zz) (control)",
        flavor: "jinja2",
        src: "{% macro m(zz) %}{% for zz in xs %}{% endfor %}[{{ zz }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return { xs: [1] }; },
        expect: ["[X]", "[X]"]
      }
    ]
  }
];

describe('Macro parameter defaults that read an earlier parameter', function () {
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
