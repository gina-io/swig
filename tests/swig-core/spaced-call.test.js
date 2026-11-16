var swig = require('../../lib/swig'),
  twig = require('../../packages/swig-twig'),
  jinja2 = require('../../packages/swig-jinja2'),
  django = require('../../packages/swig-django'),
  loaders = require('../../packages/swig-core/lib/loaders'),
  expect = require('../lib/expect.js');

/*!
 * A bare name called with a space before its parenthesis (`f (1)`) in the
 * arguments of a native tag, in the fragments a native tag registered with
 * setTag receives, and in outputs; dotted names and unspaced calls are the
 * controls.
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
    name: "Tag arguments, custom-tag fragments and outputs",
    cases: [
      {
        label: "if f (1)",
        flavor: "native",
        src: "[{% if f (1) %}Y{% endif %}]",
        loc: function () { return { f: fnTrue }; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "if f (1)",
        flavor: "twig",
        src: "[{% if f (1) %}Y{% endif %}]",
        loc: function () { return { f: fnTrue }; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "if f (1)",
        flavor: "jinja2",
        src: "[{% if f (1) %}Y{% endif %}]",
        loc: function () { return { f: fnTrue }; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "set y = f (1)",
        flavor: "native",
        src: "{% set y = f (1) %}[{{ y }}]",
        loc: function () { return { f: fnT }; },
        expect: ["[T]", "[T]"]
      },
      {
        label: "set y = f (1)",
        flavor: "twig",
        src: "{% set y = f (1) %}[{{ y }}]",
        loc: function () { return { f: fnT }; },
        expect: ["[T]", "[T]"]
      },
      {
        label: "set y = f (1)",
        flavor: "jinja2",
        src: "{% set y = f (1) %}[{{ y }}]",
        loc: function () { return { f: fnT }; },
        expect: ["[T]", "[T]"]
      },
      {
        label: "for x in f (1)",
        flavor: "native",
        src: "{% for x in f (1) %}[{{ x }}]{% endfor %}",
        loc: function () { return { f: fnList }; },
        expect: ["THROW Unexpected number \"1\" on line 1.", "THROW Unexpected number \"1\" on line 1."]
      },
      {
        label: "for x in f (1)",
        flavor: "twig",
        src: "{% for x in f (1) %}[{{ x }}]{% endfor %}",
        loc: function () { return { f: fnList }; },
        expect: ["[1][2]", "[1][2]"]
      },
      {
        label: "for x in f (1)",
        flavor: "jinja2",
        src: "{% for x in f (1) %}[{{ x }}]{% endfor %}",
        loc: function () { return { f: fnList }; },
        expect: ["[1][2]", "[1][2]"]
      },
      {
        label: "if f(1) (control)",
        flavor: "native",
        src: "[{% if f(1) %}Y{% endif %}]",
        loc: function () { return { f: fnTrue }; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "if f(1) (control)",
        flavor: "twig",
        src: "[{% if f(1) %}Y{% endif %}]",
        loc: function () { return { f: fnTrue }; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "if f(1) (control)",
        flavor: "jinja2",
        src: "[{% if f(1) %}Y{% endif %}]",
        loc: function () { return { f: fnTrue }; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "{{ f (1) }} (control, output)",
        flavor: "native",
        src: "[{{ f (1) }}]",
        loc: function () { return { f: fnT }; },
        expect: ["[T]", "[T]"]
      },
      {
        label: "{{ f (1) }} (control, output)",
        flavor: "twig",
        src: "[{{ f (1) }}]",
        loc: function () { return { f: fnT }; },
        expect: ["[T]", "[T]"]
      },
      {
        label: "{{ f (1) }} (control, output)",
        flavor: "jinja2",
        src: "[{{ f (1) }}]",
        loc: function () { return { f: fnT }; },
        expect: ["[T]", "[T]"]
      },
      {
        label: "if o.f (1) (control, dotted)",
        flavor: "native",
        src: "[{% if o.f (1) %}Y{% endif %}]",
        loc: function () { return { o: { f: fnTrue } }; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "if o.f (1) (control, dotted)",
        flavor: "twig",
        src: "[{% if o.f (1) %}Y{% endif %}]",
        loc: function () { return { o: { f: fnTrue } }; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "if o.f (1) (control, dotted)",
        flavor: "jinja2",
        src: "[{% if o.f (1) %}Y{% endif %}]",
        loc: function () { return { o: { f: fnTrue } }; },
        expect: ["[Y]", "[Y]"]
      },
      {
        label: "{% show f (1) %}",
        flavor: "native",
        src: "[{% show f (1) %}]",
        loc: function () { return { f: fnT }; },
        expect: ["[T]", "[T]"]
      }
    ]
  }
];

describe('A call written with a space before its parenthesis', function () {
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
