var tokenparser = require('@rhinostone/swig-core/lib/tokenparser'),
  ir = require('@rhinostone/swig-core/lib/ir'),
  backend = require('@rhinostone/swig-core/lib/backend'),
  _t = require('@rhinostone/swig-core/lib/tokentypes'),
  lexer = require('../../lib/lexer'),
  filters = require('../../lib/filters'),
  expect = require('expect.js');

var TokenParser = tokenparser.TokenParser;

/*!
 * Acceptance tests for TokenParser.prototype.parseExpr — the
 * LexerToken[] → IRExpr reducer introduced in #T15 Session 14b
 * (Commit 2).
 *
 * parseExpr is additive — .parse() is unchanged. No consumer flips
 * yet; Commits 3-8 migrate one transitional `IRExpr | string` slot at
 * a time. The tests below fix the IR shape contract against the
 * native frontend's real lexer output, and spot-check byte-identity
 * via backend.emitExpr for the simple cases where both paths share
 * the same flat-concatenation form.
 */
function parse(source) {
  var tokens = lexer.read(source);
  var parser = new TokenParser(tokens, filters, false, 1, 'expr.test');
  return parser.parseExpr(tokens);
}

describe('swig-core/lib/tokenparser — parseExpr', function () {

  describe('primary — literals', function () {
    it('lowers a string to IRLiteral(string)', function () {
      var node = parse('"hello"');
      expect(node.type).to.be('Literal');
      expect(node.kind).to.be('string');
      expect(node.value).to.be('hello');
    });

    it('lowers a number to IRLiteral(number)', function () {
      var node = parse('42');
      expect(node.type).to.be('Literal');
      expect(node.kind).to.be('number');
      expect(node.value).to.be(42);
    });

    it('lowers a signed number via the lexer NUMBER rule, not a UnaryOp', function () {
      var node = parse('-1.5');
      expect(node.type).to.be('Literal');
      expect(node.kind).to.be('number');
      expect(node.value).to.be(-1.5);
    });

    it('lowers booleans to IRLiteral(bool)', function () {
      expect(parse('true').value).to.be(true);
      expect(parse('false').value).to.be(false);
    });
  });

  describe('primary — VarRef', function () {
    it('single-segment identifier → IRVarRef', function () {
      var node = parse('foo');
      expect(node.type).to.be('VarRef');
      expect(node.path).to.eql(['foo']);
    });

    it('dot-path identifier → multi-segment IRVarRef', function () {
      var node = parse('user.profile.name');
      expect(node.type).to.be('VarRef');
      expect(node.path).to.eql(['user', 'profile', 'name']);
    });

    it('rejects a reserved keyword as the lead segment', function () {
      expect(function () { parse('return'); }).to.throwException(/Reserved keyword/);
    });

    it('fires CVE-2023-25345 on every path segment', function () {
      expect(function () { parse('__proto__'); }).to.throwException(/CVE-2023-25345/);
      expect(function () { parse('foo.constructor'); }).to.throwException(/CVE-2023-25345/);
      expect(function () { parse('foo.prototype.bar'); }).to.throwException(/CVE-2023-25345/);
    });
  });

  describe('primary — Access (bracket)', function () {
    it('foo["bar"] → IRAccess with string-literal key', function () {
      var node = parse('foo["bar"]');
      expect(node.type).to.be('Access');
      expect(node.object.type).to.be('VarRef');
      expect(node.object.path).to.eql(['foo']);
      expect(node.key.type).to.be('Literal');
      expect(node.key.kind).to.be('string');
      expect(node.key.value).to.be('bar');
    });

    it('foo[0] → IRAccess with numeric-literal key', function () {
      var node = parse('foo[0]');
      expect(node.type).to.be('Access');
      expect(node.key.kind).to.be('number');
      expect(node.key.value).to.be(0);
    });

    it('fires CVE-2023-25345 on a dangerous string-literal key', function () {
      expect(function () { parse('foo["__proto__"]'); }).to.throwException(/CVE-2023-25345/);
      expect(function () { parse('foo["constructor"]'); }).to.throwException(/CVE-2023-25345/);
      expect(function () { parse('foo["prototype"]'); }).to.throwException(/CVE-2023-25345/);
    });

    it('does not guard a runtime (variable) key — matches documented scope', function () {
      expect(function () { parse('foo[key]'); }).not.to.throwException();
    });

    it('DOTKEY after BRACKETCLOSE lowers to chained IRAccess', function () {
      var node = parse('foo["bar"].baz');
      expect(node.type).to.be('Access');
      expect(node.key.value).to.be('baz');
      expect(node.object.type).to.be('Access');
      expect(node.object.key.value).to.be('bar');
    });

    it('fires CVE-2023-25345 on a DOTKEY after BRACKETCLOSE', function () {
      expect(function () { parse('foo["bar"].__proto__'); }).to.throwException(/CVE-2023-25345/);
    });
  });

  describe('primary — FnCall', function () {
    it('foo() → IRFnCall with single-segment callee', function () {
      var node = parse('foo()');
      expect(node.type).to.be('FnCall');
      expect(node.callee.type).to.be('VarRef');
      expect(node.callee.path).to.eql(['foo']);
      expect(node.args).to.eql([]);
    });

    it('foo(x, 1) → IRFnCall with args', function () {
      var node = parse('foo(x, 1)');
      expect(node.type).to.be('FnCall');
      expect(node.args.length).to.be(2);
      expect(node.args[0].type).to.be('VarRef');
      expect(node.args[1].kind).to.be('number');
    });

    it('foo.bar(x) → method-call shape (multi-segment callee)', function () {
      var node = parse('foo.bar(x)');
      expect(node.type).to.be('FnCall');
      expect(node.callee.type).to.be('VarRef');
      expect(node.callee.path).to.eql(['foo', 'bar']);
      expect(node.args.length).to.be(1);
    });

    it('fires CVE-2023-25345 on a dangerous function name', function () {
      expect(function () { parse('constructor()'); }).to.throwException(/CVE-2023-25345/);
    });

    it('fires CVE-2023-25345 on a dangerous method-call path', function () {
      expect(function () { parse('foo.constructor(x)'); }).to.throwException(/CVE-2023-25345/);
    });
  });

  describe('primary — array / object literals', function () {
    it('[] → empty IRArrayLiteral', function () {
      var node = parse('[]');
      expect(node.type).to.be('ArrayLiteral');
      expect(node.elements).to.eql([]);
    });

    it('[1, "a", foo] → IRArrayLiteral with mixed element exprs', function () {
      var node = parse('[1, "a", foo]');
      expect(node.type).to.be('ArrayLiteral');
      expect(node.elements.length).to.be(3);
      expect(node.elements[0].kind).to.be('number');
      expect(node.elements[1].kind).to.be('string');
      expect(node.elements[2].type).to.be('VarRef');
    });

    it('{} → empty IRObjectLiteral', function () {
      var node = parse('{}');
      expect(node.type).to.be('ObjectLiteral');
      expect(node.properties).to.eql([]);
    });

    it('{"name": "alice", "age": 30} → IRObjectLiteral', function () {
      var node = parse('{"name": "alice", "age": 30}');
      expect(node.type).to.be('ObjectLiteral');
      expect(node.properties.length).to.be(2);
      expect(node.properties[0].key.value).to.be('name');
      expect(node.properties[0].value.value).to.be('alice');
      expect(node.properties[1].value.value).to.be(30);
    });
  });

  describe('unary NOT', function () {
    it('!foo → IRUnaryOp(!, foo)', function () {
      var node = parse('!foo');
      expect(node.type).to.be('UnaryOp');
      expect(node.op).to.be('!');
      expect(node.operand.type).to.be('VarRef');
    });

    it('not foo → IRUnaryOp(!, foo) (lexer normalises "not" to "!")', function () {
      var node = parse('not foo');
      expect(node.type).to.be('UnaryOp');
      expect(node.op).to.be('!');
    });
  });

  describe('binary ops — precedence', function () {
    it('1 + 2 → IRBinaryOp(+, 1, 2)', function () {
      var node = parse('1 + 2');
      expect(node.type).to.be('BinaryOp');
      expect(node.op).to.be('+');
      expect(node.left.value).to.be(1);
      expect(node.right.value).to.be(2);
    });

    it('1 + 2 * 3 → (+, 1, (*, 2, 3)) — multiplicative binds tighter', function () {
      var node = parse('1 + 2 * 3');
      expect(node.type).to.be('BinaryOp');
      expect(node.op).to.be('+');
      expect(node.left.value).to.be(1);
      expect(node.right.type).to.be('BinaryOp');
      expect(node.right.op).to.be('*');
      expect(node.right.left.value).to.be(2);
      expect(node.right.right.value).to.be(3);
    });

    it('1 + 2 + 3 → ((+, 1, 2), +, 3) — left-associative', function () {
      var node = parse('1 + 2 + 3');
      expect(node.type).to.be('BinaryOp');
      expect(node.op).to.be('+');
      expect(node.left.type).to.be('BinaryOp');
      expect(node.left.op).to.be('+');
      expect(node.left.left.value).to.be(1);
      expect(node.left.right.value).to.be(2);
      expect(node.right.value).to.be(3);
    });

    it('a < b === c → ((<, a, b), ===, c) — relational binds tighter than equality', function () {
      var node = parse('a < b === c');
      expect(node.type).to.be('BinaryOp');
      expect(node.op).to.be('===');
      expect(node.left.type).to.be('BinaryOp');
      expect(node.left.op).to.be('<');
    });

    it('a || b && c → (||, a, (&&, b, c)) — AND binds tighter than OR', function () {
      var node = parse('a || b && c');
      expect(node.type).to.be('BinaryOp');
      expect(node.op).to.be('||');
      expect(node.right.type).to.be('BinaryOp');
      expect(node.right.op).to.be('&&');
    });

    it('normalises keyword aliases via the lexer — gt → >, and → &&, or → ||', function () {
      expect(parse('a gt b').op).to.be('>');
      expect(parse('a and b').op).to.be('&&');
      expect(parse('a or b').op).to.be('||');
    });

    it('"a" in items → IRBinaryOp(in, ...)', function () {
      var node = parse('"a" in items');
      expect(node.type).to.be('BinaryOp');
      expect(node.op).to.be('in');
    });
  });

  describe('trailing FILTER / FILTEREMPTY — consumed via parsePostfix', function () {
    // Commit 2 of Session 14b lifted the "parseExpr bails on FILTER
    // tokens" stop-condition — parsePostfix now consumes trailing
    // FILTER / FILTEREMPTY and wraps the preceding atom in an
    // IRFilterCallExpr. This is the mechanism that lets deep filters
    // (inside function args / bracket keys / object values) lower
    // through the IR path instead of falling back to legacy. Filter
    // name validation moves into parsePostfix at the same time.
    it('wraps the preceding atom in IRFilterCallExpr when a FILTEREMPTY trails', function () {
      var tokens = lexer.read('foo|upper');
      var parser = new TokenParser(tokens, filters, false, 1, 'expr.test');
      var node = parser.parseExpr(tokens);
      expect(node.type).to.be('FilterCall');
      expect(node.name).to.be('upper');
      expect(node.input.type).to.be('VarRef');
      expect(node.input.path).to.eql(['foo']);
    });

    it('wraps the preceding atom in IRFilterCallExpr when a FILTER with args trails', function () {
      var tokens = lexer.read('foo|default("x")');
      var parser = new TokenParser(tokens, filters, false, 1, 'expr.test');
      var node = parser.parseExpr(tokens);
      expect(node.type).to.be('FilterCall');
      expect(node.name).to.be('default');
      expect(node.input.path).to.eql(['foo']);
      expect(node.args.length).to.be(1);
      expect(node.args[0].type).to.be('Literal');
    });

    it('throws "Invalid filter" on an unknown filter name', function () {
      var tokens = lexer.read('foo|doesNotExist');
      var parser = new TokenParser(tokens, filters, false, 1, 'expr.test');
      expect(function () { parser.parseExpr(tokens); }).to.throwException(/Invalid filter/);
    });
  });

  describe('round-trip via emitExpr — byte-identity spot-checks', function () {
    /*
     * For simple expressions whose flat-concatenation form matches
     * TokenParser's output, lex → parseExpr → emitExpr produces the
     * same JS string as lex → TokenParser.parse().join(''). Full
     * byte-identity across every shape is the Commit 3+ gate when
     * real consumers are flipped. This commit only spot-checks.
     */
    function emit(source) {
      return backend.emitExpr(parse(source));
    }

    it('plain VarRef round-trips to the checkMatch ladder', function () {
      var js = emit('foo');
      expect(js).to.contain('_ctx.foo');
      expect(js).to.contain('typeof _ctx.foo !== "undefined"');
    });

    it('string literal round-trips via JSON.stringify', function () {
      expect(emit('"hello"')).to.be('"hello"');
    });

    it('number literal round-trips bare', function () {
      expect(emit('42')).to.be('42');
      expect(emit('-1.5')).to.be('-1.5');
    });

    it('single-segment fnCall round-trips to the FUNCTION pattern', function () {
      var js = emit('greet()');
      expect(js).to.be(
        '((typeof _ctx.greet !== "undefined") ? _ctx.greet : ' +
        '((typeof greet !== "undefined") ? greet : _fn))()'
      );
    });

    it('multi-segment fnCall round-trips to the method-call pattern', function () {
      var js = emit('user.greet()');
      expect(js).to.contain(' || _fn).call(');
      expect(js).to.contain('_ctx.user');
    });

    it('bracket access with string literal round-trips', function () {
      var js = emit('obj["name"]');
      expect(js).to.contain('["name"]');
    });

    it('arithmetic binary op round-trips with surrounding spaces', function () {
      expect(emit('1 + 2')).to.be('1 + 2');
      expect(emit('3 * 4')).to.be('3 * 4');
    });

    it('logic / comparator binary ops round-trip bare', function () {
      expect(emit('true && false')).to.be('true&&false');
      expect(emit('1 === 2')).to.be('1===2');
    });
  });
});
