var swig = require('../../lib/swig'),
  twig = require('../../packages/swig-twig'),
  jinja2 = require('../../packages/swig-jinja2'),
  django = require('../../packages/swig-django'),
  loaders = require('../../packages/swig-core/lib/loaders'),
  expect = require('../lib/expect.js');

/*!
 * How a variable read treats a name the context may lack where a template
 * reaches it other than as a plain output: Python's ==, != and in over a
 * context key that holds undefined or null, and over a dotted name ending in
 * an Object.prototype member (swig-jinja2, swig-django); calls of a name an
 * object gets only from Object.prototype, of a reserved word and of a name the
 * compiled code uses itself, with and without a context key of that name, and
 * calls of a global whose context key holds undefined or null (native swig,
 * swig-twig, swig-jinja2); and the fragments a native tag registered with
 * setTag receives. Plain names and own keys are the controls. Each case runs on
 * the sync and the async render paths; the expectations are generated and were
 * checked against recorded renders of the same shapes.
 */
var CTORS = { native: swig.Swig, twig: twig.Twig, jinja2: jinja2.Jinja2, django: django.Django };

function fnT() { return 'T'; }

// A native tag that writes the argument fragments it receives into the output.
function showParse(str, line, parser) { return parser && true; }
function showCompile(compiler, args) { return '_output += String(' + args.join('') + ');\n'; }

