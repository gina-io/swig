var swig = require('../../lib/swig'),
  twig = require('../../packages/swig-twig'),
  jinja2 = require('../../packages/swig-jinja2'),
  django = require('../../packages/swig-django'),
  loaders = require('../../packages/swig-core/lib/loaders'),
  expect = require('../lib/expect.js');

/*!
 * A macro parameter named like a JavaScript global, a name the compiled code
 * uses or an Object.prototype member, which the compiled macro binds in the
 * context, reads as a name that holds nothing when the call gave no argument
 * for it: a call of it renders an empty string, as the call of any such name
 * does, and each other read gives what it gives for a plain parameter. A
 * function or none given as the argument, and plain names, are the controls.
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
    name: "A call of a parameter that the call gave no argument",
    cases: [
      {
        label: "m(escape) calls escape(\"x\"), called as m()",
        flavor: "native",
        src: "{% macro m(escape) %}[{{ escape(\"x\") }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(escape) calls escape(\"x\"), called as m()",
        flavor: "twig",
        src: "{% macro m(escape) %}[{{ escape(\"x\") }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(escape) calls escape(\"x\"), called as m()",
        flavor: "jinja2",
        src: "{% macro m(escape) %}[{{ escape(\"x\") }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(escape) calls escape(\"x\"), called as m(f)",
        flavor: "native",
        src: "{% macro m(escape) %}[{{ escape(\"x\") }}]{% endmacro %}{{ m(f) }}",
        loc: function () { return { f: function (s) { return 'F' + s; } }; },
        expect: ["[Fx]", "[Fx]"]
      },
      {
        label: "m(escape) calls escape(\"x\"), called as m(f)",
        flavor: "twig",
        src: "{% macro m(escape) %}[{{ escape(\"x\") }}]{% endmacro %}{{ m(f) }}",
        loc: function () { return { f: function (s) { return 'F' + s; } }; },
        expect: ["[Fx]", "[Fx]"]
      },
      {
        label: "m(escape) calls escape(\"x\"), called as m(f)",
        flavor: "jinja2",
        src: "{% macro m(escape) %}[{{ escape(\"x\") }}]{% endmacro %}{{ m(f) }}",
        loc: function () { return { f: function (s) { return 'F' + s; } }; },
        expect: ["[Fx]", "[Fx]"]
      },
      {
        label: "m(_ext) calls _ext(\"x\"), called as m()",
        flavor: "native",
        src: "{% macro m(_ext) %}[{{ _ext(\"x\") }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(_ext) calls _ext(\"x\"), called as m()",
        flavor: "twig",
        src: "{% macro m(_ext) %}[{{ _ext(\"x\") }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(_ext) calls _ext(\"x\"), called as m()",
        flavor: "jinja2",
        src: "{% macro m(_ext) %}[{{ _ext(\"x\") }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(_ext) calls _ext(\"x\"), called as m(f)",
        flavor: "native",
        src: "{% macro m(_ext) %}[{{ _ext(\"x\") }}]{% endmacro %}{{ m(f) }}",
        loc: function () { return { f: function (s) { return 'F' + s; } }; },
        expect: ["[Fx]", "[Fx]"]
      },
      {
        label: "m(_ext) calls _ext(\"x\"), called as m(f)",
        flavor: "twig",
        src: "{% macro m(_ext) %}[{{ _ext(\"x\") }}]{% endmacro %}{{ m(f) }}",
        loc: function () { return { f: function (s) { return 'F' + s; } }; },
        expect: ["[Fx]", "[Fx]"]
      },
      {
        label: "m(_ext) calls _ext(\"x\"), called as m(f)",
        flavor: "jinja2",
        src: "{% macro m(_ext) %}[{{ _ext(\"x\") }}]{% endmacro %}{{ m(f) }}",
        loc: function () { return { f: function (s) { return 'F' + s; } }; },
        expect: ["[Fx]", "[Fx]"]
      },
      {
        label: "m(toString) calls toString(\"x\"), called as m()",
        flavor: "native",
        src: "{% macro m(toString) %}[{{ toString(\"x\") }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(toString) calls toString(\"x\"), called as m()",
        flavor: "twig",
        src: "{% macro m(toString) %}[{{ toString(\"x\") }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(toString) calls toString(\"x\"), called as m()",
        flavor: "jinja2",
        src: "{% macro m(toString) %}[{{ toString(\"x\") }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(toString) calls toString(\"x\"), called as m(f)",
        flavor: "native",
        src: "{% macro m(toString) %}[{{ toString(\"x\") }}]{% endmacro %}{{ m(f) }}",
        loc: function () { return { f: function (s) { return 'F' + s; } }; },
        expect: ["[Fx]", "[Fx]"]
      },
      {
        label: "m(toString) calls toString(\"x\"), called as m(f)",
        flavor: "twig",
        src: "{% macro m(toString) %}[{{ toString(\"x\") }}]{% endmacro %}{{ m(f) }}",
        loc: function () { return { f: function (s) { return 'F' + s; } }; },
        expect: ["[Fx]", "[Fx]"]
      },
      {
        label: "m(toString) calls toString(\"x\"), called as m(f)",
        flavor: "jinja2",
        src: "{% macro m(toString) %}[{{ toString(\"x\") }}]{% endmacro %}{{ m(f) }}",
        loc: function () { return { f: function (s) { return 'F' + s; } }; },
        expect: ["[Fx]", "[Fx]"]
      },
      {
        label: "m(zz) calls zz(\"x\"), called as m() (control)",
        flavor: "native",
        src: "{% macro m(zz) %}[{{ zz(\"x\") }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(zz) calls zz(\"x\"), called as m() (control)",
        flavor: "twig",
        src: "{% macro m(zz) %}[{{ zz(\"x\") }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(zz) calls zz(\"x\"), called as m() (control)",
        flavor: "jinja2",
        src: "{% macro m(zz) %}[{{ zz(\"x\") }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(zz) calls zz(\"x\"), called as m(f) (control)",
        flavor: "native",
        src: "{% macro m(zz) %}[{{ zz(\"x\") }}]{% endmacro %}{{ m(f) }}",
        loc: function () { return { f: function (s) { return 'F' + s; } }; },
        expect: ["[Fx]", "[Fx]"]
      },
      {
        label: "m(zz) calls zz(\"x\"), called as m(f) (control)",
        flavor: "twig",
        src: "{% macro m(zz) %}[{{ zz(\"x\") }}]{% endmacro %}{{ m(f) }}",
        loc: function () { return { f: function (s) { return 'F' + s; } }; },
        expect: ["[Fx]", "[Fx]"]
      },
      {
        label: "m(zz) calls zz(\"x\"), called as m(f) (control)",
        flavor: "jinja2",
        src: "{% macro m(zz) %}[{{ zz(\"x\") }}]{% endmacro %}{{ m(f) }}",
        loc: function () { return { f: function (s) { return 'F' + s; } }; },
        expect: ["[Fx]", "[Fx]"]
      },
      {
        label: "m(escape) calls escape(\"x\"), called as m(none)",
        flavor: "jinja2",
        src: "{% macro m(escape) %}[{{ escape(\"x\") }}]{% endmacro %}{{ m(none) }}",
        loc: function () { return {}; },
        expect: ["THROW (intermediate value)(intermediate value)(intermediate value) is not a function", "THROW (intermediate value)(intermediate value)(intermediate value) is not a function"]
      },
      {
        label: "m(a=escape(\"x\"), escape=\"D\") called as m()",
        flavor: "jinja2",
        src: "{% macro m(a=escape(\"x\"), escape=\"D\") %}[{{ a }}|{{ escape }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[|D]", "[|D]"]
      },
      {
        label: "m(escape=escape(\"x\")) called as m()",
        flavor: "jinja2",
        src: "{% macro m(escape=escape(\"x\")) %}[{{ escape }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(a=zz(\"x\"), zz=\"D\") called as m() (control)",
        flavor: "jinja2",
        src: "{% macro m(a=zz(\"x\"), zz=\"D\") %}[{{ a }}|{{ zz }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[|D]", "[|D]"]
      }
    ]
  },
  {
    name: "Other reads of a parameter that the call gave no argument",
    cases: [
      {
        label: "m(escape) reads escape as output, called as m()",
        flavor: "native",
        src: "{% macro m(escape) %}[{{ escape }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(escape) reads escape as output, called as m()",
        flavor: "twig",
        src: "{% macro m(escape) %}[{{ escape }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(escape) reads escape as output, called as m()",
        flavor: "jinja2",
        src: "{% macro m(escape) %}[{{ escape }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(escape) reads escape in an if, called as m()",
        flavor: "native",
        src: "{% macro m(escape) %}[{% if escape %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(escape) reads escape in an if, called as m()",
        flavor: "twig",
        src: "{% macro m(escape) %}[{% if escape %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(escape) reads escape in an if, called as m()",
        flavor: "jinja2",
        src: "{% macro m(escape) %}[{% if escape %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(escape) reads escape with is defined, called as m()",
        flavor: "twig",
        src: "{% macro m(escape) %}[{% if escape is defined %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(escape) reads escape with is defined, called as m()",
        flavor: "jinja2",
        src: "{% macro m(escape) %}[{% if escape is defined %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(escape) reads escape with is none, called as m()",
        flavor: "jinja2",
        src: "{% macro m(escape) %}[{% if escape is none %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "m(escape) reads escape with is null, called as m()",
        flavor: "twig",
        src: "{% macro m(escape) %}[{% if escape is null %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "m(escape) reads escape with == none, called as m()",
        flavor: "jinja2",
        src: "{% macro m(escape) %}[{% if escape == none %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "m(escape) reads escape through default, called as m()",
        flavor: "native",
        src: "{% macro m(escape) %}[{{ escape|default(\"D\") }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[D]", "[D]"]
      },
      {
        label: "m(escape) reads escape through default, called as m()",
        flavor: "twig",
        src: "{% macro m(escape) %}[{{ escape|default(\"D\") }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[D]", "[D]"]
      },
      {
        label: "m(escape) reads escape through default, called as m()",
        flavor: "jinja2",
        src: "{% macro m(escape) %}[{{ escape|default(\"D\") }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[D]", "[D]"]
      },
      {
        label: "m(escape) reads escape with ~, called as m()",
        flavor: "twig",
        src: "{% macro m(escape) %}[{{ escape ~ \"a\" }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[a]", "[a]"]
      },
      {
        label: "m(escape) reads escape with ~, called as m()",
        flavor: "jinja2",
        src: "{% macro m(escape) %}[{{ escape ~ \"a\" }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[a]", "[a]"]
      },
      {
        label: "m(_ext) reads _ext as output, called as m()",
        flavor: "native",
        src: "{% macro m(_ext) %}[{{ _ext }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(_ext) reads _ext as output, called as m()",
        flavor: "twig",
        src: "{% macro m(_ext) %}[{{ _ext }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(_ext) reads _ext as output, called as m()",
        flavor: "jinja2",
        src: "{% macro m(_ext) %}[{{ _ext }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(_ext) reads _ext in an if, called as m()",
        flavor: "native",
        src: "{% macro m(_ext) %}[{% if _ext %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(_ext) reads _ext in an if, called as m()",
        flavor: "twig",
        src: "{% macro m(_ext) %}[{% if _ext %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(_ext) reads _ext in an if, called as m()",
        flavor: "jinja2",
        src: "{% macro m(_ext) %}[{% if _ext %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(_ext) reads _ext with is defined, called as m()",
        flavor: "twig",
        src: "{% macro m(_ext) %}[{% if _ext is defined %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(_ext) reads _ext with is defined, called as m()",
        flavor: "jinja2",
        src: "{% macro m(_ext) %}[{% if _ext is defined %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(_ext) reads _ext with is none, called as m()",
        flavor: "jinja2",
        src: "{% macro m(_ext) %}[{% if _ext is none %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "m(_ext) reads _ext with is null, called as m()",
        flavor: "twig",
        src: "{% macro m(_ext) %}[{% if _ext is null %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "m(_ext) reads _ext with == none, called as m()",
        flavor: "jinja2",
        src: "{% macro m(_ext) %}[{% if _ext == none %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "m(_ext) reads _ext through default, called as m()",
        flavor: "native",
        src: "{% macro m(_ext) %}[{{ _ext|default(\"D\") }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[D]", "[D]"]
      },
      {
        label: "m(_ext) reads _ext through default, called as m()",
        flavor: "twig",
        src: "{% macro m(_ext) %}[{{ _ext|default(\"D\") }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[D]", "[D]"]
      },
      {
        label: "m(_ext) reads _ext through default, called as m()",
        flavor: "jinja2",
        src: "{% macro m(_ext) %}[{{ _ext|default(\"D\") }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[D]", "[D]"]
      },
      {
        label: "m(_ext) reads _ext with ~, called as m()",
        flavor: "twig",
        src: "{% macro m(_ext) %}[{{ _ext ~ \"a\" }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[a]", "[a]"]
      },
      {
        label: "m(_ext) reads _ext with ~, called as m()",
        flavor: "jinja2",
        src: "{% macro m(_ext) %}[{{ _ext ~ \"a\" }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[a]", "[a]"]
      },
      {
        label: "m(toString) reads toString as output, called as m()",
        flavor: "native",
        src: "{% macro m(toString) %}[{{ toString }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(toString) reads toString as output, called as m()",
        flavor: "twig",
        src: "{% macro m(toString) %}[{{ toString }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(toString) reads toString as output, called as m()",
        flavor: "jinja2",
        src: "{% macro m(toString) %}[{{ toString }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(toString) reads toString in an if, called as m()",
        flavor: "native",
        src: "{% macro m(toString) %}[{% if toString %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(toString) reads toString in an if, called as m()",
        flavor: "twig",
        src: "{% macro m(toString) %}[{% if toString %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(toString) reads toString in an if, called as m()",
        flavor: "jinja2",
        src: "{% macro m(toString) %}[{% if toString %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(toString) reads toString with is defined, called as m()",
        flavor: "twig",
        src: "{% macro m(toString) %}[{% if toString is defined %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(toString) reads toString with is defined, called as m()",
        flavor: "jinja2",
        src: "{% macro m(toString) %}[{% if toString is defined %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(toString) reads toString with is none, called as m()",
        flavor: "jinja2",
        src: "{% macro m(toString) %}[{% if toString is none %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "m(toString) reads toString with is null, called as m()",
        flavor: "twig",
        src: "{% macro m(toString) %}[{% if toString is null %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "m(toString) reads toString with == none, called as m()",
        flavor: "jinja2",
        src: "{% macro m(toString) %}[{% if toString == none %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "m(toString) reads toString through default, called as m()",
        flavor: "native",
        src: "{% macro m(toString) %}[{{ toString|default(\"D\") }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[D]", "[D]"]
      },
      {
        label: "m(toString) reads toString through default, called as m()",
        flavor: "twig",
        src: "{% macro m(toString) %}[{{ toString|default(\"D\") }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[D]", "[D]"]
      },
      {
        label: "m(toString) reads toString through default, called as m()",
        flavor: "jinja2",
        src: "{% macro m(toString) %}[{{ toString|default(\"D\") }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[D]", "[D]"]
      },
      {
        label: "m(toString) reads toString with ~, called as m()",
        flavor: "twig",
        src: "{% macro m(toString) %}[{{ toString ~ \"a\" }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[a]", "[a]"]
      },
      {
        label: "m(toString) reads toString with ~, called as m()",
        flavor: "jinja2",
        src: "{% macro m(toString) %}[{{ toString ~ \"a\" }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[a]", "[a]"]
      },
      {
        label: "m(zz) reads zz as output, called as m() (control)",
        flavor: "native",
        src: "{% macro m(zz) %}[{{ zz }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(zz) reads zz as output, called as m() (control)",
        flavor: "twig",
        src: "{% macro m(zz) %}[{{ zz }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(zz) reads zz as output, called as m() (control)",
        flavor: "jinja2",
        src: "{% macro m(zz) %}[{{ zz }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(zz) reads zz in an if, called as m() (control)",
        flavor: "native",
        src: "{% macro m(zz) %}[{% if zz %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(zz) reads zz in an if, called as m() (control)",
        flavor: "twig",
        src: "{% macro m(zz) %}[{% if zz %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(zz) reads zz in an if, called as m() (control)",
        flavor: "jinja2",
        src: "{% macro m(zz) %}[{% if zz %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(zz) reads zz with is defined, called as m() (control)",
        flavor: "twig",
        src: "{% macro m(zz) %}[{% if zz is defined %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(zz) reads zz with is defined, called as m() (control)",
        flavor: "jinja2",
        src: "{% macro m(zz) %}[{% if zz is defined %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "m(zz) reads zz with is none, called as m() (control)",
        flavor: "jinja2",
        src: "{% macro m(zz) %}[{% if zz is none %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "m(zz) reads zz with is null, called as m() (control)",
        flavor: "twig",
        src: "{% macro m(zz) %}[{% if zz is null %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "m(zz) reads zz with == none, called as m() (control)",
        flavor: "jinja2",
        src: "{% macro m(zz) %}[{% if zz == none %}Y{% endif %}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "m(zz) reads zz through default, called as m() (control)",
        flavor: "native",
        src: "{% macro m(zz) %}[{{ zz|default(\"D\") }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[D]", "[D]"]
      },
      {
        label: "m(zz) reads zz through default, called as m() (control)",
        flavor: "twig",
        src: "{% macro m(zz) %}[{{ zz|default(\"D\") }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[D]", "[D]"]
      },
      {
        label: "m(zz) reads zz through default, called as m() (control)",
        flavor: "jinja2",
        src: "{% macro m(zz) %}[{{ zz|default(\"D\") }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[D]", "[D]"]
      },
      {
        label: "m(zz) reads zz with ~, called as m() (control)",
        flavor: "twig",
        src: "{% macro m(zz) %}[{{ zz ~ \"a\" }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[a]", "[a]"]
      },
      {
        label: "m(zz) reads zz with ~, called as m() (control)",
        flavor: "jinja2",
        src: "{% macro m(zz) %}[{{ zz ~ \"a\" }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[a]", "[a]"]
      }
    ]
  }
];

describe('Reads of a macro parameter that the call gave no argument', function () {
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
