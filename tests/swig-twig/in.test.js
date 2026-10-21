var twig = require('@rhinostone/swig-twig'),
  expect = require('../lib/expect.js');


/*!
 * The `in` operator checked against Twig 3.x, read from its source
 * (CoreExtension::inFilter and compare()) and its templates page: a list or
 * a mapping holds a value, compared loosely; a string holds a string or
 * number needle as a substring; anything else holds nothing. swig-twig
 * compares with JavaScript's `==`, as its own `==` does, and compares an
 * object or a list by identity. swig-twig has no else tag, so each case
 * renders a ternary.
 */
describe('@rhinostone/swig-twig — in', function () {

  function test(expr, locals) {
    return twig.render('{{ (' + expr + ') ? "Y" : "N" }}', { locals: locals });
  }

  it('a list holds a value, compared with ==', function () {
    expect(test('x in y', { x: 3, y: [1, 2, 3] })).to.equal('Y');
    expect(test('x in y', { x: 4, y: [1, 2, 3] })).to.equal('N');
    expect(test('x in y', { x: 0, y: [1, 2, 3] })).to.equal('N');
    expect(test('x in y', { x: '1', y: [1, 2, 3] })).to.equal('Y');
    expect(test('x in y', { x: 1, y: ['1', '2'] })).to.equal('Y');
    expect(test('x in y', { x: 'a', y: ['a', 'b'] })).to.equal('Y');
    expect(test('x in y', { x: 'c', y: ['a', 'b'] })).to.equal('N');
    expect(test('x in y', { x: true, y: [1] })).to.equal('Y');
    expect(test('x in y', { x: 0, y: [false] })).to.equal('Y');
    expect(test('x in y', { x: 'length', y: [1] })).to.equal('N');
    expect(test('x in y', { x: 0, y: [] })).to.equal('N');
    expect(test('1 in [1, 2, 3]', {})).to.equal('Y');
  });

  it('a list compares an object or a list by identity', function () {
    var a = [1];
    expect(test('x in y', { x: a, y: [a] })).to.equal('Y');
  });

  it('a mapping holds its values, not its keys', function () {
    expect(test('x in y', { x: 1, y: { a: 1 } })).to.equal('Y');
    expect(test('x in y', { x: 'x', y: { a: 'x' } })).to.equal('Y');
    expect(test('x in y', { x: 'a', y: { a: 1 } })).to.equal('N');
    expect(test('x in y', { x: 1, y: { '1': 'x' } })).to.equal('N');
    expect(test('x in y', { x: 'toString', y: {} })).to.equal('N');
    expect(test('x in y', { x: '__proto__', y: {} })).to.equal('N');
  });

  it('a string holds a string or number needle as a substring', function () {
    expect(test('x in y', { x: 'b', y: 'abc' })).to.equal('Y');
    expect(test('x in y', { x: 'bc', y: 'abc' })).to.equal('Y');
    expect(test('x in y', { x: 'd', y: 'abc' })).to.equal('N');
    expect(test('x in y', { x: '', y: 'abc' })).to.equal('Y');
    expect(test('x in y', { x: 1, y: '123' })).to.equal('Y');
    expect(test('x in y', { x: true, y: 'abc' })).to.equal('N');
    expect(test('"cd" in "abcde"', {})).to.equal('Y');
  });

  it('anything else holds nothing', function () {
    expect(test('x in y', { x: 1, y: 5 })).to.equal('N');
    expect(test('x in y', { x: 1, y: null })).to.equal('N');
    expect(test('x in y', { x: 1, y: true })).to.equal('N');
    expect(test('x in y', { x: 1 })).to.equal('N');
    expect(test('x in y', { y: [1] })).to.equal('N');
  });

  it('not binds tighter than in, as in Twig', function () {
    expect(test('not x in y', { x: 5, y: [1, 2, 3] })).to.equal('N');
  });
});

/*!
 * `not in` is the negated test, as Twig compiles it (`!inFilter`), at the
 * level of `in`.
 */
describe('@rhinostone/swig-twig — not in', function () {

  function test(expr, locals) {
    return twig.render('{{ (' + expr + ') ? "Y" : "N" }}', { locals: locals });
  }

  it('negates the in test of a list, a string and a mapping', function () {
    expect(test('x not in y', { x: 4, y: [1, 2, 3] })).to.equal('Y');
    expect(test('x not in y', { x: 1, y: [1, 2, 3] })).to.equal('N');
    expect(test('x not in y', { x: 'z', y: 'abc' })).to.equal('Y');
    expect(test('x not in y', { x: 'a', y: { a: 1 } })).to.equal('Y');
    expect(test('x not in y', { x: 1, y: { a: 1 } })).to.equal('N');
    expect(test('1 not in [1, 2, 3]', {})).to.equal('N');
    expect(test('"z" not in "abc"', {})).to.equal('Y');
    expect(test('x not  in y', { x: 4, y: [1, 2, 3] })).to.equal('Y');
  });

  it('is true for a container that holds nothing', function () {
    expect(test('x not in y', { x: 1, y: 5 })).to.equal('Y');
    expect(test('x not in y', { x: 1, y: null })).to.equal('Y');
    expect(test('x not in y', { x: 1 })).to.equal('Y');
  });

  it('leaves names that start with not or in to the variables', function () {
    expect(test('not in_stock', { in_stock: false })).to.equal('Y');
    expect(test('not inside', { inside: true })).to.equal('N');
    expect(test('x not in y and z', { x: 4, y: [1, 2, 3], z: true })).to.equal('Y');
  });
});
