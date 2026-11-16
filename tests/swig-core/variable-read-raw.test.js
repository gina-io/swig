var twig = require('../../packages/swig-twig'),
  jinja2 = require('../../packages/swig-jinja2'),
  django = require('../../packages/swig-django'),
  loaders = require('../../packages/swig-core/lib/loaders'),
  expect = require('../lib/expect.js');

/*!
 * Python's ==, != and in (swig-jinja2 and swig-django), `is defined`
 * (swig-jinja2 and swig-twig) and `??` (swig-twig) over a name an object
 * gets only from Object.prototype, a reserved word and a name the compiled
 * code uses itself, with and without a context key of that name, bare and
 * dotted, beside plain names as controls. Such a name is read from the
 * context only, or as missing when only Object.prototype gives it, so the
 * comparison and the existence test see what a template sees. swig-django
 * reads every name through its resolver; its rows are the same shapes. Each
 * case runs on the sync and the async render paths; the expectations are
 * generated and were checked against recorded renders of the same shapes.
 */
var CTORS = { twig: twig.Twig, jinja2: jinja2.Jinja2, django: django.Django };

function make(f, src, isAsync) {
  var mem = loaders.memory({ '/page.html': src }, '/'), loader = mem;
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

function renderSync(f, src, locals) {
  try { return make(f, src, false).renderFile('/page.html', locals); } catch (e) { return 'THROW ' + e.message; }
}

function renderAsync(f, src, locals) {
  return new Promise(function (resolve) {
    try {
      make(f, src, true).renderFile('/page.html', locals, function (err, out) {
        resolve(err ? 'THROW ' + err.message : out);
      });
    } catch (e) { resolve('THROW ' + e.message); }
  });
}

var GROUPS = [
  {
    name: "swig-jinja2 ==, != and in",
    cases: [
      {
        label: "toString == none, no key",
        flavor: "jinja2",
        src: "[{% if toString == none %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "toString == \"T\", own key",
        flavor: "jinja2",
        src: "[{% if toString == \"T\" %}Y{% else %}N{% endif %}]",
        loc: function () { return {"toString":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "toString != \"T\", no key",
        flavor: "jinja2",
        src: "[{% if toString != \"T\" %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "toString in lst, own key",
        flavor: "jinja2",
        src: "[{% if toString in lst %}Y{% else %}N{% endif %}]",
        loc: function () { return {"toString":"T","lst":["T"]}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "\"T\" in toString, own key",
        flavor: "jinja2",
        src: "[{% if \"T\" in toString %}Y{% else %}N{% endif %}]",
        loc: function () { return {"toString":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "\"T\" in toString, no key",
        flavor: "jinja2",
        src: "[{% if \"T\" in toString %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[N]", "[N]"]
      },
      {
        label: "valueOf == none, no key",
        flavor: "jinja2",
        src: "[{% if valueOf == none %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "valueOf == \"T\", own key",
        flavor: "jinja2",
        src: "[{% if valueOf == \"T\" %}Y{% else %}N{% endif %}]",
        loc: function () { return {"valueOf":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "valueOf != \"T\", no key",
        flavor: "jinja2",
        src: "[{% if valueOf != \"T\" %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "valueOf in lst, own key",
        flavor: "jinja2",
        src: "[{% if valueOf in lst %}Y{% else %}N{% endif %}]",
        loc: function () { return {"valueOf":"T","lst":["T"]}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "\"T\" in valueOf, own key",
        flavor: "jinja2",
        src: "[{% if \"T\" in valueOf %}Y{% else %}N{% endif %}]",
        loc: function () { return {"valueOf":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "\"T\" in valueOf, no key",
        flavor: "jinja2",
        src: "[{% if \"T\" in valueOf %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[N]", "[N]"]
      },
      {
        label: "hasOwnProperty == none, no key",
        flavor: "jinja2",
        src: "[{% if hasOwnProperty == none %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "hasOwnProperty == \"T\", own key",
        flavor: "jinja2",
        src: "[{% if hasOwnProperty == \"T\" %}Y{% else %}N{% endif %}]",
        loc: function () { return {"hasOwnProperty":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "hasOwnProperty != \"T\", no key",
        flavor: "jinja2",
        src: "[{% if hasOwnProperty != \"T\" %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "hasOwnProperty in lst, own key",
        flavor: "jinja2",
        src: "[{% if hasOwnProperty in lst %}Y{% else %}N{% endif %}]",
        loc: function () { return {"hasOwnProperty":"T","lst":["T"]}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "\"T\" in hasOwnProperty, own key",
        flavor: "jinja2",
        src: "[{% if \"T\" in hasOwnProperty %}Y{% else %}N{% endif %}]",
        loc: function () { return {"hasOwnProperty":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "\"T\" in hasOwnProperty, no key",
        flavor: "jinja2",
        src: "[{% if \"T\" in hasOwnProperty %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[N]", "[N]"]
      },
      {
        label: "class == none, no key",
        flavor: "jinja2",
        src: "[{% if class == none %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "class == \"T\", own key",
        flavor: "jinja2",
        src: "[{% if class == \"T\" %}Y{% else %}N{% endif %}]",
        loc: function () { return {"class":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "class != \"T\", no key",
        flavor: "jinja2",
        src: "[{% if class != \"T\" %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "class in lst, own key",
        flavor: "jinja2",
        src: "[{% if class in lst %}Y{% else %}N{% endif %}]",
        loc: function () { return {"class":"T","lst":["T"]}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "\"T\" in class, own key",
        flavor: "jinja2",
        src: "[{% if \"T\" in class %}Y{% else %}N{% endif %}]",
        loc: function () { return {"class":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "\"T\" in class, no key",
        flavor: "jinja2",
        src: "[{% if \"T\" in class %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[N]", "[N]"]
      },
      {
        label: "_output == none, no key",
        flavor: "jinja2",
        src: "[{% if _output == none %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "_output == \"T\", own key",
        flavor: "jinja2",
        src: "[{% if _output == \"T\" %}Y{% else %}N{% endif %}]",
        loc: function () { return {"_output":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "_output != \"T\", no key",
        flavor: "jinja2",
        src: "[{% if _output != \"T\" %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "_output in lst, own key",
        flavor: "jinja2",
        src: "[{% if _output in lst %}Y{% else %}N{% endif %}]",
        loc: function () { return {"_output":"T","lst":["T"]}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "\"T\" in _output, own key",
        flavor: "jinja2",
        src: "[{% if \"T\" in _output %}Y{% else %}N{% endif %}]",
        loc: function () { return {"_output":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "\"T\" in _output, no key",
        flavor: "jinja2",
        src: "[{% if \"T\" in _output %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[N]", "[N]"]
      },
      {
        label: "zz == none, no key",
        flavor: "jinja2",
        src: "[{% if zz == none %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "zz == \"T\", own key",
        flavor: "jinja2",
        src: "[{% if zz == \"T\" %}Y{% else %}N{% endif %}]",
        loc: function () { return {"zz":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "zz != \"T\", no key",
        flavor: "jinja2",
        src: "[{% if zz != \"T\" %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "zz in lst, own key",
        flavor: "jinja2",
        src: "[{% if zz in lst %}Y{% else %}N{% endif %}]",
        loc: function () { return {"zz":"T","lst":["T"]}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "\"T\" in zz, own key",
        flavor: "jinja2",
        src: "[{% if \"T\" in zz %}Y{% else %}N{% endif %}]",
        loc: function () { return {"zz":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "\"T\" in zz, no key",
        flavor: "jinja2",
        src: "[{% if \"T\" in zz %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[N]", "[N]"]
      },
      {
        label: "obj.toString == none, obj {}",
        flavor: "jinja2",
        src: "[{% if obj.toString == none %}Y{% else %}N{% endif %}]",
        loc: function () { return {"obj":{}}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "obj.toString == \"T\", own member",
        flavor: "jinja2",
        src: "[{% if obj.toString == \"T\" %}Y{% else %}N{% endif %}]",
        loc: function () { return {"obj":{"toString":"T"}}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "obj.toString != \"T\", obj {}",
        flavor: "jinja2",
        src: "[{% if obj.toString != \"T\" %}Y{% else %}N{% endif %}]",
        loc: function () { return {"obj":{}}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "\"T\" in obj.toString, own member",
        flavor: "jinja2",
        src: "[{% if \"T\" in obj.toString %}Y{% else %}N{% endif %}]",
        loc: function () { return {"obj":{"toString":"T"}}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "class.x == \"T\", own key",
        flavor: "jinja2",
        src: "[{% if class.x == \"T\" %}Y{% else %}N{% endif %}]",
        loc: function () { return {"class":{"x":"T"}}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "class.x == none, no key",
        flavor: "jinja2",
        src: "[{% if class.x == none %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "toString.length == 0, no key",
        flavor: "jinja2",
        src: "[{% if toString.length == 0 %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[N]", "[N]"]
      },
      {
        label: "_output.length == 1, no key",
        flavor: "jinja2",
        src: "[{% if _output.length == 1 %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[N]", "[N]"]
      },
      {
        label: "obj.zz == \"T\", control",
        flavor: "jinja2",
        src: "[{% if obj.zz == \"T\" %}Y{% else %}N{% endif %}]",
        loc: function () { return {"obj":{"zz":"T"}}; },
        expect: ["[Y]", "[Y]"]
      }
    ]
  },
  {
    name: "swig-django ==, != and in",
    cases: [
      {
        label: "toString == None, no key",
        flavor: "django",
        src: "[{% if toString == None %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "toString == \"T\", own key",
        flavor: "django",
        src: "[{% if toString == \"T\" %}Y{% else %}N{% endif %}]",
        loc: function () { return {"toString":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "toString != \"T\", no key",
        flavor: "django",
        src: "[{% if toString != \"T\" %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "toString in lst, own key",
        flavor: "django",
        src: "[{% if toString in lst %}Y{% else %}N{% endif %}]",
        loc: function () { return {"toString":"T","lst":["T"]}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "\"T\" in toString, own key",
        flavor: "django",
        src: "[{% if \"T\" in toString %}Y{% else %}N{% endif %}]",
        loc: function () { return {"toString":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "\"T\" in toString, no key",
        flavor: "django",
        src: "[{% if \"T\" in toString %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[N]", "[N]"]
      },
      {
        label: "valueOf == None, no key",
        flavor: "django",
        src: "[{% if valueOf == None %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "valueOf == \"T\", own key",
        flavor: "django",
        src: "[{% if valueOf == \"T\" %}Y{% else %}N{% endif %}]",
        loc: function () { return {"valueOf":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "valueOf != \"T\", no key",
        flavor: "django",
        src: "[{% if valueOf != \"T\" %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "valueOf in lst, own key",
        flavor: "django",
        src: "[{% if valueOf in lst %}Y{% else %}N{% endif %}]",
        loc: function () { return {"valueOf":"T","lst":["T"]}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "\"T\" in valueOf, own key",
        flavor: "django",
        src: "[{% if \"T\" in valueOf %}Y{% else %}N{% endif %}]",
        loc: function () { return {"valueOf":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "\"T\" in valueOf, no key",
        flavor: "django",
        src: "[{% if \"T\" in valueOf %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[N]", "[N]"]
      },
      {
        label: "hasOwnProperty == None, no key",
        flavor: "django",
        src: "[{% if hasOwnProperty == None %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "hasOwnProperty == \"T\", own key",
        flavor: "django",
        src: "[{% if hasOwnProperty == \"T\" %}Y{% else %}N{% endif %}]",
        loc: function () { return {"hasOwnProperty":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "hasOwnProperty != \"T\", no key",
        flavor: "django",
        src: "[{% if hasOwnProperty != \"T\" %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "hasOwnProperty in lst, own key",
        flavor: "django",
        src: "[{% if hasOwnProperty in lst %}Y{% else %}N{% endif %}]",
        loc: function () { return {"hasOwnProperty":"T","lst":["T"]}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "\"T\" in hasOwnProperty, own key",
        flavor: "django",
        src: "[{% if \"T\" in hasOwnProperty %}Y{% else %}N{% endif %}]",
        loc: function () { return {"hasOwnProperty":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "\"T\" in hasOwnProperty, no key",
        flavor: "django",
        src: "[{% if \"T\" in hasOwnProperty %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[N]", "[N]"]
      },
      {
        label: "class == None, no key",
        flavor: "django",
        src: "[{% if class == None %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "class == \"T\", own key",
        flavor: "django",
        src: "[{% if class == \"T\" %}Y{% else %}N{% endif %}]",
        loc: function () { return {"class":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "class != \"T\", no key",
        flavor: "django",
        src: "[{% if class != \"T\" %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "class in lst, own key",
        flavor: "django",
        src: "[{% if class in lst %}Y{% else %}N{% endif %}]",
        loc: function () { return {"class":"T","lst":["T"]}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "\"T\" in class, own key",
        flavor: "django",
        src: "[{% if \"T\" in class %}Y{% else %}N{% endif %}]",
        loc: function () { return {"class":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "\"T\" in class, no key",
        flavor: "django",
        src: "[{% if \"T\" in class %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[N]", "[N]"]
      },
      {
        label: "zz == None, no key",
        flavor: "django",
        src: "[{% if zz == None %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "zz == \"T\", own key",
        flavor: "django",
        src: "[{% if zz == \"T\" %}Y{% else %}N{% endif %}]",
        loc: function () { return {"zz":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "zz != \"T\", no key",
        flavor: "django",
        src: "[{% if zz != \"T\" %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "zz in lst, own key",
        flavor: "django",
        src: "[{% if zz in lst %}Y{% else %}N{% endif %}]",
        loc: function () { return {"zz":"T","lst":["T"]}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "\"T\" in zz, own key",
        flavor: "django",
        src: "[{% if \"T\" in zz %}Y{% else %}N{% endif %}]",
        loc: function () { return {"zz":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "\"T\" in zz, no key",
        flavor: "django",
        src: "[{% if \"T\" in zz %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[N]", "[N]"]
      },
      {
        label: "obj.toString == None, obj {}",
        flavor: "django",
        src: "[{% if obj.toString == None %}Y{% else %}N{% endif %}]",
        loc: function () { return {"obj":{}}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "obj.toString == \"T\", own member",
        flavor: "django",
        src: "[{% if obj.toString == \"T\" %}Y{% else %}N{% endif %}]",
        loc: function () { return {"obj":{"toString":"T"}}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "obj.toString != \"T\", obj {}",
        flavor: "django",
        src: "[{% if obj.toString != \"T\" %}Y{% else %}N{% endif %}]",
        loc: function () { return {"obj":{}}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "\"T\" in obj.toString, own member",
        flavor: "django",
        src: "[{% if \"T\" in obj.toString %}Y{% else %}N{% endif %}]",
        loc: function () { return {"obj":{"toString":"T"}}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "class.x == \"T\", own key",
        flavor: "django",
        src: "[{% if class.x == \"T\" %}Y{% else %}N{% endif %}]",
        loc: function () { return {"class":{"x":"T"}}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "class.x == None, no key",
        flavor: "django",
        src: "[{% if class.x == None %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "toString.length == 0, no key",
        flavor: "django",
        src: "[{% if toString.length == 0 %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[N]", "[N]"]
      },
      {
        label: "obj.zz == \"T\", control",
        flavor: "django",
        src: "[{% if obj.zz == \"T\" %}Y{% else %}N{% endif %}]",
        loc: function () { return {"obj":{"zz":"T"}}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "Math.PI == None, control",
        flavor: "django",
        src: "[{% if Math.PI == None %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      }
    ]
  },
  {
    name: "swig-jinja2 is defined",
    cases: [
      {
        label: "toString is defined, no key",
        flavor: "jinja2",
        src: "[{% if toString is defined %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[N]", "[N]"]
      },
      {
        label: "toString is defined, own key",
        flavor: "jinja2",
        src: "[{% if toString is defined %}Y{% else %}N{% endif %}]",
        loc: function () { return {"toString":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "class is defined, no key",
        flavor: "jinja2",
        src: "[{% if class is defined %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[N]", "[N]"]
      },
      {
        label: "class is defined, own key",
        flavor: "jinja2",
        src: "[{% if class is defined %}Y{% else %}N{% endif %}]",
        loc: function () { return {"class":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "_output is defined, no key",
        flavor: "jinja2",
        src: "[{% if _output is defined %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[N]", "[N]"]
      },
      {
        label: "_output is defined, own key",
        flavor: "jinja2",
        src: "[{% if _output is defined %}Y{% else %}N{% endif %}]",
        loc: function () { return {"_output":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "Math is defined, own key",
        flavor: "jinja2",
        src: "[{% if Math is defined %}Y{% else %}N{% endif %}]",
        loc: function () { return {"Math":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "zz is defined, no key",
        flavor: "jinja2",
        src: "[{% if zz is defined %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[N]", "[N]"]
      },
      {
        label: "zz is defined, own key",
        flavor: "jinja2",
        src: "[{% if zz is defined %}Y{% else %}N{% endif %}]",
        loc: function () { return {"zz":"T"}; },
        expect: ["[Y]", "[Y]"]
      }
    ]
  },
  {
    name: "swig-twig is defined and ??",
    cases: [
      {
        label: "toString is defined, no key",
        flavor: "twig",
        src: "[{% if toString is defined %}Y{% endif %}]",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "toString is defined, own key",
        flavor: "twig",
        src: "[{% if toString is defined %}Y{% endif %}]",
        loc: function () { return {"toString":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "toString ?? \"d\", no key",
        flavor: "twig",
        src: "[{{ toString ?? \"d\" }}]",
        loc: function () { return {}; },
        expect: ["[d]", "[d]"]
      },
      {
        label: "toString ?? \"d\", own key",
        flavor: "twig",
        src: "[{{ toString ?? \"d\" }}]",
        loc: function () { return {"toString":"T"}; },
        expect: ["[T]", "[T]"]
      },
      {
        label: "class is defined, no key",
        flavor: "twig",
        src: "[{% if class is defined %}Y{% endif %}]",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "class is defined, own key",
        flavor: "twig",
        src: "[{% if class is defined %}Y{% endif %}]",
        loc: function () { return {"class":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "class ?? \"d\", no key",
        flavor: "twig",
        src: "[{{ class ?? \"d\" }}]",
        loc: function () { return {}; },
        expect: ["[d]", "[d]"]
      },
      {
        label: "class ?? \"d\", own key",
        flavor: "twig",
        src: "[{{ class ?? \"d\" }}]",
        loc: function () { return {"class":"T"}; },
        expect: ["[T]", "[T]"]
      },
      {
        label: "_output is defined, no key",
        flavor: "twig",
        src: "[{% if _output is defined %}Y{% endif %}]",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "_output is defined, own key",
        flavor: "twig",
        src: "[{% if _output is defined %}Y{% endif %}]",
        loc: function () { return {"_output":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "_output ?? \"d\", no key",
        flavor: "twig",
        src: "[{{ _output ?? \"d\" }}]",
        loc: function () { return {}; },
        expect: ["[d]", "[d]"]
      },
      {
        label: "_output ?? \"d\", own key",
        flavor: "twig",
        src: "[{{ _output ?? \"d\" }}]",
        loc: function () { return {"_output":"T"}; },
        expect: ["[T]", "[T]"]
      },
      {
        label: "Math is defined, own key",
        flavor: "twig",
        src: "[{% if Math is defined %}Y{% endif %}]",
        loc: function () { return {"Math":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "Math ?? \"d\", own key",
        flavor: "twig",
        src: "[{{ Math ?? \"d\" }}]",
        loc: function () { return {"Math":"T"}; },
        expect: ["[T]", "[T]"]
      },
      {
        label: "zz is defined, no key",
        flavor: "twig",
        src: "[{% if zz is defined %}Y{% endif %}]",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "zz is defined, own key",
        flavor: "twig",
        src: "[{% if zz is defined %}Y{% endif %}]",
        loc: function () { return {"zz":"T"}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "zz ?? \"d\", no key",
        flavor: "twig",
        src: "[{{ zz ?? \"d\" }}]",
        loc: function () { return {}; },
        expect: ["[d]", "[d]"]
      },
      {
        label: "zz ?? \"d\", own key",
        flavor: "twig",
        src: "[{{ zz ?? \"d\" }}]",
        loc: function () { return {"zz":"T"}; },
        expect: ["[T]", "[T]"]
      }
    ]
  }
];

describe('Raw variable reads in comparisons and existence tests', function () {
  GROUPS.forEach(function (g) {
    describe(g.name, function () {
      g.cases.forEach(function (c) {
        it(c.label + ' (' + c.flavor + ', sync)', function () {
          expect(renderSync(c.flavor, c.src, c.loc())).to.equal(c.expect[0]);
        });
        it(c.label + ' (' + c.flavor + ', async)', function () {
          return renderAsync(c.flavor, c.src, c.loc()).then(function (out) { expect(out).to.equal(c.expect[1]); });
        });
      });
    });
  });
});
