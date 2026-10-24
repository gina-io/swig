var backend = require('@rhinostone/swig-core/lib/backend'),
  ir = require('@rhinostone/swig-core/lib/ir'),
  utils = require('@rhinostone/swig-core/lib/utils'),
  swig = require('../../lib/swig'),
  twig = require('@rhinostone/swig-twig'),
  expect = require('../lib/expect.js');


/*!
 * The opt-in binding flags of the IRFor node: `mapKeys` (one name over a
 * mapping binds each key) and `unpack` (two names over a list unpack each
 * item). The Jinja2 and Django frontends set them and have their own render
 * tests; these run the emitted loop directly, and check that native swig and
 * Twig, which never set them, keep binding the callback parameters.
 */
describe('swig-core — IRFor binding flags', function () {

  var E = String.fromCharCode(0xD83D, 0xDE00);

  // Compile a For node with the backend and call the body with a context, as
  // the engine does, without the filters and extensions it does not use.
  function run(node, ctx) {
    var body = backend.compile({ tokens: [node] }, [], {}),
      fn = new Function('_ctx', '_utils', 'var _output = "";\n' + body + '\nreturn _output;');
    return fn(ctx, utils);
  }

  // A body that prints the bound names through the context, so an undefined
  // value prints as "undefined".
  function show(names) {
    var parts = names.map(function (n) { return 'String(_ctx.' + n + ')'; });
    return [ir.legacyJS('_output += "[" + ' + parts.join(' + "=" + ') + ' + "]";\n')];
  }

  function loop(value, key, iterable, body, flag) {
    var node = ir.forStmt(value, ir.varRef([iterable]), body, key);
    if (flag) {
      node[flag] = true;
    }
    return node;
  }

  describe('without a flag', function () {
    it('binds the value and the key of each item', function () {
      expect(run(loop('v', 'k', 'p', show(['k', 'v'])), { p: [['a', 1], ['b', 2]] })).to.equal('[0=a,1][1=b,2]');
      expect(run(loop('v', 'k', 'p', show(['k', 'v'])), { p: { a: 1, b: 2 } })).to.equal('[a=1][b=2]');
      expect(run(loop('x', '__k', 'd', show(['x'])), { d: { a: 1, b: 2 } })).to.equal('[1][2]');
    });

    it('native swig and Twig loops keep the callback parameters', function () {
      var src = '{% for k, v in d %}{{ k }}{% endfor %}{% for x in d %}{{ x }}{% endfor %}';
      [swig.precompile(src).tpl.toString(), twig.precompile(src).tpl.toString()].forEach(function (body) {
        expect(body).to.contain('_utils.each(__l, function (v, k)');
        expect(body).to.contain('_utils.each(__l, function (x, __k)');
        expect(body).to.not.contain('__seq');
        expect(body).to.not.contain('_utils.unpack');
      });
    });
  });

  describe('mapKeys', function () {
    it('binds each key of a mapping, and loop.key keeps the key', function () {
      var body = [ir.legacyJS('_output += "[" + _ctx.x + ":" + _ctx.loop.key + "]";\n')];
      expect(run(loop('x', '__k', 'd', body, 'mapKeys'), { d: { a: 1, b: 2 } })).to.equal('[a:a][b:b]');
    });

    it('binds the items of a list and the characters of a string', function () {
      var body = [ir.legacyJS('_output += "[" + _ctx.x + ":" + _ctx.loop.key + "]";\n')];
      expect(run(loop('x', '__k', 'd', body, 'mapKeys'), { d: [5, 6] })).to.equal('[5:0][6:1]');
      expect(run(loop('x', '__k', 'd', body, 'mapKeys'), { d: 'ab' })).to.equal('[a:0][b:1]');
    });

    it('renders nothing for an empty or missing mapping', function () {
      expect(run(loop('x', '__k', 'd', show(['x']), 'mapKeys'), { d: {} })).to.equal('');
      expect(run(loop('x', '__k', 'd', show(['x']), 'mapKeys'), {})).to.equal('');
    });

    it('restores the outer value after the loop', function () {
      var ctx = { d: { a: 1 }, x: 'X' };
      run(loop('x', '__k', 'd', show(['x']), 'mapKeys'), ctx);
      expect(ctx.x).to.be('X');
    });
  });

  describe('unpack', function () {
    it('unpacks each pair of a list', function () {
      expect(run(loop('v', 'k', 'p', show(['k', 'v']), 'unpack'), { p: [['a', 1], ['b', 2]] })).to.equal('[a=1][b=2]');
    });

    it('unpacks the characters of a string, a surrogate pair kept together', function () {
      expect(run(loop('v', 'k', 'p', show(['k', 'v']), 'unpack'), { p: ['ab', 'cd'] })).to.equal('[a=b][c=d]');
      expect(run(loop('v', 'k', 'p', show(['k', 'v']), 'unpack'), { p: [E + 'x'] })).to.equal('[' + E + '=x]');
    });

    it('unpacks the keys of a mapping item', function () {
      expect(run(loop('v', 'k', 'p', show(['k', 'v']), 'unpack'), { p: [{ x: 1, y: 2 }] })).to.equal('[x=y]');
    });

    it('binds what an item holds when it does not hold two values', function () {
      expect(run(loop('v', 'k', 'p', show(['k', 'v']), 'unpack'), { p: [[1, 2, 3]] })).to.equal('[1=2]');
      expect(run(loop('v', 'k', 'p', show(['k', 'v']), 'unpack'), { p: [['a']] })).to.equal('[a=undefined]');
      expect(run(loop('v', 'k', 'p', show(['k', 'v']), 'unpack'), { p: [1, null] })).to.equal('[undefined=undefined][undefined=undefined]');
    });

    it('a missing value does not fall back to the item through the closure name', function () {
      var body = [ir.legacyJS('_output += "[" + ' + backend.emitExpr(ir.varRef(['v'])) + ' + "]";\n')];
      expect(run(loop('v', 'k', 'p', body, 'unpack'), { p: [['a']] })).to.equal('[]');
      expect(run(loop('v', 'k', 'p', body), { p: [['a']] })).to.equal('[a]');
    });

    it('keeps the key and the value over a mapping', function () {
      expect(run(loop('v', 'k', 'p', show(['k', 'v']), 'unpack'), { p: { a: 1, b: 2 } })).to.equal('[a=1][b=2]');
    });

    it('keeps loop.key as the index of the item', function () {
      var body = [ir.legacyJS('_output += _ctx.loop.key + ":" + _ctx.loop.index + ";";\n')];
      expect(run(loop('v', 'k', 'p', body, 'unpack'), { p: [['a', 1], ['b', 2]] })).to.equal('0:1;1:2;');
    });

    it('restores the outer values after the loop', function () {
      var ctx = { p: [['a', 1]], k: 'K', v: 'V' };
      run(loop('v', 'k', 'p', show(['k', 'v']), 'unpack'), ctx);
      expect(ctx.k).to.be('K');
      expect(ctx.v).to.be('V');
    });
  });

  describe('utils.unpack', function () {
    it('returns a list itself', function () {
      var list = [1, 2, 3];
      expect(utils.unpack(list)).to.be(list);
    });

    it('gives the first two characters of a string', function () {
      expect(utils.unpack('ab')).to.eql(['a', 'b']);
      expect(utils.unpack('abc')).to.eql(['a', 'b']);
      expect(utils.unpack('a')).to.eql(['a']);
      expect(utils.unpack('')).to.eql([]);
      expect(utils.unpack(E + 'x')).to.eql([E, 'x']);
      expect(utils.unpack(E)).to.eql([E]);
    });

    it('gives the keys of a mapping', function () {
      expect(utils.unpack({ x: 1, y: 2 })).to.eql(['x', 'y']);
      expect(utils.unpack({})).to.eql([]);
    });

    it('gives nothing for any other value', function () {
      expect(utils.unpack(5)).to.eql([]);
      expect(utils.unpack(true)).to.eql([]);
      expect(utils.unpack(null)).to.eql([]);
      expect(utils.unpack(undefined)).to.eql([]);
    });
  });

  describe('utils.values', function () {
    it('gives the own property values in key order', function () {
      var obj = Object.create({ inherited: 9 });
      obj.a = 1;
      obj.b = 2;
      expect(utils.values({ a: 1, b: 2 })).to.eql([1, 2]);
      expect(utils.values(obj)).to.eql([1, 2]);
      expect(utils.values({})).to.eql([]);
      expect(utils.values(null)).to.eql([]);
    });
  });
});
