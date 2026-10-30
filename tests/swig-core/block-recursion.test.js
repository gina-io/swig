var swigModule = require('../../lib/swig'),
  twigModule = require('@rhinostone/swig-twig'),
  jinja2Module = require('@rhinostone/swig-jinja2'),
  djangoModule = require('@rhinostone/swig-django'),
  runCapped = require('../lib/run-capped.js'),
  expect = require('../lib/expect.js');

/*!
 * On the async render path a block can render itself: a nested block of an
 * extending template is a definition of its name, and its {% parent %}, or the
 * block it nests, can lead back to it. The render may yield between two levels,
 * so the stack need not overflow, and without a bound the render runs until the
 * process is out of memory. The shapes run in a child process whose heap is
 * capped at 64 MB, so a missing guard aborts that child instead of the test run.
 */

var flavors = [
  { name: 'native', lib: swigModule, mod: require.resolve('../../lib/swig'), ctor: 'Swig', parent: true },
  { name: 'twig', lib: twigModule, mod: require.resolve('@rhinostone/swig-twig'), ctor: 'Twig', parent: false },
  { name: 'jinja2', lib: jinja2Module, mod: require.resolve('@rhinostone/swig-jinja2'), ctor: 'Jinja2', parent: false },
  { name: 'django', lib: djangoModule, mod: require.resolve('@rhinostone/swig-django'), ctor: 'Django', parent: false }
];

var EXT = '{% extends "base.html" %}',
  DEEP = 'Block "a" is nested more than 200 levels deep: a block probably renders itself through a nested block or {% parent %}.',
  shapes = [
    { name: 'two top-level blocks of a child nest each other', parent: false, files: {
      '/base.html': '<{% block a %}P{% endblock %}>',
      '/t.html': EXT + '{% block a %}{% block b %}{% endblock %}{% endblock %}{% block b %}{% block a %}{% endblock %}{% endblock %}'
    } },
    { name: 'as above, with a yield in each level', parent: false, files: {
      '/i.html': 'I',
      '/base.html': '<{% block a %}P{% endblock %}>',
      '/t.html': EXT + '{% block a %}{% include "i.html" %}{% block b %}{% endblock %}{% endblock %}{% block b %}{% block a %}{% endblock %}{% endblock %}'
    } },
    { name: 'a block renders itself through parent', parent: true, files: {
      '/base.html': '<{% block a %}A{% block b %}B{% endblock %}{% endblock %}>',
      '/t.html': EXT + '{% block b %}{% block a %}X{% parent %}{% endblock %}{% endblock %}'
    } },
    { name: 'as above, with an include in the cycle', parent: true, files: {
      '/i.html': 'I',
      '/base.html': '<{% block a %}A{% include "i.html" %}{% block b %}B{% endblock %}{% endblock %}>',
      '/t.html': EXT + '{% block b %}{% block a %}X{% parent %}{% endblock %}{% endblock %}'
    } }
  ];

/*!
 * Runs in the child: renders each shape in turn on the async path and prints
 * one JSON line.
 */
function runShapes(args) {
  var lib = require(args.mod), Ctor = lib[args.ctor], out = {}, i = 0;
  function next() {
    if (i >= args.shapes.length) {
      console.log(JSON.stringify(out));
      return;
    }
    var shape = args.shapes[i], mem = lib.loaders.memory(shape.files, '/');
    var loader = { async: true, resolve: mem.resolve, load: function (id, cb) {
      setImmediate(function () {
        var src;
        try { src = mem.load(id); } catch (e) { cb(e); return; }
        cb(null, src);
      });
    } };
    i += 1;
    new Ctor({ loader: loader, cache: false }).renderFile('/t.html', {}, function (err, output) {
      out[shape.name] = err ? { error: err.message } : { output: output };
      next();
    });
  }
  next();
}

flavors.forEach(function (flavor) {
  var list = shapes.filter(function (s) { return flavor.parent || !s.parent; });

  describe('a block that renders itself, async render path (' + flavor.name + ')', function () {
    var result, parsed;

    before(function () {
      result = runCapped('(' + runShapes.toString() + ')(' + JSON.stringify({ mod: flavor.mod, ctor: flavor.ctor, shapes: list }) + ')');
      parsed = JSON.parse(result.slice(result.indexOf('{')));
    });

    it('ends in the capped process', function () {
      expect(result.indexOf('null 0 ')).to.equal(0);
    });

    list.forEach(function (s) {
      it('fails with the nesting error: ' + s.name, function () {
        expect(parsed[s.name].error).to.equal(DEEP);
      });
    });
  });
});

describe('the block nesting count of an async render', function () {
  it('does not grow with the items of a loop', function (done) {
    var xs = [], mem, loader, i;
    for (i = 0; i < 500; i += 1) {
      xs.push(i);
    }
    mem = swigModule.loaders.memory({
      '/base.html': '{% for x in xs %}{% block row %}.{% endblock %}{% endfor %}',
      '/t.html': EXT + '{% block row %}{% parent %}{% endblock %}'
    }, '/');
    loader = { async: true, resolve: mem.resolve, load: function (id, cb) {
      setImmediate(function () { cb(null, mem.load(id)); });
    } };
    new swigModule.Swig({ loader: loader, cache: false }).renderFile('/t.html', { xs: xs }, function (err, out) {
      if (err) {
        done(err);
        return;
      }
      expect(out.length).to.equal(500);
      done();
    });
  });
});
