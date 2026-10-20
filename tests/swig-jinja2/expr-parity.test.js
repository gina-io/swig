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

  describe('a test binds to the operand next to it, tighter than every binary operator', function () {
    it('a test after an arithmetic operand tests that operand', function () {
      expect(render('{{ 1 + 2 is number }}', {})).to.equal('2');
      expect(render('{{ 2 * 3 is number }}', {})).to.equal('2');
      expect(render('{{ x ** 2 is number }}', { x: 1 })).to.equal('1');
    });
    it('a test after a comparison operand tests that operand', function () {
      expect(render('{% if x == 1 is number %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('Y');
      expect(render('{% if x < 2 is number %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('Y');
    });
    it('not applies to the whole test', function () {
      expect(render('{% if not x is defined %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('N');
      expect(render('{% if not x is defined %}Y{% else %}N{% endif %}', {})).to.equal('Y');
      expect(render('{% if not x is none %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('Y');
      expect(render('{% if not x is divisibleby(3) %}Y{% else %}N{% endif %}', { x: 4 })).to.equal('Y');
      expect(render('{{ \'y\' if not x is defined else \'n\' }}', { x: 1 })).to.equal('n');
    });
    it('a filter after a test applies to its result', function () {
      expect(render('{{ x is divisibleby(3)|upper }}', { x: 9 })).to.equal('TRUE');
    });
    it('tests next to and, or and unary minus keep their meaning', function () {
      expect(render('{% if x is defined and y is defined %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('N');
      expect(render('{% if -x is number %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('Y');
      expect(render('{% if x|default(5) is number %}Y{% else %}N{% endif %}', {})).to.equal('Y');
    });
  });

  describe('a test takes one argument without parentheses, as in Jinja2', function () {
    it('a bare literal or variable argument', function () {
      expect(render('{% if x is divisibleby 3 %}Y{% else %}N{% endif %}', { x: 9 })).to.equal('Y');
      expect(render('{% if x is divisibleby 3 %}Y{% else %}N{% endif %}', { x: 4 })).to.equal('N');
      expect(render('{% if x is sameas false %}Y{% else %}N{% endif %}', { x: false })).to.equal('Y');
      expect(render('{% if x is sameas y %}Y{% else %}N{% endif %}', { x: 1, y: 1 })).to.equal('Y');
      expect(render('{% if x is sameas \'a\' %}Y{% else %}N{% endif %}', { x: 'a' })).to.equal('Y');
      expect(render('{% if x is divisibleby y %}Y{% else %}N{% endif %}', { x: 9, y: 3 })).to.equal('Y');
      expect(render('{% if x is sameas lst[0] %}Y{% else %}N{% endif %}', { x: 1, lst: [1, 2] })).to.equal('Y');
      expect(render('{% if x is divisibleby (3) %}Y{% else %}N{% endif %}', { x: 9 })).to.equal('Y');
      expect(render('{% if x is not divisibleby 3 %}Y{% else %}N{% endif %}', { x: 4 })).to.equal('Y');
    });
    it('the argument ends at an operator, a filter, and, else or a comma', function () {
      expect(render('{{ x is divisibleby 3 + 1 }}', { x: 9 })).to.equal('2');
      expect(render('{{ x is divisibleby 3|upper }}', { x: 9 })).to.equal('TRUE');
      expect(render('{% if x is divisibleby 3 and y %}Y{% else %}N{% endif %}', { x: 9, y: 1 })).to.equal('Y');
      expect(render('{{ \'y\' if x is divisibleby 3 else \'n\' }}', { x: 9 })).to.equal('y');
      expect(render('{% with a = x is divisibleby 3, b = 1 %}{% if a %}Y{% endif %}{{ b }}{% endwith %}', { x: 9 })).to.equal('Y1');
      expect(render('{% macro f(a=x is sameas y, b=2) %}{% if a %}Y{% endif %}{{ b }}{% endmacro %}{{ f() }}', { x: 1, y: 1 })).to.equal('Y2');
      expect(render('{% set r = x is divisibleby 3 %}{% if r %}Y{% else %}N{% endif %}', { x: 9 })).to.equal('Y');
    });
    it('a parenthesized test can be tested again', function () {
      expect(render('{% if (x is defined) is sameas true %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('Y');
    });
  });
});
