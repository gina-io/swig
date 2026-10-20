var django = require('@rhinostone/swig-django'),
  filters = require('@rhinostone/swig-django/lib/filters'),
  expect = require('../lib/expect.js');


/*!
 * Filter outputs checked against Django 5.2. Each expectation is the
 * result Django gives for the same call or template.
 */
describe('@rhinostone/swig-django — filter parity with Django', function () {

  function render(src, locals) {
    return django.render(src, { locals: locals || {} });
  }

  describe('join', function () {
    it('a string joins its characters', function () {
      expect(filters.join('abc', ',')).to.equal('a,b,c');
      expect(filters.join('', ',')).to.equal('');
      expect(filters.join('\uD83D\uDE00a', ',')).to.equal('\uD83D\uDE00,a');
    });
    it('a mapping joins its keys', function () {
      expect(filters.join({ a: 1, b: 2 }, ',')).to.equal('a,b');
      expect(filters.join({}, ',')).to.equal('');
    });
    it('renders escaped characters and keys', function () {
      expect(render('{{ x|join:"," }}', { x: 'a<' })).to.equal('a,&lt;');
      expect(render('{{ x|join:"," }}', { x: { a: 1, b: 2 } })).to.equal('a,b');
    });
  });
});
