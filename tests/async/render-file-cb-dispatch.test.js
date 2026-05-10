var expect = require('expect.js'),
  swigModule = require('../../lib/swig');


/*!
 * End-to-end render tests via the public renderFile(path, locals, cb)
 * dispatch with an async loader (loader.async === true).
 *
 * Exercises the full Phase 2+3+4 round-trip: frontend tag emits deferred
 * IR → backend emits AsyncFunction body → runtime resolves via
 * _swig.getTemplate → result.output reaches the cb. The headline
 * differentiator from renderFileAsync's pre-walker is dynamic-include
 * support — templates whose include targets evaluate from locals at
 * render time.
 *
 * Dynamic extends paths (`{% extends parent_var %}`) are NOT covered
 * here. The extends-tag parser path stashes `tokens.parent` as a
 * pre-lowered JS source string rather than an IRExpr, so async-mode
 * extends only supports string-literal paths today. Closing that gap
 * is a separate follow-up.
 */


function makeAsyncLoader(templates) {
  return {
    async: true,
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


describe('swig.renderFile cb dispatch — async end-to-end', function () {

  describe('static paths', function () {

    it('renders a single template with locals', function (done) {
      var swig = new swigModule.Swig({
        loader: makeAsyncLoader({ '/hello.html': 'Hello, {{ name }}!' })
      });
      swig.renderFile('hello.html', { name: 'world' }, function (err, out) {
        expect(err).to.be(null);
        expect(out).to.equal('Hello, world!');
        done();
      });
    });

    it('resolves a static extends chain', function (done) {
      var swig = new swigModule.Swig({
        loader: makeAsyncLoader({
          '/page.html': '{% extends "layout.html" %}{% block body %}Page body{% endblock %}',
          '/layout.html': '<doc>{% block body %}{% endblock %}</doc>'
        })
      });
      swig.renderFile('page.html', {}, function (err, out) {
        expect(err).to.be(null);
        expect(out).to.equal('<doc>Page body</doc>');
        done();
      });
    });

    it('resolves a three-level extends chain', function (done) {
      var swig = new swigModule.Swig({
        loader: makeAsyncLoader({
          '/page.html': '{% extends "section.html" %}{% block body %}page{% endblock %}',
          '/section.html': '{% extends "layout.html" %}',
          '/layout.html': '<l>{% block body %}layout-default{% endblock %}</l>'
        })
      });
      swig.renderFile('page.html', {}, function (err, out) {
        expect(err).to.be(null);
        expect(out).to.equal('<l>page</l>');
        done();
      });
    });

    it('resolves a static include', function (done) {
      var swig = new swigModule.Swig({
        loader: makeAsyncLoader({
          '/entry.html': 'before {% include "partial.html" %} after',
          '/partial.html': 'partial-content'
        })
      });
      swig.renderFile('entry.html', {}, function (err, out) {
        expect(err).to.be(null);
        expect(out).to.equal('before partial-content after');
        done();
      });
    });

    it('resolves a macro across files via import', function (done) {
      var swig = new swigModule.Swig({
        loader: makeAsyncLoader({
          '/entry.html': '{% import "macros.html" as m %}{{ m.greet("world") }}',
          '/macros.html': '{% macro greet(name) %}Hi, {{ name }}!{% endmacro %}'
        })
      });
      swig.renderFile('entry.html', {}, function (err, out) {
        expect(err).to.be(null);
        expect(out).to.equal('Hi, world!');
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
      swig.renderFile('page.html', {}, function (err, out) {
        expect(err).to.be(null);
        expect(out).to.contain('Hi, page!');
        expect(out).to.contain('partial-text');
        expect(out).to.match(/^<l>/);
        expect(out).to.match(/<\/l>$/);
        done();
      });
    });
  });

  describe('dynamic include (the deferred-resolution differentiator)', function () {

    it('resolves a dynamic include path from locals', function (done) {
      var swig = new swigModule.Swig({
        loader: makeAsyncLoader({
          '/entry.html': 'before {% include partial_var %} after',
          '/static.html': 'static-content'
        })
      });
      swig.renderFile('entry.html', { partial_var: 'static.html' }, function (err, out) {
        expect(err).to.be(null);
        expect(out).to.equal('before static-content after');
        done();
      });
    });
  });

  describe('include flag semantics', function () {

    it('honors ignore missing on async include', function (done) {
      var swig = new swigModule.Swig({
        loader: makeAsyncLoader({
          '/entry.html': 'before {% include "missing.html" ignore missing %} after'
        })
      });
      swig.renderFile('entry.html', {}, function (err, out) {
        expect(err).to.be(null);
        expect(out).to.equal('before  after');
        done();
      });
    });
  });

  describe('error propagation', function () {

    it('propagates entry-template loader errors via cb', function (done) {
      var swig = new swigModule.Swig({
        loader: makeAsyncLoader({})
      });
      swig.renderFile('never.html', {}, function (err, out) {
        expect(err).to.be.an(Error);
        expect(err.message).to.contain('Template not found');
        expect(out).to.be(undefined);
        done();
      });
    });

    it('propagates nested-include loader errors via cb', function (done) {
      var swig = new swigModule.Swig({
        loader: makeAsyncLoader({
          '/entry.html': '{% include "missing.html" %}'
        })
      });
      swig.renderFile('entry.html', {}, function (err, out) {
        expect(err).to.be.an(Error);
        expect(err.message).to.contain('Template not found');
        expect(out).to.be(undefined);
        done();
      });
    });

    it('propagates parse errors via cb', function (done) {
      var swig = new swigModule.Swig({
        loader: makeAsyncLoader({ '/bad.html': '{% endif %}' })
      });
      swig.renderFile('bad.html', {}, function (err, out) {
        expect(err).to.be.an(Error);
        expect(out).to.be(undefined);
        done();
      });
    });
  });
});
