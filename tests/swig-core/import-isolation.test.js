var swigModule = require('../../lib/swig'),
  twigModule = require('@rhinostone/swig-twig'),
  jinja2Module = require('@rhinostone/swig-jinja2'),
  expect = require('../lib/expect.js');

/*!
 * On the async render path an imported template ran with the importer's
 * context and left in it what it bound there: its macros, its top-level sets,
 * the aliases of its own imports and the names a template it includes set.
 * They landed in the importer, and through it in the locals object the caller
 * passed, where the sync path keeps them out (it re-homes a file's own imports
 * under the alias). The import now takes them back out when it returns, and
 * the imported macros see them only while they run.
 */

var flavors = [
  ['native', swigModule, 'Swig'],
  ['twig', twigModule, 'Twig'],
  ['jinja2', jinja2Module, 'Jinja2']
];

var sub = '{% set leaked = "S" %}{% macro greet() %}G{% endmacro %}';

flavors.forEach(function (flavor) {
  var name = flavor[0],
    lib = flavor[1],
    Ctor = lib[flavor[2]];

  // An async loader over in-memory templates; each load completes on a later turn.
  function asyncLoader(files, delays) {
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
        }, (delays && delays[id]) || 0);
      }
    };
  }

  function renderAsync(s, path, locals) {
    return new Promise(function (resolve, reject) {
      s.renderFile(path, locals, function (err, out) {
        if (err) {
          reject(err);
          return;
        }
        resolve(out);
      });
    });
  }

  function render(files, locals) {
    return renderAsync(new Ctor({ loader: asyncLoader(files), cache: false }), '/t.html', locals);
  }

  function renderSync(files, locals) {
    return new Ctor({ loader: lib.loaders.memory(files, '/'), cache: false }).renderFile('/t.html', locals);
  }

  describe(name + ' — an import on the async render path', function () {
    it('keeps the imported template\'s macros out of the importer', function () {
      var files = { '/sub.html': sub, '/t.html': '{% import "sub.html" as sub %}{{ sub.greet() }}|greet=[{% if greet %}fn{% endif %}]' };
      return render(files, {}).then(function (out) {
        expect(out).to.equal('G|greet=[]');
        expect(renderSync(files, {})).to.equal(out);
      });
    });

    it('keeps the imported template\'s top-level set out of the importer', function () {
      var files = { '/sub.html': sub, '/t.html': '{% import "sub.html" as sub %}{{ sub.greet() }}|leaked=[{{ leaked }}]' };
      return render(files, {}).then(function (out) {
        expect(out).to.equal('G|leaked=[]');
        expect(renderSync(files, {})).to.equal(out);
      });
    });

    it('keeps the importer\'s own variable named like an imported macro', function () {
      var files = { '/sub.html': sub, '/t.html': '{% set greet = "mine" %}{% import "sub.html" as sub %}{{ sub.greet() }}|greet=[{{ greet }}]' };
      return render(files, {}).then(function (out) {
        expect(out).to.equal('G|greet=[mine]');
      });
    });

    it('keeps the aliases of the imported template\'s own imports out of the importer, three files deep', function () {
      var files = {
        '/c.html': '{% macro z() %}Z{% endmacro %}',
        '/b.html': '{% import "c.html" as c %}{% macro y() %}y{{ c.z() }}{% endmacro %}',
        '/sub.html': '{% import "b.html" as b %}{% macro m() %}m{{ b.y() }}{% endmacro %}',
        '/t.html': '{% import "sub.html" as s %}{{ s.m() }}|b=[{{ b }}]|c=[{{ c }}]'
      };
      return render(files, {}).then(function (out) {
        expect(out).to.equal('myZ|b=[]|c=[]');
        expect(renderSync(files, {})).to.equal(out);
      });
    });

    it('keeps a name set by a template the imported template includes out of the importer, and shows it to the imported macros', function () {
      var files = {
        '/inc.html': '{% set v = "V" %}',
        '/sub.html': '{% include "inc.html" %}{% macro m() %}({{ v }}){% endmacro %}',
        '/t.html': '{% import "sub.html" as s %}{{ s.m() }}[{{ v }}]'
      };
      return render(files, {}).then(function (out) {
        expect(out).to.equal('(V)[]');
      });
    });

    it('lets an imported macro read a variable the importer sets after the import', function () {
      var files = { '/sub.html': '{% macro show() %}[{{ late }}]{% endmacro %}', '/t.html': '{% import "sub.html" as sub %}{% set late = "L" %}{{ sub.show() }}' };
      return render(files, {}).then(function (out) {
        expect(out).to.equal('[L]');
      });
    });

    it('lets an imported macro read the importer\'s loop names when the imported template has a top-level loop', function () {
      var files = {
        '/sub.html': '{% for item in seed %}{% endfor %}{% macro show() %}[{{ item }}|{{ loop.index }}]{% endmacro %}',
        '/t.html': '{% import "sub.html" as s %}{% for item in xs %}{{ s.show() }}{% endfor %}'
      };
      return render(files, { xs: ['a', 'b'], seed: [1] }).then(function (out) {
        expect(out).to.equal('[a|1][b|2]');
        expect(renderSync(files, { xs: ['a', 'b'], seed: [1] })).to.equal(out);
      });
    });

    it('lets an imported macro read the importer\'s loop names when the importer had that name before the import', function () {
      var files = {
        '/sub.html': '{% for item in seed %}{% endfor %}{% macro show() %}[{{ item }}|{{ loop.index }}]{% endmacro %}',
        '/t.html': '{% set item = "z" %}{% import "sub.html" as s %}{% for item in xs %}{{ s.show() }}{% endfor %}'
      };
      return render(files, { xs: ['a', 'b'], seed: [1] }).then(function (out) {
        expect(out).to.equal('[a|1][b|2]');
      });
    });

    it('keeps the importer\'s value of a name an imported macro takes as a parameter', function () {
      var files = { '/sub.html': '{% macro m(a) %}[{{ a }}]{% endmacro %}', '/t.html': '{% set a = "CALLER" %}{% import "sub.html" as s %}{{ s.m("P") }}{{ a }}' };
      return render(files, {}).then(function (out) {
        expect(out).to.equal('[P]CALLER');
      });
    });

    it('lets an imported macro called twice use its template\'s own import each time', function () {
      var files = {
        '/icons.html': '{% macro x() %}H{% endmacro %}',
        '/sub.html': '{% import "icons.html" as icons %}{% macro m(a) %}{{ icons.x() }}{{ a }}{% endmacro %}',
        '/t.html': '{% import "sub.html" as s %}{{ s.m(1) }}{{ s.m(2) }}'
      };
      return render(files, {}).then(function (out) {
        expect(out).to.equal('H1H2');
      });
    });

    it('still renders null-prototype locals with an import', function () {
      var locals = Object.create(null), files = { '/sub.html': sub, '/t.html': '{% import "sub.html" as sub %}[{{ v }}]' };
      locals.v = 'x';
      return render(files, locals).then(function (out) {
        expect(out).to.equal('[x]');
      });
    });

    it('renders an import with frozen locals', function () {
      var files = { '/sub.html': sub, '/t.html': '{% import "sub.html" as s %}[{{ s.greet() }}]' };
      return render(files, Object.freeze({ a: 1 })).then(function (out) {
        expect(out).to.equal('[G]');
      });
    });

    if (name !== 'native') {
      it('keeps the imported template\'s top-level set out of the importer through a from-import', function () {
        var files = { '/sub.html': sub, '/t.html': '{% from "sub.html" import greet %}{{ greet() }}|leaked=[{{ leaked }}]' };
        return render(files, {}).then(function (out) {
          expect(out).to.equal('G|leaked=[]');
          expect(renderSync(files, {})).to.equal(out);
        });
      });
    }

    it('keeps two concurrent renders given one locals object apart while one of them imports', function () {
      var files = {
          '/icons.html': '{% macro x() %}H{% endmacro %}',
          '/m.html': '{% import "icons.html" as icons %}{% macro hi() %}{{ icons.x() }}{% endmacro %}',
          '/a.html': '{% import "m.html" as m %}[{{ m.hi() }}]',
          '/b.html': '{% set y = 1 %}{% include "slow.html" %}<{{ y }}>',
          '/slow.html': 's'
        },
        s = new Ctor({ loader: asyncLoader(files, { '/m.html': 20, '/icons.html': 20, '/slow.html': 60 }), cache: false }),
        shared = {};
      return Promise.all([renderAsync(s, '/a.html', shared), renderAsync(s, '/b.html', shared)]).then(function (outs) {
        expect(outs[0]).to.equal('[H]');
        expect(outs[1]).to.equal('s<1>');
        expect(Object.keys(shared)).to.eql([]);
      });
    });
  });
});
