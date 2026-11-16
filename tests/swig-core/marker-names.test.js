var swig = require('../../lib/swig'),
  twig = require('../../packages/swig-twig'),
  jinja2 = require('../../packages/swig-jinja2'),
  django = require('../../packages/swig-django'),
  loaders = require('../../packages/swig-core/lib/loaders'),
  expect = require('../lib/expect.js');

/*!
 * A loop key the template itself names __k (the name a one-name loop passes),
 * and a macro parameter named __a0 or __a1 (the names renamed parameters
 * take), bind and read like any other name; other names are the controls.
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
    name: "A loop key the template names __k",
    cases: [
      {
        label: "for __k, v in o",
        flavor: "native",
        src: "{% for __k, v in o %}[{{ __k }}={{ v }}]{% endfor %}",
        loc: function () { return { o: { a: 1 } }; },
        expect: ["[a=1]", "[a=1]"]
      },
      {
        label: "for __k, v in o",
        flavor: "twig",
        src: "{% for __k, v in o %}[{{ __k }}={{ v }}]{% endfor %}",
        loc: function () { return { o: { a: 1 } }; },
        expect: ["[a=1]", "[a=1]"]
      },
      {
        label: "for __k, v in o",
        flavor: "jinja2",
        src: "{% for __k, v in o %}[{{ __k }}={{ v }}]{% endfor %}",
        loc: function () { return { o: { a: 1 } }; },
        expect: ["[a=1]", "[a=1]"]
      },
      {
        label: "for __k, v in o.items",
        flavor: "django",
        src: "{% for __k, v in o.items %}[{{ __k }}={{ v }}]{% endfor %}",
        loc: function () { return { o: { a: 1 } }; },
        expect: ["[a=1]", "[a=1]"]
      },
      {
        label: "for __k, v in pairs",
        flavor: "jinja2",
        src: "{% for __k, v in ps %}[{{ __k }}={{ v }}]{% endfor %}",
        loc: function () { return { ps: [['a', 1]] }; },
        expect: ["[a=1]", "[a=1]"]
      },
      {
        label: "for __k, v in pairs",
        flavor: "django",
        src: "{% for __k, v in ps %}[{{ __k }}={{ v }}]{% endfor %}",
        loc: function () { return { ps: [['a', 1]] }; },
        expect: ["[a=1]", "[a=1]"]
      },
      {
        label: "for kk, v in o (control)",
        flavor: "native",
        src: "{% for kk, v in o %}[{{ kk }}={{ v }}]{% endfor %}",
        loc: function () { return { o: { a: 1 } }; },
        expect: ["[a=1]", "[a=1]"]
      },
      {
        label: "for kk, v in o (control)",
        flavor: "twig",
        src: "{% for kk, v in o %}[{{ kk }}={{ v }}]{% endfor %}",
        loc: function () { return { o: { a: 1 } }; },
        expect: ["[a=1]", "[a=1]"]
      },
      {
        label: "for kk, v in o (control)",
        flavor: "jinja2",
        src: "{% for kk, v in o %}[{{ kk }}={{ v }}]{% endfor %}",
        loc: function () { return { o: { a: 1 } }; },
        expect: ["[a=1]", "[a=1]"]
      }
    ]
  },
  {
    name: "A macro parameter named like a renamed parameter",
    cases: [
      {
        label: "macro m(__a0) read",
        flavor: "native",
        src: "{% macro m(__a0) %}[{{ __a0 }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "macro m(__a0) read",
        flavor: "twig",
        src: "{% macro m(__a0) %}[{{ __a0 }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "macro m(__a0) read",
        flavor: "jinja2",
        src: "{% macro m(__a0) %}[{{ __a0 }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "macro m(__a1) read (control)",
        flavor: "native",
        src: "{% macro m(__a1) %}[{{ __a1 }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "macro m(__a1) read (control)",
        flavor: "twig",
        src: "{% macro m(__a1) %}[{{ __a1 }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "macro m(__a1) read (control)",
        flavor: "jinja2",
        src: "{% macro m(__a1) %}[{{ __a1 }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "macro m(zz, __a1) read",
        flavor: "native",
        src: "{% macro m(zz, __a1) %}[{{ zz }}{{ __a1 }}]{% endmacro %}{{ m(\"X\", \"Y\") }}",
        loc: function () { return {}; },
        expect: ["[XY]", "[XY]"]
      },
      {
        label: "macro m(zz, __a1) read",
        flavor: "twig",
        src: "{% macro m(zz, __a1) %}[{{ zz }}{{ __a1 }}]{% endmacro %}{{ m(\"X\", \"Y\") }}",
        loc: function () { return {}; },
        expect: ["[XY]", "[XY]"]
      },
      {
        label: "macro m(zz, __a1) read",
        flavor: "jinja2",
        src: "{% macro m(zz, __a1) %}[{{ zz }}{{ __a1 }}]{% endmacro %}{{ m(\"X\", \"Y\") }}",
        loc: function () { return {}; },
        expect: ["[XY]", "[XY]"]
      }
    ]
  }
];

describe('Loop keys and macro parameters named like names the compiled code uses', function () {
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
