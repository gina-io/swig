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

  describe('pluralize', function () {
    it('a number or boolean is compared with 1', function () {
      expect(filters.pluralize(true, 'y,ies')).to.equal('y');
      expect(filters.pluralize(false, 'y,ies')).to.equal('ies');
      expect(filters.pluralize(true)).to.equal('');
      expect(filters.pluralize(false)).to.equal('s');
    });
    it('a string that parses as a Python float is compared with 1', function () {
      expect(filters.pluralize(' 1 ', 'y,ies')).to.equal('y');
      expect(filters.pluralize('1.0', 'y,ies')).to.equal('y');
      expect(filters.pluralize('1e0', 'y,ies')).to.equal('y');
      expect(filters.pluralize('+1.', 'y,ies')).to.equal('y');
      expect(filters.pluralize('.1e1', 'y,ies')).to.equal('y');
      expect(filters.pluralize('1_000', 'y,ies')).to.equal('ies');
      expect(filters.pluralize('-1', 'y,ies')).to.equal('ies');
      expect(filters.pluralize('inf', 'y,ies')).to.equal('ies');
      expect(filters.pluralize('NaN', 'y,ies')).to.equal('ies');
    });
    it('a string that does not parse gives the empty string', function () {
      expect(filters.pluralize('abc', 'y,ies')).to.equal('');
      expect(filters.pluralize('', 'y,ies')).to.equal('');
      expect(filters.pluralize('1abc', 'y,ies')).to.equal('');
      expect(filters.pluralize('1__0', 'y,ies')).to.equal('');
      expect(filters.pluralize('_1', 'y,ies')).to.equal('');
      expect(filters.pluralize('0x1', 'y,ies')).to.equal('');
    });
    it('a list or mapping counts its items', function () {
      expect(filters.pluralize([1, 2], 'y,ies')).to.equal('ies');
      expect(filters.pluralize({}, 'y,ies')).to.equal('ies');
      expect(filters.pluralize({ a: 1 }, 'y,ies')).to.equal('y');
    });
    it('any other value gives the empty string', function () {
      expect(filters.pluralize(new Date(0), 'y,ies')).to.equal('');
    });
    it('renders a string count', function () {
      expect(render('cherr{{ x|pluralize:"y,ies" }}', { x: '1' })).to.equal('cherry');
      expect(render('cherr{{ x|pluralize:"y,ies" }}', { x: 'abc' })).to.equal('cherr');
    });
  });
});
