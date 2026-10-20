var jinja2 = require('@rhinostone/swig-jinja2'),
  expect = require('../lib/expect.js');


/*!
 * `is` test results checked against Python Jinja2 3.1.6. Each expectation
 * is the Y or N that Jinja2 renders for
 * `{% if x is <test> %}Y{% else %}N{% endif %}` with the same value of x.
 */
describe('@rhinostone/swig-jinja2 — is-test parity with Jinja2', function () {

  function cond(test, locals) {
    return jinja2.render('{% if x is ' + test + ' %}Y{% else %}N{% endif %}', { locals: locals });
  }

  describe('lower and upper need a cased letter, as Python\'s islower and isupper', function () {
    it('a string without a cased letter is neither lower nor upper', function () {
      expect(cond('lower', { x: '' })).to.equal('N');
      expect(cond('upper', { x: '' })).to.equal('N');
      expect(cond('lower', { x: ' ' })).to.equal('N');
      expect(cond('upper', { x: ' ' })).to.equal('N');
      expect(cond('lower', { x: '123' })).to.equal('N');
      expect(cond('upper', { x: '123' })).to.equal('N');
      expect(cond('lower', { x: '-' })).to.equal('N');
      expect(cond('upper', { x: '-' })).to.equal('N');
      expect(cond('lower', { x: '\u4e2d' })).to.equal('N');
      expect(cond('upper', { x: '\u4e2d' })).to.equal('N');
      expect(cond('lower', { x: '\u0663' })).to.equal('N');
      expect(cond('upper', { x: '\u0663' })).to.equal('N');
    });
    it('a null or missing variable is neither lower nor upper', function () {
      expect(cond('lower', { x: null })).to.equal('N');
      expect(cond('upper', { x: null })).to.equal('N');
      expect(cond('lower', {})).to.equal('N');
      expect(cond('upper', {})).to.equal('N');
    });
    it('a string with a cased letter is tested on its cased letters', function () {
      expect(cond('lower', { x: 'abc' })).to.equal('Y');
      expect(cond('upper', { x: 'abc' })).to.equal('N');
      expect(cond('lower', { x: 'ABC' })).to.equal('N');
      expect(cond('upper', { x: 'ABC' })).to.equal('Y');
      expect(cond('lower', { x: 'Abc' })).to.equal('N');
      expect(cond('upper', { x: 'Abc' })).to.equal('N');
      expect(cond('lower', { x: 'a1' })).to.equal('Y');
      expect(cond('upper', { x: 'A1' })).to.equal('Y');
      expect(cond('lower', { x: 'a\u4e2d' })).to.equal('Y');
      expect(cond('lower', { x: '\u00df' })).to.equal('Y');
      expect(cond('upper', { x: '\u00df' })).to.equal('N');
      expect(cond('lower', { x: '\u0130' })).to.equal('N');
      expect(cond('upper', { x: '\u0130' })).to.equal('Y');
      expect(cond('lower', { x: '\u01c5' })).to.equal('N');
      expect(cond('upper', { x: '\u01c5' })).to.equal('N');
      expect(cond('lower', { x: '\u00aa' })).to.equal('Y');
      expect(cond('upper', { x: '\u00aa' })).to.equal('N');
      expect(cond('lower', { x: 'A\u00aa' })).to.equal('N');
      expect(cond('upper', { x: 'A\u00aa' })).to.equal('N');
    });
  });
});
