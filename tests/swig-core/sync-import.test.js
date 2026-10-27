var swigModule = require('../../lib/swig'),
  twigModule = require('@rhinostone/swig-twig'),
  jinja2Module = require('@rhinostone/swig-jinja2'),
  expect = require('../lib/expect.js');

/*!
 * The sync {% import %} and {% from %} tags rewrote the compiled JS of the
 * imported macros by name. That rewrite got several shapes wrong: a macro
 * named k failed to compile and a name holding $ rendered empty (native);
 * a macro named sa, a set target named like a sibling macro and an alias
 * equal to a macro's name failed; a parameter named like a sibling macro or
 * like the imported file's own import rendered the wrong value; text holding
 * "_ctx.<sibling>" was altered; an import whose alias the imported file also
 * used for its own import rendered nothing; and a from-import could not
 * reach a sibling it did not name, failed when the importer held a variable
 * or loop variable of that name, and bound swapped aliases wrongly. The tags
 * now run the imported file's own imports and macros, unrewritten, in a
 * scope function of the import (_utils.importScope), so each shape renders
 * the same on the sync and the async render paths, and a sync import makes
 * no global.
 */

var flavors = [
  ['native', swigModule, 'Swig'],
  ['twig', twigModule, 'Twig'],
  ['jinja2', jinja2Module, 'Jinja2']
];

