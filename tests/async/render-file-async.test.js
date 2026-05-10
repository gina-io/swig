var expect = require('expect.js'),
  swigModule = require('../../lib/swig');

function makeAsyncLoader(templates) {
  return {
    resolve: function (to, from) {
      if (to.charAt(0) === '/') {
        return to;
      }
      return '/' + to;
    },
    load: function (id, cb) {
      Promise.resolve().then(function () {
        if (templates.hasOwnProperty(id)) {
          cb(null, templates[id]);
        } else {
          cb(new Error('Template not found: ' + id));
        }
      });
    }
  };
}

describe('swig.renderFileAsync', function () {
  it('renders a single template with locals', function (done) {
    var swig = new swigModule.Swig({
      loader: makeAsyncLoader({
        '/hello.html': 'Hello, {{ name }}!'
      })
    });
    swig.renderFileAsync('hello.html', { name: 'world' }, function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('Hello, world!');
      done();
    });
  });

  it('accepts (path, cb) without locals', function (done) {
    var swig = new swigModule.Swig({
      loader: makeAsyncLoader({ '/static.html': 'static content' })
    });
    swig.renderFileAsync('static.html', function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('static content');
      done();
    });
  });

  it('renders an extends chain', function (done) {
    var swig = new swigModule.Swig({
      loader: makeAsyncLoader({
        '/page.html': '{% extends "layout.html" %}{% block body %}Page body{% endblock %}',
        '/layout.html': '<doc>{% block body %}{% endblock %}</doc>'
      })
    });
    swig.renderFileAsync('page.html', {}, function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('<doc>Page body</doc>');
      done();
    });
  });

  it('renders a three-level extends chain', function (done) {
    var swig = new swigModule.Swig({
      loader: makeAsyncLoader({
        '/page.html': '{% extends "section.html" %}{% block body %}page{% endblock %}',
        '/section.html': '{% extends "layout.html" %}',
        '/layout.html': '<l>{% block body %}layout-default{% endblock %}</l>'
      })
    });
    swig.renderFileAsync('page.html', {}, function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('<l>page</l>');
      done();
    });
  });

  it('renders with a static include', function (done) {
    var swig = new swigModule.Swig({
      loader: makeAsyncLoader({
        '/entry.html': 'before {% include "partial.html" %} after',
        '/partial.html': 'partial-content'
      })
    });
    swig.renderFileAsync('entry.html', {}, function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('before partial-content after');
      done();
    });
  });

  it('renders with macro import', function (done) {
    var swig = new swigModule.Swig({
      loader: makeAsyncLoader({
        '/entry.html': '{% import "macros.html" as m %}{{ m.greet("world") }}',
        '/macros.html': '{% macro greet(name) %}Hello, {{ name }}!{% endmacro %}'
      })
    });
    swig.renderFileAsync('entry.html', {}, function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('Hello, world!');
      done();
    });
  });

  it('renders a mixed graph (extends + include + import)', function (done) {
    var swig = new swigModule.Swig({
      cache: false,
      loader: makeAsyncLoader({
        '/page.html': [
          '{% extends "layout.html" %}',
          '{% import "macros.html" as m %}',
          '{% block body %}',
          '{{ m.greet("page") }}',
          '{% include "partial.html" %}',
          '{% endblock %}'
        ].join('\n'),
        '/layout.html': '<l>{% block body %}{% endblock %}</l>',
        '/macros.html': '{% macro greet(name) %}Hi, {{ name }}!{% endmacro %}',
        '/partial.html': 'partial-text'
      })
    });
    swig.renderFileAsync('page.html', {}, function (err, out) {
      expect(err).to.be(null);
      expect(out).to.contain('Hi, page!');
      expect(out).to.contain('partial-text');
      expect(out).to.match(/^<l>/);
      expect(out).to.match(/<\/l>$/);
      done();
    });
  });

  it('reports loader errors via the callback', function (done) {
    var swig = new swigModule.Swig({
      loader: makeAsyncLoader({
        '/entry.html': '{% include "missing.html" %}'
      })
    });
    swig.renderFileAsync('entry.html', {}, function (err, out) {
      expect(err).to.be.an(Error);
      expect(err.message).to.contain('Template not found: /missing.html');
      expect(out).to.be(undefined);
      done();
    });
  });

  it('reports a missing entry template via the callback', function (done) {
    var swig = new swigModule.Swig({
      loader: makeAsyncLoader({})
    });
    swig.renderFileAsync('never.html', {}, function (err) {
      expect(err).to.be.an(Error);
      expect(err.message).to.contain('Template not found: /never.html');
      done();
    });
  });

  it('restores the original loader after a successful render', function (done) {
    var loader = makeAsyncLoader({ '/x.html': 'ok' });
    var swig = new swigModule.Swig({ loader: loader });
    swig.renderFileAsync('x.html', {}, function (err) {
      expect(err).to.be(null);
      expect(swig.options.loader).to.be(loader);
      done();
    });
  });

  it('restores the original loader after a render error', function (done) {
    var loader = makeAsyncLoader({
      '/entry.html': '{% extends "missing.html" %}'
    });
    var swig = new swigModule.Swig({ loader: loader });
    swig.renderFileAsync('entry.html', {}, function (err) {
      expect(err).to.be.an(Error);
      expect(swig.options.loader).to.be(loader);
      done();
    });
  });

  it('runs concurrent calls without trampling each other', function (done) {
    var swig = new swigModule.Swig({
      cache: false,
      loader: makeAsyncLoader({
        '/a.html': '{% extends "layout-a.html" %}{% block body %}A{% endblock %}',
        '/b.html': '{% extends "layout-b.html" %}{% block body %}B{% endblock %}',
        '/layout-a.html': '<a>{% block body %}{% endblock %}</a>',
        '/layout-b.html': '<b>{% block body %}{% endblock %}</b>'
      })
    });
    var aDone = false, bDone = false;
    function maybeFinish() { if (aDone && bDone) { done(); } }
    swig.renderFileAsync('a.html', {}, function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('<a>A</a>');
      aDone = true;
      maybeFinish();
    });
    swig.renderFileAsync('b.html', {}, function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('<b>B</b>');
      bDone = true;
      maybeFinish();
    });
  });

  it('throws a clear error for runtime dynamic includes (path not in memMap)', function (done) {
    var swig = new swigModule.Swig({
      cache: false,
      loader: makeAsyncLoader({
        '/entry.html': '{% include partial_var %}',
        '/static.html': 'static'
      })
    });
    swig.renderFileAsync('entry.html', { partial_var: 'static.html' }, function (err) {
      expect(err).to.be.an(Error);
      expect(err.message).to.contain('Pre-walked map missing path');
      done();
    });
  });
});

