var swig = require('../../lib/swig'),
  twig = require('../../packages/swig-twig'),
  jinja2 = require('../../packages/swig-jinja2'),
  django = require('../../packages/swig-django'),
  loaders = require('../../packages/swig-core/lib/loaders'),
  expect = require('../lib/expect.js');

/*!
 * In swig-jinja2 a parameter default may read its own parameter or a later
 * one, also one named like a JavaScript global, a name the compiled code uses
 * or an Object.prototype member, which the compiled macro binds in the context:
 * it reads the argument, or nothing when none is given, also when the context
 * holds a key of that name. A default after a parameter that took its own
 * default, a macro without defaults called without its argument, and plain
 * names are the controls.
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
    name: "A default that reads its own parameter",
    cases: [
      {
        label: "m(process=process) called as m()",
        flavor: "jinja2",
        src: "{% macro m(process=process) %}[{{ process }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(process=process) called as m(\"X\")",
        flavor: "jinja2",
        src: "{% macro m(process=process) %}[{{ process }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "m(escape=escape) called as m()",
        flavor: "jinja2",
        src: "{% macro m(escape=escape) %}[{{ escape }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(escape=escape) called as m(\"X\")",
        flavor: "jinja2",
        src: "{% macro m(escape=escape) %}[{{ escape }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "m(Math=Math) called as m()",
        flavor: "jinja2",
        src: "{% macro m(Math=Math) %}[{{ Math }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(Math=Math) called as m(\"X\")",
        flavor: "jinja2",
        src: "{% macro m(Math=Math) %}[{{ Math }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "m(document=document) called as m()",
        flavor: "jinja2",
        src: "{% macro m(document=document) %}[{{ document }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(document=document) called as m(\"X\")",
        flavor: "jinja2",
        src: "{% macro m(document=document) %}[{{ document }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "m(toString=toString) called as m()",
        flavor: "jinja2",
        src: "{% macro m(toString=toString) %}[{{ toString }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(toString=toString) called as m(\"X\")",
        flavor: "jinja2",
        src: "{% macro m(toString=toString) %}[{{ toString }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "m(_ext=_ext) called as m()",
        flavor: "jinja2",
        src: "{% macro m(_ext=_ext) %}[{{ _ext }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(_ext=_ext) called as m(\"X\")",
        flavor: "jinja2",
        src: "{% macro m(_ext=_ext) %}[{{ _ext }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "m(__a0=__a0) called as m()",
        flavor: "jinja2",
        src: "{% macro m(__a0=__a0) %}[{{ __a0 }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(__a0=__a0) called as m(\"X\")",
        flavor: "jinja2",
        src: "{% macro m(__a0=__a0) %}[{{ __a0 }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "m(zz=zz) called as m()",
        flavor: "jinja2",
        src: "{% macro m(zz=zz) %}[{{ zz }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(zz=zz) called as m(\"X\")",
        flavor: "jinja2",
        src: "{% macro m(zz=zz) %}[{{ zz }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "m(process=process) called as m(), the context holds process",
        flavor: "jinja2",
        src: "{% macro m(process=process) %}[{{ process }}]{% endmacro %}{{ m() }}",
        loc: function () { return { process: 'CTX' }; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(toString=toString) called as m(), the context holds toString",
        flavor: "jinja2",
        src: "{% macro m(toString=toString) %}[{{ toString }}]{% endmacro %}{{ m() }}",
        loc: function () { return { toString: 'CTX' }; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(zz=zz) called as m(), the context holds zz",
        flavor: "jinja2",
        src: "{% macro m(zz=zz) %}[{{ zz }}]{% endmacro %}{{ m() }}",
        loc: function () { return { zz: 'CTX' }; },
        expect: ["[CTX]", "[CTX]"]
      }
    ]
  },
  {
    name: "A default that reads a later parameter",
    cases: [
      {
        label: "m(a=process, process=\"D\") called as m()",
        flavor: "jinja2",
        src: "{% macro m(a=process, process=\"D\") %}[{{ a }}|{{ process }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[|D]", "[|D]"]
      },
      {
        label: "m(a=process, process=\"D\") called as m(), the context holds process",
        flavor: "jinja2",
        src: "{% macro m(a=process, process=\"D\") %}[{{ a }}|{{ process }}]{% endmacro %}{{ m() }}",
        loc: function () { return { process: 'CTX' }; },
        expect: ["[|D]", "[|D]"]
      },
      {
        label: "m(a=escape, escape=\"D\") called as m()",
        flavor: "jinja2",
        src: "{% macro m(a=escape, escape=\"D\") %}[{{ a }}|{{ escape }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[|D]", "[|D]"]
      },
      {
        label: "m(a=escape, escape=\"D\") called as m(), the context holds escape",
        flavor: "jinja2",
        src: "{% macro m(a=escape, escape=\"D\") %}[{{ a }}|{{ escape }}]{% endmacro %}{{ m() }}",
        loc: function () { return { escape: 'CTX' }; },
        expect: ["[|D]", "[|D]"]
      },
      {
        label: "m(a=toString, toString=\"D\") called as m()",
        flavor: "jinja2",
        src: "{% macro m(a=toString, toString=\"D\") %}[{{ a }}|{{ toString }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[|D]", "[|D]"]
      },
      {
        label: "m(a=toString, toString=\"D\") called as m(), the context holds toString",
        flavor: "jinja2",
        src: "{% macro m(a=toString, toString=\"D\") %}[{{ a }}|{{ toString }}]{% endmacro %}{{ m() }}",
        loc: function () { return { toString: 'CTX' }; },
        expect: ["[|D]", "[|D]"]
      },
      {
        label: "m(a=zz, zz=\"D\") called as m()",
        flavor: "jinja2",
        src: "{% macro m(a=zz, zz=\"D\") %}[{{ a }}|{{ zz }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[|D]", "[|D]"]
      },
      {
        label: "m(a=zz, zz=\"D\") called as m(), the context holds zz",
        flavor: "jinja2",
        src: "{% macro m(a=zz, zz=\"D\") %}[{{ a }}|{{ zz }}]{% endmacro %}{{ m() }}",
        loc: function () { return { zz: 'CTX' }; },
        expect: ["[CTX|D]", "[CTX|D]"]
      }
    ]
  },
  {
    name: "A missing or null argument while the context holds the name",
    cases: [
      {
        label: "m(process, b=process) called as m(), the context holds process",
        flavor: "jinja2",
        src: "{% macro m(process, b=process) %}[{{ b }}]{% endmacro %}{{ m() }}",
        loc: function () { return { process: 'CTX' }; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(process, b=process) called as m(none), the context holds process",
        flavor: "jinja2",
        src: "{% macro m(process, b=process) %}[{{ b }}]{% endmacro %}{{ m(none) }}",
        loc: function () { return { process: 'CTX' }; },
        expect: ["[]", "[]"]
      }
    ]
  },
  {
    name: "A default after a parameter that took its own default, a later argument, and a macro without defaults",
    cases: [
      {
        label: "m(process=\"P\", b=process) called as m()",
        flavor: "jinja2",
        src: "{% macro m(process=\"P\", b=process) %}[{{ process }}|{{ b }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[P|P]", "[P|P]"]
      },
      {
        label: "m(process) called as m()",
        flavor: "native",
        src: "{% macro m(process) %}[{{ process }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(process) called as m()",
        flavor: "twig",
        src: "{% macro m(process) %}[{{ process }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(process) called as m()",
        flavor: "jinja2",
        src: "{% macro m(process) %}[{{ process }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(a=process, process=\"D\") called as m(u(), \"E\")",
        flavor: "jinja2",
        src: "{% macro m(a=process, process=\"D\") %}[{{ a }}|{{ process }}]{% endmacro %}{{ m(u(), \"E\") }}",
        loc: function () { return { u: function () {} }; },
        expect: ["[E|E]", "[E|E]"]
      }
    ]
  }
];

describe('Macro parameter defaults that read a parameter before it has its value', function () {
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
