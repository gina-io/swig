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

  /* ---- Twig-only binary operators: TILDE, NULLCOALESCE ----------- */

  describe('tilde (~) string concatenation', function () {
    it('parses a ~ b as BinaryOp(~)', function () {
      var node = parse('a ~ b');
      expect(node.type).to.equal('BinaryOp');
      expect(node.op).to.equal('~');
      expect(node.left.path).to.eql(['a']);
      expect(node.right.path).to.eql(['b']);
    });

    it('binds tighter than + (a + b ~ c → a + (b ~ c))', function () {
      var node = parse('a + b ~ c');
      expect(node.type).to.equal('BinaryOp');
      expect(node.op).to.equal('+');
      expect(node.left.path).to.eql(['a']);
      expect(node.right.type).to.equal('BinaryOp');
      expect(node.right.op).to.equal('~');
      expect(node.right.left.path).to.eql(['b']);
      expect(node.right.right.path).to.eql(['c']);
    });

    it('binds looser than * (a ~ b * c → a ~ (b * c))', function () {
      var node = parse('a ~ b * c');
      expect(node.type).to.equal('BinaryOp');
      expect(node.op).to.equal('~');
      expect(node.left.path).to.eql(['a']);
      expect(node.right.type).to.equal('BinaryOp');
      expect(node.right.op).to.equal('*');
    });

    it('is left-associative (a ~ b ~ c → (a ~ b) ~ c)', function () {
      var node = parse('a ~ b ~ c');
      expect(node.type).to.equal('BinaryOp');
      expect(node.op).to.equal('~');
      expect(node.left.type).to.equal('BinaryOp');
      expect(node.left.op).to.equal('~');
      expect(node.left.left.path).to.eql(['a']);
      expect(node.left.right.path).to.eql(['b']);
      expect(node.right.path).to.eql(['c']);
    });
  });

  describe('range (..)', function () {
    it('lowers a..b to FnCall(_range, [a, b])', function () {
      var node = parse('1..3');
      expect(node.type).to.equal('FnCall');
      expect(node.callee.type).to.equal('VarRef');
      expect(node.callee.path).to.eql(['_range']);
      expect(node.args).to.have.length(2);
      expect(node.args[0].value).to.equal(1);
      expect(node.args[1].value).to.equal(3);
    });

    it('binds looser than + (1..3 + 1 → _range(1, 3+1))', function () {
      var node = parse('1..3 + 1');
      expect(node.type).to.equal('FnCall');
      expect(node.callee.path).to.eql(['_range']);
      expect(node.args[0].value).to.equal(1);
      expect(node.args[1].type).to.equal('BinaryOp');
      expect(node.args[1].op).to.equal('+');
      expect(node.args[1].left.value).to.equal(3);
      expect(node.args[1].right.value).to.equal(1);
    });

    it('binds tighter than && (a..b && c → (_range(a,b)) && c)', function () {
      var node = parse('1..3 && x');
      expect(node.type).to.equal('BinaryOp');
      expect(node.op).to.equal('&&');
      expect(node.left.type).to.equal('FnCall');
      expect(node.left.callee.path).to.eql(['_range']);
      expect(node.right.path).to.eql(['x']);
    });

    it('is left-associative (a..b..c → _range(_range(a,b), c))', function () {
      var node = parse('1..2..3');
      expect(node.type).to.equal('FnCall');
      expect(node.callee.path).to.eql(['_range']);
      expect(node.args[0].type).to.equal('FnCall');
      expect(node.args[0].callee.path).to.eql(['_range']);
      expect(node.args[0].args[0].value).to.equal(1);
      expect(node.args[0].args[1].value).to.equal(2);
      expect(node.args[1].value).to.equal(3);
    });

    it('accepts variable operands (start..end)', function () {
      var node = parse('start..end');
      expect(node.type).to.equal('FnCall');
      expect(node.callee.path).to.eql(['_range']);
      expect(node.args[0].path).to.eql(['start']);
      expect(node.args[1].path).to.eql(['end']);
    });
  });

  describe('null-coalescing (??)', function () {
    it('parses a ?? b as BinaryOp(??)', function () {
      var node = parse('a ?? b');
      expect(node.type).to.equal('BinaryOp');
      expect(node.op).to.equal('??');
      expect(node.left.path).to.eql(['a']);
      expect(node.right.path).to.eql(['b']);
    });

    it('binds looser than || on the right (a ?? b || c → a ?? (b || c))', function () {
      var node = parse('a ?? b || c');
      expect(node.type).to.equal('BinaryOp');
      expect(node.op).to.equal('??');
      expect(node.left.path).to.eql(['a']);
      expect(node.right.type).to.equal('BinaryOp');
      expect(node.right.op).to.equal('||');
    });

    it('binds looser than || on the left (a || b ?? c → (a || b) ?? c)', function () {
      var node = parse('a || b ?? c');
      expect(node.type).to.equal('BinaryOp');
      expect(node.op).to.equal('??');
      expect(node.left.type).to.equal('BinaryOp');
      expect(node.left.op).to.equal('||');
      expect(node.right.path).to.eql(['c']);
    });

    it('is left-associative (a ?? b ?? c → (a ?? b) ?? c)', function () {
      var node = parse('a ?? b ?? c');
      expect(node.type).to.equal('BinaryOp');
      expect(node.op).to.equal('??');
      expect(node.left.type).to.equal('BinaryOp');
      expect(node.left.op).to.equal('??');
      expect(node.left.left.path).to.eql(['a']);
      expect(node.left.right.path).to.eql(['b']);
      expect(node.right.path).to.eql(['c']);
    });
  });

  /* ---- Ternary and Elvis ----------------------------------------- */

  describe('ternary (? :) and Elvis (?:)', function () {
    it('lowers a ? b : c to Conditional(a, b, c)', function () {
      var node = parse('a ? b : c');
      expect(node.type).to.equal('Conditional');
      expect(node.test.type).to.equal('VarRef');
      expect(node.test.path).to.eql(['a']);
      expect(node.then.path).to.eql(['b']);
      expect(node['else'].path).to.eql(['c']);
    });

    it('lowers Elvis a ?: b to Conditional(a, a, b)', function () {
      var node = parse('a ?: b');
      expect(node.type).to.equal('Conditional');
      expect(node.test.type).to.equal('VarRef');
      expect(node.test.path).to.eql(['a']);
      expect(node.then.type).to.equal('VarRef');
      expect(node.then.path).to.eql(['a']);
      expect(node['else'].path).to.eql(['b']);
    });

    it('binds looser than ?? (a ?? b ? c : d → (a ?? b) ? c : d)', function () {
      var node = parse('a ?? b ? c : d');
      expect(node.type).to.equal('Conditional');
      expect(node.test.type).to.equal('BinaryOp');
      expect(node.test.op).to.equal('??');
      expect(node.test.left.path).to.eql(['a']);
      expect(node.test.right.path).to.eql(['b']);
      expect(node.then.path).to.eql(['c']);
      expect(node['else'].path).to.eql(['d']);
    });

    it('binds looser than + (a + b ? c : d → (a + b) ? c : d)', function () {
      var node = parse('a + b ? c : d');
      expect(node.type).to.equal('Conditional');
      expect(node.test.type).to.equal('BinaryOp');
      expect(node.test.op).to.equal('+');
      expect(node.then.path).to.eql(['c']);
      expect(node['else'].path).to.eql(['d']);
    });

    it('is right-associative (a ? b : c ? d : e → a ? b : (c ? d : e))', function () {
      var node = parse('a ? b : c ? d : e');
      expect(node.type).to.equal('Conditional');
      expect(node.test.path).to.eql(['a']);
      expect(node.then.path).to.eql(['b']);
      expect(node['else'].type).to.equal('Conditional');
      expect(node['else'].test.path).to.eql(['c']);
      expect(node['else'].then.path).to.eql(['d']);
      expect(node['else']['else'].path).to.eql(['e']);
    });

    it('nests in the then-branch (a ? b ? c : d : e)', function () {
      var node = parse('a ? b ? c : d : e');
      expect(node.type).to.equal('Conditional');
      expect(node.test.path).to.eql(['a']);
      expect(node.then.type).to.equal('Conditional');
      expect(node.then.test.path).to.eql(['b']);
      expect(node.then.then.path).to.eql(['c']);
      expect(node.then['else'].path).to.eql(['d']);
      expect(node['else'].path).to.eql(['e']);
    });

    it('works as an object-literal value ({k: a ? b : c})', function () {
      var node = parse('{k: a ? b : c}');
      expect(node.type).to.equal('ObjectLiteral');
      expect(node.properties).to.have.length(1);
      expect(node.properties[0].value.type).to.equal('Conditional');
    });

    it('works as a function call argument (fn(a ? b : c))', function () {
      var node = parse('fn(a ? b : c)');
      expect(node.type).to.equal('FnCall');
      expect(node.args).to.have.length(1);
      expect(node.args[0].type).to.equal('Conditional');
    });

    it('throws when the colon is missing', function () {
      expect(function () { parse('a ? b'); }).to.throwException(/Expected colon/);
    });
  });

  /* ---- is / is not tests ----------------------------------------- */

  describe('is / is not tests', function () {
    it('lowers "foo is defined" to _test_defined(foo)', function () {
      var node = parse('foo is defined');
      expect(node.type).to.equal('FnCall');
      expect(node.callee.type).to.equal('VarRef');
      expect(node.callee.path).to.eql(['_test_defined']);
      expect(node.args).to.have.length(1);
      expect(node.args[0].type).to.equal('VarRef');
      expect(node.args[0].path).to.eql(['foo']);
    });

    it('lowers "foo is not defined" to UnaryOp(!, _test_defined(foo))', function () {
      var node = parse('foo is not defined');
      expect(node.type).to.equal('UnaryOp');
      expect(node.op).to.equal('!');
      expect(node.operand.type).to.equal('FnCall');
      expect(node.operand.callee.path).to.eql(['_test_defined']);
      expect(node.operand.args[0].path).to.eql(['foo']);
    });

    it('accepts FUNCTIONEMPTY test name (foo is defined())', function () {
      var node = parse('foo is defined()');
      expect(node.type).to.equal('FnCall');
      expect(node.callee.path).to.eql(['_test_defined']);
      expect(node.args[0].path).to.eql(['foo']);
    });

    it('accepts FUNCTION test name with args (n is divisibleby(3))', function () {
      var node = parse('n is divisibleby(3)');
      expect(node.type).to.equal('FnCall');
      expect(node.callee.path).to.eql(['_test_divisibleby']);
      expect(node.args).to.have.length(2);
      expect(node.args[0].path).to.eql(['n']);
      expect(node.args[1].type).to.equal('Literal');
      expect(node.args[1].value).to.equal(3);
    });

    it('binds tighter than && (foo is defined && bar is null)', function () {
      var node = parse('foo is defined && bar is null');
      expect(node.type).to.equal('BinaryOp');
      expect(node.op).to.equal('&&');
      expect(node.left.type).to.equal('FnCall');
      expect(node.left.callee.path).to.eql(['_test_defined']);
      expect(node.right.type).to.equal('FnCall');
      expect(node.right.callee.path).to.eql(['_test_null']);
    });

    it('binds looser than + ((a + 1) is defined)', function () {
      var node = parse('a + 1 is defined');
      expect(node.type).to.equal('FnCall');
      expect(node.callee.path).to.eql(['_test_defined']);
      expect(node.args[0].type).to.equal('BinaryOp');
      expect(node.args[0].op).to.equal('+');
    });

    it('composes with is not and other operators', function () {
      var node = parse('foo is not empty && bar');
      expect(node.type).to.equal('BinaryOp');
      expect(node.op).to.equal('&&');
      expect(node.left.type).to.equal('UnaryOp');
      expect(node.left.op).to.equal('!');
      expect(node.left.operand.callee.path).to.eql(['_test_empty']);
      expect(node.right.path).to.eql(['bar']);
    });

    it('throws on dotted test names (foo is bar.baz)', function () {
      expect(function () { parse('foo is bar.baz'); }).to.throwException(/Dotted names are not valid Twig test names/);
    });

    it('CVE-2023-25345: blocks dangerous test names (is __proto__)', function () {
      expect(function () { parse('foo is __proto__'); }).to.throwException(/Unsafe access to "__proto__"/);
    });

    it('CVE-2023-25345: blocks dangerous test names (is constructor)', function () {
      expect(function () { parse('foo is constructor'); }).to.throwException(/Unsafe access to "constructor"/);
    });

    it('throws on reserved keyword as test name (is return)', function () {
      expect(function () { parse('foo is return'); }).to.throwException(/Reserved keyword "return"/);
    });

    it('throws when test name is missing', function () {
      expect(function () { parse('foo is'); }).to.throwException(/Expected test name/);
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

/*!
 * Phase 3 Session 7 — Twig top-level source splitter (`parser.parse`).
 *
 * Covers text → IRText, `{{ … }}` → IROutput (with autoescape tail and
 * `.safe` filter suppression), `{# … #}` → dropped, and `{% … %}` →
 * tag dispatch (unknown tag throws via utils.throwError).
 *
 * Tag-content tests for `{% set %}` / `{% if %}` land in their own
 * describe blocks once those tags are wired into `tags/index.js`.
 */
describe('@rhinostone/swig-twig — parser.parse (top-level splitter)', function () {

  it('returns the canonical parse-tree shape', function () {
    var tree = parser.parse(undefined, '', {}, {}, {});
    expect(tree).to.have.property('name');
    expect(tree).to.have.property('parent');
    expect(tree).to.have.property('tokens');
    expect(tree).to.have.property('blocks');
    expect(tree.tokens).to.eql([]);
    expect(tree.blocks).to.eql({});
    expect(tree.parent).to.equal(null);
  });

  it('emits IRText for plain text', function () {
    var tree = parser.parse(undefined, 'hello world', {}, {}, {});
    expect(tree.tokens).to.have.length(1);
    expect(tree.tokens[0].type).to.equal('Text');
    expect(tree.tokens[0].value).to.equal('hello world');
  });

  it('emits IROutput with autoescape tail for {{ name }}', function () {
    var tree = parser.parse(undefined, '{{ name }}', {}, {}, {});
    expect(tree.tokens).to.have.length(1);
    var out = tree.tokens[0];
    expect(out.type).to.equal('Output');
    expect(out.expr.type).to.equal('VarRef');
    expect(out.expr.path).to.eql(['name']);
    expect(out.filters).to.have.length(1);
    expect(out.filters[0].name).to.equal('e');
  });

  it('omits autoescape tail when autoescape: false', function () {
    var tree = parser.parse(undefined, '{{ name }}', { autoescape: false }, {}, {});
    var out = tree.tokens[0];
    expect(out.type).to.equal('Output');
    expect(out.filters).to.equal(undefined);
  });

  it('omits autoescape tail when a .safe filter is in the chain', function () {
    var safeFilter = function (input) { return input; };
    safeFilter.safe = true;
    var tree = parser.parse(undefined, '{{ html|safeFilter }}', {}, {}, { safeFilter: safeFilter });
    var out = tree.tokens[0];
    expect(out.type).to.equal('Output');
    expect(out.expr.type).to.equal('FilterCall');
    expect(out.expr.name).to.equal('safeFilter');
    expect(out.filters).to.equal(undefined);
  });

  it('passes string-typed autoescape as a literal arg to the e filter', function () {
    var tree = parser.parse(undefined, '{{ name }}', { autoescape: 'js' }, {}, {});
    var out = tree.tokens[0];
    expect(out.filters).to.have.length(1);
    expect(out.filters[0].name).to.equal('e');
    expect(out.filters[0].args).to.have.length(1);
    expect(out.filters[0].args[0].type).to.equal('Literal');
    expect(out.filters[0].args[0].kind).to.equal('string');
    expect(out.filters[0].args[0].value).to.equal('js');
  });

  it('drops {# comments #} entirely', function () {
    var tree = parser.parse(undefined, 'a{# this is a note #}b', {}, {}, {});
    expect(tree.tokens).to.have.length(2);
    expect(tree.tokens[0].value).to.equal('a');
    expect(tree.tokens[1].value).to.equal('b');
  });

  it('throws on an unknown tag with filename and line attached', function () {
    expect(function () {
      parser.parse(undefined, 'x\n{% unknowntag %}', { filename: 'tpl.twig' }, {}, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/Unexpected tag "unknowntag"/);
      expect(e.message).to.match(/tpl\.twig/);
    });
  });

  it('honors custom varControls / tagControls / cmtControls', function () {
    var tree = parser.parse(undefined, '<%= name %><# c #><# c #>', {
      varControls: ['<%=', '%>'],
      tagControls: ['<%', '%>'],
      cmtControls: ['<#', '#>']
    }, {}, {});
    expect(tree.tokens).to.have.length(1);
    expect(tree.tokens[0].type).to.equal('Output');
  });

  it('interleaves text + variable + text correctly', function () {
    var tree = parser.parse(undefined, 'Hello {{ name }}!', {}, {}, {});
    expect(tree.tokens).to.have.length(3);
    expect(tree.tokens[0].type).to.equal('Text');
    expect(tree.tokens[0].value).to.equal('Hello ');
    expect(tree.tokens[1].type).to.equal('Output');
    expect(tree.tokens[2].type).to.equal('Text');
    expect(tree.tokens[2].value).to.equal('!');
  });
});


/*!
 * Phase 3 Session 7 — `{% set %}` tag.
 *
 * Covers parse-time IRSet emission, LHS path shapes (bare + dotted),
 * compound assignment operators, RHS expression lowering, and
 * CVE-2023-25345 rejection of dangerous LHS names. Bracket-LHS and
 * missing-RHS / missing-operator paths are pinned as throw assertions.
 */
describe('@rhinostone/swig-twig — parser.parse — {% set %} tag', function () {
  var tags = require('@rhinostone/swig-twig/lib/tags');

  it('emits an IRSet for a bare-identifier assignment', function () {
    var tree = parser.parse(undefined, '{% set foo = "x" %}', {}, tags, {});
    expect(tree.tokens).to.have.length(1);
    var tok = tree.tokens[0];
    expect(tok.name).to.equal('set');
    expect(tok.irExpr).to.be.an('object');
    expect(tok.irExpr.type).to.equal('Set');
    expect(tok.irExpr.op).to.equal('=');
    expect(tok.irExpr.target.type).to.equal('VarRef');
    expect(tok.irExpr.target.path).to.eql(['foo']);
    expect(tok.irExpr.value.type).to.equal('Literal');
    expect(tok.irExpr.value.kind).to.equal('string');
    expect(tok.irExpr.value.value).to.equal('x');
  });

  it('supports compound assignment operators (+=)', function () {
    var tree = parser.parse(undefined, '{% set bar += 1 %}', {}, tags, {});
    var irExpr = tree.tokens[0].irExpr;
    expect(irExpr.op).to.equal('+=');
    expect(irExpr.target.path).to.eql(['bar']);
    expect(irExpr.value.type).to.equal('Literal');
    expect(irExpr.value.kind).to.equal('number');
    expect(irExpr.value.value).to.equal(1);
  });

  it('supports a dotted-path LHS', function () {
    var tree = parser.parse(undefined, '{% set foo.bar.baz = 42 %}', {}, tags, {});
    var irExpr = tree.tokens[0].irExpr;
    expect(irExpr.target.type).to.equal('VarRef');
    expect(irExpr.target.path).to.eql(['foo', 'bar', 'baz']);
    expect(irExpr.value.value).to.equal(42);
  });

  it('lowers a complex RHS expression via parseExpr', function () {
    var tree = parser.parse(undefined, '{% set out = a + b * 2 %}', {}, tags, {});
    var value = tree.tokens[0].irExpr.value;
    expect(value.type).to.equal('BinaryOp');
    expect(value.op).to.equal('+');
    expect(value.left.type).to.equal('VarRef');
    expect(value.right.type).to.equal('BinaryOp');
    expect(value.right.op).to.equal('*');
  });

  it('rejects __proto__ on the LHS (CVE-2023-25345)', function () {
    expect(function () {
      parser.parse(undefined, '{% set __proto__ = "x" %}', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/Unsafe assignment to "__proto__"/);
      expect(e.message).to.match(/CVE-2023-25345/);
      expect(e.message).to.match(/tpl\.twig/);
    });
  });

  it('rejects constructor mid-dotted-path (CVE-2023-25345)', function () {
    expect(function () {
      parser.parse(undefined, '{% set foo.constructor = "x" %}', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/Unsafe assignment to "constructor"/);
    });
  });

  it('rejects bracket-notation LHS with a filename-aware throw', function () {
    expect(function () {
      parser.parse(undefined, '{% set foo["bar"] = 1 %}', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/Bracket-notation assignment is not supported/);
      expect(e.message).to.match(/tpl\.twig/);
    });
  });

  it('throws on missing RHS', function () {
    expect(function () {
      parser.parse(undefined, '{% set foo = %}', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/Expected expression/);
    });
  });

  it('throws on missing assignment operator', function () {
    expect(function () {
      parser.parse(undefined, '{% set foo %}', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/Expected assignment operator/);
    });
  });

  it('does not push end-marker on the stack (no endset required)', function () {
    var tree = parser.parse(undefined, '{% set foo = 1 %}text', {}, tags, {});
    expect(tree.tokens).to.have.length(2);
    expect(tree.tokens[0].name).to.equal('set');
    expect(tree.tokens[1].type).to.equal('Text');
    expect(tree.tokens[1].value).to.equal('text');
  });
});


/*!
 * Phase 3 Session 7 — `{% if %}` tag.
 *
 * Single-branch shape — `{% else %}` / `{% elseif %}` are deferred.
 * Covers: simple test, complex test expression, body content
 * collection (text + nested tags), nested if, mismatched end tag,
 * unclosed if, missing test expression.
 */
describe('@rhinostone/swig-twig — parser.parse — {% if %} tag', function () {
  var tags = require('@rhinostone/swig-twig/lib/tags');

  it('emits a single-branch IRIf for a bare-identifier test', function () {
    var tree = parser.parse(undefined, '{% if foo %}yes{% endif %}', {}, tags, {});
    expect(tree.tokens).to.have.length(1);
    var tok = tree.tokens[0];
    expect(tok.name).to.equal('if');
    expect(tok.ends).to.equal(true);
    expect(tok.irExpr).to.be.an('object');
    expect(tok.irExpr.type).to.equal('VarRef');
    expect(tok.irExpr.path).to.eql(['foo']);
    expect(tok.content).to.have.length(1);
    expect(tok.content[0].type).to.equal('Text');
    expect(tok.content[0].value).to.equal('yes');
  });

  it('lowers a complex test expression via parseExpr (BinaryOp)', function () {
    var tree = parser.parse(undefined, '{% if foo and bar %}body{% endif %}', {}, tags, {});
    var test = tree.tokens[0].irExpr;
    expect(test.type).to.equal('BinaryOp');
    expect(test.op).to.equal('&&');
    expect(test.left.type).to.equal('VarRef');
    expect(test.right.type).to.equal('VarRef');
  });

  it('captures mixed text + output content inside the body', function () {
    var tree = parser.parse(undefined, '{% if foo %}Hi {{ name }}!{% endif %}', {}, tags, {});
    var content = tree.tokens[0].content;
    expect(content).to.have.length(3);
    expect(content[0].type).to.equal('Text');
    expect(content[0].value).to.equal('Hi ');
    expect(content[1].type).to.equal('Output');
    expect(content[2].type).to.equal('Text');
    expect(content[2].value).to.equal('!');
  });

  it('supports nested if tags (stack-based body capture)', function () {
    var tree = parser.parse(undefined, '{% if a %}{% if b %}deep{% endif %}{% endif %}', {}, tags, {});
    var outer = tree.tokens[0];
    expect(outer.name).to.equal('if');
    expect(outer.content).to.have.length(1);
    var inner = outer.content[0];
    expect(inner.name).to.equal('if');
    expect(inner.content).to.have.length(1);
    expect(inner.content[0].type).to.equal('Text');
    expect(inner.content[0].value).to.equal('deep');
  });

  it('throws on missing test expression', function () {
    expect(function () {
      parser.parse(undefined, '{% if %}body{% endif %}', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/Expected conditional expression/);
      expect(e.message).to.match(/tpl\.twig/);
    });
  });

  it('throws on unclosed if (missing endif)', function () {
    expect(function () {
      parser.parse(undefined, '{% if foo %}body', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/Missing end tag for "if"/);
      expect(e.message).to.match(/tpl\.twig/);
    });
  });

  it('throws on mismatched end tag', function () {
    expect(function () {
      parser.parse(undefined, '{% if foo %}body{% endset %}', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/Unexpected end of tag "set"/);
      expect(e.message).to.match(/tpl\.twig/);
    });
  });
});


/*!
 * Phase 3 Session 8 — `{% for %}` tag.
 *
 * Covers: single-val iteration, key/val destructuring, complex iterable
 * (BinaryOp + filter chain), mixed text/output body capture, nested for,
 * empty body, all parse-time throws (empty tag, missing `in`, missing
 * iterable, unclosed, mismatched end), CVE-2023-25345 `_dangerousProps`
 * guards on val + key, dotted-identifier rejection.
 */
describe('@rhinostone/swig-twig — parser.parse — {% for %} tag', function () {
  var tags = require('@rhinostone/swig-twig/lib/tags');

  it('emits args=[val] + IRExpr iterable for single-val iteration', function () {
    var tree = parser.parse(undefined, '{% for item in items %}x{% endfor %}', {}, tags, {});
    expect(tree.tokens).to.have.length(1);
    var tok = tree.tokens[0];
    expect(tok.name).to.equal('for');
    expect(tok.ends).to.equal(true);
    expect(tok.args).to.eql(['item']);
    expect(tok.irExpr).to.be.an('object');
    expect(tok.irExpr.type).to.equal('VarRef');
    expect(tok.irExpr.path).to.eql(['items']);
    expect(tok.content).to.have.length(1);
    expect(tok.content[0].type).to.equal('Text');
    expect(tok.content[0].value).to.equal('x');
  });

  it('emits args=[key, val] for key/val destructuring', function () {
    var tree = parser.parse(undefined, '{% for k, v in map %}x{% endfor %}', {}, tags, {});
    var tok = tree.tokens[0];
    expect(tok.args).to.eql(['k', 'v']);
    expect(tok.irExpr.type).to.equal('VarRef');
    expect(tok.irExpr.path).to.eql(['map']);
  });

  it('lowers a BinaryOp iterable via parseExpr', function () {
    var tree = parser.parse(undefined, '{% for x in a + b %}x{% endfor %}', {}, tags, {});
    var iter = tree.tokens[0].irExpr;
    expect(iter.type).to.equal('BinaryOp');
    expect(iter.op).to.equal('+');
    expect(iter.left.type).to.equal('VarRef');
    expect(iter.right.type).to.equal('VarRef');
  });

  it('lowers a filter-chain iterable via parseExpr (IRFilterCallExpr)', function () {
    var tree = parser.parse(undefined, '{% for x in list|sort %}x{% endfor %}', {}, tags, { 'sort': function () {} });
    var iter = tree.tokens[0].irExpr;
    expect(iter.type).to.equal('FilterCall');
    expect(iter.name).to.equal('sort');
    expect(iter.input.type).to.equal('VarRef');
    expect(iter.input.path).to.eql(['list']);
  });

  it('captures mixed text + output content inside the body', function () {
    var tree = parser.parse(undefined, '{% for x in xs %}Hi {{ x }}!{% endfor %}', {}, tags, {});
    var content = tree.tokens[0].content;
    expect(content).to.have.length(3);
    expect(content[0].type).to.equal('Text');
    expect(content[0].value).to.equal('Hi ');
    expect(content[1].type).to.equal('Output');
    expect(content[2].type).to.equal('Text');
    expect(content[2].value).to.equal('!');
  });

  it('supports nested for tags (stack-based body capture)', function () {
    var tree = parser.parse(undefined, '{% for a in as %}{% for b in bs %}deep{% endfor %}{% endfor %}', {}, tags, {});
    var outer = tree.tokens[0];
    expect(outer.name).to.equal('for');
    expect(outer.content).to.have.length(1);
    var inner = outer.content[0];
    expect(inner.name).to.equal('for');
    expect(inner.args).to.eql(['b']);
    expect(inner.content).to.have.length(1);
    expect(inner.content[0].type).to.equal('Text');
    expect(inner.content[0].value).to.equal('deep');
  });

  it('accepts an empty body', function () {
    var tree = parser.parse(undefined, '{% for x in xs %}{% endfor %}', {}, tags, {});
    var tok = tree.tokens[0];
    expect(tok.content).to.have.length(0);
  });

  it('throws on empty tag (missing loop variable)', function () {
    expect(function () {
      parser.parse(undefined, '{% for %}body{% endfor %}', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/Expected loop variable/);
      expect(e.message).to.match(/tpl\.twig/);
    });
  });

  it('throws on missing "in" keyword', function () {
    expect(function () {
      parser.parse(undefined, '{% for x xs %}body{% endfor %}', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/Expected "in"/);
      expect(e.message).to.match(/tpl\.twig/);
    });
  });

  it('throws on missing iterable', function () {
    expect(function () {
      parser.parse(undefined, '{% for x in %}body{% endfor %}', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/Expected iterable/);
      expect(e.message).to.match(/tpl\.twig/);
    });
  });

  it('throws on unclosed for (missing endfor)', function () {
    expect(function () {
      parser.parse(undefined, '{% for x in xs %}body', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/Missing end tag for "for"/);
      expect(e.message).to.match(/tpl\.twig/);
    });
  });

  it('throws on mismatched end tag', function () {
    expect(function () {
      parser.parse(undefined, '{% for x in xs %}body{% endif %}', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/Unexpected end of tag "if"/);
      expect(e.message).to.match(/tpl\.twig/);
    });
  });

  it('throws when val is a dangerous prop (__proto__)', function () {
    expect(function () {
      parser.parse(undefined, '{% for __proto__ in xs %}body{% endfor %}', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/Unsafe loop variable "__proto__"/);
      expect(e.message).to.match(/CVE-2023-25345/);
      expect(e.message).to.match(/tpl\.twig/);
    });
  });

  it('throws when key is a dangerous prop (constructor)', function () {
    expect(function () {
      parser.parse(undefined, '{% for constructor, v in xs %}body{% endfor %}', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/Unsafe loop variable "constructor"/);
      expect(e.message).to.match(/CVE-2023-25345/);
    });
  });

  it('throws when val is a dangerous prop after key (prototype)', function () {
    expect(function () {
      parser.parse(undefined, '{% for k, prototype in xs %}body{% endfor %}', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/Unsafe loop variable "prototype"/);
      expect(e.message).to.match(/CVE-2023-25345/);
    });
  });

  it('throws on dotted loop variable (bare identifier required)', function () {
    expect(function () {
      parser.parse(undefined, '{% for foo.bar in xs %}body{% endfor %}', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/must be a bare identifier/);
      expect(e.message).to.match(/tpl\.twig/);
    });
  });
});

/**
 * Phase 3 Session 9 — `{% block %}` tag tests.
 */
describe('@rhinostone/swig-twig — parser.parse — {% block %} tag', function () {
  var tags = require('@rhinostone/swig-twig/lib/tags');

  it('captures block name in args and ends=true', function () {
    var tree = parser.parse(undefined, '{% block title %}hello{% endblock %}', {}, tags, {});
    expect(tree.tokens).to.have.length(1);
    var tok = tree.tokens[0];
    expect(tok.name).to.equal('block');
    expect(tok.ends).to.equal(true);
    expect(tok.block).to.equal(true);
    expect(tok.args).to.eql(['title']);
    expect(tok.content).to.have.length(1);
    expect(tok.content[0].type).to.equal('Text');
    expect(tok.content[0].value).to.equal('hello');
  });

  it('populates tree.blocks at top level keyed by block name', function () {
    var tree = parser.parse(undefined, 'pre {% block a %}A{% endblock %} mid {% block b %}B{% endblock %} post', {}, tags, {});
    expect(tree.blocks).to.have.property('a');
    expect(tree.blocks).to.have.property('b');
    expect(tree.blocks.a.name).to.equal('block');
    expect(tree.blocks.a.args).to.eql(['a']);
    expect(tree.blocks.b.args).to.eql(['b']);
  });

  it('keeps block token inline in tokens at top level (not only in blocks map)', function () {
    var tree = parser.parse(undefined, '{% block x %}y{% endblock %}', {}, tags, {});
    expect(tree.tokens).to.have.length(1);
    expect(tree.tokens[0].name).to.equal('block');
    expect(tree.blocks.x).to.equal(tree.tokens[0]);
  });

  it('accepts an empty body', function () {
    var tree = parser.parse(undefined, '{% block empty %}{% endblock %}', {}, tags, {});
    var tok = tree.tokens[0];
    expect(tok.args).to.eql(['empty']);
    expect(tok.content).to.have.length(0);
  });

  it('captures mixed text + output content', function () {
    var tree = parser.parse(undefined, '{% block m %}hi {{ name }}!{% endblock %}', {}, tags, {});
    var content = tree.tokens[0].content;
    expect(content).to.have.length(3);
    expect(content[0].type).to.equal('Text');
    expect(content[0].value).to.equal('hi ');
    expect(content[1].type).to.equal('Output');
    expect(content[2].type).to.equal('Text');
    expect(content[2].value).to.equal('!');
  });

  it('captures a nested block inside another block', function () {
    var tree = parser.parse(undefined, '{% block outer %}o{% block inner %}i{% endblock %}o{% endblock %}', {}, tags, {});
    expect(tree.tokens).to.have.length(1);
    var outer = tree.tokens[0];
    expect(outer.args).to.eql(['outer']);
    expect(outer.content).to.have.length(3);
    expect(outer.content[0].type).to.equal('Text');
    expect(outer.content[1].name).to.equal('block');
    expect(outer.content[1].args).to.eql(['inner']);
    expect(outer.content[2].type).to.equal('Text');
  });

  it('only top-level blocks populate tree.blocks (nested blocks do not)', function () {
    var tree = parser.parse(undefined, '{% block outer %}{% block inner %}x{% endblock %}{% endblock %}', {}, tags, {});
    expect(tree.blocks).to.have.property('outer');
    expect(tree.blocks).to.not.have.property('inner');
  });

  it('throws on empty block name', function () {
    expect(function () {
      parser.parse(undefined, '{% block %}body{% endblock %}', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/Expected block name/);
      expect(e.message).to.match(/tpl\.twig/);
    });
  });

  it('throws on dotted block name (bare identifier required)', function () {
    expect(function () {
      parser.parse(undefined, '{% block foo.bar %}body{% endblock %}', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/must be a bare identifier/);
      expect(e.message).to.match(/tpl\.twig/);
    });
  });

  it('throws on __proto__ block name (CVE-2023-25345)', function () {
    expect(function () {
      parser.parse(undefined, '{% block __proto__ %}body{% endblock %}', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/Unsafe block name "__proto__"/);
      expect(e.message).to.match(/CVE-2023-25345/);
    });
  });

  it('throws on constructor block name (CVE-2023-25345)', function () {
    expect(function () {
      parser.parse(undefined, '{% block constructor %}body{% endblock %}', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/Unsafe block name "constructor"/);
    });
  });

  it('throws on prototype block name (CVE-2023-25345)', function () {
    expect(function () {
      parser.parse(undefined, '{% block prototype %}body{% endblock %}', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/Unsafe block name "prototype"/);
    });
  });

  it('throws on trailing tokens after block name', function () {
    expect(function () {
      parser.parse(undefined, '{% block foo bar %}body{% endblock %}', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/Unexpected token "bar"/);
      expect(e.message).to.match(/tpl\.twig/);
    });
  });

  it('throws on unclosed block', function () {
    expect(function () {
      parser.parse(undefined, '{% block foo %}body', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/Missing end tag for "block"/);
    });
  });
});

/**
 * Phase 3 Session 9 — `{% extends %}` tag tests.
 */
describe('@rhinostone/swig-twig — parser.parse — {% extends %} tag', function () {
  var tags = require('@rhinostone/swig-twig/lib/tags');

  it('sets template.parent from a double-quoted STRING path', function () {
    var tree = parser.parse(undefined, '{% extends "layout.twig" %}', {}, tags, {});
    expect(tree.parent).to.equal('layout.twig');
  });

  it('sets template.parent from a single-quoted STRING path', function () {
    var tree = parser.parse(undefined, "{% extends 'layout.twig' %}", {}, tags, {});
    expect(tree.parent).to.equal('layout.twig');
  });

  it('captures block overrides alongside extends in a child template', function () {
    var src = '{% extends "parent.twig" %}{% block a %}A1{% endblock %}{% block b %}B1{% endblock %}';
    var tree = parser.parse(undefined, src, {}, tags, {});
    expect(tree.parent).to.equal('parent.twig');
    expect(tree.blocks).to.have.property('a');
    expect(tree.blocks).to.have.property('b');
    expect(tree.blocks.a.args).to.eql(['a']);
    expect(tree.blocks.b.args).to.eql(['b']);
  });

  it('extends.compile returns undefined (no-op) — no runtime code emitted', function () {
    var tree = parser.parse(undefined, '{% extends "layout.twig" %}', {}, tags, {});
    var extendsToken = tree.tokens[0];
    expect(extendsToken.name).to.equal('extends');
    expect(extendsToken.ends).to.equal(false);
    expect(extendsToken.compile()).to.equal(undefined);
  });

  it('throws on missing parent path', function () {
    expect(function () {
      parser.parse(undefined, '{% extends %}', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/Expected parent template path/);
      expect(e.message).to.match(/tpl\.twig/);
    });
  });

  it('throws on VAR parent (dynamic extends rejected)', function () {
    expect(function () {
      parser.parse(undefined, '{% extends parentTpl %}', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/Dynamic "extends" is not supported/);
      expect(e.message).to.match(/tpl\.twig/);
    });
  });

  it('throws on ternary parent (dynamic extends rejected)', function () {
    expect(function () {
      parser.parse(undefined, '{% extends a ? "x" : "y" %}', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/Dynamic "extends" is not supported/);
    });
  });

  it('throws on trailing tokens after STRING path', function () {
    expect(function () {
      parser.parse(undefined, '{% extends "a.twig" "b.twig" %}', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/Unexpected token/);
      expect(e.message).to.match(/tpl\.twig/);
    });
  });
});

describe('@rhinostone/swig-twig — parser.parse — {% include %} tag', function () {
  var tags = require('@rhinostone/swig-twig/lib/tags');

  it('emits IRInclude with a STRING literal path', function () {
    var tree = parser.parse(undefined, '{% include "partial.twig" %}', { filename: 'tpl.twig' }, tags, {});
    var tok = tree.tokens[0];
    expect(tok.name).to.equal('include');
    expect(tok.ends).to.equal(false);
    expect(tok.block).to.equal(false);
    expect(tok.irExpr.type).to.equal('Include');
    expect(tok.irExpr.path.type).to.equal('Literal');
    expect(tok.irExpr.path.kind).to.equal('string');
    expect(tok.irExpr.path.value).to.equal('partial.twig');
    expect(tok.irExpr.resolveFrom).to.equal('tpl.twig');
    expect(tok.irExpr.isolated).to.equal(false);
    expect(tok.irExpr.ignoreMissing).to.equal(false);
    expect(tok.irExpr.context).to.equal(undefined);
  });

  it('accepts a VAR path expression (dynamic include)', function () {
    var tree = parser.parse(undefined, '{% include myPath %}', { filename: 'tpl.twig' }, tags, {});
    var tok = tree.tokens[0];
    expect(tok.irExpr.path.type).to.equal('VarRef');
    expect(tok.irExpr.path.path).to.eql(['myPath']);
  });

  it('accepts a member-access path expression', function () {
    var tree = parser.parse(undefined, '{% include paths.partial %}', { filename: 'tpl.twig' }, tags, {});
    var tok = tree.tokens[0];
    expect(tok.irExpr.path.type).to.equal('VarRef');
    expect(tok.irExpr.path.path).to.eql(['paths', 'partial']);
  });

  it('accepts a conditional path expression', function () {
    var tree = parser.parse(undefined, '{% include cond ? "a.twig" : "b.twig" %}', { filename: 'tpl.twig' }, tags, {});
    var tok = tree.tokens[0];
    expect(tok.irExpr.path.type).to.equal('Conditional');
  });

  it('parses "with <ctx>" context expression', function () {
    var tree = parser.parse(undefined, '{% include "p.twig" with myCtx %}', { filename: 'tpl.twig' }, tags, {});
    var tok = tree.tokens[0];
    expect(tok.irExpr.path.value).to.equal('p.twig');
    expect(tok.irExpr.context.type).to.equal('VarRef');
    expect(tok.irExpr.context.path).to.eql(['myCtx']);
    expect(tok.irExpr.isolated).to.equal(false);
  });

  it('parses "with <object literal>" context expression', function () {
    var tree = parser.parse(undefined, '{% include "p.twig" with {a: 1, b: 2} %}', { filename: 'tpl.twig' }, tags, {});
    var tok = tree.tokens[0];
    expect(tok.irExpr.context.type).to.equal('ObjectLiteral');
    expect(tok.irExpr.context.properties.length).to.equal(2);
  });

  it('parses "with <ctx> only" and sets isolated', function () {
    var tree = parser.parse(undefined, '{% include "p.twig" with myCtx only %}', { filename: 'tpl.twig' }, tags, {});
    var tok = tree.tokens[0];
    expect(tok.irExpr.context.type).to.equal('VarRef');
    expect(tok.irExpr.isolated).to.equal(true);
    expect(tok.irExpr.ignoreMissing).to.equal(false);
  });

  it('parses "ignore missing"', function () {
    var tree = parser.parse(undefined, '{% include "p.twig" ignore missing %}', { filename: 'tpl.twig' }, tags, {});
    var tok = tree.tokens[0];
    expect(tok.irExpr.ignoreMissing).to.equal(true);
    expect(tok.irExpr.isolated).to.equal(false);
    expect(tok.irExpr.context).to.equal(undefined);
  });

  it('parses "with <ctx> only ignore missing" (all modifiers)', function () {
    var tree = parser.parse(undefined, '{% include "p.twig" with myCtx only ignore missing %}', { filename: 'tpl.twig' }, tags, {});
    var tok = tree.tokens[0];
    expect(tok.irExpr.context.type).to.equal('VarRef');
    expect(tok.irExpr.isolated).to.equal(true);
    expect(tok.irExpr.ignoreMissing).to.equal(true);
  });

  it('escapes backslashes in resolveFrom for Windows paths', function () {
    var tree = parser.parse(undefined, '{% include "p.twig" %}', { filename: 'C:\\templates\\tpl.twig' }, tags, {});
    var tok = tree.tokens[0];
    expect(tok.irExpr.resolveFrom).to.equal('C:\\\\templates\\\\tpl.twig');
  });

  it('throws on missing path', function () {
    expect(function () {
      parser.parse(undefined, '{% include %}', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/Expected template path in "include" tag/);
      expect(e.message).to.match(/tpl\.twig/);
    });
  });

  it('throws on "with" without a context expression', function () {
    expect(function () {
      parser.parse(undefined, '{% include "p.twig" with %}', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/Expected context expression after "with"/);
      expect(e.message).to.match(/tpl\.twig/);
    });
  });

  it('throws on "only" without a preceding "with"', function () {
    expect(function () {
      parser.parse(undefined, '{% include "p.twig" only %}', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/"only" keyword in "include" tag requires a preceding "with"/);
      expect(e.message).to.match(/tpl\.twig/);
    });
  });

  it('throws on "ignore" not followed by "missing"', function () {
    expect(function () {
      parser.parse(undefined, '{% include "p.twig" ignore %}', { filename: 'tpl.twig' }, tags, {});
    }).to.throwException(function (e) {
      expect(e.message).to.match(/"ignore" keyword in "include" tag must be followed by "missing"/);
      expect(e.message).to.match(/tpl\.twig/);
    });
  });
});
