var swigModule = require('../../lib/swig'),
  twigModule = require('@rhinostone/swig-twig'),
  jinja2Module = require('@rhinostone/swig-jinja2'),
  expect = require('../lib/expect.js');

/*!
 * On the async render path, a call of an imported macro has in place the
 * names its template bound that the call can reach through that template's
 * own macros, imports and from-imports (utils.importIsolated, which puts
 * every such name in place when the reach is unknown). Code that comes in
 * from the importing side (a function passed as an argument, a macro or
 * alias of an importing template called by name) sees the names in that
 * reach (C1, C2, C4) and reads its own template's names for the others
 * (C3). A macro that hands the context itself to other code, and a name
 * holding a value no compiled code recorded (a function from the locals, an
 * object, an array), keep every name the import bound in place. The sync
 * path is unchanged; each row gives both outputs.
 */

var flavors = [
  ['native', swigModule, 'Swig'],
  ['twig', twigModule, 'Twig'],
  ['jinja2', jinja2Module, 'Jinja2']
];

// `sync` and `async` are the outputs on each render path; `syncTwig` and
// `asyncTwig`, when present, the Twig and Jinja2 outputs (they escape macro
// output), and `syncJinja2` the Jinja2 output where it differs from Twig's
// (it renders undefined as an empty string). `only` names the flavors a
// shape runs in, `locals` makes fresh locals for each render.
var shapes = [
  {
    title: 'N1: a macro of a file the imported file imports reads the imported file\'s top-level set',
    files: {
      '/inner.html': '{% macro f() %}[{{ y }}]{% endmacro %}',
      '/outer.html': '{% import "inner.html" as t %}{% set y = "Y" %}{% macro m0() %}{{ t.f() }}{% endmacro %}'
    },
    imp: '{% import "outer.html" as s %}{{ s.m0() }}',
    from: '{% from "outer.html" import m0 %}{{ m0() }}',
    sync: '[]',
    async: '[Y]'
  },
  {
    title: 'N2: a macro of a file the imported file imports calls a macro of the imported file by name',
    files: {
      '/inner.html': '{% macro f() %}({{ g() }}){% endmacro %}',
      '/outer.html': '{% import "inner.html" as t %}{% macro g() %}G{% endmacro %}{% macro m0() %}{{ t.f() }}{% endmacro %}'
    },
    imp: '{% import "outer.html" as s %}{{ s.m0() }}',
    from: '{% from "outer.html" import m0 %}{{ m0() }}',
    sync: '(G)',
    async: '(G)'
  },
  {
    title: 'N3: a macro of a file the imported file imports uses another import alias of the imported file',
    files: {
      '/inner.html': '{% macro f() %}({{ u.h() }}){% endmacro %}',
      '/other.html': '{% macro h() %}H{% endmacro %}',
      '/outer.html': '{% import "inner.html" as t %}{% import "other.html" as u %}{% macro m0() %}{{ t.f() }}{% endmacro %}'
    },
    imp: '{% import "outer.html" as s %}{{ s.m0() }}',
    from: '{% from "outer.html" import m0 %}{{ m0() }}',
    sync: '(H)',
    async: '(H)'
  },
  {
    title: 'N4: as N1, and the imported file\'s macro reads the set too',
    files: {
      '/inner.html': '{% macro f() %}[{{ y }}]{% endmacro %}',
      '/outer.html': '{% import "inner.html" as t %}{% set y = "Y" %}{% macro m0() %}{{ y }}{{ t.f() }}{% endmacro %}'
    },
    imp: '{% import "outer.html" as s %}{{ s.m0() }}',
    from: '{% from "outer.html" import m0 %}{{ m0() }}',
    sync: '[]',
    async: 'Y[Y]'
  },
  {
    title: 'N5: a macro calls a sibling that reads the file\'s top-level set it does not read itself',
    files: {
      '/outer.html': '{% set y = "Y" %}{% macro g() %}<{{ y }}>{% endmacro %}{% macro m0() %}{{ g() }}{% endmacro %}'
    },
    imp: '{% import "outer.html" as s %}{{ s.m0() }}',
    from: '{% from "outer.html" import m0 %}{{ m0() }}',
    sync: '<>',
    syncTwig: '&lt;&gt;',
    async: '<Y>',
    asyncTwig: '&lt;Y&gt;'
  },
  {
    title: 'N6: as N1, and the importer has its own y',
    files: {
      '/inner.html': '{% macro f() %}[{{ y }}]{% endmacro %}',
      '/outer.html': '{% import "inner.html" as t %}{% set y = "Y" %}{% macro m0() %}{{ t.f() }}{% endmacro %}'
    },
    imp: '{% set y = "P" %}{% import "outer.html" as s %}{{ s.m0() }}',
    from: '{% set y = "P" %}{% from "outer.html" import m0 %}{{ m0() }}',
    sync: '[P]',
    async: '[Y]'
  },
  {
    title: 'N7: a macro reads only its argument; the importer has a variable named like the imported macro',
    files: {
      '/outer.html': '{% macro m0(x) %}<{{ x }}>{% endmacro %}{% macro m1() %}M{% endmacro %}'
    },
    imp: '{% set m1 = "P" %}{% import "outer.html" as s %}{{ s.m0(1) }}{{ m1 }}',
    from: '{% set m1 = "P" %}{% from "outer.html" import m0 %}{{ m0(1) }}{{ m1 }}',
    sync: '<1>P',
    syncTwig: '&lt;1&gt;P',
    async: '<1>P',
    asyncTwig: '&lt;1&gt;P'
  },
  {
    title: 'N8: a function passed as an argument reads the imported file\'s set',
    files: {
      '/inner.html': '{% macro f() %}[{{ y }}]{% endmacro %}',
      '/outer.html': '{% set y = "Y" %}{% macro m0(fn) %}{{ fn() }}{% endmacro %}'
    },
    imp: '{% import "inner.html" as i %}{% import "outer.html" as s %}{{ s.m0(i.f) }}',
    from: '{% from "inner.html" import f %}{% from "outer.html" import m0 %}{{ m0(f) }}',
    sync: '[]',
    async: '[]'
  },
  {
    title: 'N9: the imported file\'s macro calls the importer\'s alias, whose macro reads the imported file\'s set',
    files: {
      '/inner.html': '{% macro f() %}[{{ y }}]{% endmacro %}',
      '/outer.html': '{% set y = "Y" %}{% macro m0() %}{{ i.f() }}{% endmacro %}'
    },
    imp: '{% import "inner.html" as i %}{% import "outer.html" as s %}{{ s.m0() }}',
    from: '{% import "inner.html" as i %}{% from "outer.html" import m0 %}{{ m0() }}',
    sync: '[]',
    async: '[]'
  },
  {
    title: 'N9b: the imported file\'s macro calls a macro of the importer that reads the imported file\'s set',
    files: {
      '/outer.html': '{% set y = "Y" %}{% macro m0() %}{{ pm() }}{% endmacro %}'
    },
    imp: '{% macro pm() %}[{{ y }}]{% endmacro %}{% import "outer.html" as s %}{{ s.m0() }}',
    from: '{% macro pm() %}[{{ y }}]{% endmacro %}{% from "outer.html" import m0 %}{{ m0() }}',
    sync: '[]',
    async: '[]'
  },
  {
    title: 'N10: three levels: the innermost macro reads a set of the outermost imported file',
    files: {
      '/c.html': '{% macro o() %}[{{ z }}]{% endmacro %}',
      '/b.html': '{% import "c.html" as c %}{% macro n() %}{{ c.o() }}{% endmacro %}',
      '/a.html': '{% import "b.html" as b %}{% set z = "Z" %}{% macro m0() %}{{ b.n() }}{% endmacro %}'
    },
    imp: '{% import "a.html" as s %}{{ s.m0() }}',
    from: '{% from "a.html" import m0 %}{{ m0() }}',
    sync: '[]',
    async: '[Z]'
  },
  {
    title: 'N10b: three levels: the innermost macro reads a set of the middle file',
    files: {
      '/c.html': '{% macro o() %}[{{ z }}]{% endmacro %}',
      '/b.html': '{% import "c.html" as c %}{% set z = "Z" %}{% macro n() %}{{ c.o() }}{% endmacro %}',
      '/a.html': '{% import "b.html" as b %}{% macro m0() %}{{ b.n() }}{% endmacro %}'
    },
    imp: '{% import "a.html" as s %}{{ s.m0() }}',
    from: '{% from "a.html" import m0 %}{{ m0() }}',
    sync: '[]',
    async: '[Z]'
  },
  {
    title: 'N11: a top-level set holds an imported macro that reads the imported file\'s set',
    files: {
      '/inner.html': '{% macro f() %}[{{ y }}]{% endmacro %}',
      '/outer.html': '{% import "inner.html" as t %}{% set y = "Y" %}{% set k = t.f %}{% macro m0() %}{{ k() }}{% endmacro %}'
    },
    imp: '{% import "outer.html" as s %}{{ s.m0() }}',
    from: '{% from "outer.html" import m0 %}{{ m0() }}',
    sync: '',
    async: '[Y]'
  },
  {
    title: 'N12: an object literal holds an imported macro that reads the imported file\'s set',
    files: {
      '/inner.html': '{% macro f() %}[{{ y }}]{% endmacro %}',
      '/outer.html': '{% import "inner.html" as t %}{% set y = "Y" %}{% set o = {"f": t.f} %}{% macro m0() %}{{ o.f() }}{% endmacro %}'
    },
    imp: '{% import "outer.html" as s %}{{ s.m0() }}',
    from: '{% from "outer.html" import m0 %}{{ m0() }}',
    sync: '',
    async: '[Y]'
  },
  {
    title: 'N13: as N12, the macro one object deeper',
    files: {
      '/inner.html': '{% macro f() %}[{{ y }}]{% endmacro %}',
      '/outer.html': '{% import "inner.html" as t %}{% set y = "Y" %}{% set o = {"a": {"f": t.f}} %}{% macro m0() %}{{ o.a.f() }}{% endmacro %}'
    },
    imp: '{% import "outer.html" as s %}{{ s.m0() }}',
    from: '{% from "outer.html" import m0 %}{{ m0() }}',
    sync: '',
    async: '[Y]'
  },
  {
    title: 'N14: the imported file from-imports a macro that reads the imported file\'s set',
    files: {
      '/inner.html': '{% macro f() %}[{{ y }}]{% endmacro %}',
      '/outer.html': '{% from "inner.html" import f %}{% set y = "Y" %}{% macro m0() %}{{ f() }}{% endmacro %}'
    },
    imp: '{% import "outer.html" as s %}{{ s.m0() }}',
    from: '{% from "outer.html" import m0 %}{{ m0() }}',
    only: ['twig', 'jinja2'],
    sync: '[]',
    async: '[Y]'
  },
  {
    title: 'N20: tells the mechanisms apart: m0 reaches y through its own import, and calls the importer\'s alias of another file, whose macro reads the imported file\'s w',
    files: {
      '/inner.html': '{% macro f() %}[{{ y }}]{% endmacro %}',
      '/other.html': '{% macro g() %}<{{ w }}>{% endmacro %}',
      '/outer.html': '{% import "inner.html" as t %}{% set y = "Y" %}{% set w = "W" %}{% macro m0() %}{{ t.f() }}{{ i.g() }}{% endmacro %}'
    },
    imp: '{% import "other.html" as i %}{% import "outer.html" as s %}{{ s.m0() }}',
    from: '{% import "other.html" as i %}{% from "outer.html" import m0 %}{{ m0() }}',
    sync: '[]<>',
    syncTwig: '[]&lt;&gt;',
    async: '[Y]<>',
    asyncTwig: '[Y]&lt;&gt;'
  },
  {
    title: 'N21: a macro reads a set holding a big array (more values than the walk reads)',
    files: {
      '/outer.html': '{% set y = "Y" %}{% set a = big %}{% macro m0() %}{{ a.length }}{{ y }}{% endmacro %}'
    },
    imp: '{% import "outer.html" as s %}{{ s.m0() }}',
    from: '{% from "outer.html" import m0 %}{{ m0() }}',
    locals: function () { var b = [], i; for (i = 0; i < 5000; i += 1) { b.push(i); } return { big: b }; },
    sync: '',
    async: '5000Y'
  },
  {
    title: 'N15: a top-level set holds a function from the locals',
    files: {
      '/outer.html': '{% set h = helper %}{% set y = "Y" %}{% macro m0() %}{{ h() }}{{ y }}{% endmacro %}'
    },
    imp: '{% import "outer.html" as s %}{{ s.m0() }}',
    from: '{% from "outer.html" import m0 %}{{ m0() }}',
    locals: function () { return { helper: function () { return 'H'; } }; },
    sync: '',
    async: 'HY'
  },
  {
    title: 'N17: a top-level set holds a Proxy from the locals whose key listing throws',
    files: {
      '/outer.html': '{% set d = data %}{% macro m0() %}[{{ d.x }}]{% endmacro %}'
    },
    imp: '{% import "outer.html" as s %}{{ s.m0() }}',
    from: '{% from "outer.html" import m0 %}{{ m0() }}',
    locals: function () { return { data: new Proxy({ x: 'X' }, { ownKeys: function () { throw new Error('no keys'); } }) }; },
    sync: '[]',
    async: '[X]'
  },
  {
    title: 'N18: a macro passes the importer\'s alias object as an argument; the callee calls through it',
    files: {
      '/inner.html': '{% macro f() %}[{{ y }}]{% endmacro %}',
      '/outer.html': '{% set y = "Y" %}{% macro m0(lib) %}{{ lib.f() }}{% endmacro %}'
    },
    imp: '{% import "inner.html" as i %}{% import "outer.html" as s %}{{ s.m0(i) }}',
    from: '{% import "inner.html" as i %}{% from "outer.html" import m0 %}{{ m0(i) }}',
    sync: '[]',
    async: '[]'
  },
  {
    title: 'N22: the imported file\'s own import calls back a macro of the imported file by name, which reads a name both files bind',
    files: {
      '/inner.html': '{% set z = "I" %}{% macro f() %}{{ g() }}{% endmacro %}',
      '/outer.html': '{% import "inner.html" as t %}{% set z = "O" %}{% macro g() %}[{{ z }}]{% endmacro %}{% macro m0() %}{{ t.f() }}{% endmacro %}'
    },
    imp: '{% import "outer.html" as s %}{{ s.m0() }}',
    from: '{% from "outer.html" import m0 %}{{ m0() }}',
    sync: '[]',
    async: '[O]'
  },
  {
    title: 'N19: two imports of one file, each macro reads that import\'s set',
    files: {
      '/inner.html': '{% macro f() %}[{{ y }}]{% endmacro %}',
      '/outer.html': '{% import "inner.html" as t %}{% set y = "Y" %}{% macro m0() %}{{ t.f() }}{% endmacro %}'
    },
    imp: '{% import "outer.html" as s %}{% import "outer.html" as s2 %}{{ s.m0() }}{{ s2.m0() }}',
    from: '{% from "outer.html" import m0 %}{% from "outer.html" import m0 as m1 %}{{ m0() }}{{ m1() }}',
    sync: '[][]',
    async: '[Y][Y]'
  },
  {
    title: 'C1: the importer\'s alias of another file reads a name the imported macro reaches through its own import',
    files: {
      '/inner.html': '{% macro f() %}[{{ y }}]{% endmacro %}',
      '/other.html': '{% macro g() %}<{{ y }}>{% endmacro %}',
      '/outer.html': '{% import "inner.html" as t %}{% set y = "Y" %}{% macro m0() %}{{ t.f() }}{{ i.g() }}{% endmacro %}'
    },
    imp: '{% import "other.html" as i %}{% import "outer.html" as s %}{{ s.m0() }}',
    from: '{% import "other.html" as i %}{% from "outer.html" import m0 %}{{ m0() }}',
    sync: '[]<>',
    syncTwig: '[]&lt;&gt;',
    async: '[Y]<Y>',
    asyncTwig: '[Y]&lt;Y&gt;'
  },
  {
    title: 'C2: the importer\'s alias of another file reads a name the imported macro reads itself',
    files: {
      '/other.html': '{% macro g() %}<{{ w }}>{% endmacro %}',
      '/outer.html': '{% set w = "W" %}{% macro m0() %}{{ w }}{{ i.g() }}{% endmacro %}'
    },
    imp: '{% import "other.html" as i %}{% import "outer.html" as s %}{{ s.m0() }}',
    from: '{% import "other.html" as i %}{% from "outer.html" import m0 %}{{ m0() }}',
    sync: '<>',
    syncTwig: '&lt;&gt;',
    async: 'W<W>',
    asyncTwig: 'W&lt;W&gt;'
  },
  {
    title: 'C3: a macro of the page passed as an argument reads a name the page and the imported file bind, the imported macro does not use it',
    files: {
      '/lib.html': '{% set y = "I" %}{% macro m(fn) %}{{ fn() }}{% endmacro %}'
    },
    imp: '{% set y = "P" %}{% macro pm() %}<{{ y }}>{% endmacro %}{% import "lib.html" as s %}{{ s.m(pm) }}',
    from: '{% set y = "P" %}{% macro pm() %}<{{ y }}>{% endmacro %}{% from "lib.html" import m %}{{ m(pm) }}',
    sync: '<P>',
    syncTwig: '&lt;P&gt;',
    async: '<P>',
    asyncTwig: '&lt;P&gt;'
  },
  {
    title: 'C4: as C3, and the imported macro reads that name too',
    files: {
      '/lib.html': '{% set y = "I" %}{% macro m(fn) %}{{ y }}{{ fn() }}{% endmacro %}'
    },
    imp: '{% set y = "P" %}{% macro pm() %}<{{ y }}>{% endmacro %}{% import "lib.html" as s %}{{ s.m(pm) }}',
    from: '{% set y = "P" %}{% macro pm() %}<{{ y }}>{% endmacro %}{% from "lib.html" import m %}{{ m(pm) }}',
    sync: 'P<P>',
    syncTwig: 'P&lt;P&gt;',
    async: 'I<I>',
    asyncTwig: 'I&lt;I&gt;'
  },
  {
    title: 'D1: a locals function given _ctx reads the imported file\'s set',
    files: {
      '/outer.html': '{% set y = "Y" %}{% macro m0() %}[{{ pick(_ctx) }}]{% endmacro %}'
    },
    imp: '{% import "outer.html" as s %}{{ s.m0() }}',
    from: '{% from "outer.html" import m0 %}{{ m0() }}',
    locals: function () { return { pick: function (c) { return c && c.y; } }; },
    sync: '[undefined]',
    syncJinja2: '[]',
    async: '[Y]'
  },
  {
    title: 'D2: a custom tag passes _ctx to an extension that reads the imported file\'s set',
    files: {
      '/outer.html': '{% set y = "Y" %}{% macro m0() %}[{% pickctx %}]{% endmacro %}'
    },
    imp: '{% import "outer.html" as s %}{{ s.m0() }}',
    from: '{% from "outer.html" import m0 %}{{ m0() }}',
    sync: '[undefined]',
    async: '[Y]'
  },
  {
    title: 'D3: a custom tag passes _ctx to an extension that calls a sibling macro',
    files: {
      '/outer.html': '{% macro g() %}G{% endmacro %}{% macro m0() %}[{% callg %}]{% endmacro %}'
    },
    imp: '{% import "outer.html" as s %}{{ s.m0() }}',
    from: '{% from "outer.html" import m0 %}{{ m0() }}',
    sync: '[]',
    async: '[G]'
  },
  {
    title: 'E1: a custom tag passes a copy of _ctx to an extension',
    files: {
      '/outer.html': '{% set y = "Y" %}{% macro m0() %}[{% pickcopy %}]{% endmacro %}'
    },
    imp: '{% import "outer.html" as s %}{{ s.m0() }}',
    from: '{% from "outer.html" import m0 %}{{ m0() }}',
    sync: '[undefined]',
    async: '[Y]'
  },
  {
    title: 'E2: a custom tag passes a copy of _ctx through its own function',
    files: {
      '/outer.html': '{% set y = "Y" %}{% macro m0() %}[{% pickiife %}]{% endmacro %}'
    },
    imp: '{% import "outer.html" as s %}{{ s.m0() }}',
    from: '{% from "outer.html" import m0 %}{{ m0() }}',
    sync: '[undefined]',
    async: '[Y]'
  },
  {
    title: 'E3: a locals function given the macro\'s own copy __ctx',
    files: {
      '/outer.html': '{% set y = "Y" %}{% macro m0() %}[{{ pick(__ctx) }}]{% endmacro %}'
    },
    imp: '{% import "outer.html" as s %}{{ s.m0() }}',
    from: '{% from "outer.html" import m0 %}{{ m0() }}',
    locals: function () { return { pick: function (c) { return c && c.y; } }; },
    sync: '[undefined]',
    syncJinja2: '[]',
    async: '[Y]'
  },
  {
    title: 'E4: a sibling macro called through _exports reads the imported file\'s set',
    files: {
      '/outer.html': '{% set y = "Y" %}{% macro g() %}{{ y }}{% endmacro %}{% macro m0() %}[{{ _exports.g() }}]{% endmacro %}'
    },
    imp: '{% import "outer.html" as s %}{{ s.m0() }}',
    from: '{% from "outer.html" import m0 %}{{ m0() }}',
    sync: '[]',
    async: '[Y]'
  },
  {
    title: 'E5: a macro defined in a macro reads the imported file\'s set',
    files: {
      '/outer.html': '{% set y = "Y" %}{% macro m0() %}{% macro inner() %}{{ y }}{% endmacro %}[{{ inner() }}]{% endmacro %}'
    },
    imp: '{% import "outer.html" as s %}{{ s.m0() }}',
    from: '{% from "outer.html" import m0 %}{{ m0() }}',
    sync: '[]',
    async: '[Y]'
  },
  {
    title: 'E6: a {% with %} body hands _ctx to a locals function',
    files: {
      '/outer.html': '{% set y = "Y" %}{% macro m0() %}{% with %}[{{ pick(_ctx) }}]{% endwith %}{% endmacro %}'
    },
    imp: '{% import "outer.html" as s %}{{ s.m0() }}',
    from: '{% from "outer.html" import m0 %}{{ m0() }}',
    only: ['twig', 'jinja2'],
    locals: function () { return { pick: function (c) { return c && c.y; } }; },
    sync: '[undefined]',
    syncJinja2: '[]',
    async: '[Y]'
  },
  {
    title: 'B1: a macro reads a set holding an array of 100000 values',
    files: {
      '/outer.html': '{% set v = big %}{% macro m0(x) %}<{{ v.length }}|{{ x }}>{% endmacro %}'
    },
    imp: '{% import "outer.html" as s %}{{ s.m0(1) }}',
    from: '{% from "outer.html" import m0 %}{{ m0(1) }}',
    locals: function () { var a = [], i; for (i = 0; i < 100000; i += 1) { a.push(i); } return { big: a }; },
    sync: '<|1>',
    syncTwig: '&lt;|1&gt;',
    async: '<100000|1>',
    asyncTwig: '&lt;100000|1&gt;'
  },
  {
    title: 'B2: a macro reads a set holding an object of 100000 keys',
    files: {
      '/outer.html': '{% set v = big %}{% macro m0(x) %}<{{ v.k1 }}|{{ x }}>{% endmacro %}'
    },
    imp: '{% import "outer.html" as s %}{{ s.m0(1) }}',
    from: '{% from "outer.html" import m0 %}{{ m0(1) }}',
    locals: function () { var o = {}, i; for (i = 0; i < 100000; i += 1) { o['k' + i] = i; } return { big: o }; },
    sync: '<|1>',
    syncTwig: '&lt;|1&gt;',
    async: '<1|1>',
    asyncTwig: '&lt;1|1&gt;'
  }
];

