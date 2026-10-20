var jinja2 = require('@rhinostone/swig-jinja2'),
  expect = require('../lib/expect.js');


/*!
 * Expression grammar checked against Python Jinja2 3.1.6: where tests,
 * not, unary minus and ** bind. Each expectation is the output Jinja2
 * renders for the same template and locals.
 */
describe('@rhinostone/swig-jinja2 — expression parity with Jinja2', function () {

  function render(tpl, locals) {
    return jinja2.render(tpl, { locals: locals });
  }

  describe('a unary minus or plus applies before filters, tests and **, as in Jinja2', function () {
    it('a filter applies to the negated value', function () {
      expect(render('{{ -x|abs }}', { x: 5 })).to.equal('5');
      expect(render('{{ -x|abs }}', { x: -5 })).to.equal('5');
      expect(render('{{ +x|abs }}', { x: -3 })).to.equal('3');
      expect(render('{{ -x|abs * 2 }}', { x: 5 })).to.equal('10');
      expect(render('{% set r = -x|abs %}{{ r }}', { x: 5 })).to.equal('5');
    });
    it('the minus belongs to the ** base', function () {
      expect(render('{{ -2 ** 2 }}', {})).to.equal('4');
      expect(render('{{ -x ** 2 }}', { x: 3 })).to.equal('9');
      expect(render('{{ 2 ** -1 }}', {})).to.equal('0.5');
    });
    it('subscripts still bind tighter than the minus', function () {
      expect(render('{{ -x.a }}', { x: { a: 2 } })).to.equal('-2');
      expect(render('{{ -x[0] }}', { x: [4] })).to.equal('-4');
      expect(render('{{ 10 - x|abs }}', { x: -3 })).to.equal('7');
    });
  });

  describe('** reads its operands left to right, as in Jinja2', function () {
    it('a chain of ** groups from the left', function () {
      expect(render('{{ 2 ** 3 ** 2 }}', {})).to.equal('64');
      expect(render('{{ 2 ** 2 ** 3 }}', {})).to.equal('64');
      expect(render('{{ 3 ** 2 ** 0 }}', {})).to.equal('1');
    });
    it('** still binds tighter than *', function () {
      expect(render('{{ 2 * 3 ** 2 }}', {})).to.equal('18');
    });
  });
});
