var backend = require('@rhinostone/swig-core/lib/backend'),
  ir = require('@rhinostone/swig-core/lib/ir'),
  swigModule = require('../../lib/swig'),
  twigModule = require('@rhinostone/swig-twig'),
  jinja2Module = require('@rhinostone/swig-jinja2'),
  djangoModule = require('@rhinostone/swig-django'),
  expect = require('../lib/expect.js');

/*!
 * The IR tree carries the grouping a template writes with parentheses:
 * `(1 + 2) * 3` parses to a `*` node whose left operand is the `+` node.
 * The emitted JavaScript has to keep it. A nested binary operand, and a
 * binary or unary operand under a unary prefix or a subscript, are wrapped
 * in parentheses; otherwise JavaScript's own precedence and associativity
 * regroup the expression (`1 + 2 * 3`, `x || y && z`, `--x`).
 */

function num(n) { return ir.literal('number', n); }
function bool(b) { return ir.literal('bool', b); }
function str(s) { return ir.literal('string', s); }

describe('swig-core/lib/backend — grouping of nested operands', function () {
  it('wraps a nested binary operand on either side', function () {
    expect(backend.emitExpr(ir.binaryOp('*', ir.binaryOp('+', num(1), num(2)), num(3)))).to.be('(1 + 2) * 3');
    expect(backend.emitExpr(ir.binaryOp('-', num(10), ir.binaryOp('+', num(2), num(3))))).to.be('10 - (2 + 3)');
    expect(backend.emitExpr(ir.binaryOp('&&', ir.binaryOp('||', bool(true), bool(false)), bool(false)))).to.be('(true||false)&&false');
  });

  it('wraps a binary or unary object under a subscript', function () {
    expect(backend.emitExpr(ir.access(ir.binaryOp('+', str('a'), str('b')), num(1)))).to.be('("a" + "b")[1]');
    expect(backend.emitExpr(ir.access(ir.unaryOp('-', num(1)), num(0)))).to.be('(-1)[0]');
  });

  it('wraps a unary operand under a unary prefix', function () {
    expect(backend.emitExpr(ir.unaryOp('-', ir.unaryOp('-', num(3))))).to.be('-(-3)');
  });

  it('leaves a top-level binary operator on literal operands unwrapped', function () {
    expect(backend.emitExpr(ir.binaryOp('+', num(1), num(2)))).to.be('1 + 2');
  });
});

var flavors = [
  ['native', swigModule.Swig],
  ['twig', twigModule.Twig],
  ['jinja2', jinja2Module.Jinja2],
  ['django', djangoModule.Django]
];

// [template, locals, expected output]. The `[Y]` row is the positive
// control: the same condition with z true has to render its branch.
var cases = [
  ['{{ (1 + 2) * 3 }}', {}, '9'],
  ['{{ 2 * (3 + 4) }}', {}, '14'],
  ['{{ 10 - (2 + 3) }}', {}, '5'],
  ['[{% if (x or y) and z %}Y{% endif %}]', { x: true, y: false, z: false }, '[]'],
  ['[{% if (x or y) and z %}Y{% endif %}]', { x: true, y: false, z: true }, '[Y]'],
  ['[{% if x and (y or z) %}Y{% endif %}]', { x: false, y: false, z: true }, '[]'],
  ['{{ -(-x) }}', { x: 3 }, '3'],
  ['{{ ("a" + "b")[1] }}', {}, 'b'],
  ['{{ a == (b == c) }}', { a: false, b: 1, c: 2 }, 'true']
];

flavors.forEach(function (flavor) {
  describe('grouped expressions render as written — ' + flavor[0], function () {
    cases.forEach(function (c) {
      it(c[0] + ' with ' + JSON.stringify(c[1]) + ' renders ' + c[2], function () {
        var engine = new flavor[1]();
        expect(engine.render(c[0], { locals: c[1] })).to.be(c[2]);
      });
    });
  });
});
