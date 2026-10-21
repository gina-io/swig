var django = require('@rhinostone/swig-django'),
  expect = require('../lib/expect.js');


/*!
 * The membership operators checked against Django 5.2.18. Each
 * expectation is the output Django renders for the same template and
 * locals.
 */
describe('@rhinostone/swig-django — membership parity with Django', function () {

  function render(tpl, locals) {
    return django.render(tpl, { locals: locals });
  }

  describe('`in` tests membership, as in the reference engine', function () {
    it('a list holds an item', function () {
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 3, y: [1, 2, 3] })).to.equal('Y');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 4, y: [1, 2, 3] })).to.equal('N');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 0, y: [1, 2, 3] })).to.equal('N');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 'a', y: ['a', 'b'] })).to.equal('Y');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 'c', y: ['a', 'b'] })).to.equal('N');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 1.5, y: [1.5] })).to.equal('Y');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 0, y: [] })).to.equal('N');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 'length', y: [1] })).to.equal('N');
    });
    it('an item is compared without type coercion', function () {
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: '1', y: [1, 2, 3] })).to.equal('N');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 1, y: ['1', '2'] })).to.equal('N');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: '', y: [0] })).to.equal('N');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: null, y: [false] })).to.equal('N');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: null, y: [null] })).to.equal('Y');
    });
    it('a string holds a substring', function () {
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 'b', y: 'abc' })).to.equal('Y');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 'bc', y: 'abc' })).to.equal('Y');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 'd', y: 'abc' })).to.equal('N');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: '', y: 'abc' })).to.equal('Y');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: '', y: '' })).to.equal('Y');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 'B', y: 'abc' })).to.equal('N');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 'ab', y: 'b' })).to.equal('N');
    });
    it('a mapping holds its own keys', function () {
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 'a', y: { a: 1 } })).to.equal('Y');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 'z', y: { a: 1 } })).to.equal('N');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 1, y: { a: 1 } })).to.equal('N');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 'x', y: { a: 'x' } })).to.equal('N');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 'toString', y: {} })).to.equal('N');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: '__proto__', y: {} })).to.equal('N');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 'constructor', y: { a: 1 } })).to.equal('N');
    });
    it('a test the reference cannot run gives false', function () {
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 1, y: '123' })).to.equal('N');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 1, y: 5 })).to.equal('N');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 1, y: null })).to.equal('N');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 1, y: true })).to.equal('N');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: null, y: 'abc' })).to.equal('N');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: [1], y: { a: 1 } })).to.equal('N');
    });
    it('a missing value', function () {
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { y: [1] })).to.equal('N');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('N');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 'a' })).to.equal('N');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { y: [null] })).to.equal('Y');
    });
    it('in combines with other operators and filters', function () {
      expect(render('{% if x in y and z %}Y{% else %}N{% endif %}', { x: 1, y: [1], z: true })).to.equal('Y');
      expect(render('{% if x|lower in y %}Y{% else %}N{% endif %}', { x: 'A', y: ['a'] })).to.equal('Y');
      expect(render('{% if "b" in "abc" %}Y{% else %}N{% endif %}', {})).to.equal('Y');
    });
  });
});
