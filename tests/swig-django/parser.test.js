var parser = require('@rhinostone/swig-django/lib/parser'),
  lexer = require('@rhinostone/swig-django/lib/lexer'),
  expect = require('../lib/expect.js');


/*!
 * Django expression parser — IR-shape coverage.
 *
 * Asserts parseExpr lowers Django expressions to the right swig-core IRExpr
 * shapes (the same shapes the shared backend emits for the native / Twig /
 * Jinja2 frontends), that colon-filters and the `is` / `is not` identity
 * lowering work, that the inherited (lenient) parens / arithmetic /
 * function-call machinery still parses, and that the CVE-2023-25345 guards
 * fire on every dangerous path.
 */
describe('@rhinostone/swig-django — parser (expression grammar)', function () {

  function parse(str, filters) { return parser.parseExpr(lexer.read(str), filters); }

  /* ---- Literals ------------------------------------------------ */

  it('lowers string / number / boolean / None literals', function () {
    expect(parse("'hi'")).to.eql({ type: 'Literal', kind: 'string', value: 'hi' });
    expect(parse('42')).to.eql({ type: 'Literal', kind: 'number', value: 42 });
    expect(parse('3.5')).to.eql({ type: 'Literal', kind: 'number', value: 3.5 });
    expect(parse('True')).to.eql({ type: 'Literal', kind: 'bool', value: true });
    expect(parse('False')).to.eql({ type: 'Literal', kind: 'bool', value: false });
    expect(parse('None')).to.eql({ type: 'Literal', kind: 'null', value: null });
  });

  /* ---- Variable references ------------------------------------- */

  it('lowers a bare identifier to VarRef', function () {
    expect(parse('name')).to.eql({ type: 'VarRef', path: ['name'], resolve: true });
  });

  it('folds a dotted path into a single VarRef', function () {
    expect(parse('user.profile.name')).to.eql({ type: 'VarRef', path: ['user', 'profile', 'name'], resolve: true });
  });

  /* ---- Colon-filters ------------------------------------------- */

  it('lowers a no-arg filter to FilterCall with no args', function () {
    expect(parse('x|upper')).to.eql({
      type: 'FilterCall', name: 'upper', input: { type: 'VarRef', path: ['x'], resolve: true }
    });
  });

  it('lowers a colon-filter with a string argument', function () {
    expect(parse('x|default:"none"')).to.eql({
      type: 'FilterCall', name: 'default', input: { type: 'VarRef', path: ['x'], resolve: true },
      args: [{ type: 'Literal', kind: 'string', value: 'none' }]
    });
  });

  it('lowers a colon-filter with a variable argument', function () {
    expect(parse('x|add:y')).to.eql({
      type: 'FilterCall', name: 'add', input: { type: 'VarRef', path: ['x'], resolve: true },
      args: [{ type: 'VarRef', path: ['y'], resolve: true }]
    });
  });

  it('lowers a colon-filter with a negative-number argument', function () {
    expect(parse('x|floatformat:-3')).to.eql({
      type: 'FilterCall', name: 'floatformat', input: { type: 'VarRef', path: ['x'], resolve: true },
      args: [{ type: 'Literal', kind: 'number', value: -3 }]
    });
  });

  it('chains filters left-to-right (the trailing filter wraps the result)', function () {
    expect(parse('x|lower|upper')).to.eql({
      type: 'FilterCall', name: 'upper',
      input: { type: 'FilterCall', name: 'lower', input: { type: 'VarRef', path: ['x'], resolve: true } }
    });
  });

  it('does not let a colon-filter argument greedily swallow a trailing filter', function () {
    // `x|default:y|upper` — `|upper` applies to the whole `x|default:y`
    // result, NOT to the `y` argument.
    expect(parse('x|default:y|upper')).to.eql({
      type: 'FilterCall', name: 'upper',
      input: {
        type: 'FilterCall', name: 'default', input: { type: 'VarRef', path: ['x'], resolve: true },
        args: [{ type: 'VarRef', path: ['y'], resolve: true }]
      }
    });
  });

  it('throws "Invalid filter" when the name maps to a non-function in the catalog', function () {
    expect(function () { parse('x|nope', { nope: 'not a function' }); }).to.throwError(/Invalid filter/);
  });

  /* ---- is / is not (identity) --------------------------------- */

  it('lowers `x is None` to !VarRefExists (defined-and-non-null negated)', function () {
    expect(parse('x is None')).to.eql({
      type: 'UnaryOp', op: '!', operand: { type: 'VarRefExists', path: ['x'] }
    });
  });

  it('lowers `x is not None` to VarRefExists', function () {
    expect(parse('x is not None')).to.eql({ type: 'VarRefExists', path: ['x'] });
  });

  it('lowers `x is True` to an identity BinaryOp (===)', function () {
    expect(parse('x is True')).to.eql({
      type: 'BinaryOp', op: '===',
      left: { type: 'VarRef', path: ['x'], resolve: true },
      right: { type: 'Literal', kind: 'bool', value: true }
    });
  });

  it('lowers `x is not False` to an identity BinaryOp (!==)', function () {
    expect(parse('x is not False')).to.eql({
      type: 'BinaryOp', op: '!==',
      left: { type: 'VarRef', path: ['x'], resolve: true },
      right: { type: 'Literal', kind: 'bool', value: false }
    });
  });

  /* ---- Comparison / logic / arithmetic (lenient superset) ----- */

  it('lowers a comparison to BinaryOp', function () {
    expect(parse('a == b')).to.eql({
      type: 'BinaryOp', op: '==',
      left: { type: 'VarRef', path: ['a'], resolve: true }, right: { type: 'VarRef', path: ['b'], resolve: true }
    });
  });

  it('lowers and / or logic to BinaryOp', function () {
    expect(parse('a and b')).to.eql({
      type: 'BinaryOp', op: '&&',
      left: { type: 'VarRef', path: ['a'], resolve: true }, right: { type: 'VarRef', path: ['b'], resolve: true }
    });
  });

  it('keeps inherited arithmetic (lenient — not Django syntax, but accepted)', function () {
    expect(parse('a + b')).to.eql({
      type: 'BinaryOp', op: '+',
      left: { type: 'VarRef', path: ['a'], resolve: true }, right: { type: 'VarRef', path: ['b'], resolve: true }
    });
  });

  it('keeps inherited parenthesis grouping', function () {
    expect(parse('(a or b) and c')).to.eql({
      type: 'BinaryOp', op: '&&',
      left: {
        type: 'BinaryOp', op: '||',
        left: { type: 'VarRef', path: ['a'], resolve: true }, right: { type: 'VarRef', path: ['b'], resolve: true }
      },
      right: { type: 'VarRef', path: ['c'], resolve: true }
    });
  });

  it('keeps inherited function-call syntax', function () {
    expect(parse('foo(bar)')).to.eql({
      type: 'FnCall', callee: { type: 'VarRef', path: ['foo'] },
      args: [{ type: 'VarRef', path: ['bar'], resolve: true }]
    });
  });

  /* ---- CVE-2023-25345 guards ---------------------------------- */

  it('blocks __proto__ / constructor / prototype as a bare identifier', function () {
    expect(function () { parse('__proto__'); }).to.throwError(/CVE-2023-25345/);
    expect(function () { parse('constructor'); }).to.throwError(/CVE-2023-25345/);
    expect(function () { parse('prototype'); }).to.throwError(/CVE-2023-25345/);
  });

  it('blocks a dangerous dotted-path segment', function () {
    expect(function () { parse('foo.__proto__'); }).to.throwError(/CVE-2023-25345/);
    expect(function () { parse('foo.constructor'); }).to.throwError(/CVE-2023-25345/);
  });

  it('blocks a dangerous bracket-string access', function () {
    expect(function () { parse('foo["__proto__"]'); }).to.throwError(/CVE-2023-25345/);
  });

  it('blocks a dangerous variable inside a colon-filter argument', function () {
    expect(function () { parse('x|default:__proto__'); }).to.throwError(/CVE-2023-25345/);
  });

});
