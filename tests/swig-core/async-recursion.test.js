var swigModule = require('../../lib/swig'),
  twigModule = require('@rhinostone/swig-twig'),
  jinja2Module = require('@rhinostone/swig-jinja2'),
  djangoModule = require('@rhinostone/swig-django'),
  runCapped = require('../lib/run-capped.js'),
  expect = require('../lib/expect.js');

/*!
 * On the async render path a template that includes, imports or extends
 * itself, or an extends cycle, loaded templates until the process ran out of
 * memory. Each top-level async render now counts the templates in progress
 * and fails past 1000 nested templates, and an extends cycle fails at once
 * with the sync path's message. The shapes that never ended without the guard
 * run in a child process whose heap is capped at 64 MB, so a missing guard
 * aborts that child instead of the test run.
 */

var flavors = [
  { name: 'native', lib: swigModule, mod: require.resolve('../../lib/swig'), ctor: 'Swig', imports: true, from: false, ignoreMissing: true },
  { name: 'twig', lib: twigModule, mod: require.resolve('@rhinostone/swig-twig'), ctor: 'Twig', imports: true, from: true, ignoreMissing: true },
  { name: 'jinja2', lib: jinja2Module, mod: require.resolve('@rhinostone/swig-jinja2'), ctor: 'Jinja2', imports: true, from: true, ignoreMissing: true },
  { name: 'django', lib: djangoModule, mod: require.resolve('@rhinostone/swig-django'), ctor: 'Django', imports: false, from: false, ignoreMissing: false }
];

var NESTED = ' is nested more than 1000 levels deep: a template probably includes, imports or extends itself.';

/*!
 * Runs in the child: renders each shape in turn on the async path with a
 * memory loader that counts its loads, and prints one JSON line.
 */
function runShapes(args) {
  var lib = require(args.mod), Ctor = lib[args.ctor], out = {}, i = 0;
  function next() {
    if (i >= args.shapes.length) {
      console.log(JSON.stringify(out));
      return;
    }
    var shape = args.shapes[i], mem = lib.loaders.memory(shape.files, '/'), loads = 0;
    var loader = { async: true, resolve: mem.resolve, load: function (id, cb) {
      loads += 1;
      setImmediate(function () {
        var src;
        try { src = mem.load(id); } catch (e) { cb(e); return; }
        cb(null, src);
      });
    } };
    i += 1;
    new Ctor({ loader: loader, cache: false }).renderFile(shape.entry, shape.locals || {}, function (err, output) {
      out[shape.name] = err ? { error: err.message, loads: loads } : { output: output, loads: loads };
      next();
    });
  }
  next();
}

function shapesFor(flavor) {
  var chain = { '/t9.html': '<{% block b %}E{% endblock %}>', '/t0.html': '{% extends "t1.html" %}{% block b %}x{% include "t0.html" %}{% endblock %}' }, k,
    shapes = [
      { name: 'extendsCycle', entry: '/a.html', files: { '/a.html': '{% extends "b.html" %}{% block b %}A{% endblock %}', '/b.html': '{% extends "a.html" %}{% block b %}B{% endblock %}' } },
      { name: 'dynamicSelfExtends', entry: '/self.html', locals: { layout: 'self.html' }, files: { '/self.html': '{% extends layout %}{% block b %}X{% endblock %}' } },
      { name: 'selfInclude', entry: '/s.html', files: { '/s.html': 'x{% include "s.html" %}' } },
      { name: 'dynamicSelfInclude', entry: '/d.html', locals: { partial: 'd.html' }, files: { '/d.html': 'x{% include partial %}' } },
      { name: 'blockIncludeChain', entry: '/t0.html', files: chain }
    ];
  for (k = 1; k < 9; k += 1) { chain['/t' + k + '.html'] = '{% extends "t' + (k + 1) + '.html" %}'; }
  if (flavor.imports) {
    shapes.push({ name: 'importCycle', entry: '/ia.html', files: { '/ia.html': '{% import "ib.html" as b %}{% macro x() %}A{% endmacro %}A', '/ib.html': '{% import "ia.html" as a %}{% macro y() %}B{% endmacro %}B' } });
  }
  if (flavor.from) {
    shapes.push({ name: 'fromCycle', entry: '/fa.html', files: { '/fa.html': '{% from "fb.html" import y %}{% macro x() %}A{% endmacro %}A', '/fb.html': '{% from "fa.html" import x %}{% macro y() %}B{% endmacro %}B' } });
  }
  if (flavor.ignoreMissing) {
    shapes.push({ name: 'ignoreMissingSelfInclude', entry: '/s.html', files: { '/s.html': 'x{% include "s.html" ignore missing %}' } });
  }
  return shapes;
}

