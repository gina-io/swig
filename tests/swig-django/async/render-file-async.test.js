var expect = require('../../lib/expect.js'),
  djangoModule = require('../../../packages/swig-django');

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

describe('django.renderFileAsync', function () {
  it('renders a single template with locals', function (done) {
    var django = new djangoModule.Django({
      loader: makeAsyncLoader({ '/hello.html': 'Hello, {{ name }}!' })
    });
    django.renderFileAsync('hello.html', { name: 'world' }, function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('Hello, world!');
      done();
    });
  });

  it('accepts (path, cb) without locals', function (done) {
    var django = new djangoModule.Django({
      loader: makeAsyncLoader({ '/static.html': 'static content' })
    });
    django.renderFileAsync('static.html', function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('static content');
      done();
    });
  });

  it('renders an extends chain', function (done) {
    var django = new djangoModule.Django({
      loader: makeAsyncLoader({
        '/page.html': '{% extends "layout.html" %}{% block body %}Page body{% endblock %}',
        '/layout.html': '<doc>{% block body %}{% endblock %}</doc>'
      })
    });
    django.renderFileAsync('page.html', {}, function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('<doc>Page body</doc>');
      done();
    });
  });

  it('renders with a static include', function (done) {
    var django = new djangoModule.Django({
      loader: makeAsyncLoader({
        '/entry.html': 'before {% include "partial.html" %} after',
        '/partial.html': 'partial-content'
      })
    });
    django.renderFileAsync('entry.html', {}, function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('before partial-content after');
      done();
    });
  });

  it('renders a nested extends + include graph', function (done) {
    var django = new djangoModule.Django({
      loader: makeAsyncLoader({
        '/page.html': '{% extends "layout.html" %}{% block body %}{% include "snippet.html" %}{% endblock %}',
        '/layout.html': '<doc>{% block body %}{% endblock %}</doc>',
        '/snippet.html': 'snip'
      })
    });
    django.renderFileAsync('page.html', {}, function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('<doc>snip</doc>');
      done();
    });
  });

  it('reports loader errors via the callback', function (done) {
    var django = new djangoModule.Django({
      loader: makeAsyncLoader({ '/entry.html': '{% include "missing.html" %}' })
    });
    django.renderFileAsync('entry.html', {}, function (err) {
      expect(err).to.be.an(Error);
      expect(err.message).to.contain('Template not found: /missing.html');
      done();
    });
  });

  it('restores the original loader after a successful render', function (done) {
    var loader = makeAsyncLoader({ '/x.html': 'ok' });
    var django = new djangoModule.Django({ loader: loader });
    django.renderFileAsync('x.html', {}, function (err) {
      expect(err).to.be(null);
      expect(django.options.loader).to.be(loader);
      done();
    });
  });

  it('runs concurrent calls without trampling each other', function (done) {
    var django = new djangoModule.Django({
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
    django.renderFileAsync('a.html', {}, function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('<a>A</a>');
      aDone = true;
      maybeFinish();
    });
    django.renderFileAsync('b.html', {}, function (err, out) {
      expect(err).to.be(null);
      expect(out).to.equal('<b>B</b>');
      bDone = true;
      maybeFinish();
    });
  });
});

describe('django.compileFileAsync', function () {
  it('returns a callable compiled function', function (done) {
    var django = new djangoModule.Django({
      loader: makeAsyncLoader({ '/hello.html': 'Hello, {{ name }}!' })
    });
    django.compileFileAsync('hello.html', {}, function (err, fn) {
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
    var django = new djangoModule.Django({ cache: false, loader: loader });
    django.compileFileAsync('entry.html', {}, function (err, fn) {
      expect(err).to.be(null);
      expect(django.options.loader).to.be(loader);
      expect(fn({})).to.equal('before middle after');
      expect(fn({})).to.equal('before middle after');
      done();
    });
  });
});

describe('django module-level exports', function () {
  it('exposes renderFileAsync and compileFileAsync', function () {
    expect(djangoModule.renderFileAsync).to.be.a('function');
    expect(djangoModule.compileFileAsync).to.be.a('function');
  });
});