describe('swig.compileFileAsync', function () {
  it('returns a callable compiled function', function (done) {
    var swig = new swigModule.Swig({
      loader: makeAsyncLoader({
        '/hello.html': 'Hello, {{ name }}!'
      })
    });
    swig.compileFileAsync('hello.html', {}, function (err, fn) {
      expect(err).to.be(null);
      expect(fn).to.be.a('function');
      expect(fn({ name: 'world' })).to.equal('Hello, world!');
      done();
    });
  });

  it('accepts (path, cb) without options', function (done) {
    var swig = new swigModule.Swig({
      loader: makeAsyncLoader({ '/x.html': 'xyz' })
    });
    swig.compileFileAsync('x.html', function (err, fn) {
      expect(err).to.be(null);
      expect(fn()).to.equal('xyz');
      done();
    });
  });

  it('returned function can be called multiple times with different locals', function (done) {
    var swig = new swigModule.Swig({
      loader: makeAsyncLoader({
        '/greet.html': 'Hi, {{ name }}.'
      })
    });
    swig.compileFileAsync('greet.html', {}, function (err, fn) {
      expect(err).to.be(null);
      expect(fn({ name: 'first' })).to.equal('Hi, first.');
      expect(fn({ name: 'second' })).to.equal('Hi, second.');
      expect(fn({ name: 'third' })).to.equal('Hi, third.');
      done();
    });
  });

  it('runtime includes still resolve via the captured memory map', function (done) {
    var loader = makeAsyncLoader({
      '/entry.html': 'before {% include "partial.html" %} after',
      '/partial.html': 'middle'
    });
    var swig = new swigModule.Swig({ cache: false, loader: loader });
    swig.compileFileAsync('entry.html', {}, function (err, fn) {
      expect(err).to.be(null);
      // Even though the loader was restored to async, the wrapped fn
      // re-installs the memory wrapper for the duration of each call.
      expect(swig.options.loader).to.be(loader);
      expect(fn({})).to.equal('before middle after');
      // Second call still works (memMap captured in closure).
      expect(fn({})).to.equal('before middle after');
      done();
    });
  });

  it('reports compile errors via the callback', function (done) {
    var swig = new swigModule.Swig({
      loader: makeAsyncLoader({
        '/bad.html': '{% endif %}'
      })
    });
    swig.compileFileAsync('bad.html', {}, function (err, fn) {
      expect(err).to.be.an(Error);
      expect(fn).to.be(undefined);
      done();
    });
  });
});

describe('module-level exports', function () {
  it('exposes renderFileAsync and compileFileAsync', function () {
    expect(swigModule.renderFileAsync).to.be.a('function');
    expect(swigModule.compileFileAsync).to.be.a('function');
  });
});
