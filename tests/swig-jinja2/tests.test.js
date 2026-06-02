var jinja2 = require('@rhinostone/swig-jinja2'),
  expect = require('../lib/expect.js');


/*!
 * `is <test>` / `is not <test>` render tests. Each test name lowers to
 * `_ext._test_<name>(subject, ...args)` (except the defined/none/undefined
 * VarRef special-cases), registered onto the instance by the constructor.
 */
describe('@rhinostone/swig-jinja2 — is tests', function () {

  function cond(expr, locals) {
    return jinja2.render('{% if ' + expr + ' %}Y{% else %}N{% endif %}', { locals: locals || {} });
  }

  it('number', function () {
    expect(cond('n is number', { n: 5 })).to.equal('Y');
    expect(cond('n is number', { n: 'x' })).to.equal('N');
  });

  it('string', function () {
    expect(cond('s is string', { s: 'x' })).to.equal('Y');
    expect(cond('s is string', { s: 5 })).to.equal('N');
  });

  it('boolean', function () {
    expect(cond('b is boolean', { b: true })).to.equal('Y');
    expect(cond('b is boolean', { b: 1 })).to.equal('N');
  });

  it('mapping (dict, not array)', function () {
    expect(cond('o is mapping', { o: { a: 1 } })).to.equal('Y');
    expect(cond('o is mapping', { o: [1] })).to.equal('N');
  });

  it('sequence (array or string, not dict)', function () {
    expect(cond('o is sequence', { o: [1] })).to.equal('Y');
    expect(cond('o is sequence', { o: 'ab' })).to.equal('Y');
    expect(cond('o is sequence', { o: {} })).to.equal('N');
  });

  it('iterable (array, string, or object)', function () {
    expect(cond('o is iterable', { o: [1] })).to.equal('Y');
    expect(cond('o is iterable', { o: {} })).to.equal('Y');
    expect(cond('o is iterable', { o: 5 })).to.equal('N');
  });

  it('callable', function () {
    expect(cond('f is callable', { f: function () {} })).to.equal('Y');
    expect(cond('f is callable', { f: 5 })).to.equal('N');
  });

  it('even / odd', function () {
    expect(cond('n is even', { n: 4 })).to.equal('Y');
    expect(cond('n is even', { n: 3 })).to.equal('N');
    expect(cond('n is odd', { n: 3 })).to.equal('Y');
    expect(cond('n is odd', { n: 4 })).to.equal('N');
  });

  it('divisibleby(n)', function () {
    expect(cond('n is divisibleby(3)', { n: 9 })).to.equal('Y');
    expect(cond('n is divisibleby(3)', { n: 10 })).to.equal('N');
  });

  it('sameas(other) is identity', function () {
    var shared = {};
    expect(cond('a is sameas(b)', { a: shared, b: shared })).to.equal('Y');
    expect(cond('a is sameas(b)', { a: {}, b: {} })).to.equal('N');
  });

  it('lower / upper (string case)', function () {
    expect(cond('s is lower', { s: 'abc' })).to.equal('Y');
    expect(cond('s is lower', { s: 'Abc' })).to.equal('N');
    expect(cond('s is upper', { s: 'ABC' })).to.equal('Y');
    expect(cond('s is upper', { s: 'Abc' })).to.equal('N');
  });

  it('defined / undefined / none on a variable', function () {
    expect(cond('x is defined', { x: 1 })).to.equal('Y');
    expect(cond('x is defined', {})).to.equal('N');
    expect(cond('x is undefined', {})).to.equal('Y');
    expect(cond('x is none', { x: null })).to.equal('Y');
    expect(cond('x is none', { x: 1 })).to.equal('N');
  });

  it('none on a non-variable subject routes through the helper', function () {
    expect(cond('(x) is none', { x: null })).to.equal('Y');
    expect(cond('(x) is none', { x: 1 })).to.equal('N');
  });

  it('is not negates the result', function () {
    expect(cond('n is not even', { n: 3 })).to.equal('Y');
    expect(cond('n is not even', { n: 4 })).to.equal('N');
  });

  it('a consumer can override a test per-instance', function () {
    var mj = new jinja2.Jinja2();
    mj.setExtension('_test_even', function () { return false; });
    expect(mj.render('{% if n is even %}Y{% else %}N{% endif %}', { locals: { n: 4 } })).to.equal('N');
    // default instance is unaffected
    expect(cond('n is even', { n: 4 })).to.equal('Y');
  });

});
