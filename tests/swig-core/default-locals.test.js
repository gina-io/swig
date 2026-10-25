var swigModule = require('../../lib/swig'),
  runtimeModule = require('../../lib/runtime'),
  twigModule = require('@rhinostone/swig-twig'),
  jinja2Module = require('@rhinostone/swig-jinja2'),
  djangoModule = require('@rhinostone/swig-django'),
  expect = require('../lib/expect.js');

/*!
 * A render without call-time locals ran with the instance's default locals
 * object itself as its context, so what the template wrote ({% set %}, loop
 * names, Django cycle state) stayed in the defaults and reached every later
 * render on that instance. run() without locals did the same, and instances
 * built without their own locals share one module-level defaults object, so
 * one instance's run reached another instance. A render now works on a copy.
 */

var flavors = [
  ['native', swigModule, 'Swig'],
  ['twig', twigModule, 'Twig'],
  ['jinja2', jinja2Module, 'Jinja2'],
  ['django', djangoModule, 'Django']
];

var writers = {
  native: '{% set name = "alice" %}{% for x in items %}{% endfor %}{{ site }}{{ name }}',
  twig: '{% set name = "alice" %}{% for x in items %}{% endfor %}{{ site }}{{ name }}',
  jinja2: '{% set name = "alice" %}{% for x in items %}{% endfor %}{{ site }}{{ name }}',
  django: '{% for x in items %}{% cycle "a" "b" %}{% endfor %}{{ site }}'
};

// Templates that write to their context without reading any locals.
var standalone = {
  native: '{% set name = "alice" %}{{ name }}',
  twig: '{% set name = "alice" %}{{ name }}',
  jinja2: '{% set name = "alice" %}{{ name }}',
  django: '{% for x in "ab" %}{% cycle "a" "b" %}{% endfor %}'
};

flavors.forEach(function (flavor) {
  var name = flavor[0],
    lib = flavor[1],
    Ctor = lib[flavor[2]],
    files = {
      '/w.html': writers[name],
      '/r.html': '<{{ site }}:{{ name }}>',
      '/c.html': '{% for x in items %}{% cycle "a" "b" "c" %}{% endfor %}'
    };

  function instance(opts) {
    var o = { loader: lib.loaders.memory(files, '/') }, k;
    for (k in (opts || {})) {
      o[k] = opts[k];
    }
    return new Ctor(o);
  }

  function asyncLoader() {
    var mem = lib.loaders.memory(files, '/');
    return {
      async: true,
      resolve: mem.resolve,
      load: function (id, cb) {
        if (!cb) {
          return mem.load(id);
        }
        setImmediate(function () {
          var src;
          try {
            src = mem.load(id);
          } catch (e) {
            cb(e);
            return;
          }
          cb(null, src);
        });
      }
    };
  }

  describe(name + ' — default locals and renders without locals', function () {
    it('leaves the default locals unchanged after a render without locals', function () {
      var s = instance({ locals: { site: 'S', items: [1, 2] } });
      s.renderFile('/w.html');
      expect(Object.keys(s.options.locals)).to.eql(['site', 'items']);
    });

    if (name !== 'django') {
      it('keeps a variable set by one render out of a later render', function () {
        var s = instance({ locals: { site: 'S', items: [1, 2] } });
        expect(s.renderFile('/w.html')).to.equal('Salice');
        expect(s.renderFile('/r.html')).to.equal('<S:>');
        expect(s.renderFile('/r.html', {})).to.equal('<S:>');
      });
    }

    if (name === 'django') {
      it('starts the cycle tag afresh on each render without locals', function () {
        var s = instance({ locals: { items: [1, 2] } });
        expect([s.renderFile('/c.html'), s.renderFile('/c.html'), s.renderFile('/c.html')]).to.eql(['ab', 'ab', 'ab']);
      });
    }

    it('leaves the default locals unchanged after a registered template renders without locals', function () {
      var s = instance({ locals: { site: 'S', items: [1, 2] } });
      s.register('/reg.html', s.precompile(writers[name]).tpl);
      s.renderFile('/reg.html');
      expect(Object.keys(s.options.locals)).to.eql(['site', 'items']);
    });

    it('leaves the default locals unchanged after run without locals', function () {
      var s = instance({ locals: { site: 'S', items: [1, 2] } });
      s.run(s.precompile(writers[name]).tpl);
      expect(Object.keys(s.options.locals)).to.eql(['site', 'items']);
    });

    it('keeps run without locals on one instance out of another instance', function () {
      var a = instance(),
        b = instance(),
        shared = a.options.locals,
        before = Object.keys(shared),
        out;
      try {
        a.run(a.precompile(standalone[name]).tpl);
        out = b.render('[{{ name }}{{ x }}]');
        expect(Object.keys(shared)).to.eql(before);
        expect(out).to.equal('[]');
      } finally {
        Object.keys(shared).forEach(function (k) {
          if (before.indexOf(k) === -1) {
            delete shared[k];
          }
        });
      }
    });

    it('still renders null-prototype default locals without call locals', function () {
      var defaults = Object.create(null), s;
      defaults.site = 'S';
      s = instance({ locals: defaults });
      expect(s.renderFile('/r.html')).to.equal('<S:>');
      expect(s.run(s.precompile('<{{ site }}>').tpl)).to.equal('<S>');
      expect(Object.keys(s.options.locals)).to.eql(['site']);
    });

    it('leaves the default locals unchanged after an async render without locals', function (done) {
      var s = instance({ loader: asyncLoader(), locals: { site: 'S', items: [1, 2] } });
      s.renderFile('/w.html', undefined, function (err) {
        if (err) {
          done(err);
          return;
        }
        try {
          expect(Object.keys(s.options.locals)).to.eql(['site', 'items']);
        } catch (e) {
          done(e);
          return;
        }
        done();
      });
    });
  });
});

describe('runtime — default locals and renders without locals', function () {
  var src = '{% set name = "alice" %}{% for x in items %}{% endfor %}{{ site }}{{ name }}';

  it('leaves the default locals unchanged after a registered template renders without locals', function () {
    var rt = new runtimeModule.Swig({ locals: { site: 'S', items: [1, 2] } });
    rt.register('/reg.html', swigModule.precompile(src).tpl);
    expect(rt.renderFile('/reg.html')).to.equal('Salice');
    expect(Object.keys(rt.options.locals)).to.eql(['site', 'items']);
  });

  it('still renders null-prototype default locals without call locals', function () {
    var defaults = Object.create(null), rt;
    defaults.site = 'S';
    rt = new runtimeModule.Swig({ locals: defaults });
    rt.register('/reg.html', swigModule.precompile('<{{ site }}>').tpl);
    expect(rt.renderFile('/reg.html')).to.equal('<S>');
    expect(rt.run(swigModule.precompile('<{{ site }}>').tpl)).to.equal('<S>');
  });

  it('leaves the default locals unchanged after run without locals', function () {
    var rt = new runtimeModule.Swig({ locals: { site: 'S', items: [1, 2] } });
    expect(rt.run(swigModule.precompile(src).tpl)).to.equal('Salice');
    expect(Object.keys(rt.options.locals)).to.eql(['site', 'items']);
  });
});