function asyncLoader(lib, files) {
  var mem = lib.loaders.memory(files, '/'), loader;
  loader = { async: true, loads: 0, resolve: mem.resolve, load: function (id, cb) {
    // compileFile loads its template without a callback.
    if (!cb) { return mem.load(id); }
    loader.loads += 1;
    setImmediate(function () {
      var src;
      try { src = mem.load(id); } catch (e) { cb(e); return; }
      cb(null, src);
    });
  } };
  return loader;
}

function render(s, file, locals) {
  return new Promise(function (resolve) {
    s.renderFile(file, locals, function (err, output) { resolve(err ? { error: err.message } : { output: output }); });
  });
}

flavors.forEach(function (flavor) {
  var Ctor = flavor.lib[flavor.ctor],
    node = flavor.name === 'django' ?
      '{% if n > 0 %}<{% with n=n|add:"-1" %}{% include "node.html" %}{% endwith %}>{% endif %}' :
      '{% if n > 0 %}<{% set n = n - 1 %}{% include "node.html" %}>{% endif %}';

  describe(flavor.name + ' — async recursion guard, shapes that never ended', function () {
    var results;

    before(function () {
      var res = runCapped('(' + runShapes.toString() + ')(' + JSON.stringify({ mod: flavor.mod, ctor: flavor.ctor, shapes: shapesFor(flavor) }) + ');'),
        m = /^(\S+) (\S+) ([\s\S]*)$/.exec(res);
      if (!m || m[1] !== 'null' || m[2] !== '0') {
        throw new Error('the child did not finish: ' + res.slice(0, 200));
      }
      results = JSON.parse(m[3]);
    });

    it('stops an extends cycle with the sync path\'s message', function () {
      expect(results.extendsCycle).to.eql({ error: 'Illegal circular extends of "/b.html".', loads: 4 });
    });

    it('stops a dynamic extends that names its own template', function () {
      expect(results.dynamicSelfExtends).to.eql({ error: 'Illegal circular extends of "/self.html".', loads: 3 });
    });

    it('stops a template that includes itself at 1000 nested templates', function () {
      expect(results.selfInclude).to.eql({ error: 'Template "/s.html"' + NESTED, loads: 1001 });
    });

    it('stops an include path from the locals that names its own template', function () {
      expect(results.dynamicSelfInclude).to.eql({ error: 'Template "/d.html"' + NESTED, loads: 1001 });
    });

    it('counts every template in progress, also a block override\'s include from deep in an extends chain', function () {
      expect(results.blockIncludeChain.error).to.match(/^Template "\/t[0-9]\.html" is nested more than 1000 levels deep/);
      expect(results.blockIncludeChain.loads).to.be(1001);
    });

    if (flavor.imports) {
      it('stops an import cycle', function () {
        expect(results.importCycle).to.eql({ error: 'Template "/ib.html"' + NESTED, loads: 1001 });
      });
    }

    if (flavor.from) {
      it('stops a from-import cycle', function () {
        expect(results.fromCycle).to.eql({ error: 'Template "/fb.html"' + NESTED, loads: 1001 });
      });
    }

    if (flavor.ignoreMissing) {
      it('ends a self-include marked ignore missing at the limit, whose error that include swallows', function () {
        expect(results.ignoreMissingSelfInclude).to.eql({ output: new Array(1002).join('x'), loads: 1001 });
      });
    }
  });

  describe(flavor.name + ' — async recursion guard, legitimate nesting', function () {
    it('renders a recursive include 1000 templates deep', function () {
      var loader = asyncLoader(flavor.lib, { '/node.html': node });
      return render(new Ctor({ loader: loader, cache: false }), '/node.html', { n: 1000 }).then(function (r) {
        expect(r.output).to.equal(new Array(1001).join('<') + new Array(1001).join('>'));
        expect(loader.loads).to.be(1001);
      });
    });

    it('fails a recursive include 1001 templates deep', function () {
      var loader = asyncLoader(flavor.lib, { '/node.html': node });
      return render(new Ctor({ loader: loader, cache: false }), '/node.html', { n: 1001 }).then(function (r) {
        expect(r).to.eql({ error: 'Template "/node.html"' + NESTED });
        expect(loader.loads).to.be(1001);
      });
    });

    it('counts nesting, not includes: renders 2000 sibling includes', function () {
      var loader = asyncLoader(flavor.lib, { '/loop.html': '{% for i in items %}{% include "leaf.html" %}{% endfor %}', '/leaf.html': 'y' }),
        items = [], k;
      for (k = 0; k < 2000; k += 1) { items.push(k); }
      return render(new Ctor({ loader: loader, cache: false }), '/loop.html', { items: items }).then(function (r) {
        expect(r.output).to.equal(new Array(2001).join('y'));
      });
    });

    it('gives each render its own count: two renders 600 deep at the same time both render', function () {
      var s = new Ctor({ loader: asyncLoader(flavor.lib, { '/node.html': node }), cache: false }),
        deep = new Array(601).join('<') + new Array(601).join('>');
      return Promise.all([render(s, '/node.html', { n: 600 }), render(s, '/node.html', { n: 600 })]).then(function (rs) {
        expect(rs).to.eql([{ output: deep }, { output: deep }]);
      });
    });

    it('passes a nested template\'s resolve error to the callback', function () {
      var loader = asyncLoader(flavor.lib, { '/page.html': 'a{% include "bad.html" %}b' }),
        resolve = loader.resolve;
      loader.resolve = function (to, from) {
        if (to === 'bad.html') { throw new Error('cannot resolve bad.html'); }
        return resolve(to, from);
      };
      return render(new Ctor({ loader: loader, cache: false }), '/page.html', {}).then(function (r) {
        expect(r).to.eql({ error: 'cannot resolve bad.html' });
      });
    });

    if (flavor.ignoreMissing) {
      it('gives back the count of a nested template that fails: 1001 failed includes, then one more', function () {
        var loader = asyncLoader(flavor.lib, {
            '/loop.html': '{% for i in items %}{% include "fail.html" ignore missing %}{% endfor %}{% include "ok.html" %}',
            '/fail.html': 'f{% include "missing.html" %}',
            '/ok.html': 'OK'
          }),
          items = [], k;
        for (k = 0; k < 1001; k += 1) { items.push(k); }
        return render(new Ctor({ loader: loader, cache: false }), '/loop.html', { items: items }).then(function (r) {
          expect(r).to.eql({ output: 'OK' });
        });
      });
    }

    it('gives each call of an async-compiled template its own count', function () {
      var s = new Ctor({ loader: asyncLoader(flavor.lib, { '/node.html': node }) }),
        fn = s.compileFile('/node.html', { codegenMode: 'async' }),
        deep = new Array(601).join('<') + new Array(601).join('>');
      return Promise.all([fn({ n: 600 }), fn({ n: 600 })]).then(function (rs) {
        expect([rs[0].output, rs[1].output]).to.eql([deep, deep]);
      });
    });
  });
});
