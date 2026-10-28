var django = require('@rhinostone/swig-django'),
  expect = require('../lib/expect.js');


/*!
 * else and empty with arguments, checked against Django 5.2: the reference rejects the
 * template, so swig throws when it compiles; a bare tag renders the reference's
 * output.
 */
describe('@rhinostone/swig-django — else and empty take no arguments', function () {

  function render(src, locals) {
    return django.render(src, { locals: locals || {} });
  }

  describe('else and empty take no arguments, as in Django', function () {
    it('else', function () {
      expect(function () { render('{% if a %}A{% else if b %}B{% endif %}', { a: 0, b: 0, l: [] }); }).to.throwError(/does not accept arguments/);
      expect(function () { render('{% if a %}A{% else x %}B{% endif %}', { a: 0, b: 0, l: [] }); }).to.throwError(/does not accept arguments/);
    });
    it('empty', function () {
      expect(function () { render('{% for i in l %}{{ i }}{% empty x %}E{% endfor %}', { a: 0, b: 0, l: [] }); }).to.throwError(/does not accept arguments/);
    });
    it('a bare else or empty still renders', function () {
      expect(render('{% if a %}A{% else %}B{% endif %}', { a: 0, b: 0, l: [] })).to.equal('B');
      expect(render('{% if a %}A{% else   %}B{% endif %}', { a: 0, b: 0, l: [] })).to.equal('B');
      expect(render('{% for i in l %}{{ i }}{% empty %}E{% endfor %}', { a: 0, b: 0, l: [] })).to.equal('E');
    });
  });
});
