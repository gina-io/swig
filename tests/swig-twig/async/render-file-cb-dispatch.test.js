var expect = require('expect.js'),
  twigModule = require('../../../packages/swig-twig');


/*!
 * End-to-end render tests via the public renderFile(path, locals, cb)
 * dispatch with an async loader (loader.async === true) on the Twig
 * frontend.
 *
 * Mirrors tests/async/render-file-cb-dispatch.test.js and adds
 * Twig-specific surfaces: {% from "..." import x, y as z %} and
 * Twig's include flag set (with/only/ignore missing).
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


describe('twig.renderFile cb dispatch — async end-to-end', function () {

  describe('static paths', function () {

    it('renders a single template with locals', function (done) {
      var twig = new twigModule.Twig({
        loader: makeAsyncLoader({ '/hello.twig': 'Hello, {{ name }}!' })
      });
      twig.renderFile('hello.twig', { name: 'world' }, function (err, out) {
        expect(err).to.be(null);
        expect(out).to.equal('Hello, world!');
        done();
      });
    });

    it('resolves a static extends chain', function (done) {
      var twig = new twigModule.Twig({
        loader: makeAsyncLoader({
          '/page.twig': '{% extends "layout.twig" %}{% block body %}Page body{% endblock %}',
          '/layout.twig': '<doc>{% block body %}{% endblock %}</doc>'
        })
      });
      twig.renderFile('page.twig', {}, function (err, out) {
        expect(err).to.be(null);
        expect(out).to.equal('<doc>Page body</doc>');
        done();
      });
    });

    it('resolves a static include', function (done) {
      var twig = new twigModule.Twig({
        loader: makeAsyncLoader({
          '/entry.twig': 'before {% include "partial.twig" %} after',
          '/partial.twig': 'partial-content'
        })
      });
      twig.renderFile('entry.twig', {}, function (err, out) {
        expect(err).to.be(null);
        expect(out).to.equal('before partial-content after');
        done();
      });
    });

    it('resolves a macro across files via import', function (done) {
      var twig = new twigModule.Twig({
        loader: makeAsyncLoader({
          '/entry.twig': '{% import "macros.twig" as m %}{{ m.greet("world") }}',
          '/macros.twig': '{% macro greet(name) %}Hi, {{ name }}!{% endmacro %}'
        })
      });
      twig.renderFile('entry.twig', {}, function (err, out) {
        expect(err).to.be(null);
        expect(out).to.equal('Hi, world!');
        done();
      });
    });

    it('resolves bare-name and aliased entries via from-import', function (done) {
      var twig = new twigModule.Twig({
        loader: makeAsyncLoader({
          '/entry.twig': '{% from "macros.twig" import greet, shout as yell %}{{ greet("world") }}/{{ yell("done") }}',
          '/macros.twig': '{% macro greet(name) %}Hi, {{ name }}{% endmacro %}{% macro shout(text) %}{{ text }}!{% endmacro %}'
        })
      });
      twig.renderFile('entry.twig', {}, function (err, out) {
        expect(err).to.be(null);
        expect(out).to.equal('Hi, world/done!');
        done();
      });
    });
  });

  describe('dynamic include (the deferred-resolution differentiator)', function () {

    it('resolves a dynamic include path from locals', function (done) {
      var twig = new twigModule.Twig({
        loader: makeAsyncLoader({
          '/entry.twig': 'before {% include partial_var %} after',
          '/static.twig': 'static-content'
        })
      });
      twig.renderFile('entry.twig', { partial_var: 'static.twig' }, function (err, out) {
        expect(err).to.be(null);
        expect(out).to.equal('before static-content after');
        done();
      });
    });
  });

  describe('include flag semantics', function () {

    it('honors ignore missing on async include', function (done) {
      var twig = new twigModule.Twig({
        loader: makeAsyncLoader({
          '/entry.twig': 'before {% include "missing.twig" ignore missing %} after'
        })
      });
      twig.renderFile('entry.twig', {}, function (err, out) {
        expect(err).to.be(null);
        expect(out).to.equal('before  after');
        done();
      });
    });

    it('honors with-context isolation on async include', function (done) {
      var twig = new twigModule.Twig({
        loader: makeAsyncLoader({
          '/entry.twig': '{% include "partial.twig" with { who: "world" } only %}',
          '/partial.twig': 'Hi, {{ who }}!'
        })
      });
      twig.renderFile('entry.twig', { who: 'outer' }, function (err, out) {
        expect(err).to.be(null);
        expect(out).to.equal('Hi, world!');
        done();
      });
    });
  });

  describe('error propagation', function () {

    it('propagates entry-template loader errors via cb', function (done) {
      var twig = new twigModule.Twig({
        loader: makeAsyncLoader({})
      });
      twig.renderFile('never.twig', {}, function (err, out) {
        expect(err).to.be.an(Error);
        expect(err.message).to.contain('Template not found');
        expect(out).to.be(undefined);
        done();
      });
    });

    it('propagates nested-include loader errors via cb', function (done) {
      var twig = new twigModule.Twig({
        loader: makeAsyncLoader({
          '/entry.twig': '{% include "missing.twig" %}'
        })
      });
      twig.renderFile('entry.twig', {}, function (err, out) {
        expect(err).to.be.an(Error);
        expect(err.message).to.contain('Template not found');
        expect(out).to.be(undefined);
        done();
      });
    });

    it('propagates parse errors via cb', function (done) {
      var twig = new twigModule.Twig({
        loader: makeAsyncLoader({ '/bad.twig': '{% endif %}' })
      });
      twig.renderFile('bad.twig', {}, function (err, out) {
        expect(err).to.be.an(Error);
        expect(out).to.be(undefined);
        done();
      });
    });
  });
});
