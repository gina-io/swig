var expect = require('expect.js'),
  twigModule = require('../../../packages/swig-twig');

function makeAsyncLoader(templates) {
  return {
    resolve: function (to) {
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

describe('twig.renderFileAsync', function () {
  it('renders a single template with locals', function (done) {
    var twig = new twigModule.Twig({
      loader: makeAsyncLoader({
        '/hello.twig': 'Hello, {{ name }}!'
      })
    });
    twig.renderFileAsync('hello.twig', { name: 'world' }, function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('Hello, world!');
      done();
    });
  });

  it('accepts (path, cb) without locals', function (done) {
    var twig = new twigModule.Twig({
      loader: makeAsyncLoader({ '/static.twig': 'static content' })
    });
    twig.renderFileAsync('static.twig', function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('static content');
      done();
    });
  });

  it('renders an extends chain', function (done) {
    var twig = new twigModule.Twig({
      loader: makeAsyncLoader({
        '/page.twig': '{% extends "layout.twig" %}{% block body %}Page body{% endblock %}',
        '/layout.twig': '<doc>{% block body %}{% endblock %}</doc>'
      })
    });
    twig.renderFileAsync('page.twig', {}, function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('<doc>Page body</doc>');
      done();
    });
  });

  it('renders with a static include', function (done) {
    var twig = new twigModule.Twig({
      loader: makeAsyncLoader({
        '/entry.twig': 'before {% include "partial.twig" %} after',
        '/partial.twig': 'partial-content'
      })
    });
    twig.renderFileAsync('entry.twig', {}, function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('before partial-content after');
      done();
    });
  });

  it('renders with from-import (Twig-specific)', function (done) {
    var twig = new twigModule.Twig({
      loader: makeAsyncLoader({
        '/entry.twig': '{% from "macros.twig" import greet %}{{ greet("world") }}',
        '/macros.twig': '{% macro greet(name) %}Hello, {{ name }}!{% endmacro %}'
      })
    });
    twig.renderFileAsync('entry.twig', {}, function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('Hello, world!');
      done();
    });
  });

  it('renders with namespaced import', function (done) {
    var twig = new twigModule.Twig({
      loader: makeAsyncLoader({
        '/entry.twig': '{% import "macros.twig" as m %}{{ m.greet("there") }}',
        '/macros.twig': '{% macro greet(name) %}Hi, {{ name }}!{% endmacro %}'
      })
    });
    twig.renderFileAsync('entry.twig', {}, function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('Hi, there!');
      done();
    });
  });

  it('reports loader errors via the callback', function (done) {
    var twig = new twigModule.Twig({
      loader: makeAsyncLoader({
        '/entry.twig': '{% include "missing.twig" %}'
      })
    });
    twig.renderFileAsync('entry.twig', {}, function (err) {
      expect(err).to.be.an(Error);
      expect(err.message).to.contain('Template not found: /missing.twig');
      done();
    });
  });

  it('restores the original loader after a successful render', function (done) {
    var loader = makeAsyncLoader({ '/x.twig': 'ok' });
    var twig = new twigModule.Twig({ loader: loader });
    twig.renderFileAsync('x.twig', {}, function (err) {
      expect(err).to.be(null);
      expect(twig.options.loader).to.be(loader);
      done();
    });
  });

  it('runs concurrent calls without trampling each other', function (done) {
    var twig = new twigModule.Twig({
      cache: false,
      loader: makeAsyncLoader({
        '/a.twig': '{% extends "layout-a.twig" %}{% block body %}A{% endblock %}',
        '/b.twig': '{% extends "layout-b.twig" %}{% block body %}B{% endblock %}',
        '/layout-a.twig': '<a>{% block body %}{% endblock %}</a>',
        '/layout-b.twig': '<b>{% block body %}{% endblock %}</b>'
      })
    });
    var aDone = false, bDone = false;
    function maybeFinish() { if (aDone && bDone) { done(); } }
    twig.renderFileAsync('a.twig', {}, function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('<a>A</a>');
      aDone = true;
      maybeFinish();
    });
    twig.renderFileAsync('b.twig', {}, function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('<b>B</b>');
      bDone = true;
      maybeFinish();
    });
  });
});

describe('twig.compileFileAsync', function () {
  it('returns a callable compiled function', function (done) {
    var twig = new twigModule.Twig({
      loader: makeAsyncLoader({
        '/hello.twig': 'Hello, {{ name }}!'
      })
    });
    twig.compileFileAsync('hello.twig', {}, function (err, fn) {
      expect(err).to.be(null);
      expect(fn).to.be.a('function');
      expect(fn({ name: 'world' })).to.equal('Hello, world!');
      done();
    });
  });

  it('runtime includes still resolve via the captured memory map', function (done) {
    var loader = makeAsyncLoader({
      '/entry.twig': 'before {% include "partial.twig" %} after',
      '/partial.twig': 'middle'
    });
    var twig = new twigModule.Twig({ cache: false, loader: loader });
    twig.compileFileAsync('entry.twig', {}, function (err, fn) {
      expect(err).to.be(null);
      expect(twig.options.loader).to.be(loader);
      expect(fn({})).to.equal('before middle after');
      expect(fn({})).to.equal('before middle after');
      done();
    });
  });
});

describe('twig module-level exports', function () {
  it('exposes renderFileAsync and compileFileAsync', function () {
    expect(twigModule.renderFileAsync).to.be.a('function');
    expect(twigModule.compileFileAsync).to.be.a('function');
  });
});
