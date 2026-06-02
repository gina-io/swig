var expect = require('../../lib/expect.js'),
  jinja2Module = require('../../../packages/swig-jinja2');


/*!
 * End-to-end render tests via the public renderFile(path, locals, cb)
 * dispatch with an async loader (loader.async === true) on the Jinja2
 * frontend.
 *
 * Mirrors tests/async/render-file-cb-dispatch.test.js (native) and
 * tests/swig-twig/async/render-file-cb-dispatch.test.js. Dynamic extends
 * paths (`{% extends layout_var %}`) ARE covered here: the extends tag
 * lowers its path through parser.parseExpr into an IRExpr on
 * tokens.parentExpr, which buildExtendsDeferred passes into
 * ir.extendsDeferred's path slot — mirroring dynamic include. Static
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


describe('jinja2.renderFile cb dispatch — async end-to-end', function () {

  describe('static paths', function () {

    it('resolves a static extends chain', function (done) {
      var jinja2 = new jinja2Module.Jinja2({
        loader: makeAsyncLoader({
          '/page.html': '{% extends "layout.html" %}{% block body %}Page body{% endblock %}',
          '/layout.html': '<doc>{% block body %}{% endblock %}</doc>'
        })
      });
      jinja2.renderFile('page.html', {}, function (err, out) {
        expect(err).to.be(null);
        expect(out).to.equal('<doc>Page body</doc>');
        done();
      });
    });
  });

  describe('dynamic extends (the dynamic-path differentiator)', function () {

    it('resolves a dynamic extends path from locals', function (done) {
      var jinja2 = new jinja2Module.Jinja2({
        loader: makeAsyncLoader({
          '/page.html': '{% extends layout_var %}{% block body %}Page body{% endblock %}',
          '/layout.html': '<doc>{% block body %}{% endblock %}</doc>'
        })
      });
      jinja2.renderFile('page.html', { layout_var: 'layout.html' }, function (err, out) {
        expect(err).to.be(null);
        expect(out).to.equal('<doc>Page body</doc>');
        done();
      });
    });
  });
});