// `out` is the native output; `esc`, when present, is the Twig and Jinja2
// output, which escapes the macro output. `only` and `skip` name flavors.
var shapes = [
  {
    title: 'renders the argument of a parameter named like a sibling macro',
    files: { '/m.html': '{% macro a() %}A{% endmacro %}{% macro b(a) %}<{{ a }}>{% endmacro %}' },
    imp: '{% import "m.html" as s %}[{{ s.b(5) }}]',
    from: '{% from "m.html" import b %}[{{ b(5) }}]',
    out: '[<5>]',
    esc: '[&lt;5&gt;]'
  },
  {
    title: 'renders a macro named k',
    files: { '/m.html': '{% macro k() %}K{% endmacro %}' },
    imp: '{% import "m.html" as s %}[{{ s.k() }}]',
    from: '{% from "m.html" import k %}[{{ k() }}]',
    out: '[K]'
  },
  {
    title: 'renders a macro named $x',
    only: 'native',
    files: { '/m.html': '{% macro $x() %}X{% endmacro %}' },
    imp: '{% import "m.html" as s %}[{{ s.$x() }}]',
    out: '[X]'
  },
  {
    title: 'renders a macro named $',
    only: 'native',
    files: { '/m.html': '{% macro $() %}D{% endmacro %}' },
    imp: '{% import "m.html" as s %}[{{ s.$() }}]',
    out: '[D]'
  },
  {
    title: 'reaches the imported file\'s own import when its alias equals the importer\'s',
    files: {
      '/n.html': '{% macro h() %}H{% endmacro %}',
      '/m.html': '{% import "n.html" as s %}{% macro f() %}{{ s.h() }}{% endmacro %}'
    },
    imp: '{% import "m.html" as s %}[{{ s.f() }}]',
    from: '{% from "m.html" import f as s %}[{{ s() }}]',
    out: '[H]'
  },
  {
    title: 'reaches the imported file\'s own import under another alias',
    files: {
      '/n.html': '{% macro h() %}H{% endmacro %}',
      '/m.html': '{% import "n.html" as t %}{% macro f() %}{{ t.h() }}{% endmacro %}'
    },
    imp: '{% import "m.html" as s %}[{{ s.f() }}]',
    from: '{% from "m.html" import f %}[{{ f() }}]',
    out: '[H]'
  },
  {
    title: 'does not expose the imported file\'s own import through the alias',
    files: {
      '/n.html': '{% macro h() %}H{% endmacro %}',
      '/m.html': '{% import "n.html" as t %}{% macro f() %}F{% endmacro %}'
    },
    imp: '{% import "m.html" as s %}[{{ s.t.h() }}]',
    out: '[]'
  },
  {
    title: 'keeps a loop variable named like a sibling macro',
    files: { '/m.html': '{% macro a(xs) %}{% for b in xs %}{{ b }}{% endfor %}{% endmacro %}{% macro b() %}B{% endmacro %}' },
    imp: '{% import "m.html" as s %}[{{ s.a([1, 2]) }}|{{ s.b() }}]',
    from: '{% from "m.html" import a, b %}[{{ a([1, 2]) }}|{{ b() }}]',
    out: '[12|B]'
  },
  {
    title: 'keeps a set target named like a sibling macro',
    files: { '/m.html': '{% macro a() %}{% set b = 1 %}{{ b }}{% endmacro %}{% macro b() %}B{% endmacro %}' },
    imp: '{% import "m.html" as s %}[{{ s.a() }}|{{ s.b() }}]',
    from: '{% from "m.html" import a, b %}[{{ a() }}|{{ b() }}]',
    out: '[1|B]'
  },
  {
    title: 'leaves a string literal that holds "_ctx." and the name of a sibling alone',
    files: { '/m.html': '{% macro a() %}{{ "_ctx.b" }}{% endmacro %}{% macro b() %}B{% endmacro %}' },
    imp: '{% import "m.html" as s %}[{{ s.a() }}]',
    from: '{% from "m.html" import a %}[{{ a() }}]',
    out: '[_ctx.b]'
  },
  {
    title: 'leaves template text that holds "_ctx." and the name of a sibling alone',
    files: { '/m.html': '{% macro a() %}_ctx.b{% endmacro %}{% macro b() %}B{% endmacro %}' },
    imp: '{% import "m.html" as s %}[{{ s.a() }}]',
    from: '{% from "m.html" import a %}[{{ a() }}]',
    out: '[_ctx.b]'
  },
  {
    title: 'lets an imported macro call a sibling the import does not name',
    files: { '/m.html': '{% macro a() %}A{{ b() }}{% endmacro %}{% macro b() %}B{% endmacro %}' },
    imp: '{% import "m.html" as s %}[{{ s.a() }}]',
    from: '{% from "m.html" import a %}[{{ a() }}]',
    out: '[AB]'
  },
  {
    title: 'lets an imported macro read a variable of the importer',
    files: { '/m.html': '{% macro a() %}{{ who }}{% endmacro %}' },
    imp: '{% set who = "W" %}{% import "m.html" as s %}[{{ s.a() }}]',
    from: '{% set who = "W" %}{% from "m.html" import a %}[{{ a() }}]',
    out: '[W]'
  },
  {
    title: 'keeps an importer variable named like a sibling macro apart from that macro',
    files: { '/m.html': '{% macro a() %}{{ b() }}{% endmacro %}{% macro b() %}B{% endmacro %}' },
    imp: '{% set b = "V" %}{% import "m.html" as s %}[{{ s.a() }}|{{ b }}]',
    from: '{% set b = "V" %}{% from "m.html" import a %}[{{ a() }}|{{ b }}]',
    out: '[B|V]'
  },
  {
    title: 'renders a recursive macro',
    files: { '/m.html': '{% macro r(n) %}{% if n > 0 %}{{ n }}{{ r(n - 1) }}{% endif %}{% endmacro %}' },
    imp: '{% import "m.html" as s %}[{{ s.r(3) }}]',
    from: '{% from "m.html" import r %}[{{ r(3) }}]',
    out: '[321]'
  },
  {
    title: 'keeps the escaping of the macro output',
    files: { '/m.html': '{% macro a() %}<b>{% endmacro %}' },
    imp: '{% import "m.html" as s %}[{{ s.a() }}]',
    from: '{% from "m.html" import a %}[{{ a() }}]',
    out: '[<b>]',
    esc: '[&lt;b&gt;]'
  },
  {
    title: 'renders an import whose alias equals the name of one of its macros',
    files: { '/m.html': '{% macro s() %}S{% endmacro %}{% macro a() %}A{{ s() }}{% endmacro %}' },
    imp: '{% import "m.html" as s %}[{{ s.s() }}|{{ s.a() }}]',
    out: '[S|AS]'
  },
  {
    title: 'renders an import whose alias equals a parameter name',
    files: { '/m.html': '{% macro a(s) %}<{{ s }}>{% endmacro %}' },
    imp: '{% import "m.html" as s %}[{{ s.a(5) }}]',
    out: '[<5>]',
    esc: '[&lt;5&gt;]'
  },
  {
    title: 'renders the same file imported twice',
    files: { '/m.html': '{% macro a() %}A{{ b() }}{% endmacro %}{% macro b() %}B{% endmacro %}' },
    imp: '{% import "m.html" as s %}{% import "m.html" as t %}[{{ s.a() }}{{ t.a() }}]',
    out: '[ABAB]'
  },
  {
    title: 'lets an imported macro read a variable the importer sets after the import',
    files: { '/m.html': '{% macro a() %}{{ who }}{% endmacro %}' },
    imp: '{% import "m.html" as s %}{% set who = "W" %}[{{ s.a() }}]',
    from: '{% from "m.html" import a %}{% set who = "W" %}[{{ a() }}]',
    out: '[W]'
  },
  {
    title: 'reaches imports three files deep that all use one alias',
    files: {
      '/o.html': '{% macro z() %}Z{% endmacro %}',
      '/n.html': '{% import "o.html" as s %}{% macro h() %}{{ s.z() }}{% endmacro %}',
      '/m.html': '{% import "n.html" as s %}{% macro f() %}{{ s.h() }}{% endmacro %}'
    },
    imp: '{% import "m.html" as s %}[{{ s.f() }}]',
    from: '{% from "m.html" import f %}[{{ f() }}]',
    out: '[Z]'
  },
  {
    title: 'renders the argument of a parameter named like the imported file\'s own import',
    files: {
      '/n.html': '{% macro h() %}H{% endmacro %}',
      '/m.html': '{% import "n.html" as t %}{% macro f(t) %}<{{ t }}>{% endmacro %}'
    },
    imp: '{% import "m.html" as s %}[{{ s.f(5) }}]',
    from: '{% from "m.html" import f %}[{{ f(5) }}]',
    out: '[<5>]',
    esc: '[&lt;5&gt;]'
  },
  {
    title: 'renders an imported macro called in a loop whose variable is named like a sibling',
    files: { '/m.html': '{% macro a(x) %}<{{ x }}{{ b() }}>{% endmacro %}{% macro b() %}B{% endmacro %}' },
    imp: '{% import "m.html" as s %}[{% for b in [1, 2] %}{{ s.a(b) }}{{ b }}{% endfor %}]',
    from: '{% from "m.html" import a %}[{% for b in [1, 2] %}{{ a(b) }}{{ b }}{% endfor %}]',
    out: '[<1B>1<2B>2]',
    esc: '[&lt;1B&gt;1&lt;2B&gt;2]'
  },
  {
    title: 'renders a macro whose name is the start of "safe"',
    files: { '/m.html': '{% macro sa() %}SA{% endmacro %}{% macro b() %}B{% endmacro %}' },
    imp: '{% import "m.html" as t %}[{{ t.sa() }}{{ t.b() }}]',
    from: '{% from "m.html" import sa as x, b %}[{{ x() }}{{ b() }}]',
    out: '[SAB]'
  },
  {
    title: 'binds swapped aliases to the right macros',
    skip: 'native',
    files: { '/m.html': '{% macro foo() %}F{% endmacro %}{% macro bar() %}R{% endmacro %}' },
    from: '{% from "m.html" import foo as bar, bar as foo %}[{{ bar() }}{{ foo() }}]',
    out: '[FR]'
  },
  {
    title: 'reaches a from-import inside a from-imported file',
    skip: 'native',
    files: {
      '/o.html': '{% macro z() %}Z{% endmacro %}',
      '/n.html': '{% from "o.html" import z %}{% macro h() %}{{ z() }}{% endmacro %}',
      '/m.html': '{% from "n.html" import h %}{% macro f() %}{{ h() }}{% endmacro %}'
    },
    imp: '{% import "m.html" as s %}[{{ s.f() }}]',
    from: '{% from "m.html" import f %}[{{ f() }}]',
    out: '[Z]'
  },
  {
    title: 'renders a macro named _scope, called by a sibling and through the alias',
    files: { '/m.html': '{% macro _scope() %}SC{% endmacro %}{% macro a() %}A{{ _scope() }}{% endmacro %}' },
    imp: '{% import "m.html" as s %}[{{ s.a() }}{{ s._scope() }}]',
    out: '[ASCSC]'
  },
  {
    title: 'renders a macro named String beside a ~ concatenation',
    skip: 'native',
    files: { '/m.html': '{% macro String() %}S{% endmacro %}{% macro a() %}{{ "x" ~ "y" }}{{ String() }}{% endmacro %}' },
    imp: '{% import "m.html" as s %}[{{ s.a() }}]',
    out: '[xyS]'
  },
  {
    title: 'lets a sibling call a macro named like a variable the importer holds, and keeps that variable',
    files: { '/m.html': '{% macro _h() %}H{% endmacro %}{% macro a() %}A{{ _h() }}{% endmacro %}' },
    imp: '{% set _h = "V" %}{% import "m.html" as s %}[{{ s.a() }}|{{ _h }}]',
    out: '[AH|V]'
  },
  {
    title: 'binds a macro defined inside an imported macro in the context, never as a global',
    files: { '/m.html': '{% macro a() %}{% macro nestedInImport() %}I{% endmacro %}[{{ nestedInImport() }}]{% endmacro %}' },
    imp: '{% import "m.html" as s %}{{ s.a() }}',
    from: '{% from "m.html" import a %}{{ a() }}',
    out: '[I]',
    global: 'nestedInImport'
  },
  {
    title: 'lets an imported macro call a sibling named __l inside a loop',
    files: { '/m.html': '{% macro __l() %}L{% endmacro %}{% macro a(xs) %}{% for x in xs %}{{ __l() }}{% endfor %}{% endmacro %}' },
    imp: '{% import "m.html" as s %}[{{ s.a(xs) }}]',
    from: '{% from "m.html" import a %}[{{ a(xs) }}]',
    locals: { xs: [1, 2] },
    out: '[LL]'
  },
  {
    title: 'renders a macro named class through the alias',
    files: { '/m.html': '{% macro class() %}C{% endmacro %}{% macro a() %}A{% endmacro %}' },
    imp: '{% import "m.html" as s %}[{{ s.class() }}{{ s.a() }}]',
    from: '{% from "m.html" import class as c, a %}[{{ c() }}{{ a() }}]',
    out: '[CA]'
  }
];

