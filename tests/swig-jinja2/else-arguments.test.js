var jinja2 = require('@rhinostone/swig-jinja2'),
  expect = require('../lib/expect.js');


/*!
 * else with arguments, checked against Jinja2 3.1: the reference rejects the
 * template, so swig throws when it compiles; a bare tag renders the reference's
 * output.
 */
describe('@rhinostone/swig-jinja2 — else takes no arguments', function () {

  function render(src, locals) {
    return jinja2.render(src, { locals: locals || {} });
  }

  describe('else takes no arguments, as in Jinja2', function () {
    it('in an if', function () {
      expect(function () { render('{% if a %}A{% else if b %}B{% endif %}', { a: 0, b: 0, l: [] }); }).to.throwError(/does not accept arguments/);
      expect(function () { render('{% if a %}A{% else x %}B{% endif %}', { a: 0, b: 0, l: [] }); }).to.throwError(/does not accept arguments/);
    });
    it('in a for', function () {
      expect(function () { render('{% for i in l %}{{ i }}{% else x %}E{% endfor %}', { a: 0, b: 0, l: [] }); }).to.throwError(/does not accept arguments/);
    });
    it('a bare else still renders', function () {
      expect(render('{% if a %}A{% else %}B{% endif %}', { a: 0, b: 0, l: [] })).to.equal('B');
      expect(render('{% if a %}A{% else   %}B{% endif %}', { a: 0, b: 0, l: [] })).to.equal('B');
      expect(render('{% if a %}A {%- else -%} B{% endif %}', { a: 0, b: 0, l: [] })).to.equal('B');
      expect(render('{% for i in l %}{{ i }}{% else %}E{% endfor %}', { a: 0, b: 0, l: [] })).to.equal('E');
    });
  });
});
