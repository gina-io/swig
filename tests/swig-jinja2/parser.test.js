var parser = require('@rhinostone/swig-jinja2/lib/parser'),
  lexer = require('@rhinostone/swig-jinja2/lib/lexer'),
  expect = require('../lib/expect.js');


/*!
 * Jinja2 expression parser over the swig-shared subset.
 *
 * Asserts parseExpr lowers shared-subset expressions to the right
 * swig-core IRExpr shapes (the same shapes the shared backend already
 * emits for the native + Twig frontends) and that the CVE-2023-25345
 * guards fire on every dangerous path. Jinja2-only operators (`~`, `**`,
 * `//`, inline `if`/`else`, `is` tests) get their own coverage as those
 * productions land.
 */
describe('@rhinostone/swig-jinja2 — parser (expression subset)', function () {

  function parse(str, filters) { return parser.parseExpr(lexer.read(str), filters); }

  /* ---- Literals ------------------------------------------------ */

  it('lowers string / number / boolean literals', function () {
    expect(parse("'hi'")).to.eql({ type: 'Literal', kind: 'string', value: 'hi' });
    expect(parse('42')).to.eql({ type: 'Literal', kind: 'number', value: 42 });
    expect(parse('3.5')).to.eql({ type: 'Literal', kind: 'number', value: 3.5 });
    expect(parse('true')).to.eql({ type: 'Literal', kind: 'bool', value: true });
    expect(parse('false')).to.eql({ type: 'Literal', kind: 'bool', value: false });
  });

  /* ---- Variable references & access ---------------------------- */

  it('lowers a bare identifier to VarRef', function () {
    expect(parse('name')).to.eql({ type: 'VarRef', path: ['name'] });
  });

  it('folds a dotted path into a single VarRef', function () {
    expect(parse('user.profile.name')).to.eql({ type: 'VarRef', path: ['user', 'profile', 'name'] });
  });

  it('lowers numeric bracket access to Access', function () {
    var ir = parse('arr[0]');
    expect(ir.type).to.equal('Access');
    expect(ir.object).to.eql({ type: 'VarRef', path: ['arr'] });
    expect(ir.key).to.eql({ type: 'Literal', kind: 'number', value: 0 });
  });

  it('lowers string bracket access to Access', function () {
    var ir = parse("obj['key']");
    expect(ir.type).to.equal('Access');
    expect(ir.key).to.eql({ type: 'Literal', kind: 'string', value: 'key' });
  });

  /* ---- Operator precedence ------------------------------------- */

  it('binds * tighter than +', function () {
    var ir = parse('a + b * c');
    expect(ir.type).to.equal('BinaryOp');
    expect(ir.op).to.equal('+');
    expect(ir.left).to.eql({ type: 'VarRef', path: ['a'] });
    expect(ir.right.type).to.equal('BinaryOp');
    expect(ir.right.op).to.equal('*');
  });

  it('parses subtraction left-associatively', function () {
    var ir = parse('a - b - c');
    expect(ir.op).to.equal('-');
    expect(ir.left.type).to.equal('BinaryOp');
    expect(ir.left.op).to.equal('-');
    expect(ir.right).to.eql({ type: 'VarRef', path: ['c'] });
  });

  it('binds `and` tighter than `or`', function () {
    var ir = parse('a and b or c');
    expect(ir.op).to.equal('||');
    expect(ir.left.type).to.equal('BinaryOp');
    expect(ir.left.op).to.equal('&&');
    expect(ir.right).to.eql({ type: 'VarRef', path: ['c'] });
  });

  it('lowers comparisons including the `in` keyword', function () {
    expect(parse('a == b').op).to.equal('==');
    expect(parse('a != b').op).to.equal('!=');
    expect(parse('a < b').op).to.equal('<');
    expect(parse('x in items').op).to.equal('in');
  });

  it('honours parenthesised grouping over precedence', function () {
    var ir = parse('(a + b) * c');
    expect(ir.op).to.equal('*');
    expect(ir.left.type).to.equal('BinaryOp');
    expect(ir.left.op).to.equal('+');
  });

  /* ---- Unary --------------------------------------------------- */

  it('lowers `not` to a UnaryOp(!)', function () {
    expect(parse('not done')).to.eql({ type: 'UnaryOp', op: '!', operand: { type: 'VarRef', path: ['done'] } });
  });

  it('lowers a leading minus to a UnaryOp(-)', function () {
    expect(parse('-x')).to.eql({ type: 'UnaryOp', op: '-', operand: { type: 'VarRef', path: ['x'] } });
  });

  /* ---- Collections --------------------------------------------- */

  it('lowers an array literal', function () {
    var ir = parse('[1, 2, 3]');
    expect(ir.type).to.equal('ArrayLiteral');
    expect(ir.elements).to.have.length(3);
    expect(ir.elements[0]).to.eql({ type: 'Literal', kind: 'number', value: 1 });
  });

  it('lowers an object literal with string and bare-word keys', function () {
    var ir = parse("{ 'a': 1, b: 2 }");
    expect(ir.type).to.equal('ObjectLiteral');
    expect(ir.properties).to.have.length(2);
    expect(ir.properties[0].key).to.eql({ type: 'Literal', kind: 'string', value: 'a' });
    expect(ir.properties[1].key).to.eql({ type: 'Literal', kind: 'string', value: 'b' });
  });

  /* ---- Calls & filters ----------------------------------------- */

  it('lowers a function call with args to FnCall', function () {
    var ir = parse('range(10)');
    expect(ir.type).to.equal('FnCall');
    expect(ir.callee).to.eql({ type: 'VarRef', path: ['range'] });
    expect(ir.args).to.have.length(1);
  });

  it('lowers an empty function call to FnCall with no args', function () {
    var ir = parse('now()');
    expect(ir.type).to.equal('FnCall');
    expect(ir.args).to.have.length(0);
  });

  it('lowers a bare filter to FilterCall', function () {
    var ir = parse('x|upper');
    expect(ir.type).to.equal('FilterCall');
    expect(ir.name).to.equal('upper');
    expect(ir.input).to.eql({ type: 'VarRef', path: ['x'] });
  });

  it('lowers a filter with args, carrying the args', function () {
    var ir = parse("x|join(', ')");
    expect(ir.type).to.equal('FilterCall');
    expect(ir.name).to.equal('join');
    expect(ir.args).to.have.length(1);
    expect(ir.args[0]).to.eql({ type: 'Literal', kind: 'string', value: ', ' });
  });

  it('chains filters left-to-right', function () {
    var ir = parse('x|upper|reverse');
    expect(ir.type).to.equal('FilterCall');
    expect(ir.name).to.equal('reverse');
    expect(ir.input.type).to.equal('FilterCall');
    expect(ir.input.name).to.equal('upper');
  });

  it('rejects a filter name present in the catalog but not a function', function () {
    expect(function () { parse('x|bad', { bad: 42 }); }).to.throwError(/Invalid filter/);
  });

  /* ---- Jinja2-only operators ----------------------------------- */

  it('lowers ~ to a BinaryOp(~) string-concatenation', function () {
    var ir = parse('a ~ b');
    expect(ir).to.eql({ type: 'BinaryOp', op: '~', left: { type: 'VarRef', path: ['a'] }, right: { type: 'VarRef', path: ['b'] } });
  });

  it('binds ~ tighter than + (Jinja2/Python precedence)', function () {
    var ir = parse('a ~ b + c');
    expect(ir.op).to.equal('+');
    expect(ir.left.op).to.equal('~');
    expect(ir.right).to.eql({ type: 'VarRef', path: ['c'] });
  });

  it('lowers ** to a Math.pow call', function () {
    var ir = parse('2 ** 3');
    expect(ir.type).to.equal('FnCall');
    expect(ir.callee).to.eql({ type: 'VarRef', path: ['Math', 'pow'] });
    expect(ir.args[0]).to.eql({ type: 'Literal', kind: 'number', value: 2 });
    expect(ir.args[1]).to.eql({ type: 'Literal', kind: 'number', value: 3 });
  });

  it('parses ** right-associatively', function () {
    var ir = parse('2 ** 3 ** 2');
    expect(ir.callee.path).to.eql(['Math', 'pow']);
    expect(ir.args[0]).to.eql({ type: 'Literal', kind: 'number', value: 2 });
    expect(ir.args[1].type).to.equal('FnCall');
    expect(ir.args[1].callee.path).to.eql(['Math', 'pow']);
  });

  it('groups a leading minus outside ** (Python -(2 ** 2))', function () {
    var ir = parse('-2 ** 2');
    expect(ir.type).to.equal('UnaryOp');
    expect(ir.op).to.equal('-');
    expect(ir.operand.type).to.equal('FnCall');
    expect(ir.operand.callee.path).to.eql(['Math', 'pow']);
  });

  it('binds ** tighter than *', function () {
    var ir = parse('2 * 3 ** 2');
    expect(ir.type).to.equal('BinaryOp');
    expect(ir.op).to.equal('*');
    expect(ir.right.type).to.equal('FnCall');
    expect(ir.right.callee.path).to.eql(['Math', 'pow']);
  });

  it('lowers // to Math.floor of the division', function () {
    var ir = parse('7 // 2');
    expect(ir.type).to.equal('FnCall');
    expect(ir.callee).to.eql({ type: 'VarRef', path: ['Math', 'floor'] });
    expect(ir.args).to.have.length(1);
    expect(ir.args[0]).to.eql({ type: 'BinaryOp', op: '/', left: { type: 'Literal', kind: 'number', value: 7 }, right: { type: 'Literal', kind: 'number', value: 2 } });
  });

  it('lowers a full inline-if to a Conditional (then if cond else else)', function () {
    var ir = parse("'yes' if cond else 'no'");
    expect(ir.type).to.equal('Conditional');
    expect(ir.test).to.eql({ type: 'VarRef', path: ['cond'] });
    expect(ir.then).to.eql({ type: 'Literal', kind: 'string', value: 'yes' });
    expect(ir['else']).to.eql({ type: 'Literal', kind: 'string', value: 'no' });
  });

  it('lowers a no-else inline-if to a Conditional with an undefined else', function () {
    var ir = parse("'yes' if cond");
    expect(ir.type).to.equal('Conditional');
    expect(ir.test).to.eql({ type: 'VarRef', path: ['cond'] });
    expect(ir.then).to.eql({ type: 'Literal', kind: 'string', value: 'yes' });
    expect(ir['else']).to.eql({ type: 'Literal', kind: 'undefined', value: undefined });
  });

  it('binds inline-if looser than binary operators', function () {
    var ir = parse('a + b if c else d');
    expect(ir.type).to.equal('Conditional');
    expect(ir.then).to.eql({ type: 'BinaryOp', op: '+', left: { type: 'VarRef', path: ['a'] }, right: { type: 'VarRef', path: ['b'] } });
    expect(ir.test).to.eql({ type: 'VarRef', path: ['c'] });
  });

  it('lowers a generic `is <test>` to an _ext._test_<name> call', function () {
    var ir = parse('x is odd');
    expect(ir.type).to.equal('FnCall');
    expect(ir.callee).to.eql({ type: 'VarRef', path: ['_ext', '_test_odd'] });
    expect(ir.args[0]).to.eql({ type: 'VarRef', path: ['x'] });
  });

  it('passes test arguments through (`is divisibleby(3)`)', function () {
    var ir = parse('x is divisibleby(3)');
    expect(ir.callee.path).to.eql(['_ext', '_test_divisibleby']);
    expect(ir.args).to.have.length(2);
    expect(ir.args[1]).to.eql({ type: 'Literal', kind: 'number', value: 3 });
  });

  it('routes `is defined` on a VarRef through VarRefExists', function () {
    expect(parse('x is defined')).to.eql({ type: 'VarRefExists', path: ['x'] });
  });

  it('routes `is not defined` through a negated VarRefExists', function () {
    var ir = parse('x is not defined');
    expect(ir).to.eql({ type: 'UnaryOp', op: '!', operand: { type: 'VarRefExists', path: ['x'] } });
  });

  it('treats `is none` like a negated existence check on a VarRef', function () {
    var ir = parse('x is none');
    expect(ir).to.eql({ type: 'UnaryOp', op: '!', operand: { type: 'VarRefExists', path: ['x'] } });
  });

  it('wraps `is not <test>` in a unary !', function () {
    var ir = parse('x is not odd');
    expect(ir.type).to.equal('UnaryOp');
    expect(ir.op).to.equal('!');
    expect(ir.operand.type).to.equal('FnCall');
    expect(ir.operand.callee.path).to.eql(['_ext', '_test_odd']);
  });

  it('falls through to the generic helper for a non-VarRef subject', function () {
    var ir = parse('items|first is defined');
    expect(ir.type).to.equal('FnCall');
    expect(ir.callee.path).to.eql(['_ext', '_test_defined']);
    expect(ir.args[0].type).to.equal('FilterCall');
  });

  it('binds `is` tighter than `and`', function () {
    var ir = parse('x is defined and y');
    expect(ir.type).to.equal('BinaryOp');
    expect(ir.op).to.equal('&&');
    expect(ir.left).to.eql({ type: 'VarRefExists', path: ['x'] });
    expect(ir.right).to.eql({ type: 'VarRef', path: ['y'] });
  });

  /* ---- Slice subscripts ---------------------------------------- */

  function sliceArgs(str) {
    var ir = parse(str);
    expect(ir.type).to.equal('FnCall');
    expect(ir.callee).to.eql({ type: 'VarRef', path: ['_utils', 'slice'] });
    return ir.args;
  }

  it('lowers [start:stop] to a _utils.slice call', function () {
    var args = sliceArgs('arr[1:3]');
    expect(args[0]).to.eql({ type: 'VarRef', path: ['arr'] });
    expect(args[1]).to.eql({ type: 'Literal', kind: 'number', value: 1 });
    expect(args[2]).to.eql({ type: 'Literal', kind: 'number', value: 3 });
    expect(args[3]).to.eql({ type: 'Literal', kind: 'undefined', value: undefined });
  });

  it('passes an undefined literal for an omitted start ([:5])', function () {
    var args = sliceArgs('arr[:5]');
    expect(args[1]).to.eql({ type: 'Literal', kind: 'undefined', value: undefined });
    expect(args[2]).to.eql({ type: 'Literal', kind: 'number', value: 5 });
  });

  it('passes an undefined literal for an omitted stop ([2:])', function () {
    var args = sliceArgs('arr[2:]');
    expect(args[1]).to.eql({ type: 'Literal', kind: 'number', value: 2 });
    expect(args[2]).to.eql({ type: 'Literal', kind: 'undefined', value: undefined });
  });

  it('carries the step ([::2] and [::-1])', function () {
    var byTwo = sliceArgs('arr[::2]');
    expect(byTwo[3]).to.eql({ type: 'Literal', kind: 'number', value: 2 });

    var rev = sliceArgs('arr[::-1]');
    expect(rev[3]).to.eql({ type: 'UnaryOp', op: '-', operand: { type: 'Literal', kind: 'number', value: 1 } });
  });

  it('handles a negative start ([-3:])', function () {
    var args = sliceArgs('arr[-3:]');
    expect(args[1]).to.eql({ type: 'UnaryOp', op: '-', operand: { type: 'Literal', kind: 'number', value: 3 } });
  });

  it('still lowers a plain [key] to Access, not a slice', function () {
    var ir = parse('arr[0]');
    expect(ir.type).to.equal('Access');
  });

  /* ---- CVE-2023-25345 guards ----------------------------------- */

  it('blocks __proto__ as a bare variable', function () {
    expect(function () { parse('__proto__'); }).to.throwError(/CVE-2023-25345/);
  });

  it('blocks a dangerous segment inside a dotted path', function () {
    expect(function () { parse('a.__proto__'); }).to.throwError(/CVE-2023-25345/);
    expect(function () { parse('a.constructor'); }).to.throwError(/CVE-2023-25345/);
  });

  it('blocks a dangerous DOTKEY after a bracket access', function () {
    expect(function () { parse('arr[0].__proto__'); }).to.throwError(/CVE-2023-25345/);
  });

  it('blocks a dangerous string bracket key', function () {
    expect(function () { parse("obj['__proto__']"); }).to.throwError(/CVE-2023-25345/);
  });

  it('blocks a dangerous function callee name', function () {
    expect(function () { parse("constructor('return 1')"); }).to.throwError(/CVE-2023-25345/);
  });

  /* ---- Fail-close ---------------------------------------------- */

  it('bails on trailing tokens with no operator', function () {
    expect(function () { parse('a b'); }).to.throwError(/Unexpected token/);
  });

  it('bails on a reserved keyword used as a variable', function () {
    expect(function () { parse('for'); }).to.throwError(/Reserved keyword/);
  });

});


describe('@rhinostone/swig-jinja2 — parser.parse — {% extends %} tag', function () {
  var tags = require('@rhinostone/swig-jinja2/lib/tags');

  it('sets template.parent from a STRING path (static extends)', function () {
    var tree = parser.parse(undefined, '{% extends "layout.html" %}', {}, tags, {});
    expect(tree.parent).to.equal('layout.html');
    expect(tree.parentExpr).to.be(undefined);
  });

  it('lowers a VAR parent to template.parentExpr (dynamic extends)', function () {
    var tree = parser.parse(undefined, '{% extends parent_var %}', { filename: 't.html' }, tags, {});
    expect(tree.parent).to.equal('parent_var');
    expect(tree.parentExpr).to.be.an('object');
    expect(tree.parentExpr.type).to.equal('VarRef');
    expect(tree.parentExpr.path).to.eql(['parent_var']);
  });

  it('lowers an inline-if parent to template.parentExpr (dynamic extends)', function () {
    var tree = parser.parse(undefined, '{% extends full if cond else partial %}', { filename: 't.html' }, tags, {});
    expect(tree.parentExpr).to.be.an('object');
    expect(tree.parentExpr.type).to.equal('Conditional');
  });
});