// Macros named like the internals, the standard globals and the names the
// emitted code declares, each called by a sibling and through the alias.
var internalNames = ['_scope', '_utils', '_filters', '_fn', '_ext', '_output', '_exports', '_imp', '_swig', '_blocks',
  '_parentBlock', '_ctx', 'String', 'Object', 'Math', 'JSON', 'undefined', 'eval', 'arguments', 'NaN', '__l', '__ctx', '__k'];

flavors.forEach(function (flavor) {
  var name = flavor[0],
    lib = flavor[1],
    Ctor = lib[flavor[2]];

  // An async loader over in-memory templates; each load completes on a later turn.
  function asyncLoader(files) {
    var mem = lib.loaders.memory(files, '/');
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

  // Render on the sync path (checking that it made no global), then on the
  // async path; both must give `want`.
  function check(files, main, want, locals, globalName) {
    var all = withMain(files, main),
      before = Object.keys(global),
      out = new Ctor({ loader: lib.loaders.memory(all, '/'), cache: false }).renderFile('/t.html', locals || {}),
      added = Object.keys(global).filter(function (k) { return before.indexOf(k) === -1; });
    expect(out).to.equal(want);
    expect(added).to.eql([]);
    if (globalName) {
      expect(typeof global[globalName]).to.equal('undefined');
    }
    return new Promise(function (resolve, reject) {
      new Ctor({ loader: asyncLoader(all), cache: false }).renderFile('/t.html', locals || {}, function (err, res) {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    }).then(function (res) {
      expect(res).to.equal(want);
    });
  }

  describe(name + ' — a sync import or from-import of a file\'s macros', function () {
    shapes.forEach(function (sh) {
      var want = (name !== 'native' && sh.esc) ? sh.esc : sh.out;
      if ((sh.only && sh.only !== name) || (sh.skip && sh.skip === name)) {
        return;
      }
      if (sh.imp) {
        it(sh.title + ' (import)', function () {
          return check(sh.files, sh.imp, want, sh.locals, sh.global);
        });
      }
      if (sh.from && name !== 'native') {
        it(sh.title + ' (from)', function () {
          return check(sh.files, sh.from, want, sh.locals, sh.global);
        });
      }
    });

    internalNames.forEach(function (n) {
      it('renders a macro named ' + n + ', called by a sibling and through the alias', function () {
        var files = { '/m.html': '{% macro ' + n + '() %}N{% endmacro %}{% macro a() %}A{{ ' + n + '() }}{% endmacro %}' };
        return check(files, '{% import "m.html" as s %}[{{ s.a() }}|{{ s.' + n + '() }}]', '[AN|N]').then(function () {
          if (name !== 'native') {
            return check(files, '{% from "m.html" import a %}[{{ a() }}]', '[AN]');
          }
        });
      });
    });
  });
});
