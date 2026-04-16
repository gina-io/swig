var parser = require('@rhinostone/swig-twig/lib/parser'),
  lexer = require('@rhinostone/swig-twig/lib/lexer'),
  expect = require('expect.js');

/*!
 * Phase 3 Session 5 — Twig expression parser.
 *
 * Covers the swig-shared expression subset: literals, VarRef, member
 * access (dot + bracket), function calls, arrays, objects, comparators,
 * logic, operators, paren grouping, filter chains, and INTERP_OPEN /
 * INTERP_CLOSE (string interpolation) lowering to BinaryOp('+', ...).
 *
 * CVE-2023-25345 _dangerousProps guards on VAR segments, DOTKEY,
 * STRING-in-bracket, and FUNCTION/FUNCTIONEMPTY callee names.
 */
describe('@rhinostone/swig-twig — parser (expression subset)', function () {

  function parse(str, filters, posOut) {
    var tokens = lexer.read(str);
    return parser.parseExpr(tokens, filters, posOut);
  }

  /* ---- Literals -------------------------------------------------- */

  describe('literals', function () {
    it('parses a double-quoted string', function () {
      var node = parse('"hello"');
      expect(node.type).to.equal('Literal');
      expect(node.kind).to.equal('string');
      expect(node.value).to.equal('hello');
    });

    it('parses a single-quoted string', function () {
      var node = parse("'world'");
      expect(node.type).to.equal('Literal');
      expect(node.kind).to.equal('string');
      expect(node.value).to.equal('world');
    });

    it('parses an integer', function () {
      var node = parse('42');
      expect(node.type).to.equal('Literal');
      expect(node.kind).to.equal('number');
      expect(node.value).to.equal(42);
    });

    it('parses a float', function () {
      var node = parse('3.14');
      expect(node.type).to.equal('Literal');
      expect(node.kind).to.equal('number');
      expect(node.value).to.equal(3.14);
    });

    it('parses true', function () {
      var node = parse('true ');
      expect(node.type).to.equal('Literal');
      expect(node.kind).to.equal('bool');
      expect(node.value).to.equal(true);
    });

    it('parses false', function () {
      var node = parse('false ');
      expect(node.type).to.equal('Literal');
      expect(node.kind).to.equal('bool');
      expect(node.value).to.equal(false);
    });
  });

  /* ---- VarRef + member access ------------------------------------ */

  describe('VarRef and member access', function () {
    it('parses a simple variable', function () {
      var node = parse('foo');
      expect(node.type).to.equal('VarRef');
      expect(node.path).to.eql(['foo']);
    });

    it('parses a dot-path variable', function () {
      var node = parse('user.profile.name');
      expect(node.type).to.equal('VarRef');
      expect(node.path).to.eql(['user', 'profile', 'name']);
    });

    it('parses a DOTKEY after a VarRef', function () {
      var node = parse('foo.bar');
      expect(node.type).to.equal('VarRef');
      expect(node.path).to.eql(['foo', 'bar']);
    });

    it('parses bracket access with a string key', function () {
      var node = parse('foo["bar"]');
      expect(node.type).to.equal('Access');
      expect(node.object.type).to.equal('VarRef');
      expect(node.object.path).to.eql(['foo']);
      expect(node.key.type).to.equal('Literal');
      expect(node.key.value).to.equal('bar');
    });

    it('parses bracket access with a variable key', function () {
      var node = parse('foo[idx]');
      expect(node.type).to.equal('Access');
      expect(node.key.type).to.equal('VarRef');
      expect(node.key.path).to.eql(['idx']);
    });

    it('chains dot and bracket access', function () {
      var node = parse('a.b["c"]');
      expect(node.type).to.equal('Access');
      expect(node.object.type).to.equal('VarRef');
      expect(node.object.path).to.eql(['a', 'b']);
      expect(node.key.value).to.equal('c');
    });
  });

  /* ---- Function calls -------------------------------------------- */

  describe('function calls', function () {
    it('parses a no-arg function call', function () {
      var node = parse('now()');
      expect(node.type).to.equal('FnCall');
      expect(node.callee.type).to.equal('VarRef');
      expect(node.callee.path).to.eql(['now']);
      expect(node.args).to.have.length(0);
    });

    it('parses a function call with arguments', function () {
      var node = parse('range(1, 10)');
      expect(node.type).to.equal('FnCall');
      expect(node.callee.path).to.eql(['range']);
      expect(node.args).to.have.length(2);
      expect(node.args[0].value).to.equal(1);
      expect(node.args[1].value).to.equal(10);
    });

    it('parses method-style chaining via dot + paren', function () {
      var node = parse('foo.bar()');
      expect(node.type).to.equal('FnCall');
      expect(node.callee.type).to.equal('VarRef');
      expect(node.callee.path).to.eql(['foo', 'bar']);
      expect(node.args).to.have.length(0);
    });
  });

  /* ---- Array and object literals --------------------------------- */

  describe('array and object literals', function () {
    it('parses an empty array', function () {
      var node = parse('[]');
      expect(node.type).to.equal('ArrayLiteral');
      expect(node.elements).to.have.length(0);
    });

    it('parses an array with elements', function () {
      var node = parse('[1, 2, 3]');
      expect(node.type).to.equal('ArrayLiteral');
      expect(node.elements).to.have.length(3);
      expect(node.elements[0].value).to.equal(1);
      expect(node.elements[2].value).to.equal(3);
    });

    it('parses an empty object', function () {
      var node = parse('{}');
      expect(node.type).to.equal('ObjectLiteral');
      expect(node.properties).to.have.length(0);
    });

    it('parses an object with string keys', function () {
      var node = parse('{"a": 1, "b": 2}');
      expect(node.type).to.equal('ObjectLiteral');
      expect(node.properties).to.have.length(2);
      expect(node.properties[0].key.value).to.equal('a');
      expect(node.properties[0].value.value).to.equal(1);
    });

    it('parses an object with bare identifier keys', function () {
      var node = parse('{name: "Swig"}');
      expect(node.type).to.equal('ObjectLiteral');
      expect(node.properties[0].key.value).to.equal('name');
      expect(node.properties[0].value.value).to.equal('Swig');
    });
  });

  /* ---- Binary operators ------------------------------------------ */

  describe('binary operators', function () {
    it('parses addition', function () {
      var node = parse('a + 1');
      expect(node.type).to.equal('BinaryOp');
      expect(node.op).to.equal('+');
      expect(node.left.path).to.eql(['a']);
      expect(node.right.value).to.equal(1);
    });

    it('respects precedence: * binds tighter than +', function () {
      var node = parse('a + b * c');
      expect(node.type).to.equal('BinaryOp');
      expect(node.op).to.equal('+');
      expect(node.right.type).to.equal('BinaryOp');
      expect(node.right.op).to.equal('*');
    });

    it('respects precedence: && binds tighter than ||', function () {
      var node = parse('a || b && c');
      expect(node.type).to.equal('BinaryOp');
      expect(node.op).to.equal('||');
      expect(node.right.type).to.equal('BinaryOp');
      expect(node.right.op).to.equal('&&');
    });

    it('parses comparators', function () {
      var node = parse('x == 1');
      expect(node.type).to.equal('BinaryOp');
      expect(node.op).to.equal('==');
    });

    it('parses the in comparator', function () {
      var node = parse('x in items');
      expect(node.type).to.equal('BinaryOp');
      expect(node.op).to.equal('in');
    });

    it('parses grouped sub-expressions', function () {
      var node = parse('(a + b) * c');
      expect(node.type).to.equal('BinaryOp');
      expect(node.op).to.equal('*');
      expect(node.left.type).to.equal('BinaryOp');
      expect(node.left.op).to.equal('+');
    });
  });

  /* ---- Unary operators ------------------------------------------- */

  describe('unary operators', function () {
    it('parses not (!)', function () {
      var node = parse('!x');
      expect(node.type).to.equal('UnaryOp');
      expect(node.op).to.equal('!');
      expect(node.operand.path).to.eql(['x']);
    });

    it('parses not (keyword)', function () {
      var node = parse('not x');
      expect(node.type).to.equal('UnaryOp');
      expect(node.op).to.equal('!');
    });

    it('parses unary minus before a variable', function () {
      var node = parse('-x');
      expect(node.type).to.equal('UnaryOp');
      expect(node.op).to.equal('-');
      expect(node.operand.path).to.eql(['x']);
    });
  });

  /* ---- Filter chains --------------------------------------------- */

  describe('filter chains', function () {
    it('parses a simple filter (FILTEREMPTY)', function () {
      var node = parse('name|upper');
      expect(node.type).to.equal('FilterCall');
      expect(node.name).to.equal('upper');
      expect(node.input.type).to.equal('VarRef');
      expect(node.input.path).to.eql(['name']);
    });

    it('parses a filter with args (FILTER)', function () {
      var node = parse('name|default("anon")');
      expect(node.type).to.equal('FilterCall');
      expect(node.name).to.equal('default');
      expect(node.args).to.have.length(1);
      expect(node.args[0].value).to.equal('anon');
    });

    it('chains multiple filters', function () {
      var node = parse('name|upper|reverse');
      expect(node.type).to.equal('FilterCall');
      expect(node.name).to.equal('reverse');
      expect(node.input.type).to.equal('FilterCall');
      expect(node.input.name).to.equal('upper');
    });

    it('filter binds to the preceding atom in binary ops', function () {
      var node = parse('a + b|upper');
      expect(node.type).to.equal('BinaryOp');
      expect(node.op).to.equal('+');
      expect(node.right.type).to.equal('FilterCall');
      expect(node.right.name).to.equal('upper');
      expect(node.right.input.path).to.eql(['b']);
    });
  });

  /* ---- String interpolation -------------------------------------- */

  describe('string interpolation (INTERP_OPEN / INTERP_CLOSE)', function () {
    it('lowers "hello #{name}" to BinaryOp(+)', function () {
      var node = parse('"hello #{name}"');
      expect(node.type).to.equal('BinaryOp');
      expect(node.op).to.equal('+');
      // "hello " + name + ""
      expect(node.left.type).to.equal('BinaryOp');
      expect(node.left.left.value).to.equal('hello ');
      expect(node.left.right.type).to.equal('VarRef');
      expect(node.left.right.path).to.eql(['name']);
      expect(node.right.type).to.equal('Literal');
      expect(node.right.value).to.equal('');
    });

    it('lowers pure interpolation "#{n}" with leading empty string', function () {
      var node = parse('"#{n}"');
      // "" + n + ""
      expect(node.type).to.equal('BinaryOp');
      expect(node.op).to.equal('+');
      expect(node.left.type).to.equal('BinaryOp');
      expect(node.left.left.value).to.equal('');
      expect(node.left.right.path).to.eql(['n']);
      expect(node.right.value).to.equal('');
    });

    it('lowers multiple interpolations', function () {
      var node = parse('"#{a} and #{b}"');
      // "" + a + " and " + b + ""
      expect(node.type).to.equal('BinaryOp');
      expect(node.op).to.equal('+');
    });

    it('handles interpolation with expressions inside', function () {
      var node = parse('"total: #{a + b}"');
      // "total: " + (a + b) + ""
      expect(node.left.right.type).to.equal('BinaryOp');
      expect(node.left.right.op).to.equal('+');
    });

    it('does not interpolate single-quoted strings', function () {
      var node = parse("'hello #{name}'");
      expect(node.type).to.equal('Literal');
      expect(node.kind).to.equal('string');
    });
  });

  /* ---- Partial consumption / _posOut ----------------------------- */

  describe('partial consumption', function () {
    it('throws on trailing tokens by default', function () {
      expect(function () {
        parse('a b');
      }).to.throwException(/Unexpected token/);
    });

    it('returns partial result with _posOut', function () {
      var tokens = lexer.read('a b');
      var posOut = {};
      var node = parser.parseExpr(tokens, {}, posOut);
      expect(node.type).to.equal('VarRef');
      expect(node.path).to.eql(['a']);
      expect(posOut.pos).to.be.a('number');
      expect(posOut.pos).to.be.lessThan(tokens.length);
    });
  });

  /* ---- CVE-2023-25345 _dangerousProps guards --------------------- */

  describe('CVE-2023-25345: _dangerousProps', function () {
    it('blocks __proto__ in VAR', function () {
      expect(function () { parse('__proto__'); }).to.throwException(/Unsafe access.*__proto__/);
    });

    it('blocks constructor in VAR', function () {
      expect(function () { parse('constructor'); }).to.throwException(/Unsafe access.*constructor/);
    });

    it('blocks prototype in VAR', function () {
      expect(function () { parse('prototype'); }).to.throwException(/Unsafe access.*prototype/);
    });

    it('blocks __proto__ in dot-path VAR', function () {
      expect(function () { parse('foo.__proto__'); }).to.throwException(/Unsafe access.*__proto__/);
    });

    it('blocks __proto__ in DOTKEY', function () {
      expect(function () {
        var tokens = lexer.read('foo');
        tokens.push({ type: 14, match: '__proto__', length: 9 });
        parser.parseExpr(tokens, {});
      }).to.throwException(/Unsafe access.*__proto__/);
    });

    it('blocks __proto__ in bracket-string access', function () {
      expect(function () { parse('foo["__proto__"]'); }).to.throwException(/Unsafe access.*__proto__.*bracket/);
    });

    it('blocks constructor in bracket-string access', function () {
      expect(function () { parse('foo["constructor"]'); }).to.throwException(/Unsafe access.*constructor.*bracket/);
    });

    it('blocks __proto__ in FUNCTION callee', function () {
      expect(function () { parse('__proto__("x")'); }).to.throwException(/Unsafe access.*__proto__/);
    });

    it('blocks __proto__ in FUNCTIONEMPTY callee', function () {
      expect(function () { parse('__proto__()'); }).to.throwException(/Unsafe access.*__proto__/);
    });

    it('does not block __proto__ in array literal string values', function () {
      var node = parse('["__proto__"]');
      expect(node.type).to.equal('ArrayLiteral');
      expect(node.elements[0].value).to.equal('__proto__');
    });
  });

  /* ---- Reserved keywords ----------------------------------------- */

  describe('reserved keywords', function () {
    it('rejects JS reserved words as variable names', function () {
      expect(function () { parse('delete'); }).to.throwException(/Reserved keyword/);
    });

    it('rejects JS reserved words as function names', function () {
      expect(function () { parse('return()'); }).to.throwException(/Reserved keyword/);
    });
  });

  /* ---- Edge cases ------------------------------------------------ */

  describe('edge cases', function () {
    it('parses deeply nested expressions', function () {
      var node = parse('a.b["c"].d(1, 2)');
      expect(node.type).to.equal('FnCall');
      expect(node.args).to.have.length(2);
    });

    it('parses empty string literal', function () {
      var node = parse('""');
      expect(node.type).to.equal('Literal');
      expect(node.value).to.equal('');
    });

    it('parses a negative numeric literal', function () {
      var node = parse('-42');
      expect(node.type).to.equal('Literal');
      expect(node.kind).to.equal('number');
      expect(node.value).to.equal(-42);
    });
  });

});
