var expect = require('../../lib/expect.js'),
  djangoModule = require('../../../packages/swig-django');


/*!
 * End-to-end render tests via the public renderFile(path, locals, cb)
 * dispatch with an async loader (loader.async === true) on the Django
 * frontend.
 *
 * Mirrors tests/async/render-file-cb-dispatch.test.js (native),
 * tests/swig-twig/async/render-file-cb-dispatch.test.js, and the Jinja2
 * sibling. Dynamic extends paths (`{% extends layout_var %}`) ARE covered
 * here: the Django extends tag lowers its path through parseExpr onto
 * tokens.parentExpr, which the shared engine's buildExtendsDeferred passes
 * into ir.extendsDeferred's path slot — mirroring dynamic include. Static
 * string-literal extends keeps its tokens.parent string path unchanged.
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


describe('django.renderFile cb dispatch — async end-to-end', function () {

  describe('static paths', function () {

    it('resolves a static extends chain', function (done) {
      var django = new djangoModule.Django({
        loader: makeAsyncLoader({
          '/page.html': '{% extends "layout.html" %}{% block body %}Page body{% endblock %}',
          '/layout.html': '<doc>{% block body %}{% endblock %}</doc>'
        })
      });
      django.renderFile('page.html', {}, function (err, out) {
        expect(err).to.be(null);
        expect(out).to.equal('<doc>Page body</doc>');
        done();
      });
    });

    it('resolves a static include', function (done) {
      var django = new djangoModule.Django({
        loader: makeAsyncLoader({
          '/entry.html': 'before {% include "partial.html" %} after',
          '/partial.html': 'inner'
        })
      });
      django.renderFile('entry.html', {}, function (err, out) {
        expect(err).to.be(null);
        expect(out).to.equal('before inner after');
        done();
      });
    });
  });

  describe('dynamic extends (the dynamic-path differentiator)', function () {

    it('resolves a dynamic extends path from locals', function (done) {
      var django = new djangoModule.Django({
        loader: makeAsyncLoader({
          '/page.html': '{% extends layout_var %}{% block body %}Page body{% endblock %}',
          '/layout.html': '<doc>{% block body %}{% endblock %}</doc>'
        })
      });
      django.renderFile('page.html', { layout_var: 'layout.html' }, function (err, out) {
        expect(err).to.be(null);
        expect(out).to.equal('<doc>Page body</doc>');
        done();
      });
    });
  });
});
