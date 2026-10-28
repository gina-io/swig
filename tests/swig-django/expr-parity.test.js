var django = require('@rhinostone/swig-django'),
  expect = require('../lib/expect.js');


/*!
 * Where not, in and the comparisons bind in an if expression, checked against
 * Django 5.2 (smartif: or, and, not, then in and not in, then the comparisons
 * and is, each level binding more tightly). Each expectation is the output
 * Django gives for the same template.
 */
describe('@rhinostone/swig-django — expression levels in if', function () {

  function render(src, locals) {
    return django.render(src, { locals: locals || {} });
  }

  describe('not binds more loosely than the comparisons and in, as in Django', function () {
    it('a comparison', function () {
      expect(render('{% if not x == y %}Y{% else %}N{% endif %}', { x: 1, y: 2 })).to.equal('Y');
      expect(render('{% if not x == y %}Y{% else %}N{% endif %}', { x: 1, y: 1 })).to.equal('N');
      expect(render('{% if not x != y %}Y{% else %}N{% endif %}', { x: 1, y: 1 })).to.equal('Y');
      expect(render('{% if not x < y %}Y{% else %}N{% endif %}', { x: 1, y: 2 })).to.equal('N');
      expect(render('{% if not x < y %}Y{% else %}N{% endif %}', { x: 2, y: 1 })).to.equal('Y');
      expect(render('{% if not x >= y %}Y{% else %}N{% endif %}', { x: 1, y: 2 })).to.equal('Y');
    });
    it('in and not in', function () {
      expect(render('{% if not x in y %}Y{% else %}N{% endif %}', { x: 5, y: [1, 2, 3] })).to.equal('Y');
      expect(render('{% if not x in y %}Y{% else %}N{% endif %}', { x: 2, y: [1, 2, 3] })).to.equal('N');
      expect(render('{% if not x not in y %}Y{% else %}N{% endif %}', { x: 2, y: [1, 2] })).to.equal('Y');
      expect(render('{% if not x in y %}Y{% else %}N{% endif %}', { x: 'a', y: 'abc' })).to.equal('N');
    });
    it('is and is not', function () {
      expect(render('{% if not x is y %}Y{% else %}N{% endif %}', { x: 1, y: 1 })).to.equal('N');
      expect(render('{% if not x is None %}Y{% else %}N{% endif %}', { x: null })).to.equal('N');
      expect(render('{% if not x is None %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('Y');
      expect(render('{% if not x is not None %}Y{% else %}N{% endif %}', { x: null })).to.equal('Y');
    });
    it('elif', function () {
      expect(render('{% if a %}A{% elif not x == y %}B{% else %}C{% endif %}', { a: 0, x: 1, y: 2 })).to.equal('B');
    });
  });

  describe('not keeps binding more tightly than and and or', function () {
    it('and, or and not not', function () {
      expect(render('{% if not x and y %}Y{% else %}N{% endif %}', { x: 0, y: 1 })).to.equal('Y');
      expect(render('{% if not x and y %}Y{% else %}N{% endif %}', { x: 1, y: 1 })).to.equal('N');
      expect(render('{% if not x or y %}Y{% else %}N{% endif %}', { x: 1, y: 0 })).to.equal('N');
      expect(render('{% if x and not y %}Y{% else %}N{% endif %}', { x: 1, y: 0 })).to.equal('Y');
      expect(render('{% if not not x %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('Y');
    });
    it('not after a comparison', function () {
      expect(render('{% if x == not y %}Y{% else %}N{% endif %}', { x: true, y: 0 })).to.equal('Y');
    });
  });

  describe('in binds more loosely than the comparisons, as in Django', function () {
    it('a comparison before in', function () {
      expect(render('{% if a == b in c %}Y{% else %}N{% endif %}', { a: 1, b: 1, c: [true] })).to.equal('Y');
      expect(render('{% if a == b in c %}Y{% else %}N{% endif %}', { a: 1, b: 2, c: [false] })).to.equal('Y');
      expect(render('{% if a != b in c %}Y{% else %}N{% endif %}', { a: 1, b: 1, c: [false] })).to.equal('Y');
      expect(render('{% if a < b in c %}Y{% else %}N{% endif %}', { a: 1, b: 2, c: [true] })).to.equal('Y');
    });
    it('a comparison after in', function () {
      expect(render('{% if a in b < c %}Y{% else %}N{% endif %}', { a: 'a', b: 'abc', c: 2 })).to.equal('N');
      expect(render('{% if a in b == c %}Y{% else %}N{% endif %}', { a: true, b: 1, c: 1 })).to.equal('N');
      expect(render('{% if a not in b == c %}Y{% else %}N{% endif %}', { a: 1, b: [2], c: true })).to.equal('N');
    });
  });

  describe('the comparisons and is group left to right at one level', function () {
    it('mixed comparisons', function () {
      expect(render('{% if a < b == c %}Y{% else %}N{% endif %}', { a: 1, b: 2, c: true })).to.equal('Y');
      expect(render('{% if a == b < c %}Y{% else %}N{% endif %}', { a: 0, b: 1, c: 0 })).to.equal('N');
      expect(render('{% if a is b == c %}Y{% else %}N{% endif %}', { a: 1, b: 1, c: true })).to.equal('Y');
      expect(render('{% if a == b is c %}Y{% else %}N{% endif %}', { a: 1, b: 1, c: true })).to.equal('Y');
      expect(render('{% if a is not b == c %}Y{% else %}N{% endif %}', { a: 1, b: 2, c: false })).to.equal('N');
    });
  });
});
