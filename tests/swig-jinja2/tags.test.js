var jinja2 = require('@rhinostone/swig-jinja2'),
  expect = require('expect.js');


/*!
 * Per-tag render tests. Each tag is exercised end-to-end through the
 * engine.install() pipeline so the IR shape and its runtime emission are
 * both verified.
 */
describe('@rhinostone/swig-jinja2 — tags', function () {

  function render(src, locals) {
    return jinja2.render(src, { locals: locals || {} });
  }

  describe('{% set %}', function () {

    it('assigns a literal and interpolates it', function () {
      expect(render('{% set x = 5 %}{{ x }}')).to.equal('5');
    });

    it('assigns an expression', function () {
      expect(render("{% set x = 'a' ~ 'b' %}{{ x }}")).to.equal('ab');
      expect(render('{% set x = 2 ** 3 %}{{ x }}')).to.equal('8');
    });

    it('assigns from locals', function () {
      expect(render('{% set y = x %}{{ y }}', { x: 'hi' })).to.equal('hi');
    });

    it('supports the body-capture form', function () {
      expect(render('{% set greeting %}hello{% endset %}{{ greeting }}')).to.equal('hello');
    });

    it('rejects bracket-notation assignment', function () {
      expect(function () {
        render('{% set x["a"] = 1 %}');
      }).to.throwError(/Bracket-notation assignment is not supported/);
    });

    it('blocks a dangerous assignment target', function () {
      expect(function () {
        render('{% set __proto__ = 1 %}');
      }).to.throwError(/CVE-2023-25345/);
    });

  });

});
