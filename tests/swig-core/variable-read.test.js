var swig = require('../../lib/swig'),
  twig = require('@rhinostone/swig-twig'),
  jinja2 = require('@rhinostone/swig-jinja2'),
  django = require('@rhinostone/swig-django'),
  loaders = require('@rhinostone/swig-core/lib/loaders'),
  expect = require('../lib/expect.js');

/*!
 * How a template reads a name. A name is read from the context, and
 * whether a JavaScript identifier of the same name is read when the context
 * has none is decided per name when the template compiles: a reserved word
 * or a name the compiled code uses itself is read from the context only, a
 * name an object gets only from Object.prototype reads as missing (bare or
 * dotted), and a context key that holds null or undefined keeps the global of
 * that name out. The globals templates rely on (Math, JSON, Date,
 * encodeURIComponent) are still read when the context has no such key, also
 * after a loop variable of that name. A loop or macro parameter whose name
 * cannot be a variable of the compiled code is renamed, and a macro binds
 * those parameters in the context for the call, so an include inside the
 * macro sees them. Each case runs on the sync and the async render paths;
 * the expectations are generated and were checked against recorded renders
 * of the same shapes.
 */
var CTORS = { native: swig.Swig, twig: twig.Twig, jinja2: jinja2.Jinja2, django: django.Django };
var DEFAULTS = { native: swig, twig: twig, jinja2: jinja2, django: django };

function make(f, files, isAsync) {
  var mem = loaders.memory(files, '/'), loader = mem;
  if (isAsync) {
    loader = {
      async: true,
      resolve: mem.resolve,
      load: function (id, cb) {
        if (!cb) { return mem.load(id); }
        setImmediate(function () {
          var src;
          try { src = mem.load(id); } catch (e) { cb(e); return; }
          cb(null, src);
        });
      }
    };
  }
  return new CTORS[f]({ loader: loader, cache: false });
}

function renderSync(f, files, locals) {
  try { return make(f, files, false).renderFile('/t.html', locals); } catch (e) { return 'THROW ' + e.message; }
}

function renderAsync(f, files, locals) {
  return new Promise(function (resolve) {
    try {
      make(f, files, true).renderFile('/t.html', locals, function (err, out) {
        resolve(err ? 'THROW ' + err.message : out);
      });
    } catch (e) { resolve('THROW ' + e.message); }
  });
}

function renderDefault(f, tpl, locals) {
  try { return DEFAULTS[f].render(tpl, { locals: locals }); } catch (e) { return 'THROW ' + e.message; }
}

function djangoSync(tpl, locals) {
  try { return new django.Django().render(tpl, { locals: locals }); } catch (e) { return 'THROW ' + e.message; }
}

function djangoAsync(tpl, locals) {
  return new Promise(function (resolve) {
    var loader = {
      async: true,
      resolve: function (to) { return to; },
      load: function (id, cb) {
        if (!cb) { return tpl; }
        setImmediate(function () { cb(null, tpl); });
      }
    };
    new django.Django({ cache: false, loader: loader }).renderFile('t.html', locals, function (err, out) {
      resolve(err ? 'THROW ' + err.message : out);
    });
  });
}

function recordsOf(f, tpl) {
  var body;
  try {
    body = make(f, {}, false).precompile(tpl, { codegenMode: 'async', filename: '/m.html' }).tpl.toString();
  } catch (e) { return 'THROW ' + e.message; }
  return body.indexOf('_utils.exportRefs(_exports.m') !== -1 ? 'records' : 'whole';
}

function proxyAll(v) { return new Proxy({}, { get: function () { return v; } }); }
function C() {}
C.prototype.toString = function () { return 'C'; };

function withProto(proto, fn) {
  var r;
  if (!proto) { return fn(); }
  Object.defineProperty(Object.prototype, proto[0], { value: proto[1], writable: true, configurable: true, enumerable: false });
  function restore(x) { delete Object.prototype[proto[0]]; return x; }
  try { r = fn(); } catch (e) { restore(); throw e; }
  if (r && typeof r.then === 'function') { return r.then(restore, function (e) { restore(); throw e; }); }
  return restore(r);
}

function run(c, f, isAsync) {
  return withProto(c.proto, function () {
    if (c.kind === 'compile') { return recordsOf(f, c.tpl); }
    if (!isAsync) {
      if (c.kind === 'default') { return renderDefault(f, c.tpl, c.loc()); }
      if (c.kind === 'django') { return djangoSync(c.tpl, c.loc()); }
      return renderSync(f, c.files, c.loc());
    }
    if (c.kind === 'django') { return djangoAsync(c.tpl, c.loc()); }
    return renderAsync(f, c.kind === 'default' ? { '/t.html': c.tpl } : c.files, c.loc());
  });
}

