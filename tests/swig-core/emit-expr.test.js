var backend = require('@rhinostone/swig-core/lib/backend'),
  ir = require('@rhinostone/swig-core/lib/ir'),
  expect = require('expect.js');


/*!
 * Acceptance tests for backend.emitExpr — the IR → JS-source reducer
 * introduced in #T15 Session 14a (Commit 1).
 *
 * The reducer is standalone this commit: no statement emitter calls it
 * yet. Tests cover every IRExpr factory shape plus the two CVE-2023-25345
 * guards (IRVarRef path segments, IRAccess string-literal keys).
 *
 * Byte-identity with TokenParser's checkMatch / FUNCTION / PARENOPEN-
 * after-VAR output shapes is the contract for the upcoming Commits 3-8
 * migrations. The cases below fix that contract in tests.
 */
describe('swig-core/lib/backend — emitExpr', function () {

  describe('IRLiteral', function () {
    it('emits strings via JSON.stringify so quotes / backslashes escape cleanly', function () {
      expect(backend.emitExpr(ir.literal('string', 'hello'))).to.be('"hello"');
      expect(backend.emitExpr(ir.literal('string', 'he said "hi"'))).to.be('"he said \\"hi\\""');
      expect(backend.emitExpr(ir.literal('string', 'a\\b'))).to.be('"a\\\\b"');
      expect(backend.emitExpr(ir.literal('string', ''))).to.be('""');
    });

    it('emits numbers as bare decimal source', function () {
      expect(backend.emitExpr(ir.literal('number', 0))).to.be('0');
      expect(backend.emitExpr(ir.literal('number', 42))).to.be('42');
      expect(backend.emitExpr(ir.literal('number', -1.5))).to.be('-1.5');
    });

    it('emits the two booleans and the two nullish literals', function () {
      expect(backend.emitExpr(ir.literal('bool', true))).to.be('true');
      expect(backend.emitExpr(ir.literal('bool', false))).to.be('false');
      expect(backend.emitExpr(ir.literal('null', null))).to.be('null');
      expect(backend.emitExpr(ir.literal('undefined', undefined))).to.be('undefined');
    });

    it('throws on an unknown literal kind', function () {
      expect(function () {
        backend.emitExpr({ type: 'Literal', kind: 'bigint', value: 0 });
      }).to.throwException(/unknown literal kind/);
    });
  });

  describe('IRVarRef', function () {
    it('emits a byte-identical checkMatch ladder for a single-segment path', function () {
      var js = backend.emitExpr(ir.varRef(['foo']));
      expect(js).to.be(
        '(((typeof _ctx.foo !== "undefined" && _ctx.foo !== null) ? ' +
        '((typeof _ctx.foo !== "undefined" && _ctx.foo !== null) ? _ctx.foo : "") : ' +
        '((typeof foo !== "undefined" && foo !== null) ? foo : "")) !== null ? ' +
        '((typeof _ctx.foo !== "undefined" && _ctx.foo !== null) ? ' +
        '((typeof _ctx.foo !== "undefined" && _ctx.foo !== null) ? _ctx.foo : "") : ' +
        '((typeof foo !== "undefined" && foo !== null) ? foo : "")) : "" )'
      );
    });

    it('chains dot-path null checks for a multi-segment path', function () {
      var js = backend.emitExpr(ir.varRef(['user', 'profile', 'name']));
      // Just spot-check the key structural invariants — the full string is
      // covered by the single-segment case above.
      expect(js).to.contain('_ctx.user.profile.name');
      expect(js).to.contain('_ctx.user.profile !== undefined');
      expect(js).to.contain('_ctx.user !== null');
      expect(js).to.contain('user.profile !== undefined');
    });

    it('throws CVE-2023-25345 on a dangerous segment in the path', function () {
      expect(function () {
        backend.emitExpr(ir.varRef(['__proto__']));
      }).to.throwException(/CVE-2023-25345/);
      expect(function () {
        backend.emitExpr(ir.varRef(['foo', 'constructor']));
      }).to.throwException(/CVE-2023-25345/);
      expect(function () {
        backend.emitExpr(ir.varRef(['foo', 'prototype', 'bar']));
      }).to.throwException(/CVE-2023-25345/);
    });

    it('throws on an empty path', function () {
      expect(function () {
        backend.emitExpr(ir.varRef([]));
      }).to.throwException(/path must be a non-empty array/);
    });
  });

  describe('IRAccess', function () {
    it('emits object[key] with both operands recursively reduced', function () {
      var node = ir.access(ir.varRef(['items']), ir.literal('number', 0));
      var js = backend.emitExpr(node);
      expect(js).to.match(/^\(.*\)\[0\]$/);
    });

    it('allows non-dangerous string-literal keys', function () {
      var node = ir.access(ir.varRef(['obj']), ir.literal('string', 'name'));
      var js = backend.emitExpr(node);
      expect(js).to.contain('["name"]');
    });

    it('throws CVE-2023-25345 on a dangerous string-literal key', function () {
      expect(function () {
        backend.emitExpr(ir.access(ir.varRef(['foo']), ir.literal('string', '__proto__')));
      }).to.throwException(/CVE-2023-25345/);
      expect(function () {
        backend.emitExpr(ir.access(ir.varRef(['foo']), ir.literal('string', 'constructor')));
      }).to.throwException(/CVE-2023-25345/);
      expect(function () {
        backend.emitExpr(ir.access(ir.varRef(['foo']), ir.literal('string', 'prototype')));
      }).to.throwException(/CVE-2023-25345/);
    });

    it('does not guard non-literal (runtime) keys — matches the documented scope', function () {
      // Runtime bracket access with a variable key cannot be guarded at
      // emit time. See .claude/security.md § What the guards do NOT
      // protect against.
      var node = ir.access(ir.varRef(['foo']), ir.varRef(['key']));
      expect(function () { backend.emitExpr(node); }).not.to.throwException();
    });
  });

  describe('IRBinaryOp', function () {
    it('emits arithmetic ops with surrounding spaces', function () {
      var js = backend.emitExpr(ir.binaryOp('+', ir.literal('number', 1), ir.literal('number', 2)));
      expect(js).to.be('1 + 2');
      expect(backend.emitExpr(ir.binaryOp('*', ir.literal('number', 3), ir.literal('number', 4)))).to.be('3 * 4');
      expect(backend.emitExpr(ir.binaryOp('%', ir.literal('number', 7), ir.literal('number', 2)))).to.be('7 % 2');
    });

    it('emits logic / comparator ops bare to match TokenParser output', function () {
      expect(backend.emitExpr(ir.binaryOp('&&', ir.literal('bool', true), ir.literal('bool', false)))).to.be('true&&false');
      expect(backend.emitExpr(ir.binaryOp('||', ir.literal('bool', true), ir.literal('bool', false)))).to.be('true||false');
      expect(backend.emitExpr(ir.binaryOp('===', ir.literal('number', 1), ir.literal('number', 2)))).to.be('1===2');
      expect(backend.emitExpr(ir.binaryOp('!==', ir.literal('number', 1), ir.literal('number', 2)))).to.be('1!==2');
      expect(backend.emitExpr(ir.binaryOp('<=', ir.literal('number', 1), ir.literal('number', 2)))).to.be('1<=2');
    });

    it('emits `in` with surrounding spaces so the keyword detokenises', function () {
      var js = backend.emitExpr(ir.binaryOp('in', ir.literal('string', 'a'), ir.varRef(['items'])));
      expect(js).to.match(/^"a" in \(/);
    });
  });

  describe('IRUnaryOp', function () {
    it('emits op and operand bare', function () {
      expect(backend.emitExpr(ir.unaryOp('!', ir.literal('bool', true)))).to.be('!true');
      expect(backend.emitExpr(ir.unaryOp('-', ir.literal('number', 5)))).to.be('-5');
      expect(backend.emitExpr(ir.unaryOp('+', ir.literal('number', 5)))).to.be('+5');
    });
  });

  describe('IRConditional', function () {
    it('emits a parenthesised ternary', function () {
      var node = ir.conditional(
        ir.literal('bool', true),
        ir.literal('string', 'yes'),
        ir.literal('string', 'no')
      );
      expect(backend.emitExpr(node)).to.be('(true ? "yes" : "no")');
    });
  });

  describe('IRArrayLiteral', function () {
    it('emits brackets with comma-separated elements', function () {
      var node = ir.arrayLiteral([
        ir.literal('number', 1),
        ir.literal('number', 2),
        ir.literal('number', 3)
      ]);
      expect(backend.emitExpr(node)).to.be('[1, 2, 3]');
    });

    it('emits an empty array as `[]`', function () {
      expect(backend.emitExpr(ir.arrayLiteral([]))).to.be('[]');
    });
  });

  describe('IRObjectLiteral', function () {
    it('emits curlies with comma-separated key:value pairs', function () {
      var node = ir.objectLiteral([
        ir.objectProperty(ir.literal('string', 'name'), ir.literal('string', 'alice')),
        ir.objectProperty(ir.literal('string', 'age'), ir.literal('number', 30))
      ]);
      expect(backend.emitExpr(node)).to.be('{"name":"alice", "age":30}');
    });

    it('emits an empty object as `{}`', function () {
      expect(backend.emitExpr(ir.objectLiteral([]))).to.be('{}');
    });
  });

  describe('IRFnCall', function () {
    it('single-segment VarRef callee — emits the FUNCTION pattern with _fn fallback', function () {
      var js = backend.emitExpr(ir.fnCall(ir.varRef(['greet']), []));
      expect(js).to.be(
        '((typeof _ctx.greet !== "undefined") ? _ctx.greet : ' +
        '((typeof greet !== "undefined") ? greet : _fn))()'
      );
    });

    it('single-segment VarRef callee — passes args through emitExpr', function () {
      var js = backend.emitExpr(ir.fnCall(
        ir.varRef(['greet']),
        [ir.literal('string', 'world'), ir.literal('number', 42)]
      ));
      expect(js).to.contain('))("world", 42)');
    });

    it('multi-segment VarRef callee — emits the method-call PARENOPEN-after-VAR pattern', function () {
      var js = backend.emitExpr(ir.fnCall(ir.varRef(['user', 'greet']), []));
      expect(js).to.contain(' || _fn).call(');
      // Receiver = path minus last, so the .call() argument uses
      // checkMatch over ['user'] alone.
      expect(js).to.contain('_ctx.user');
      expect(js).to.match(/\|\| _fn\)\.call\([^,]+\)$/);
    });

    it('multi-segment VarRef callee — passes args after the receiver', function () {
      var js = backend.emitExpr(ir.fnCall(
        ir.varRef(['user', 'greet']),
        [ir.literal('string', 'hi')]
      ));
      expect(js).to.contain(' || _fn).call(');
      expect(js).to.match(/, "hi"\)$/);
    });

    it('non-VarRef callee falls through to a plain call', function () {
      var node = ir.fnCall(
        ir.access(ir.varRef(['handlers']), ir.literal('string', 'go')),
        [ir.literal('number', 1)]
      );
      var js = backend.emitExpr(node);
      expect(js).to.match(/^\(.*\)\(1\)$/);
    });

    it('throws CVE-2023-25345 on a dangerous segment in the callee path', function () {
      expect(function () {
        backend.emitExpr(ir.fnCall(ir.varRef(['constructor']), []));
      }).to.throwException(/CVE-2023-25345/);
      expect(function () {
        backend.emitExpr(ir.fnCall(ir.varRef(['foo', 'constructor']), []));
      }).to.throwException(/CVE-2023-25345/);
    });
  });

  describe('IRFilterCallExpr', function () {
    it('emits _filters["<name>"](<input>) with no args', function () {
      var js = backend.emitExpr(ir.filterCallExpr('upper', ir.varRef(['name'])));
      expect(js).to.contain('_filters["upper"](');
      expect(js).to.contain('_ctx.name');
      expect(js.indexOf(', ')).to.be(-1);
    });

    it('emits args after the input expression', function () {
      var js = backend.emitExpr(ir.filterCallExpr(
        'default',
        ir.varRef(['x']),
        [ir.literal('string', 'fallback')]
      ));
      expect(js).to.contain('_filters["default"](');
      expect(js).to.contain(', "fallback")');
    });

    it('chains via nested input', function () {
      var inner = ir.filterCallExpr('upper', ir.varRef(['x']));
      var outer = ir.filterCallExpr('reverse', inner);
      var js = backend.emitExpr(outer);
      expect(js.indexOf('_filters["reverse"](_filters["upper"](')).to.be(0);
    });

    it('accepts another IRExpr as input (e.g. a BinaryOp)', function () {
      var bin = ir.binaryOp('+', ir.varRef(['a']), ir.varRef(['b']));
      var js = backend.emitExpr(ir.filterCallExpr('upper', bin));
      expect(js.indexOf('_filters["upper"](')).to.be(0);
    });
  });

  describe('dispatch / validation', function () {
    it('throws on a missing node', function () {
      expect(function () { backend.emitExpr(null); }).to.throwException(/expected an IR expression node/);
      expect(function () { backend.emitExpr(undefined); }).to.throwException(/expected an IR expression node/);
    });

    it('throws on an unknown IR type', function () {
      expect(function () {
        backend.emitExpr({ type: 'ZzzNotATypeZzz' });
      }).to.throwException(/unknown IR expression type/);
    });

    it('accepts a deps override for dangerousProps', function () {
      var hit = [];
      var deps = {
        dangerousProps: ['blocked'],
        throwError: function (msg) { hit.push(msg); throw new Error(msg); }
      };
      expect(function () {
        backend.emitExpr(ir.varRef(['blocked']), deps);
      }).to.throwException();
      expect(hit.length).to.be(1);
      expect(hit[0]).to.match(/Unsafe access to "blocked"/);
    });

    it('accepts a deps override for throwError', function () {
      var captured;
      var deps = {
        throwError: function (msg, line, filename) {
          captured = { msg: msg, line: line, filename: filename };
          throw new Error(msg);
        }
      };
      var node = ir.varRef(['__proto__']);
      node.loc = { line: 12, filename: 'tpl.html' };
      expect(function () {
        backend.emitExpr(node, deps);
      }).to.throwException();
      expect(captured.msg).to.match(/CVE-2023-25345/);
      expect(captured.line).to.be(12);
      expect(captured.filename).to.be('tpl.html');
    });
  });
});
