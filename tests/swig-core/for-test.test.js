var backend = require('@rhinostone/swig-core/lib/backend'),
  ir = require('@rhinostone/swig-core/lib/ir'),
  utils = require('@rhinostone/swig-core/lib/utils'),
  expect = require('../lib/expect.js');


/*!
 * The opt-in `test` field of the IRFor node: a loop filter, run once per
 * item before the loop, that keeps the items it holds for. The Jinja2
 * frontend sets it and has its own render tests; these run the emitted loop
 * directly, in each binding mode.
 */
describe('swig-core — IRFor loop filter', function () {

  // Compile a For node with the backend and call the body with a context, as
  // the engine does, without the filters and extensions it does not use.
  function run(node, ctx) {
    var body = backend.compile({ tokens: [node] }, [], {}),
      fn = new Function('_ctx', '_utils', 'var _output = "";\n' + body + '\nreturn _output;');
    return fn(ctx, utils);
  }

  // A body that prints the bound names through the context.
  function show(names) {
    var parts = names.map(function (n) { return 'String(_ctx.' + n + ')'; });
    return [ir.legacyJS('_output += "[" + ' + parts.join(' + "=" + ') + ' + "]";\n')];
  }

  function loop(value, key, iterable, body, test, flag, emptyBody) {
    var node = ir.forStmt(value, ir.varRef([iterable]), body, key, emptyBody);
    node.test = test;
    if (flag) {
      node[flag] = true;
    }
    return node;
  }

  function gt(path, n) {
    return ir.binaryOp('>', ir.varRef(path), ir.literal('number', n));
  }

  function ne(path, s) {
    return ir.binaryOp('!==', ir.varRef(path), ir.literal('string', s));
  }

  describe('keeps the items the test holds for', function () {
    it('without a binding flag', function () {
      expect(run(loop('x', '__k', 'xs', show(['x']), gt(['x'], 1)), { xs: [1, 2, 3] })).to.equal('[2][3]');
      expect(run(loop('v', 'k', 'd', show(['k', 'v']), gt(['v'], 1)), { d: { a: 1, b: 2, c: 3 } })).to.equal('[b=2][c=3]');
    });

    it('with mapKeys: a mapping by key, a list by item, a string by character', function () {
      expect(run(loop('x', '__k', 'd', show(['x']), ne(['x'], 'a'), 'mapKeys'), { d: { a: 1, b: 2, c: 3 } })).to.equal('[b][c]');
      expect(run(loop('x', '__k', 'd', show(['x']), gt(['x'], 1), 'mapKeys'), { d: [1, 2, 3] })).to.equal('[2][3]');
      expect(run(loop('x', '__k', 's', show(['x']), ne(['x'], 'b'), 'mapKeys'), { s: 'abc' })).to.equal('[a][c]');
    });

    it('with unpack: each pair by its values, a mapping by key and value', function () {
      expect(run(loop('v', 'k', 'p', show(['k', 'v']), gt(['v'], 1), 'unpack'), { p: [['a', 1], ['b', 2], ['c', 3]] })).to.equal('[b=2][c=3]');
      expect(run(loop('v', 'k', 'p', show(['k', 'v']), ne(['k'], 'a'), 'unpack'), { p: { a: 1, b: 2 } })).to.equal('[b=2]');
    });
  });

  describe('the loop counts only the kept items', function () {
    it('loop.index, loop.length, loop.first and loop.last', function () {
      var body = [ir.legacyJS('_output += _ctx.loop.index + "/" + _ctx.loop.length + (_ctx.loop.first ? "F" : "") + (_ctx.loop.last ? "L" : "") + ";";\n')];
      expect(run(loop('x', '__k', 'xs', body, gt(['x'], 1), 'mapKeys'), { xs: [1, 2, 3] })).to.equal('1/2F;2/2L;');
    });

    it('the empty branch runs when no item is kept, and only then', function () {
      var empty = [ir.legacyJS('_output += "E";\n')];
      expect(run(loop('x', '__k', 'xs', show(['x']), gt(['x'], 5), 'mapKeys', empty), { xs: [1, 2] })).to.equal('E');
      expect(run(loop('x', '__k', 'xs', show(['x']), gt(['x'], 1), 'mapKeys', empty), { xs: [1, 2] })).to.equal('[2]');
      expect(run(loop('x', '__k', 'xs', show(['x']), gt(['x'], 1), 'mapKeys', empty), {})).to.equal('E');
    });
  });

  describe('scope', function () {
    it('the test sees the enclosing loop, not this one', function () {
      var inner = loop('y', '__k', 'ys', show(['y']), ir.binaryOp('===', ir.varRef(['loop', 'index']), ir.literal('number', 1)), 'mapKeys'),
        outer = ir.forStmt('x', ir.varRef(['xs']), [ir.legacyJS(backend.compile({ tokens: [inner] }, [], {}) + '_output += ";";\n')], '__k');
      outer.mapKeys = true;
      expect(run(outer, { xs: [1, 2], ys: ['a', 'b'] })).to.equal('[a][b];;');
    });

    it('restores the outer names after the test pass and after the loop', function () {
      var empty = [ir.legacyJS('_output += "E" + _ctx.x;\n')], ctx = { xs: [1, 2], x: 'X' };
      expect(run(loop('x', '__k', 'xs', show(['x']), gt(['x'], 5), 'mapKeys', empty), ctx)).to.equal('EX');
      expect(ctx.x).to.equal('X');
      ctx = { p: [['a', 1]], k: 'K', v: 'V' };
      expect(run(loop('v', 'k', 'p', show(['k', 'v']), gt(['v'], 0), 'unpack'), ctx)).to.equal('[a=1]');
      expect(ctx.k).to.equal('K');
      expect(ctx.v).to.equal('V');
    });
  });

  describe('guards and emit', function () {
    it('the test goes through the prototype-chain guard', function () {
      expect(function () {
        backend.compile({ tokens: [loop('x', '__k', 'xs', show(['x']), ir.varRef(['x', '__proto__']), 'mapKeys')] }, [], {});
      }).to.throwError(/Unsafe access/);
    });

    it('without a test the loop emits no filter pass', function () {
      var node = ir.forStmt('x', ir.varRef(['xs']), show(['x']), '__k');
      node.mapKeys = true;
      expect(backend.compile({ tokens: [node] }, [], {})).to.not.contain('__fout');
      expect(backend.compile({ tokens: [loop('x', '__k', 'xs', show(['x']), gt(['x'], 1), 'mapKeys')] }, [], {})).to.contain('__fout');
    });
  });
});