flavors.forEach(function (fv) {
  var name = fv[0],
    lib = fv[1],
    Ctor = lib[fv[2]];

  // The custom tags and extensions of the D and E rows.
  function setup(s) {
    s.setExtension('pick', function (c) { return c && c.y; });
    s.setExtension('callg', function (c) { return (c && typeof c.g === 'function') ? c.g() : ''; });
    s.setTag('pickctx', function () { return true; }, function () { return '_output += _ext.pick(_ctx);\n'; }, false);
    s.setTag('callg', function () { return true; }, function () { return '_output += _ext.callg(_ctx);\n'; }, false);
    s.setTag('pickcopy', function () { return true; }, function () { return '_output += _ext.pick(_utils.extend({}, _ctx));\n'; }, false);
    s.setTag('pickiife', function () { return true; }, function () { return '_output += (function (c) { return _ext.pick(c); })(_utils.extend({}, _ctx));\n'; }, false);
    return s;
  }

  function asyncLoader(all) {
    var mem = lib.loaders.memory(all, '/');
    return {
      async: true,
      resolve: mem.resolve,
      load: function (id, cb) {
        if (!cb) {
          return mem.load(id);
        }
        setTimeout(function () {
          var src;
          try {
            src = mem.load(id);
          } catch (e) {
            cb(e);
            return;
          }
          cb(null, src);
        }, 0);
      }
    };
  }

  function withMain(files, main) {
    var all = { '/t.html': main };
    Object.keys(files).forEach(function (k) {
      all[k] = files[k];
    });
    return all;
  }

  function renderAsync(all, locals) {
    return new Promise(function (resolve, reject) {
      setup(new Ctor({ loader: asyncLoader(all), cache: false })).renderFile('/t.html', locals, function (err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
  }

  // The output this flavor gives on one render path ('sync' or 'async').
  function want(sh, p) {
    if (name === 'jinja2' && sh[p + 'Jinja2'] !== undefined) {
      return sh[p + 'Jinja2'];
    }
    if (name !== 'native' && sh[p + 'Twig'] !== undefined) {
      return sh[p + 'Twig'];
    }
    return sh[p];
  }

  // Render on the sync path, then on the async path, each with fresh locals.
  function check(sh, main) {
    var all = withMain(sh.files, main),
      fresh = function () { return sh.locals ? sh.locals() : {}; };
    expect(setup(new Ctor({ loader: lib.loaders.memory(all, '/'), cache: false })).renderFile('/t.html', fresh()))
      .to.equal(want(sh, 'sync'));
    return renderAsync(all, fresh()).then(function (res) {
      expect(res).to.equal(want(sh, 'async'));
    });
  }

  describe(name + ' — the names an async import puts in place while its macros run', function () {
    shapes.forEach(function (sh) {
      if (sh.only && sh.only.indexOf(name) === -1) {
        return;
      }
      it(sh.title + ' (import)', function () {
        return check(sh, sh.imp);
      });
      if (name !== 'native') {
        it(sh.title + ' (from)', function () {
          return check(sh, sh.from);
        });
      }
    });

    it('N16: an import reads a getter of an object a set holds as often as the same macro defined in the page', function () {
      var meter = { gets: 0 },
        locals = function () {
          return { data: Object.defineProperty({}, 'g', { enumerable: true, get: function () { meter.gets += 1; return 'G'; } }) };
        },
        imported = withMain({ '/outer.html': '{% set d = data %}{% macro m0() %}[{{ d.g }}]{% endmacro %}' }, '{% import "outer.html" as s %}{{ s.m0() }}'),
        inPage = withMain({}, '{% set d = data %}{% macro m0() %}[{{ d.g }}]{% endmacro %}{{ m0() }}'),
        viaImport;
      return renderAsync(imported, locals()).then(function (out) {
        expect(out).to.equal('[G]');
        viaImport = meter.gets;
        meter.gets = 0;
        return renderAsync(inPage, locals());
      }).then(function (out) {
        expect(out).to.equal('[G]');
        expect(meter.gets).to.be.greaterThan(0);
        expect(viaImport).to.equal(meter.gets);
      });
    });
  });
});
