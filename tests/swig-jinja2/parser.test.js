var parser = require('@rhinostone/swig-jinja2/lib/parser'),
  lexer = require('@rhinostone/swig-jinja2/lib/lexer'),
  expect = require('expect.js');


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