var GROUPS = [
  {
    name: "a reserved word or a compiled-code name is read from the context",
    cases: [
      {
        label: "{{ class }}",
        kind: "file",
        files: {
          "/t.html": "[{{ class }}]"
        },
        loc: function () { return {"class":"x"}; },
        expect: {
          native: ["[x]", "[x]"],
          twig: ["[x]", "[x]"],
          jinja2: ["[x]", "[x]"],
          django: ["[x]", "[x]"]
        }
      },
      {
        label: "{{ super }}",
        kind: "file",
        files: {
          "/t.html": "[{{ super }}]"
        },
        loc: function () { return {"super":"x"}; },
        expect: {
          native: ["[x]", "[x]"],
          twig: ["[x]", "[x]"],
          jinja2: ["[x]", "[x]"],
          django: ["[x]", "[x]"]
        }
      },
      {
        label: "{{ enum }}",
        kind: "file",
        files: {
          "/t.html": "[{{ enum }}]"
        },
        loc: function () { return {"enum":"x"}; },
        expect: {
          native: ["[x]", "[x]"],
          twig: ["[x]", "[x]"],
          jinja2: ["[x]", "[x]"],
          django: ["[x]", "[x]"]
        }
      },
      {
        label: "{{ const }}",
        kind: "file",
        files: {
          "/t.html": "[{{ const }}]"
        },
        loc: function () { return {"const":"x"}; },
        expect: {
          native: ["[x]", "[x]"],
          twig: ["[x]", "[x]"],
          jinja2: ["[x]", "[x]"],
          django: ["[x]", "[x]"]
        }
      },
      {
        label: "{{ import }}",
        kind: "file",
        files: {
          "/t.html": "[{{ import }}]"
        },
        loc: function () { return {"import":"x"}; },
        expect: {
          native: ["[x]", "[x]"],
          twig: ["[x]", "[x]"],
          jinja2: ["[x]", "[x]"],
          django: ["[x]", "[x]"]
        }
      },
      {
        label: "control {{ klass }}",
        kind: "file",
        files: {
          "/t.html": "[{{ klass }}]"
        },
        loc: function () { return {"klass":"x"}; },
        expect: {
          native: ["[x]", "[x]"],
          twig: ["[x]", "[x]"],
          jinja2: ["[x]", "[x]"],
          django: ["[x]", "[x]"]
        }
      },
      {
        label: "control no call",
        kind: "file",
        files: {
          "/p.html": "[{% block b %}P{% endblock %}]",
          "/t.html": "{% extends \"p.html\" %}{% block b %}C{% endblock %}"
        },
        loc: function () { return {}; },
        expect: {
          jinja2: ["[C]", "[C]"],
          twig: ["[C]", "[C]"]
        }
      },
      {
        label: "macro __k in loop",
        kind: "file",
        files: {
          "/t.html": "{% macro __k() %}M{% endmacro %}[{% for x in xs %}{{ __k() }}{% endfor %}]"
        },
        loc: function () { return {"xs":[1,2]}; },
        expect: {
          native: ["[MM]", "[MM]"],
          jinja2: ["[MM]", "[MM]"]
        }
      },
      {
        label: "control macro mk",
        kind: "file",
        files: {
          "/t.html": "{% macro mk() %}M{% endmacro %}[{% for x in xs %}{{ mk() }}{% endfor %}]"
        },
        loc: function () { return {"xs":[1,2]}; },
        expect: {
          native: ["[MM]", "[MM]"],
          jinja2: ["[MM]", "[MM]"]
        }
      }
    ]
  },
  {
    name: "a name only Object.prototype gives an object reads as missing",
    cases: [
      {
        label: "{{ toString }}",
        kind: "file",
        files: {
          "/t.html": "[{{ toString }}]"
        },
        loc: function () { return {}; },
        expect: {
          native: ["[]", "[]"],
          twig: ["[]", "[]"],
          jinja2: ["[]", "[]"],
          django: ["[]", "[]"]
        }
      },
      {
        label: "{{ valueOf }}",
        kind: "file",
        files: {
          "/t.html": "[{{ valueOf }}]"
        },
        loc: function () { return {}; },
        expect: {
          native: ["[]", "[]"],
          twig: ["[]", "[]"],
          jinja2: ["[]", "[]"],
          django: ["[]", "[]"]
        }
      },
      {
        label: "{{ hasOwnProperty }}",
        kind: "file",
        files: {
          "/t.html": "[{{ hasOwnProperty }}]"
        },
        loc: function () { return {}; },
        expect: {
          native: ["[]", "[]"],
          twig: ["[]", "[]"],
          jinja2: ["[]", "[]"],
          django: ["[]", "[]"]
        }
      },
      {
        label: "{{ isPrototypeOf }}",
        kind: "file",
        files: {
          "/t.html": "[{{ isPrototypeOf }}]"
        },
        loc: function () { return {}; },
        expect: {
          native: ["[]", "[]"],
          twig: ["[]", "[]"],
          jinja2: ["[]", "[]"],
          django: ["[]", "[]"]
        }
      },
      {
        label: "{{ toLocaleString }}",
        kind: "file",
        files: {
          "/t.html": "[{{ toLocaleString }}]"
        },
        loc: function () { return {}; },
        expect: {
          native: ["[]", "[]"],
          twig: ["[]", "[]"],
          jinja2: ["[]", "[]"],
          django: ["[]", "[]"]
        }
      },
      {
        label: "{{ __lookupGetter__ }}",
        kind: "file",
        files: {
          "/t.html": "[{{ __lookupGetter__ }}]"
        },
        loc: function () { return {}; },
        expect: {
          native: ["[]", "[]"],
          twig: ["[]", "[]"],
          jinja2: ["[]", "[]"],
          django: ["[]", "[]"]
        }
      },
      {
        label: "control {{ nothere }}",
        kind: "file",
        files: {
          "/t.html": "[{{ nothere }}]"
        },
        loc: function () { return {}; },
        expect: {
          native: ["[]", "[]"],
          twig: ["[]", "[]"],
          jinja2: ["[]", "[]"],
          django: ["[]", "[]"]
        }
      },
      {
        label: "own key toString:T",
        kind: "file",
        files: {
          "/t.html": "[{{ toString }}]"
        },
        loc: function () { return {"toString":"T"}; },
        expect: {
          native: ["[T]", "[T]"],
          twig: ["[T]", "[T]"],
          jinja2: ["[T]", "[T]"],
          django: ["[T]", "[T]"]
        }
      },
      {
        label: "{{ obj.toString }}",
        kind: "file",
        files: {
          "/t.html": "[{{ obj.toString }}]"
        },
        loc: function () { return {"obj":{}}; },
        expect: {
          native: ["[]", "[]"],
          twig: ["[]", "[]"],
          jinja2: ["[]", "[]"],
          django: ["[]", "[]"]
        }
      },
      {
        label: "if toString",
        kind: "file",
        files: {
          "/t.html": "{% if toString %}Y{% else %}N{% endif %}"
        },
        loc: function () { return {}; },
        expect: {
          native: ["N", "N"],
          jinja2: ["N", "N"],
          django: ["N", "N"]
        }
      },
      {
        label: "twig if toString",
        kind: "file",
        files: {
          "/t.html": "[{% if toString %}Y{% endif %}]"
        },
        loc: function () { return {}; },
        expect: {
          twig: ["[]", "[]"]
        }
      }
    ]
  },
  {
    name: "a null context value named like a global or a compiled-code local",
    cases: [
      {
        label: "{{ _output }}=null",
        kind: "file",
        files: {
          "/t.html": "[{{ _output }}]"
        },
        loc: function () { return {"_output":null}; },
        expect: {
          native: ["[]", "[]"],
          twig: ["[]", "[]"],
          jinja2: ["[]", "[]"],
          django: ["[]", "[]"]
        }
      },
      {
        label: "{{ Math }}=null",
        kind: "file",
        files: {
          "/t.html": "[{{ Math }}]"
        },
        loc: function () { return {"Math":null}; },
        expect: {
          native: ["[]", "[]"],
          twig: ["[]", "[]"],
          jinja2: ["[]", "[]"],
          django: ["[]", "[]"]
        }
      },
      {
        label: "{{ JSON }}=null",
        kind: "file",
        files: {
          "/t.html": "[{{ JSON }}]"
        },
        loc: function () { return {"JSON":null}; },
        expect: {
          native: ["[]", "[]"],
          twig: ["[]", "[]"],
          jinja2: ["[]", "[]"],
          django: ["[]", "[]"]
        }
      },
      {
        label: "{{ Date }}=null",
        kind: "file",
        files: {
          "/t.html": "[{{ Date }}]"
        },
        loc: function () { return {"Date":null}; },
        expect: {
          native: ["[]", "[]"],
          twig: ["[]", "[]"],
          jinja2: ["[]", "[]"],
          django: ["[]", "[]"]
        }
      },
      {
        label: "{{ Object }}=null",
        kind: "file",
        files: {
          "/t.html": "[{{ Object }}]"
        },
        loc: function () { return {"Object":null}; },
        expect: {
          native: ["[]", "[]"],
          twig: ["[]", "[]"],
          jinja2: ["[]", "[]"],
          django: ["[]", "[]"]
        }
      },
      {
        label: "{{ _utils }}=null",
        kind: "file",
        files: {
          "/t.html": "[{{ _utils }}]"
        },
        loc: function () { return {"_utils":null}; },
        expect: {
          native: ["[]", "[]"],
          twig: ["[]", "[]"],
          jinja2: ["[]", "[]"],
          django: ["[]", "[]"]
        }
      },
      {
        label: "{{ _ctx }}=null",
        kind: "file",
        files: {
          "/t.html": "[{{ _ctx }}]"
        },
        loc: function () { return {"_ctx":null}; },
        expect: {
          native: ["[]", "[]"],
          twig: ["[]", "[]"],
          jinja2: ["[]", "[]"],
          django: ["[]", "[]"]
        }
      },
      {
        label: "{{ __l }}=null in loop",
        kind: "file",
        files: {
          "/t.html": "[{% for x in xs %}{{ __l }}{% endfor %}]"
        },
        loc: function () { return {"xs":[1],"__l":null}; },
        expect: {
          native: ["[]", "[]"],
          twig: ["[]", "[]"],
          jinja2: ["[]", "[]"],
          django: ["[]", "[]"]
        }
      },
      {
        label: "control {{ z }}=null",
        kind: "file",
        files: {
          "/t.html": "[{{ z }}]"
        },
        loc: function () { return {"z":null}; },
        expect: {
          native: ["[]", "[]"],
          twig: ["[]", "[]"],
          jinja2: ["[]", "[]"],
          django: ["[]", "[]"]
        }
      },
      {
        label: "{{ Math }} absent",
        kind: "file",
        files: {
          "/t.html": "[{{ Math }}]"
        },
        loc: function () { return {}; },
        expect: {
          native: ["[[object Object]]", "[[object Object]]"],
          twig: ["[[object Object]]", "[[object Object]]"],
          jinja2: ["[[object Object]]", "[[object Object]]"],
          django: ["[]", "[]"]
        }
      },
      {
        label: "jinja2 Math is none",
        kind: "file",
        files: {
          "/t.html": "{% if Math is none %}Y{% else %}N{% endif %}"
        },
        loc: function () { return {"Math":null}; },
        expect: {
          jinja2: ["Y", "Y"]
        }
      },
      {
        label: "jinja2 control z is none",
        kind: "file",
        files: {
          "/t.html": "{% if z is none %}Y{% else %}N{% endif %}"
        },
        loc: function () { return {"z":null}; },
        expect: {
          jinja2: ["Y", "Y"]
        }
      },
      {
        label: "jinja2 Math == none",
        kind: "file",
        files: {
          "/t.html": "{% if Math == none %}Y{% else %}N{% endif %}"
        },
        loc: function () { return {"Math":null}; },
        expect: {
          jinja2: ["Y", "Y"]
        }
      },
      {
        label: "twig Math is null",
        kind: "file",
        files: {
          "/t.html": "[{% if Math is null %}Y{% endif %}]"
        },
        loc: function () { return {"Math":null}; },
        expect: {
          twig: ["[Y]", "[Y]"]
        }
      },
      {
        label: "twig control z is null",
        kind: "file",
        files: {
          "/t.html": "[{% if z is null %}Y{% endif %}]"
        },
        loc: function () { return {"z":null}; },
        expect: {
          twig: ["[Y]", "[Y]"]
        }
      },
      {
        label: "django Math is None",
        kind: "file",
        files: {
          "/t.html": "{% if Math is None %}Y{% else %}N{% endif %}"
        },
        loc: function () { return {"Math":null}; },
        expect: {
          django: ["Y", "Y"]
        }
      },
      {
        label: "django control z is None",
        kind: "file",
        files: {
          "/t.html": "{% if z is None %}Y{% else %}N{% endif %}"
        },
        loc: function () { return {"z":null}; },
        expect: {
          django: ["Y", "Y"]
        }
      }
    ]
  },
  {
    name: "a name a template binds that equals an engine helper root",
    cases: [
      {
        label: "{% set _utils = 5 %}{% for i in 1..3 %}{{ i }}{% endfor %}",
        kind: "default",
        tpl: "{% set _utils = 5 %}{% for i in 1..3 %}{{ i }}{% endfor %}",
        loc: function () { return {}; },
        expect: {
          twig: ["123", "123"]
        }
      },
      {
        label: "{% set _utils = {range: 0} %}{% for i in 1..3 %}{{ i }}{% endfor %}",
        kind: "default",
        tpl: "{% set _utils = {range: 0} %}{% for i in 1..3 %}{{ i }}{% endfor %}",
        loc: function () { return {}; },
        expect: {
          twig: ["123", "123"]
        }
      },
      {
        label: "{% set _ext = 5 %}[{% if 2 is even %}Y{% endif %}]",
        kind: "default",
        tpl: "{% set _ext = 5 %}[{% if 2 is even %}Y{% endif %}]",
        loc: function () { return {}; },
        expect: {
          twig: ["[Y]", "[Y]"]
        }
      },
      {
        label: "{% for _utils in [1] %}[{% for i in 1..2 %}{{ i }}{% endfor %}]{% endfor %}",
        kind: "default",
        tpl: "{% for _utils in [1] %}[{% for i in 1..2 %}{{ i }}{% endfor %}]{% endfor %}",
        loc: function () { return {}; },
        expect: {
          twig: ["[12]", "[12]"]
        }
      },
      {
        label: "{% for _ext in [1] %}[{% if 2 is even %}Y{% endif %}]{% endfor %}",
        kind: "default",
        tpl: "{% for _ext in [1] %}[{% if 2 is even %}Y{% endif %}]{% endfor %}",
        loc: function () { return {}; },
        expect: {
          twig: ["[Y]", "[Y]"]
        }
      },
      {
        label: "{% macro m(_ext) %}[{% if 2 is even %}Y{% endif %}]{% endmacro %}{{ m(1) }}",
        kind: "default",
        tpl: "{% macro m(_ext) %}[{% if 2 is even %}Y{% endif %}]{% endmacro %}{{ m(1) }}",
        loc: function () { return {}; },
        expect: {
          twig: ["[Y]", "[Y]"]
        }
      },
      {
        label: "{% macro m(_utils) %}[{% for i in 1..2 %}{{ i }}{% endfor %}]{% endmacro %}{{ m(1) }}",
        kind: "default",
        tpl: "{% macro m(_utils) %}[{% for i in 1..2 %}{{ i }}{% endfor %}]{% endmacro %}{{ m(1) }}",
        loc: function () { return {}; },
        expect: {
          twig: ["[12]", "[12]"]
        }
      },
      {
        label: "{% set Math = 5 %}[{{ 2 ** 3 }}|{{ 7 // 2 }}]",
        kind: "default",
        tpl: "{% set Math = 5 %}[{{ 2 ** 3 }}|{{ 7 // 2 }}]",
        loc: function () { return {}; },
        expect: {
          jinja2: ["[8|3]", "[8|3]"]
        }
      },
      {
        label: "{% set Math = {\"pow\": 0} %}[{{ 2 ** 3 }}]",
        kind: "default",
        tpl: "{% set Math = {\"pow\": 0} %}[{{ 2 ** 3 }}]",
        loc: function () { return {}; },
        expect: {
          jinja2: ["[8]", "[8]"]
        }
      },
      {
        label: "{% set _utils = 5 %}[{{ [1,2,3][1:]|join(\",\") }}]",
        kind: "default",
        tpl: "{% set _utils = 5 %}[{{ [1,2,3][1:]|join(\",\") }}]",
        loc: function () { return {}; },
        expect: {
          jinja2: ["[2,3]", "[2,3]"]
        }
      },
      {
        label: "{% for Math in [1] %}[{{ 2 ** 3 }}]{% endfor %}",
        kind: "default",
        tpl: "{% for Math in [1] %}[{{ 2 ** 3 }}]{% endfor %}",
        loc: function () { return {}; },
        expect: {
          jinja2: ["[8]", "[8]"]
        }
      },
      {
        label: "{% for _ext in [1] %}[{% if 2 is even %}Y{% else %}N{% endif %}]{% endfor %}",
        kind: "default",
        tpl: "{% for _ext in [1] %}[{% if 2 is even %}Y{% else %}N{% endif %}]{% endfor %}",
        loc: function () { return {}; },
        expect: {
          jinja2: ["[Y]", "[Y]"]
        }
      },
      {
        label: "{% macro m(_ext) %}[{% if 2 is even %}Y{% else %}N{% endif %}]{% endmacro %}{{ m(1) }}",
        kind: "default",
        tpl: "{% macro m(_ext) %}[{% if 2 is even %}Y{% else %}N{% endif %}]{% endmacro %}{{ m(1) }}",
        loc: function () { return {}; },
        expect: {
          jinja2: ["[Y]", "[Y]"]
        }
      },
      {
        label: "{% macro m(Math) %}[{{ 2 ** 3 }}]{% endmacro %}{{ m(1) }}",
        kind: "default",
        tpl: "{% macro m(Math) %}[{{ 2 ** 3 }}]{% endmacro %}{{ m(1) }}",
        loc: function () { return {}; },
        expect: {
          jinja2: ["[8]", "[8]"]
        }
      },
      {
        label: "{% with _utils = 5 %}[{{ [1,2,3][1:]|join(\",\") }}]{% endwith %}",
        kind: "default",
        tpl: "{% with _utils = 5 %}[{{ [1,2,3][1:]|join(\",\") }}]{% endwith %}",
        loc: function () { return {}; },
        expect: {
          jinja2: ["[2,3]", "[2,3]"]
        }
      },
      {
        label: "{% with _utils=5 %}[{{ l[1:]|join:\",\" }}]{% endwith %}",
        kind: "default",
        tpl: "{% with _utils=5 %}[{{ l[1:]|join:\",\" }}]{% endwith %}",
        loc: function () { return {"l":[1,2,3]}; },
        expect: {
          django: ["[2,3]", "[2,3]"]
        }
      },
      {
        label: "{% for _utils in xs %}[{{ l[1:]|join:\",\" }}]{% endfor %}",
        kind: "default",
        tpl: "{% for _utils in xs %}[{{ l[1:]|join:\",\" }}]{% endfor %}",
        loc: function () { return {"l":[1,2,3],"xs":[1]}; },
        expect: {
          django: ["[2,3]", "[2,3]"]
        }
      }
    ]
  },
  {
    name: "an include inside a macro and the macro parameters",
    cases: [
      {
        label: "plain a, caller lacks a",
        kind: "file",
        files: {
          "/t.html": "{% macro m(a) %}[{% include \"p.html\" %}]{% endmacro %}{{ m(\"X\") }}",
          "/p.html": "{{ a }}"
        },
        loc: function none() { return {}; },
        expect: {
          native: ["[]", "THROW The macro \"m\" in /t.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."],
          twig: ["[]", "THROW The macro \"m\" in /t.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."],
          jinja2: ["[]", "THROW The macro \"m\" in /t.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."]
        }
      },
      {
        label: "plain a, caller holds a=OUT",
        kind: "file",
        files: {
          "/t.html": "{% macro m(a) %}[{% include \"p.html\" %}]{% endmacro %}{{ m(\"X\") }}",
          "/p.html": "{{ a }}"
        },
        loc: function () { return { a: 'OUT' }; },
        expect: {
          native: ["[]", "THROW The macro \"m\" in /t.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."],
          twig: ["[]", "THROW The macro \"m\" in /t.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."],
          jinja2: ["[]", "THROW The macro \"m\" in /t.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."]
        }
      },
      {
        label: "renamed document, caller lacks it",
        kind: "file",
        files: {
          "/t.html": "{% macro m(document) %}[{% include \"p.html\" %}]{% endmacro %}{{ m(\"X\") }}",
          "/p.html": "{{ document }}"
        },
        loc: function none() { return {}; },
        expect: {
          native: ["[X]", "THROW The macro \"m\" in /t.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."],
          twig: ["[X]", "THROW The macro \"m\" in /t.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."],
          jinja2: ["[X]", "THROW The macro \"m\" in /t.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."]
        }
      },
      {
        label: "renamed document, caller holds OUT",
        kind: "file",
        files: {
          "/t.html": "{% macro m(document) %}[{% include \"p.html\" %}]{% endmacro %}{{ m(\"X\") }}",
          "/p.html": "{{ document }}"
        },
        loc: function () { return { document: 'OUT' }; },
        expect: {
          native: ["[X]", "THROW The macro \"m\" in /t.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."],
          twig: ["[X]", "THROW The macro \"m\" in /t.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."],
          jinja2: ["[X]", "THROW The macro \"m\" in /t.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."]
        }
      },
      {
        label: "renamed _ext, caller lacks it",
        kind: "file",
        files: {
          "/t.html": "{% macro m(_ext) %}[{% include \"p.html\" %}]{% endmacro %}{{ m(\"X\") }}",
          "/p.html": "{{ _ext }}"
        },
        loc: function none() { return {}; },
        expect: {
          native: ["[X]", "THROW The macro \"m\" in /t.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."],
          twig: ["[X]", "THROW The macro \"m\" in /t.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."],
          jinja2: ["[X]", "THROW The macro \"m\" in /t.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."]
        }
      },
      {
        label: "renamed document, body reads it too",
        kind: "file",
        files: {
          "/t.html": "{% macro m(document) %}<{{ document }}>[{% include \"p.html\" %}]{% endmacro %}{{ m(\"X\") }}",
          "/p.html": "{{ document }}"
        },
        loc: function none() { return {}; },
        expect: {
          native: ["<X>[X]", "THROW The macro \"m\" in /t.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."],
          twig: ["&lt;X&gt;[X]", "THROW The macro \"m\" in /t.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."],
          jinja2: ["&lt;X&gt;[X]", "THROW The macro \"m\" in /t.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."]
        }
      }
    ]
  },
  {
    name: "a loop variable named like a global over missing items",
    cases: [
      {
        label: "for Math over [undefined, null, 1]",
        kind: "file",
        files: {
          "/t.html": "{% for Math in items %}[{{ Math }}]{% endfor %}"
        },
        loc: function items() { return { items: [undefined, null, 1] }; },
        expect: {
          native: ["[][][1]", "[][][1]"],
          twig: ["[][][1]", "[][][1]"],
          jinja2: ["[][][1]", "[][][1]"],
          django: ["[][][1]", "[][][1]"]
        }
      },
      {
        label: "for JSON over [undefined, null, 1]",
        kind: "file",
        files: {
          "/t.html": "{% for JSON in items %}[{{ JSON }}]{% endfor %}"
        },
        loc: function items() { return { items: [undefined, null, 1] }; },
        expect: {
          native: ["[][][1]", "[][][1]"],
          twig: ["[][][1]", "[][][1]"],
          jinja2: ["[][][1]", "[][][1]"],
          django: ["[][][1]", "[][][1]"]
        }
      },
      {
        label: "for document over [undefined, null, 1]",
        kind: "file",
        files: {
          "/t.html": "{% for document in items %}[{{ document }}]{% endfor %}"
        },
        loc: function items() { return { items: [undefined, null, 1] }; },
        expect: {
          native: ["[][][1]", "[][][1]"],
          twig: ["[][][1]", "[][][1]"],
          jinja2: ["[][][1]", "[][][1]"],
          django: ["[][][1]", "[][][1]"]
        }
      },
      {
        label: "control: for x over [undefined, null, 1]",
        kind: "file",
        files: {
          "/t.html": "{% for x in items %}[{{ x }}]{% endfor %}"
        },
        loc: function items() { return { items: [undefined, null, 1] }; },
        expect: {
          native: ["[][][1]", "[][][1]"],
          twig: ["[][][1]", "[][][1]"],
          jinja2: ["[][][1]", "[][][1]"],
          django: ["[][][1]", "[][][1]"]
        }
      },
      {
        label: "for k, Math over {a: undefined, b: 1}",
        kind: "file",
        files: {
          "/t.html": "{% for k, Math in obj %}[{{ k }}={{ Math }}]{% endfor %}"
        },
        loc: function () { return { obj: { a: undefined, b: 1 } }; },
        expect: {
          native: ["[a=][b=1]", "[a=][b=1]"],
          twig: ["[a=][b=1]", "[a=][b=1]"],
          jinja2: ["[a=][b=1]", "[a=][b=1]"]
        }
      },
      {
        label: "django for k, Math over d.items",
        kind: "file",
        files: {
          "/t.html": "{% for k, Math in obj.items %}[{{ k }}={{ Math }}]{% endfor %}"
        },
        loc: function () { return { obj: { a: undefined, b: 1 } }; },
        expect: {
          django: ["[a=][b=1]", "[a=][b=1]"]
        }
      }
    ]
  },
  {
    name: "which macros record the names they read on the async import path",
    cases: [
      {
        label: "control, records: m(a) {{ a }}",
        kind: "compile",
        tpl: "{% macro m(a) %}{{ a }}{% endmacro %}",
        expect: {
          native: "records",
          twig: "records",
          jinja2: "records"
        }
      },
      {
        label: "m(document) {{ document }}",
        kind: "compile",
        tpl: "{% macro m(document) %}{{ document }}{% endmacro %}",
        expect: {
          native: "records",
          twig: "records",
          jinja2: "records"
        }
      },
      {
        label: "m(_ext) {{ _ext }}",
        kind: "compile",
        tpl: "{% macro m(_ext) %}{{ _ext }}{% endmacro %}",
        expect: {
          native: "records",
          twig: "records",
          jinja2: "records"
        }
      },
      {
        label: "control, whole: m(a) {{ fn(_ctx) }}",
        kind: "compile",
        tpl: "{% macro m(a) %}{{ fn(_ctx) }}{% endmacro %}",
        expect: {
          native: "whole",
          twig: "whole",
          jinja2: "whole"
        }
      },
      {
        label: "m() {{ Math.PI }}",
        kind: "compile",
        tpl: "{% macro m() %}[{{ Math.PI }}]{% endmacro %}",
        expect: {
          native: "records",
          twig: "records",
          jinja2: "records"
        }
      },
      {
        label: "m(x) {{ encodeURIComponent(x) }}",
        kind: "compile",
        tpl: "{% macro m(x) %}[{{ encodeURIComponent(x) }}]{% endmacro %}",
        expect: {
          native: "records",
          twig: "records",
          jinja2: "records"
        }
      },
      {
        label: "m() {{ toString }}",
        kind: "compile",
        tpl: "{% macro m() %}[{{ toString }}]{% endmacro %}",
        expect: {
          native: "records",
          twig: "records",
          jinja2: "records"
        }
      },
      {
        label: "m(document) {{ document }}",
        kind: "compile",
        tpl: "{% macro m(document) %}[{{ document }}]{% endmacro %}",
        expect: {
          native: "records",
          twig: "records",
          jinja2: "records"
        }
      },
      {
        label: "m(xs) holding for Math",
        kind: "compile",
        tpl: "{% macro m(xs) %}{% for Math in xs %}{% endfor %}{% endmacro %}",
        expect: {
          native: "records",
          twig: "records",
          jinja2: "records"
        }
      },
      {
        label: "m(o) holding for Math, v",
        kind: "compile",
        tpl: "{% macro m(o) %}{% for Math, v in o %}{% endfor %}{% endmacro %}",
        expect: {
          native: "records",
          twig: "records",
          jinja2: "records"
        }
      },
      {
        label: "jinja2 m(xs) holding a loop filter on Math",
        kind: "compile",
        tpl: "{% macro m(xs) %}{% for Math in xs if Math %}{% endfor %}{% endmacro %}",
        expect: {
          jinja2: "records"
        }
      }
    ]
  },
  {
    name: "reads after a loop that bound a global name",
    cases: [
      {
        label: "for Math over [1], then Math.PI",
        kind: "file",
        files: {
          "/t.html": "{% for Math in xs %}{% endfor %}[{{ Math.PI }}]"
        },
        loc: function () { return { xs: [1] }; },
        expect: {
          native: ["[3.141592653589793]", "[3.141592653589793]"],
          twig: ["[3.141592653589793]", "[3.141592653589793]"],
          jinja2: ["[3.141592653589793]", "[3.141592653589793]"],
          django: ["[]", "[]"]
        }
      },
      {
        label: "for Math over [undefined]: inside, then Math.PI",
        kind: "file",
        files: {
          "/t.html": "{% for Math in xs %}[{{ Math }}]{% endfor %}[{{ Math.PI }}]"
        },
        loc: function () { return { xs: [undefined] }; },
        expect: {
          native: ["[][3.141592653589793]", "[][3.141592653589793]"],
          twig: ["[][3.141592653589793]", "[][3.141592653589793]"],
          jinja2: ["[][3.141592653589793]", "[][3.141592653589793]"],
          django: ["[][]", "[][]"]
        }
      },
      {
        label: "for k, Math over {a: 1}, then Math.PI",
        kind: "file",
        files: {
          "/t.html": "{% for k, Math in o %}{% endfor %}[{{ Math.PI }}]"
        },
        loc: function () { return { o: { a: 1 } }; },
        expect: {
          native: ["[3.141592653589793]", "[3.141592653589793]"],
          twig: ["[3.141592653589793]", "[3.141592653589793]"],
          jinja2: ["[3.141592653589793]", "[3.141592653589793]"],
          django: ["[]", "[]"]
        }
      },
      {
        label: "for Math over [1], then Math is defined",
        kind: "file",
        files: {
          "/t.html": "{% for Math in xs %}{% endfor %}[{% if Math is defined %}Y{% endif %}]"
        },
        loc: function () { return { xs: [1] }; },
        expect: {
          twig: ["[Y]", "[Y]"],
          jinja2: ["[Y]", "[Y]"]
        }
      },
      {
        label: "macro m(Math) called bare, then Math.PI",
        kind: "file",
        files: {
          "/t.html": "{% macro m(Math) %}[{{ Math }}]{% endmacro %}{{ m() }}[{{ Math.PI }}]"
        },
        loc: function () { return {}; },
        expect: {
          native: ["[][3.141592653589793]", "[][3.141592653589793]"],
          twig: ["[][3.141592653589793]", "[][3.141592653589793]"],
          jinja2: ["[][3.141592653589793]", "[][3.141592653589793]"]
        }
      },
      {
        label: "control: no loop, Math.PI",
        kind: "file",
        files: {
          "/t.html": "[{{ Math.PI }}]"
        },
        loc: function () { return {}; },
        expect: {
          native: ["[3.141592653589793]", "[3.141592653589793]"],
          twig: ["[3.141592653589793]", "[3.141592653589793]"],
          jinja2: ["[3.141592653589793]", "[3.141592653589793]"],
          django: ["[]", "[]"]
        }
      },
      {
        label: "for Math, v over {a: 1} (key named Math), then Math.PI",
        kind: "file",
        files: {
          "/t.html": "{% for Math, v in o %}{% endfor %}[{{ Math.PI }}]",
          "/p.html": "x"
        },
        loc: function () { return { o: { a: 1 } }; },
        expect: {
          native: ["[3.141592653589793]", "[3.141592653589793]"],
          twig: ["[3.141592653589793]", "[3.141592653589793]"],
          jinja2: ["[3.141592653589793]", "[3.141592653589793]"],
          django: ["[]", "[]"]
        }
      },
      {
        label: "jinja2 loop filter keeping some, then Math.PI",
        kind: "file",
        files: {
          "/t.html": "{% for Math in xs if Math %}{% endfor %}[{{ Math.PI }}]",
          "/p.html": "x"
        },
        loc: function () { return { xs: [1, 0] }; },
        expect: {
          jinja2: ["[3.141592653589793]", "[3.141592653589793]"]
        }
      },
      {
        label: "jinja2 loop filter keeping none, then Math.PI",
        kind: "file",
        files: {
          "/t.html": "{% for Math in xs if Math > 5 %}{% endfor %}[{{ Math.PI }}]",
          "/p.html": "x"
        },
        loc: function () { return { xs: [1] }; },
        expect: {
          jinja2: ["[3.141592653589793]", "[3.141592653589793]"]
        }
      },
      {
        label: "jinja2 loop filter, key named Math, then Math.PI",
        kind: "file",
        files: {
          "/t.html": "{% for Math, v in o if v %}{% endfor %}[{{ Math.PI }}]",
          "/p.html": "x"
        },
        loc: function () { return { o: { a: 1 } }; },
        expect: {
          jinja2: ["[3.141592653589793]", "[3.141592653589793]"]
        }
      },
      {
        label: "body with an include (async: eachAsync), then Math.PI",
        kind: "file",
        files: {
          "/t.html": "{% for Math in xs %}{% include \"p.html\" %}{% endfor %}[{{ Math.PI }}]",
          "/p.html": "x"
        },
        loc: function () { return { xs: [1] }; },
        expect: {
          native: ["x[3.141592653589793]", "x[3.141592653589793]"],
          twig: ["x[3.141592653589793]", "x[3.141592653589793]"],
          jinja2: ["x[3.141592653589793]", "x[3.141592653589793]"],
          django: ["x[]", "x[]"]
        }
      },
      {
        label: "context had Math = \"M\", loop, then Math",
        kind: "file",
        files: {
          "/t.html": "{% for Math in xs %}{% endfor %}[{{ Math }}]",
          "/p.html": "x"
        },
        loc: function () { return { Math: 'M', xs: [1] }; },
        expect: {
          native: ["[M]", "[M]"],
          twig: ["[M]", "[M]"],
          jinja2: ["[M]", "[M]"],
          django: ["[M]", "[M]"]
        }
      },
      {
        label: "context had Math = null, loop, then Math",
        kind: "file",
        files: {
          "/t.html": "{% for Math in xs %}{% endfor %}[{{ Math }}]",
          "/p.html": "x"
        },
        loc: function () { return { Math: null, xs: [1] }; },
        expect: {
          native: ["[]", "[]"],
          twig: ["[]", "[]"],
          jinja2: ["[]", "[]"],
          django: ["[]", "[]"]
        }
      },
      {
        label: "nested loops named Math, then Math.PI",
        kind: "file",
        files: {
          "/t.html": "{% for Math in xs %}{% for Math in ys %}{% endfor %}[{{ Math }}]{% endfor %}[{{ Math.PI }}]",
          "/p.html": "x"
        },
        loc: function () { return { xs: [1], ys: [2] }; },
        expect: {
          native: ["[1][3.141592653589793]", "[1][3.141592653589793]"],
          twig: ["[1][3.141592653589793]", "[1][3.141592653589793]"],
          jinja2: ["[1][3.141592653589793]", "[1][3.141592653589793]"],
          django: ["[1][]", "[1][]"]
        }
      },
      {
        label: "jinja2 empty loop with else, then Math.PI",
        kind: "file",
        files: {
          "/t.html": "{% for Math in xs %}{% else %}E{% endfor %}[{{ Math.PI }}]",
          "/p.html": "x"
        },
        loc: function () { return { xs: [] }; },
        expect: {
          jinja2: ["E[3.141592653589793]", "E[3.141592653589793]"]
        }
      },
      {
        label: "django empty loop with empty, then Math.PI",
        kind: "file",
        files: {
          "/t.html": "{% for Math in xs %}{% empty %}E{% endfor %}[{{ Math.PI }}]",
          "/p.html": "x"
        },
        loc: function () { return { xs: [] }; },
        expect: {
          django: ["E[]", "E[]"]
        }
      },
      {
        label: "for JSON over [1], then JSON.stringify(o)",
        kind: "file",
        files: {
          "/t.html": "{% for JSON in xs %}{% endfor %}[{{ JSON.stringify(o) }}]",
          "/p.html": "x"
        },
        loc: function () { return { xs: [1], o: { a: 1 } }; },
        expect: {
          native: ["[{\"a\":1}]", "[{\"a\":1}]"],
          twig: ["[{&quot;a&quot;:1}]", "[{&quot;a&quot;:1}]"],
          jinja2: ["[{&quot;a&quot;:1}]", "[{&quot;a&quot;:1}]"]
        }
      },
      {
        label: "control, plain name: for x over [1], then x",
        kind: "file",
        files: {
          "/t.html": "{% for x in xs %}{% endfor %}[{{ x }}]",
          "/p.html": "x"
        },
        loc: function () { return { xs: [1] }; },
        expect: {
          native: ["[]", "[]"],
          twig: ["[]", "[]"],
          jinja2: ["[]", "[]"],
          django: ["[]", "[]"]
        }
      }
    ]
  },
  {
    name: "reads that templates rely on",
    cases: [
      {
        label: "set timestamp = Date.now()",
        kind: "file",
        files: {
          "/t.html": "{% set timestamp = Date.now() %}[{% if timestamp > 0 %}Y{% endif %}]",
          "/p.html": "x"
        },
        loc: function none() { return {}; },
        expect: {
          native: ["[Y]", "[Y]"],
          twig: ["[Y]", "[Y]"],
          jinja2: ["[Y]", "[Y]"]
        }
      },
      {
        label: "JSON.stringify(o)",
        kind: "file",
        files: {
          "/t.html": "[{{ JSON.stringify(o) }}]",
          "/p.html": "x"
        },
        loc: function () { return { o: { a: 1 } }; },
        expect: {
          native: ["[{\"a\":1}]", "[{\"a\":1}]"],
          twig: ["[{&quot;a&quot;:1}]", "[{&quot;a&quot;:1}]"],
          jinja2: ["[{&quot;a&quot;:1}]", "[{&quot;a&quot;:1}]"]
        }
      },
      {
        label: "encodeURIComponent(s)",
        kind: "file",
        files: {
          "/t.html": "[{{ encodeURIComponent(s) }}]",
          "/p.html": "x"
        },
        loc: function () { return { s: 'a b&c' }; },
        expect: {
          native: ["[a%20b%26c]", "[a%20b%26c]"],
          twig: ["[a%20b%26c]", "[a%20b%26c]"],
          jinja2: ["[a%20b%26c]", "[a%20b%26c]"]
        }
      },
      {
        label: "Math.round(x)",
        kind: "file",
        files: {
          "/t.html": "[{{ Math.round(x) }}]",
          "/p.html": "x"
        },
        loc: function () { return { x: 2.6 }; },
        expect: {
          native: ["[3]", "[3]"],
          twig: ["[3]", "[3]"],
          jinja2: ["[3]", "[3]"]
        }
      },
      {
        label: "Math.floor(a / b)",
        kind: "file",
        files: {
          "/t.html": "[{{ Math.floor(a / b) }}]",
          "/p.html": "x"
        },
        loc: function () { return { a: 7, b: 2 }; },
        expect: {
          native: ["[3]", "[3]"],
          twig: ["[3]", "[3]"],
          jinja2: ["[3]", "[3]"]
        }
      },
      {
        label: "macro m(a, b) called m(\"X\"), caller b=OUT",
        kind: "file",
        files: {
          "/t.html": "{% macro m(a, b) %}[{{ a }}|{{ b }}]{% endmacro %}{{ m(\"X\") }}",
          "/p.html": "x"
        },
        loc: function () { return { b: 'OUT' }; },
        expect: {
          native: ["[X|]", "[X|]"],
          twig: ["[X|]", "[X|]"],
          jinja2: ["[X|]", "[X|]"]
        }
      },
      {
        label: "macro m(a, b) called m(\"X\", \"Y\")",
        kind: "file",
        files: {
          "/t.html": "{% macro m(a, b) %}[{{ a }}|{{ b }}]{% endmacro %}{{ m(\"X\", \"Y\") }}",
          "/p.html": "x"
        },
        loc: function none() { return {}; },
        expect: {
          native: ["[X|Y]", "[X|Y]"],
          twig: ["[X|Y]", "[X|Y]"],
          jinja2: ["[X|Y]", "[X|Y]"]
        }
      },
      {
        label: "jinja2 macro m(a, b=\"D\") called m(\"X\")",
        kind: "file",
        files: {
          "/t.html": "{% macro m(a, b=\"D\") %}[{{ a }}|{{ b }}]{% endmacro %}{{ m(\"X\") }}",
          "/p.html": "x"
        },
        loc: function none() { return {}; },
        expect: {
          jinja2: ["[X|D]", "[X|D]"]
        }
      },
      {
        label: "m(true, false): true, false as variables",
        kind: "file",
        files: {
          "/t.html": "{% macro m(a, b) %}[{{ a }}|{{ b }}]{% endmacro %}{{ m(true, false) }}",
          "/p.html": "x"
        },
        loc: function none() { return {}; },
        expect: {
          native: ["[true|false]", "[true|false]"],
          twig: ["[true|false]", "[true|false]"],
          jinja2: ["[true|false]", "[true|false]"]
        }
      },
      {
        label: "set flags = [true, false]",
        kind: "file",
        files: {
          "/t.html": "{% set flags = [true, false] %}[{{ flags|join(\"-\") }}]",
          "/p.html": "x"
        },
        loc: function none() { return {}; },
        expect: {
          native: ["[true-false]", "[true-false]"],
          twig: ["[true-false]", "[true-false]"],
          jinja2: ["[true-false]", "[true-false]"]
        }
      },
      {
        label: "sync import, sibling macro call",
        kind: "file",
        files: {
          "/t.html": "{% import \"m.html\" as mm %}{{ mm.b() }}",
          "/p.html": "x",
          "/m.html": "{% macro a() %}A{% endmacro %}{% macro b() %}[{{ a() }}]{% endmacro %}"
        },
        loc: function none() { return {}; },
        expect: {
          native: ["[A]", "[A]"],
          twig: ["[A]", "[A]"],
          jinja2: ["[A]", "[A]"]
        }
      },
      {
        label: "from import, sibling macro call",
        kind: "file",
        files: {
          "/t.html": "{% from \"m.html\" import b %}{{ b() }}",
          "/p.html": "x",
          "/m.html": "{% macro a() %}A{% endmacro %}{% macro b() %}[{{ a() }}]{% endmacro %}"
        },
        loc: function none() { return {}; },
        expect: {
          twig: ["[A]", "[A]"],
          jinja2: ["[A]", "[A]"]
        }
      },
      {
        label: "for document over [{status: a}, null]",
        kind: "file",
        files: {
          "/t.html": "{% for document in documents %}[{{ document.status }}]{% endfor %}",
          "/p.html": "x"
        },
        loc: function () { return { documents: [{ status: 'a' }, null] }; },
        expect: {
          native: ["[a][]", "[a][]"],
          twig: ["[a][]", "[a][]"],
          jinja2: ["[a][]", "[a][]"],
          django: ["[a][]", "[a][]"]
        }
      },
      {
        label: "for document, then document after the loop",
        kind: "file",
        files: {
          "/t.html": "{% for document in documents %}{% endfor %}[{{ document }}]",
          "/p.html": "x"
        },
        loc: function () { return { documents: [{ status: 'a' }] }; },
        expect: {
          native: ["[]", "[]"],
          twig: ["[]", "[]"],
          jinja2: ["[]", "[]"],
          django: ["[]", "[]"]
        }
      },
      {
        label: "document.status from the context",
        kind: "file",
        files: {
          "/t.html": "[{{ document.status }}]",
          "/p.html": "x"
        },
        loc: function () { return { document: { status: 'z' } }; },
        expect: {
          native: ["[z]", "[z]"],
          twig: ["[z]", "[z]"],
          jinja2: ["[z]", "[z]"],
          django: ["[z]", "[z]"]
        }
      },
      {
        label: "for document with loop.index",
        kind: "file",
        files: {
          "/t.html": "{% for document in documents %}[{{ loop.index }}{{ document.status }}]{% endfor %}",
          "/p.html": "x"
        },
        loc: function () { return { documents: [{ status: 'a' }, { status: 'b' }] }; },
        expect: {
          native: ["[1a][2b]", "[1a][2b]"],
          twig: ["[1a][2b]", "[1a][2b]"],
          jinja2: ["[1a][2b]", "[1a][2b]"],
          django: ["[a][b]", "[a][b]"]
        }
      },
      {
        label: "{{ this }}, no locals",
        kind: "file",
        files: {
          "/t.html": "[{{ this }}]",
          "/p.html": "x"
        },
        loc: function none() { return {}; },
        expect: {
          native: ["THROW Reserved keyword \"this\" attempted to be used as a variable on line 1 in file /t.html.", "THROW Reserved keyword \"this\" attempted to be used as a variable on line 1 in file /t.html."],
          twig: ["THROW Reserved keyword \"this\" attempted to be used as a variable on line 1 in file /t.html.", "THROW Reserved keyword \"this\" attempted to be used as a variable on line 1 in file /t.html."],
          jinja2: ["THROW Reserved keyword \"this\" attempted to be used as a variable on line 1 in file /t.html.", "THROW Reserved keyword \"this\" attempted to be used as a variable on line 1 in file /t.html."],
          django: ["THROW Reserved keyword \"this\" attempted to be used as a variable on line 1 in file /t.html.", "THROW Reserved keyword \"this\" attempted to be used as a variable on line 1 in file /t.html."]
        }
      },
      {
        label: "{{ this }}, key this = \"T\"",
        kind: "file",
        files: {
          "/t.html": "[{{ this }}]",
          "/p.html": "x"
        },
        loc: function () { return { 'this': 'T' }; },
        expect: {
          native: ["THROW Reserved keyword \"this\" attempted to be used as a variable on line 1 in file /t.html.", "THROW Reserved keyword \"this\" attempted to be used as a variable on line 1 in file /t.html."],
          twig: ["THROW Reserved keyword \"this\" attempted to be used as a variable on line 1 in file /t.html.", "THROW Reserved keyword \"this\" attempted to be used as a variable on line 1 in file /t.html."],
          jinja2: ["THROW Reserved keyword \"this\" attempted to be used as a variable on line 1 in file /t.html.", "THROW Reserved keyword \"this\" attempted to be used as a variable on line 1 in file /t.html."],
          django: ["THROW Reserved keyword \"this\" attempted to be used as a variable on line 1 in file /t.html.", "THROW Reserved keyword \"this\" attempted to be used as a variable on line 1 in file /t.html."]
        }
      },
      {
        label: "if this, no locals",
        kind: "file",
        files: {
          "/t.html": "[{% if this %}Y{% endif %}]",
          "/p.html": "x"
        },
        loc: function none() { return {}; },
        expect: {
          native: ["THROW Reserved keyword \"this\" attempted to be used as a variable on line 1 in file /t.html.", "THROW Reserved keyword \"this\" attempted to be used as a variable on line 1 in file /t.html."],
          twig: ["THROW Reserved keyword \"this\" attempted to be used as a variable on line 1 in file /t.html.", "THROW Reserved keyword \"this\" attempted to be used as a variable on line 1 in file /t.html."],
          jinja2: ["THROW Reserved keyword \"this\" attempted to be used as a variable on line 1 in file /t.html.", "THROW Reserved keyword \"this\" attempted to be used as a variable on line 1 in file /t.html."]
        }
      },
      {
        label: "key setTimeout = null",
        kind: "file",
        files: {
          "/t.html": "[{{ setTimeout }}]",
          "/p.html": "x"
        },
        loc: function () { return { setTimeout: null }; },
        expect: {
          native: ["[function setTimeout(callback, after, ...args) {\n  validateFunction(callback, 'callback');\n  const timeout = new Timeout(callback, after, args.length ? args : undefined, false, true);\n  insert(timeout, timeout._idleTimeout);\n  return timeout;\n}]", "[function setTimeout(callback, after, ...args) {\n  validateFunction(callback, 'callback');\n  const timeout = new Timeout(callback, after, args.length ? args : undefined, false, true);\n  insert(timeout, timeout._idleTimeout);\n  return timeout;\n}]"],
          twig: ["[function setTimeout(callback, after, ...args) {\n  validateFunction(callback, 'callback');\n  const timeout = new Timeout(callback, after, args.length ? args : undefined, false, true);\n  insert(timeout, timeout._idleTimeout);\n  return timeout;\n}]", "[function setTimeout(callback, after, ...args) {\n  validateFunction(callback, 'callback');\n  const timeout = new Timeout(callback, after, args.length ? args : undefined, false, true);\n  insert(timeout, timeout._idleTimeout);\n  return timeout;\n}]"],
          jinja2: ["[function setTimeout(callback, after, ...args) {\n  validateFunction(callback, 'callback');\n  const timeout = new Timeout(callback, after, args.length ? args : undefined, false, true);\n  insert(timeout, timeout._idleTimeout);\n  return timeout;\n}]", "[function setTimeout(callback, after, ...args) {\n  validateFunction(callback, 'callback');\n  const timeout = new Timeout(callback, after, args.length ? args : undefined, false, true);\n  insert(timeout, timeout._idleTimeout);\n  return timeout;\n}]"],
          django: ["[]", "[]"]
        }
      },
      {
        label: "setTimeout, no key",
        kind: "file",
        files: {
          "/t.html": "[{{ setTimeout }}]",
          "/p.html": "x"
        },
        loc: function none() { return {}; },
        expect: {
          native: ["[function setTimeout(callback, after, ...args) {\n  validateFunction(callback, 'callback');\n  const timeout = new Timeout(callback, after, args.length ? args : undefined, false, true);\n  insert(timeout, timeout._idleTimeout);\n  return timeout;\n}]", "[function setTimeout(callback, after, ...args) {\n  validateFunction(callback, 'callback');\n  const timeout = new Timeout(callback, after, args.length ? args : undefined, false, true);\n  insert(timeout, timeout._idleTimeout);\n  return timeout;\n}]"],
          twig: ["[function setTimeout(callback, after, ...args) {\n  validateFunction(callback, 'callback');\n  const timeout = new Timeout(callback, after, args.length ? args : undefined, false, true);\n  insert(timeout, timeout._idleTimeout);\n  return timeout;\n}]", "[function setTimeout(callback, after, ...args) {\n  validateFunction(callback, 'callback');\n  const timeout = new Timeout(callback, after, args.length ? args : undefined, false, true);\n  insert(timeout, timeout._idleTimeout);\n  return timeout;\n}]"],
          jinja2: ["[function setTimeout(callback, after, ...args) {\n  validateFunction(callback, 'callback');\n  const timeout = new Timeout(callback, after, args.length ? args : undefined, false, true);\n  insert(timeout, timeout._idleTimeout);\n  return timeout;\n}]", "[function setTimeout(callback, after, ...args) {\n  validateFunction(callback, 'callback');\n  const timeout = new Timeout(callback, after, args.length ? args : undefined, false, true);\n  insert(timeout, timeout._idleTimeout);\n  return timeout;\n}]"],
          django: ["[]", "[]"]
        }
      },
      {
        label: "control, key Math = null",
        kind: "file",
        files: {
          "/t.html": "[{{ Math }}]",
          "/p.html": "x"
        },
        loc: function () { return { Math: null }; },
        expect: {
          native: ["[]", "[]"],
          twig: ["[]", "[]"],
          jinja2: ["[]", "[]"],
          django: ["[]", "[]"]
        }
      },
      {
        label: "key process = null",
        kind: "file",
        files: {
          "/t.html": "[{{ process }}]",
          "/p.html": "x"
        },
        loc: function () { return { process: null }; },
        expect: {
          native: ["[]", "[]"],
          twig: ["[]", "[]"],
          jinja2: ["[]", "[]"],
          django: ["[]", "[]"]
        }
      }
    ]
  },
  {
    name: "swig-django reads of members an object gets from Object.prototype",
    cases: [
      {
        label: "bare toString",
        kind: "django",
        tpl: "[{{ toString }}]",
        loc: function () { return {}; },
        expect: {
          django: ["[]", "[]"]
        }
      },
      {
        label: "o.toString over {}",
        kind: "django",
        tpl: "[{{ o.toString }}]",
        loc: function () { return { o: {} }; },
        expect: {
          django: ["[]", "[]"]
        }
      },
      {
        label: "o.hasOwnProperty over {}",
        kind: "django",
        tpl: "[{{ o.hasOwnProperty }}]",
        loc: function () { return { o: {} }; },
        expect: {
          django: ["[]", "[]"]
        }
      },
      {
        label: "own key toString = \"T\"",
        kind: "django",
        tpl: "[{{ o.toString }}]",
        loc: function () { return { o: { toString: 'T' } }; },
        expect: {
          django: ["[T]", "[T]"]
        }
      },
      {
        label: "own function f",
        kind: "django",
        tpl: "[{{ o.f }}]",
        loc: function () { return { o: { f: function () { return 'F'; } } }; },
        expect: {
          django: ["[F]", "[F]"]
        }
      },
      {
        label: "Object.prototype.zz = \"Z\"",
        kind: "django",
        tpl: "[{{ o.zz }}|{{ zz }}]",
        proto: ["zz", "Z"],
        loc: function () { return { o: {} }; },
        expect: {
          django: ["[Z|Z]", "[Z|Z]"]
        }
      },
      {
        label: "Object.prototype.zf = function",
        kind: "django",
        tpl: "[{{ o.zf }}|{{ zf }}]",
        proto: ["zf", function () { return 'ZF'; }],
        loc: function () { return { o: {} }; },
        expect: {
          django: ["[|]", "[|]"]
        }
      },
      {
        label: "Proxy answering \"P\"",
        kind: "django",
        tpl: "[{{ p.toString }}|{{ p.other }}]",
        loc: function () { return { p: proxyAll('P') }; },
        expect: {
          django: ["[P|P]", "[P|P]"]
        }
      },
      {
        label: "Proxy answering a function",
        kind: "django",
        tpl: "[{{ p.toString }}|{{ p.other }}]",
        loc: function () { return { p: proxyAll(function () { return 'PF'; }) }; },
        expect: {
          django: ["[|PF]", "[|PF]"]
        }
      },
      {
        label: "null-prototype object",
        kind: "django",
        tpl: "[{{ n.toString }}]",
        loc: function () { return { n: Object.create(null) }; },
        expect: {
          django: ["[]", "[]"]
        }
      },
      {
        label: "string toString",
        kind: "django",
        tpl: "[{{ s.toString }}]",
        loc: function () { return { s: 'abc' }; },
        expect: {
          django: ["[abc]", "[abc]"]
        }
      },
      {
        label: "class method toString",
        kind: "django",
        tpl: "[{{ c.toString }}]",
        loc: function () { return { c: new C() }; },
        expect: {
          django: ["[C]", "[C]"]
        }
      }
    ]
  },
  {
    name: "super and parent are read as names",
    cases: [
      {
        label: "read parent",
        kind: "file",
        files: {
          "/t.html": "[{{ parent }}]"
        },
        loc: function () { return {"parent":"v"}; },
        expect: {
          twig: ["[v]", "[v]"]
        }
      },
      {
        label: "read super",
        kind: "file",
        files: {
          "/t.html": "[{{ super }}]"
        },
        loc: function () { return {"super":"v"}; },
        expect: {
          jinja2: ["[v]", "[v]"]
        }
      },
      {
        label: "dotted read parent",
        kind: "file",
        files: {
          "/t.html": "[{{ parent.y }}]"
        },
        loc: function () { return {"parent":{"y":"Y"}}; },
        expect: {
          twig: ["[Y]", "[Y]"]
        }
      },
      {
        label: "dotted read super",
        kind: "file",
        files: {
          "/t.html": "[{{ super.y }}]"
        },
        loc: function () { return {"super":{"y":"Y"}}; },
        expect: {
          jinja2: ["[Y]", "[Y]"]
        }
      }
    ]
  },
  {
    name: "a one-name loop binds no key name",
    cases: [
      {
        label: "{{ __k }} inside a one-name loop",
        kind: "file",
        files: {
          "/t.html": "[{% for x in xs %}{{ __k }}{% endfor %}]"
        },
        loc: function () { return {"xs":[1,2]}; },
        expect: {
          native: ["[]", "[]"]
        }
      },
      {
        label: "{{ __k }} inside a one-name loop",
        kind: "file",
        files: {
          "/t.html": "[{% for x in xs %}{{ __k }}{% endfor %}]"
        },
        loc: function () { return {"xs":[1,2]}; },
        expect: {
          twig: ["[]", "[]"]
        }
      },
      {
        label: "{{ __k }} inside a one-name loop",
        kind: "file",
        files: {
          "/t.html": "[{% for x in xs %}{{ __k }}{% endfor %}]"
        },
        loc: function () { return {"xs":[1,2]}; },
        expect: {
          jinja2: ["[]", "[]"]
        }
      }
    ]
  }
];

describe('Variable reads', function () {
  GROUPS.forEach(function (g) {
    describe(g.name, function () {
      g.cases.forEach(function (c) {
        Object.keys(c.expect).forEach(function (f) {
          var want = c.expect[f];
          if (c.kind === 'compile') {
            it(c.label + ' (' + f + ')', function () {
              expect(run(c, f, false)).to.equal(want);
            });
            return;
          }
          it(c.label + ' (' + f + ', sync)', function () {
            expect(run(c, f, false)).to.equal(want[0]);
          });
          if (want[1] === null) { return; }
          it(c.label + ' (' + f + ', async)', function () {
            return run(c, f, true).then(function (out) { expect(out).to.equal(want[1]); });
          });
        });
      });
    });
  });
});