function make(f, src, isAsync) {
  var mem = loaders.memory({ '/page.html': src }, '/'), loader = mem, s;
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
  s = new CTORS[f]({ loader: loader, cache: false });
  if (f === 'native') { s.setTag('show', showParse, showCompile, false, false); }
  return s;
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
    name: "==, != and in over a context key that holds undefined (swig-jinja2, swig-django)",
    cases: [
      {
        label: "Math == none, key undefined",
        flavor: "jinja2",
        src: "[{% if Math == none %}Y{% else %}N{% endif %}]",
        loc: function () { return { Math: undefined }; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "Math == none, key null",
        flavor: "jinja2",
        src: "[{% if Math == none %}Y{% else %}N{% endif %}]",
        loc: function () { return { Math: null }; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "Math == none, no key",
        flavor: "jinja2",
        src: "[{% if Math == none %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[N]", "[N]"]
      },
      {
        label: "Math != none, key undefined",
        flavor: "jinja2",
        src: "[{% if Math != none %}Y{% else %}N{% endif %}]",
        loc: function () { return { Math: undefined }; },
        expect: ["[N]", "[N]"]
      },
      {
        label: "Math in [none], key undefined",
        flavor: "jinja2",
        src: "[{% if Math in [none] %}Y{% else %}N{% endif %}]",
        loc: function () { return { Math: undefined }; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "Math == None, key undefined",
        flavor: "django",
        src: "[{% if Math == None %}Y{% else %}N{% endif %}]",
        loc: function () { return { Math: undefined }; },
        expect: ["[Y]", "[Y]"]
      }
    ]
  },
  {
    name: "== over a dotted name ending in an Object.prototype member (swig-jinja2, swig-django)",
    cases: [
      {
        label: "Math.toString == none, no key",
        flavor: "jinja2",
        src: "[{% if Math.toString == none %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "Math.toString == none, no key",
        flavor: "django",
        src: "[{% if Math.toString == none %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "Math.valueOf == none, no key",
        flavor: "jinja2",
        src: "[{% if Math.valueOf == none %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "Math.PI == none, no key (control)",
        flavor: "jinja2",
        src: "[{% if Math.PI == none %}Y{% else %}N{% endif %}]",
        loc: function () { return {}; },
        expect: ["[N]", "[N]"]
      },
      {
        label: "o.toString == none, o {} (control)",
        flavor: "jinja2",
        src: "[{% if o.toString == none %}Y{% else %}N{% endif %}]",
        loc: function () { return { o: {} }; },
        expect: ["[Y]", "[Y]"]
      }
    ]
  },
  {
    name: "Calls of Object.prototype names, reserved words and names the compiled code uses itself",
    cases: [
      {
        label: "{{ toString() }}, no key",
        flavor: "native",
        src: "[{{ toString() }}]",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "{{ toString() }}, no key",
        flavor: "twig",
        src: "[{{ toString() }}]",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "{{ toString() }}, no key",
        flavor: "jinja2",
        src: "[{{ toString() }}]",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "{{ valueOf() }}, no key",
        flavor: "native",
        src: "[{{ valueOf() }}]",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "{{ valueOf() }}, no key",
        flavor: "twig",
        src: "[{{ valueOf() }}]",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "{{ valueOf() }}, no key",
        flavor: "jinja2",
        src: "[{{ valueOf() }}]",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "{{ hasOwnProperty(\"a\") }}, no key",
        flavor: "native",
        src: "[{{ hasOwnProperty(\"a\") }}]",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "{{ hasOwnProperty(\"a\") }}, no key",
        flavor: "twig",
        src: "[{{ hasOwnProperty(\"a\") }}]",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "{{ hasOwnProperty(\"a\") }}, no key",
        flavor: "jinja2",
        src: "[{{ hasOwnProperty(\"a\") }}]",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "{{ class() }}, no key",
        flavor: "native",
        src: "[{{ class() }}]",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "{{ class() }}, no key",
        flavor: "twig",
        src: "[{{ class() }}]",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "{{ class() }}, no key",
        flavor: "jinja2",
        src: "[{{ class() }}]",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "{{ super() }}, no key",
        flavor: "native",
        src: "[{{ super() }}]",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "{{ super() }}, no key",
        flavor: "twig",
        src: "[{{ super() }}]",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "{{ super() }}, no key",
        flavor: "jinja2",
        src: "[{{ super() }}]",
        loc: function () { return {}; },
        expect: ["THROW \"super()\" is not supported (swig-jinja2 does not render parent blocks) on line 1 in file /page.html.", "THROW \"super()\" is not supported (swig-jinja2 does not render parent blocks) on line 1 in file /page.html."]
      },
      {
        label: "{{ _output() }}, no key",
        flavor: "native",
        src: "[{{ _output() }}]",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "{{ _output() }}, no key",
        flavor: "twig",
        src: "[{{ _output() }}]",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "{{ _output() }}, no key",
        flavor: "jinja2",
        src: "[{{ _output() }}]",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "{{ _utils() }}, no key",
        flavor: "native",
        src: "[{{ _utils() }}]",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "{{ _utils() }}, no key",
        flavor: "twig",
        src: "[{{ _utils() }}]",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "{{ _utils() }}, no key",
        flavor: "jinja2",
        src: "[{{ _utils() }}]",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "{{ zz() }}, no key",
        flavor: "native",
        src: "[{{ zz() }}]",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "{{ zz() }}, no key",
        flavor: "twig",
        src: "[{{ zz() }}]",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "{{ zz() }}, no key",
        flavor: "jinja2",
        src: "[{{ zz() }}]",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "{{ toString() }}, own key (control)",
        flavor: "native",
        src: "[{{ toString() }}]",
        loc: function () { return { toString: fnT }; },
        expect: ["[T]", "[T]"]
      },
      {
        label: "{{ toString() }}, own key (control)",
        flavor: "twig",
        src: "[{{ toString() }}]",
        loc: function () { return { toString: fnT }; },
        expect: ["[T]", "[T]"]
      },
      {
        label: "{{ toString() }}, own key (control)",
        flavor: "jinja2",
        src: "[{{ toString() }}]",
        loc: function () { return { toString: fnT }; },
        expect: ["[T]", "[T]"]
      },
      {
        label: "{{ class() }}, own key (control)",
        flavor: "native",
        src: "[{{ class() }}]",
        loc: function () { return { 'class': fnT }; },
        expect: ["[T]", "[T]"]
      },
      {
        label: "{{ class() }}, own key (control)",
        flavor: "twig",
        src: "[{{ class() }}]",
        loc: function () { return { 'class': fnT }; },
        expect: ["[T]", "[T]"]
      },
      {
        label: "{{ class() }}, own key (control)",
        flavor: "jinja2",
        src: "[{{ class() }}]",
        loc: function () { return { 'class': fnT }; },
        expect: ["[T]", "[T]"]
      }
    ]
  },
  {
    name: "Calls of a global whose context key holds undefined or null",
    cases: [
      {
        label: "encodeURIComponent(\"a b\"), key undefined",
        flavor: "native",
        src: "[{{ encodeURIComponent(\"a b\") }}]",
        loc: function () { return { encodeURIComponent: undefined }; },
        expect: ["[]", "[]"]
      },
      {
        label: "encodeURIComponent(\"a b\"), key undefined",
        flavor: "twig",
        src: "[{{ encodeURIComponent(\"a b\") }}]",
        loc: function () { return { encodeURIComponent: undefined }; },
        expect: ["[]", "[]"]
      },
      {
        label: "encodeURIComponent(\"a b\"), key undefined",
        flavor: "jinja2",
        src: "[{{ encodeURIComponent(\"a b\") }}]",
        loc: function () { return { encodeURIComponent: undefined }; },
        expect: ["[]", "[]"]
      },
      {
        label: "encodeURIComponent(\"a b\"), key null",
        flavor: "native",
        src: "[{{ encodeURIComponent(\"a b\") }}]",
        loc: function () { return { encodeURIComponent: null }; },
        expect: ["THROW (intermediate value)(intermediate value)(intermediate value) is not a function", "THROW (intermediate value)(intermediate value)(intermediate value) is not a function"]
      },
      {
        label: "encodeURIComponent(\"a b\"), key null",
        flavor: "twig",
        src: "[{{ encodeURIComponent(\"a b\") }}]",
        loc: function () { return { encodeURIComponent: null }; },
        expect: ["THROW (intermediate value)(intermediate value)(intermediate value) is not a function", "THROW (intermediate value)(intermediate value)(intermediate value) is not a function"]
      },
      {
        label: "encodeURIComponent(\"a b\"), key null",
        flavor: "jinja2",
        src: "[{{ encodeURIComponent(\"a b\") }}]",
        loc: function () { return { encodeURIComponent: null }; },
        expect: ["THROW (intermediate value)(intermediate value)(intermediate value) is not a function", "THROW (intermediate value)(intermediate value)(intermediate value) is not a function"]
      },
      {
        label: "encodeURIComponent(\"a b\"), no key (control)",
        flavor: "native",
        src: "[{{ encodeURIComponent(\"a b\") }}]",
        loc: function () { return {}; },
        expect: ["[a%20b]", "[a%20b]"]
      },
      {
        label: "encodeURIComponent(\"a b\"), no key (control)",
        flavor: "twig",
        src: "[{{ encodeURIComponent(\"a b\") }}]",
        loc: function () { return {}; },
        expect: ["[a%20b]", "[a%20b]"]
      },
      {
        label: "encodeURIComponent(\"a b\"), no key (control)",
        flavor: "jinja2",
        src: "[{{ encodeURIComponent(\"a b\") }}]",
        loc: function () { return {}; },
        expect: ["[a%20b]", "[a%20b]"]
      }
    ]
  },
  {
    name: "Fragments a native tag registered with setTag receives",
    cases: [
      {
        label: "{% show toString %}, no key",
        flavor: "native",
        src: "[{% show toString %}]",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "{% show o.toString %}, o {}",
        flavor: "native",
        src: "[{% show o.toString %}]",
        loc: function () { return { o: {} }; },
        expect: ["[]", "[]"]
      },
      {
        label: "{% show class %}, key",
        flavor: "native",
        src: "[{% show class %}]",
        loc: function () { return { 'class': 'C' }; },
        expect: ["[C]", "[C]"]
      },
      {
        label: "{% show Math %}, key null",
        flavor: "native",
        src: "[{% show Math %}]",
        loc: function () { return { Math: null }; },
        expect: ["[]", "[]"]
      },
      {
        label: "{% show zz %}, key (control)",
        flavor: "native",
        src: "[{% show zz %}]",
        loc: function () { return { zz: 'Z' }; },
        expect: ["[Z]", "[Z]"]
      },
      {
        label: "{% show toString() %}, no key",
        flavor: "native",
        src: "[{% show toString() %}]",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "{% show class() %}, no key",
        flavor: "native",
        src: "[{% show class() %}]",
        loc: function () { return {}; },
        expect: ["[]", "[]"]
      },
      {
        label: "{% show zz() %}, own key (control)",
        flavor: "native",
        src: "[{% show zz() %}]",
        loc: function () { return { zz: fnT }; },
        expect: ["[T]", "[T]"]
      }
    ]
  }
];

describe('Variable reads in calls, comparisons and custom-tag fragments', function () {
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
