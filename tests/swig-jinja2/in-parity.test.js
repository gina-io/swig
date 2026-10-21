var jinja2 = require('@rhinostone/swig-jinja2'),
  expect = require('../lib/expect.js');


/*!
 * The membership operators checked against Python Jinja2 3.1.6. Each
 * expectation is the output Jinja2 renders for the same template and
 * locals; where Jinja2 raises, swig's test gives a value instead of an
 * error, as Django's if tag does.
 */
describe('@rhinostone/swig-jinja2 — membership parity with Jinja2', function () {

  function render(tpl, locals) {
    return jinja2.render(tpl, { locals: locals });
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
      // Jinja2 raises; swig's lenient value
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 1, y: '123' })).to.equal('N');
      // Jinja2 raises; swig's lenient value
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 1, y: 5 })).to.equal('N');
      // Jinja2 raises; swig's lenient value
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 1, y: null })).to.equal('N');
      // Jinja2 raises; swig's lenient value
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 1, y: true })).to.equal('N');
      // Jinja2 raises; swig's lenient value
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: [1], y: { a: 1 } })).to.equal('N');
    });
    it('a missing value', function () {
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { y: [1] })).to.equal('N');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('N');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { x: 'a' })).to.equal('N');
      expect(render('{% if x in y %}Y{% else %}N{% endif %}', { y: [null] })).to.equal('N');
    });
    it('in combines with other operators and filters', function () {
      expect(render('{% if x in y and z %}Y{% else %}N{% endif %}', { x: 1, y: [1], z: true })).to.equal('Y');
      expect(render('{% if x|lower in y %}Y{% else %}N{% endif %}', { x: 'A', y: ['a'] })).to.equal('Y');
      expect(render('{% if not x in y %}Y{% else %}N{% endif %}', { x: 5, y: [1, 2, 3] })).to.equal('Y');
      expect(render('{% set r = x in y %}{% if r %}Y{% else %}N{% endif %}', { x: 2, y: [1, 2] })).to.equal('Y');
      expect(render('{% if 2 in [1, 2, 3] %}Y{% else %}N{% endif %}', {})).to.equal('Y');
      expect(render('{% if "b" in "abc" %}Y{% else %}N{% endif %}', {})).to.equal('Y');
      expect(render('{% if "k" in {"k": 1} %}Y{% else %}N{% endif %}', {})).to.equal('Y');
    });
  });

  describe('`not in` is the negated test, as in the reference engine', function () {
    it('a list, a string and a mapping', function () {
      expect(render('{% if x not in y %}Y{% else %}N{% endif %}', { x: 4, y: [1, 2, 3] })).to.equal('Y');
      expect(render('{% if x not in y %}Y{% else %}N{% endif %}', { x: 1, y: [1, 2, 3] })).to.equal('N');
      expect(render('{% if x not in y %}Y{% else %}N{% endif %}', { x: 'z', y: 'abc' })).to.equal('Y');
      expect(render('{% if x not in y %}Y{% else %}N{% endif %}', { x: 'b', y: 'abc' })).to.equal('N');
      expect(render('{% if x not in y %}Y{% else %}N{% endif %}', { x: 'a', y: { a: 1 } })).to.equal('N');
      expect(render('{% if x not in y %}Y{% else %}N{% endif %}', { x: 'z', y: { a: 1 } })).to.equal('Y');
      expect(render('{% if x not in y %}Y{% else %}N{% endif %}', { x: null, y: { a: 1 } })).to.equal('Y');
      expect(render('{% if x not  in y %}Y{% else %}N{% endif %}', { x: 4, y: [1, 2, 3] })).to.equal('Y');
      expect(render('{% if "z" not in "abc" %}Y{% else %}N{% endif %}', {})).to.equal('Y');
    });
    it('a test the reference cannot run', function () {
      // Jinja2 raises; swig's lenient value
      expect(render('{% if x not in y %}Y{% else %}N{% endif %}', { x: 1, y: 5 })).to.equal('Y');
      // Jinja2 raises; swig's lenient value
      expect(render('{% if x not in y %}Y{% else %}N{% endif %}', { x: 1, y: null })).to.equal('Y');
      // Jinja2 raises; swig's lenient value
      expect(render('{% if x not in y %}Y{% else %}N{% endif %}', { x: 1, y: '123' })).to.equal('Y');
      // Jinja2 raises; swig's lenient value
      expect(render('{% if x not in y %}Y{% else %}N{% endif %}', { x: [1], y: { a: 1 } })).to.equal('Y');
    });
    it('a missing value', function () {
      expect(render('{% if x not in y %}Y{% else %}N{% endif %}', { y: [1] })).to.equal('Y');
      expect(render('{% if x not in y %}Y{% else %}N{% endif %}', { x: 'a' })).to.equal('Y');
      expect(render('{% if x not in y %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('Y');
    });
    it('words that start with not or in are still variables', function () {
      expect(render('{% if not in_stock %}Y{% else %}N{% endif %}', { in_stock: false })).to.equal('Y');
      expect(render('{% if not inside %}Y{% else %}N{% endif %}', { inside: true })).to.equal('N');
      expect(render('{% if x not in y and not z %}Y{% else %}N{% endif %}', { x: 4, y: [1, 2, 3], z: false })).to.equal('Y');
    });
  });
});
