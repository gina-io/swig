var django = require('@rhinostone/swig-django'),
  parser = require('@rhinostone/swig-django/lib/parser'),
  lexer = require('@rhinostone/swig-django/lib/lexer'),
  expect = require('../lib/expect.js');


/*!
 * Where the Django frontend marks the variable an expression starts with
 * (parser.missingAsEmpty): `{{ }}` outputs and the values of with, cycle and
 * include-with, where Django gives a failed lookup "" before any filter runs,
 * but not if, for or firstof, where Django reads it as None. The render tests
 * against Django are in missing-variable.test.js.
 */
describe('@rhinostone/swig-django — marking the variable an expression starts with', function () {

  function parse(str) { return parser.parseExpr(lexer.read(str), {}); }

  function body(src) {
    return django.precompile(src, { filename: 'page.html' }).tpl.toString();
  }

  it('marks the input of a filter chain, or the expression itself', function () {
    expect(parser.missingAsEmpty(parse('x|lower|upper')).input.input.missingAsEmpty).to.be(true);
    expect(parser.missingAsEmpty(parse('x.y')).missingAsEmpty).to.be(true);
  });

  it('leaves a filter argument, a literal and a subscript unmarked', function () {
    var expr = parser.missingAsEmpty(parse('x|default:y'));
    expect(expr.args[0].missingAsEmpty).to.be(undefined);
    expect(parser.missingAsEmpty(parse('"a"|upper')).input.missingAsEmpty).to.be(undefined);
    expect(parser.missingAsEmpty(parse('x[0]|upper')).input.missingAsEmpty).to.be(undefined);
  });

  it('leaves parseExpr itself unchanged', function () {
    expect(parse('x|upper')).to.eql({
      type: 'FilterCall', name: 'upper', input: { type: 'VarRef', path: ['x'], resolve: true }
    });
  });

  it('passes "" for outputs and for with, cycle and include-with values', function () {
    expect(body('{{ x|upper }}')).to.contain('_utils.resolve(_ctx, ["x"], "")');
    expect(body('{% with y=x|upper %}{{ y }}{% endwith %}')).to.contain('_utils.resolve(_ctx, ["x"], "")');
    expect(body('{% with x|upper as y %}{{ y }}{% endwith %}')).to.contain('_utils.resolve(_ctx, ["x"], "")');
    expect(body('{% for i in "ab" %}{% cycle x "z" %}{% endfor %}')).to.contain('_utils.resolve(_ctx, ["x"], "")');
    expect(body('{% include "p.html" with y=x %}')).to.contain('_utils.resolve(_ctx, ["x"], "")');
  });

  it('does not pass it for if, for or firstof', function () {
    expect(body('{% if x|upper %}Y{% endif %}')).to.contain('_utils.resolve(_ctx, ["x"])');
    expect(body('{% for i in x %}{% endfor %}')).to.contain('_utils.resolve(_ctx, ["x"])');
    expect(body('{% firstof x "z" %}')).to.contain('_utils.resolve(_ctx, ["x"])');
    expect(body('{% if x|upper %}Y{% endif %}{% for i in x %}{% endfor %}{% firstof x "z" %}')).to.not.contain(', "")');
  });
});
