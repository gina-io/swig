var swig = require('../../lib/swig'),
  twig = require('../../packages/swig-twig'),
  jinja2 = require('../../packages/swig-jinja2'),
  django = require('../../packages/swig-django'),
  loaders = require('../../packages/swig-core/lib/loaders'),
  expect = require('../lib/expect.js');

/*!
 * A loop name named like a JavaScript global, a name the compiled code uses
 * or an Object.prototype member is read from the context only. The other
 * name of a two-name loop stays a parameter of the loop callback: a null item
 * of it renders an empty string inside a macro or a loop that holds that
 * name, and a macro defined in the loop and called after the loop reads that
 * name's last item.
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
    name: "A null item of the other name, inside a macro or a loop of that name",
    cases: [
      {
        label: "m(v) holds for document, v in o: a null item",
        flavor: "native",
        src: "{% macro m(v) %}{% for document, v in o %}[{{ v }}]{% endfor %}{% endmacro %}{{ m(\"OUT\") }}",
        loc: function () { return {"o":{"a":null,"b":"B"}}; },
        expect: ["[][B]", "[][B]"]
      },
      {
        label: "m(v) holds for document, v in o: a null item",
        flavor: "twig",
        src: "{% macro m(v) %}{% for document, v in o %}[{{ v }}]{% endfor %}{% endmacro %}{{ m(\"OUT\") }}",
        loc: function () { return {"o":{"a":null,"b":"B"}}; },
        expect: ["[][B]", "[][B]"]
      },
      {
        label: "for v in outer holds for document, v in o: a null item",
        flavor: "native",
        src: "{% for v in outer %}{% for document, v in o %}[{{ v }}]{% endfor %}{% endfor %}",
        loc: function () { return {"outer":["OUT"],"o":{"a":null,"b":"B"}}; },
        expect: ["[][B]", "[][B]"]
      },
      {
        label: "for v in outer holds for document, v in o: a null item",
        flavor: "twig",
        src: "{% for v in outer %}{% for document, v in o %}[{{ v }}]{% endfor %}{% endfor %}",
        loc: function () { return {"outer":["OUT"],"o":{"a":null,"b":"B"}}; },
        expect: ["[][B]", "[][B]"]
      },
      {
        label: "m(v) holds for public, v in o: a null item",
        flavor: "native",
        src: "{% macro m(v) %}{% for public, v in o %}[{{ v }}]{% endfor %}{% endmacro %}{{ m(\"OUT\") }}",
        loc: function () { return {"o":{"a":null,"b":"B"}}; },
        expect: ["[][B]", "[][B]"]
      },
      {
        label: "m(v) holds for public, v in o: a null item",
        flavor: "twig",
        src: "{% macro m(v) %}{% for public, v in o %}[{{ v }}]{% endfor %}{% endmacro %}{{ m(\"OUT\") }}",
        loc: function () { return {"o":{"a":null,"b":"B"}}; },
        expect: ["[][B]", "[][B]"]
      },
      {
        label: "for v in outer holds for public, v in o: a null item",
        flavor: "native",
        src: "{% for v in outer %}{% for public, v in o %}[{{ v }}]{% endfor %}{% endfor %}",
        loc: function () { return {"outer":["OUT"],"o":{"a":null,"b":"B"}}; },
        expect: ["[][B]", "[][B]"]
      },
      {
        label: "for v in outer holds for public, v in o: a null item",
        flavor: "twig",
        src: "{% for v in outer %}{% for public, v in o %}[{{ v }}]{% endfor %}{% endfor %}",
        loc: function () { return {"outer":["OUT"],"o":{"a":null,"b":"B"}}; },
        expect: ["[][B]", "[][B]"]
      },
      {
        label: "m(v) holds for kk, v in o: a null item (control)",
        flavor: "native",
        src: "{% macro m(v) %}{% for kk, v in o %}[{{ v }}]{% endfor %}{% endmacro %}{{ m(\"OUT\") }}",
        loc: function () { return {"o":{"a":null,"b":"B"}}; },
        expect: ["[][B]", "[][B]"]
      },
      {
        label: "m(v) holds for kk, v in o: a null item (control)",
        flavor: "twig",
        src: "{% macro m(v) %}{% for kk, v in o %}[{{ v }}]{% endfor %}{% endmacro %}{{ m(\"OUT\") }}",
        loc: function () { return {"o":{"a":null,"b":"B"}}; },
        expect: ["[][B]", "[][B]"]
      },
      {
        label: "for v in outer holds for kk, v in o: a null item (control)",
        flavor: "native",
        src: "{% for v in outer %}{% for kk, v in o %}[{{ v }}]{% endfor %}{% endfor %}",
        loc: function () { return {"outer":["OUT"],"o":{"a":null,"b":"B"}}; },
        expect: ["[][B]", "[][B]"]
      },
      {
        label: "for v in outer holds for kk, v in o: a null item (control)",
        flavor: "twig",
        src: "{% for v in outer %}{% for kk, v in o %}[{{ v }}]{% endfor %}{% endfor %}",
        loc: function () { return {"outer":["OUT"],"o":{"a":null,"b":"B"}}; },
        expect: ["[][B]", "[][B]"]
      }
    ]
  },
  {
    name: "A macro defined in the loop and called after it",
    cases: [
      {
        label: "a macro defined in for document, v in o reads v after the loop",
        flavor: "native",
        src: "{% for document, v in o %}{% macro m() %}[{{ v }}]{% endmacro %}{% endfor %}{{ m() }}",
        loc: function () { return {"o":{"a":"A","b":"B"}}; },
        expect: ["[B]", "[B]"]
      },
      {
        label: "a macro defined in for document, v in o reads v after the loop",
        flavor: "twig",
        src: "{% for document, v in o %}{% macro m() %}[{{ v }}]{% endmacro %}{% endfor %}{{ m() }}",
        loc: function () { return {"o":{"a":"A","b":"B"}}; },
        expect: ["[B]", "[B]"]
      },
      {
        label: "a macro defined in for public, v in o reads v after the loop",
        flavor: "native",
        src: "{% for public, v in o %}{% macro m() %}[{{ v }}]{% endmacro %}{% endfor %}{{ m() }}",
        loc: function () { return {"o":{"a":"A","b":"B"}}; },
        expect: ["[B]", "[B]"]
      },
      {
        label: "a macro defined in for public, v in o reads v after the loop",
        flavor: "twig",
        src: "{% for public, v in o %}{% macro m() %}[{{ v }}]{% endmacro %}{% endfor %}{{ m() }}",
        loc: function () { return {"o":{"a":"A","b":"B"}}; },
        expect: ["[B]", "[B]"]
      },
      {
        label: "a macro defined in for kk, v in o reads v after the loop (control)",
        flavor: "native",
        src: "{% for kk, v in o %}{% macro m() %}[{{ v }}]{% endmacro %}{% endfor %}{{ m() }}",
        loc: function () { return {"o":{"a":"A","b":"B"}}; },
        expect: ["[B]", "[B]"]
      },
      {
        label: "a macro defined in for kk, v in o reads v after the loop (control)",
        flavor: "twig",
        src: "{% for kk, v in o %}{% macro m() %}[{{ v }}]{% endmacro %}{% endfor %}{{ m() }}",
        loc: function () { return {"o":{"a":"A","b":"B"}}; },
        expect: ["[B]", "[B]"]
      },
      {
        label: "a macro defined in for k, document in o reads k after the loop",
        flavor: "native",
        src: "{% for k, document in o %}{% macro m() %}[{{ k }}]{% endmacro %}{% endfor %}{{ m() }}",
        loc: function () { return {"o":{"a":"A","b":"B"}}; },
        expect: ["[b]", "[b]"]
      },
      {
        label: "a macro defined in for k, document in o reads k after the loop",
        flavor: "twig",
        src: "{% for k, document in o %}{% macro m() %}[{{ k }}]{% endmacro %}{% endfor %}{{ m() }}",
        loc: function () { return {"o":{"a":"A","b":"B"}}; },
        expect: ["[b]", "[b]"]
      },
      {
        label: "a macro defined in for k, public in o reads k after the loop",
        flavor: "native",
        src: "{% for k, public in o %}{% macro m() %}[{{ k }}]{% endmacro %}{% endfor %}{{ m() }}",
        loc: function () { return {"o":{"a":"A","b":"B"}}; },
        expect: ["[b]", "[b]"]
      },
      {
        label: "a macro defined in for k, public in o reads k after the loop",
        flavor: "twig",
        src: "{% for k, public in o %}{% macro m() %}[{{ k }}]{% endmacro %}{% endfor %}{{ m() }}",
        loc: function () { return {"o":{"a":"A","b":"B"}}; },
        expect: ["[b]", "[b]"]
      },
      {
        label: "a macro defined in for k, vv in o reads k after the loop (control)",
        flavor: "native",
        src: "{% for k, vv in o %}{% macro m() %}[{{ k }}]{% endmacro %}{% endfor %}{{ m() }}",
        loc: function () { return {"o":{"a":"A","b":"B"}}; },
        expect: ["[b]", "[b]"]
      },
      {
        label: "a macro defined in for k, vv in o reads k after the loop (control)",
        flavor: "twig",
        src: "{% for k, vv in o %}{% macro m() %}[{{ k }}]{% endmacro %}{% endfor %}{{ m() }}",
        loc: function () { return {"o":{"a":"A","b":"B"}}; },
        expect: ["[b]", "[b]"]
      }
    ]
  },
  {
    name: "A loop key named like a name the compiled code uses",
    cases: [
      {
        label: "for _output, v in o: the loop output",
        flavor: "native",
        src: "{% for _output, v in o %}[{{ v }}]{% endfor %}",
        loc: function () { return {"o":{"a":"A","b":"B"}}; },
        expect: ["[A][B]", "[A][B]"]
      },
      {
        label: "for _output, v in o: the loop output",
        flavor: "twig",
        src: "{% for _output, v in o %}[{{ v }}]{% endfor %}",
        loc: function () { return {"o":{"a":"A","b":"B"}}; },
        expect: ["[A][B]", "[A][B]"]
      },
      {
        label: "for kk, v in o: the loop output (control)",
        flavor: "native",
        src: "{% for kk, v in o %}[{{ v }}]{% endfor %}",
        loc: function () { return {"o":{"a":"A","b":"B"}}; },
        expect: ["[A][B]", "[A][B]"]
      },
      {
        label: "for kk, v in o: the loop output (control)",
        flavor: "twig",
        src: "{% for kk, v in o %}[{{ v }}]{% endfor %}",
        loc: function () { return {"o":{"a":"A","b":"B"}}; },
        expect: ["[A][B]", "[A][B]"]
      }
    ]
  }
];

describe('The other name of a two-name loop over a name read from the context only', function () {
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
