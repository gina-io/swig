var expect = require('../../lib/expect.js'),
  jinja2Module = require('../../../packages/swig-jinja2');

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

describe('jinja2.renderFileAsync', function () {
  it('renders a single template with locals', function (done) {
    var jinja2 = new jinja2Module.Jinja2({
      loader: makeAsyncLoader({ '/hello.html': 'Hello, {{ name }}!' })
    });
    jinja2.renderFileAsync('hello.html', { name: 'world' }, function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('Hello, world!');
      done();
    });
  });

  it('accepts (path, cb) without locals', function (done) {
    var jinja2 = new jinja2Module.Jinja2({
      loader: makeAsyncLoader({ '/static.html': 'static content' })
    });
    jinja2.renderFileAsync('static.html', function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('static content');
      done();
    });
  });

  it('renders an extends chain', function (done) {
    var jinja2 = new jinja2Module.Jinja2({
      loader: makeAsyncLoader({
        '/page.html': '{% extends "layout.html" %}{% block body %}Page body{% endblock %}',
        '/layout.html': '<doc>{% block body %}{% endblock %}</doc>'
      })
    });
    jinja2.renderFileAsync('page.html', {}, function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('<doc>Page body</doc>');
      done();
    });
  });

  it('renders with a static include', function (done) {
    var jinja2 = new jinja2Module.Jinja2({
      loader: makeAsyncLoader({
        '/entry.html': 'before {% include "partial.html" %} after',
        '/partial.html': 'partial-content'
      })
    });
    jinja2.renderFileAsync('entry.html', {}, function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('before partial-content after');
      done();
    });
  });

  it('renders with from-import', function (done) {
    var jinja2 = new jinja2Module.Jinja2({
      loader: makeAsyncLoader({
        '/entry.html': '{% from "macros.html" import greet %}{{ greet("world") }}',
        '/macros.html': '{% macro greet(name) %}Hello, {{ name }}!{% endmacro %}'
      })
    });
    jinja2.renderFileAsync('entry.html', {}, function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('Hello, world!');
      done();
    });
  });

  it('renders with namespaced import', function (done) {
    var jinja2 = new jinja2Module.Jinja2({
      loader: makeAsyncLoader({
        '/entry.html': '{% import "macros.html" as m %}{{ m.greet("there") }}',
        '/macros.html': '{% macro greet(name) %}Hi, {{ name }}!{% endmacro %}'
      })
    });
    jinja2.renderFileAsync('entry.html', {}, function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('Hi, there!');
      done();
    });
  });

  it('reports loader errors via the callback', function (done) {
    var jinja2 = new jinja2Module.Jinja2({
      loader: makeAsyncLoader({ '/entry.html': '{% include "missing.html" %}' })
    });
    jinja2.renderFileAsync('entry.html', {}, function (err) {
      expect(err).to.be.an(Error);
      expect(err.message).to.contain('Template not found: /missing.html');
      done();
    });
  });

  it('restores the original loader after a successful render', function (done) {
    var loader = makeAsyncLoader({ '/x.html': 'ok' });
    var jinja2 = new jinja2Module.Jinja2({ loader: loader });
    jinja2.renderFileAsync('x.html', {}, function (err) {
      expect(err).to.be(null);
      expect(jinja2.options.loader).to.be(loader);
      done();
    });
  });

  it('runs concurrent calls without trampling each other', function (done) {
    var jinja2 = new jinja2Module.Jinja2({
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
    jinja2.renderFileAsync('a.html', {}, function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('<a>A</a>');
      aDone = true;
      maybeFinish();
    });
    jinja2.renderFileAsync('b.html', {}, function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('<b>B</b>');
      bDone = true;
      maybeFinish();
    });
  });
});

describe('jinja2.compileFileAsync', function () {
  it('returns a callable compiled function', function (done) {
    var jinja2 = new jinja2Module.Jinja2({
      loader: makeAsyncLoader({ '/hello.html': 'Hello, {{ name }}!' })
    });
    jinja2.compileFileAsync('hello.html', {}, function (err, fn) {
      expect(err).to.be(null);
      expect(fn).to.be.a('function');
      expect(fn({ name: 'world' })).to.equal('Hello, world!');
      done();
    });
  });

  it('runtime includes still resolve via the captured memory map', function (done) {
    var loader = makeAsyncLoader({
      '/entry.html': 'before {% include "partial.html" %} after',
      '/partial.html': 'middle'
    });
    var jinja2 = new jinja2Module.Jinja2({ cache: false, loader: loader });
    jinja2.compileFileAsync('entry.html', {}, function (err, fn) {
      expect(err).to.be(null);
      expect(jinja2.options.loader).to.be(loader);
      expect(fn({})).to.equal('before middle after');
      expect(fn({})).to.equal('before middle after');
      done();
    });
  });
});

describe('jinja2 module-level exports', function () {
  it('exposes renderFileAsync and compileFileAsync', function () {
    expect(jinja2Module.renderFileAsync).to.be.a('function');
    expect(jinja2Module.compileFileAsync).to.be.a('function');
  });
});
