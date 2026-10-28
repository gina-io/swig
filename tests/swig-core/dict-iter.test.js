var backend = require('@rhinostone/swig-core/lib/backend'),
  ir = require('@rhinostone/swig-core/lib/ir'),
  utils = require('@rhinostone/swig-core/lib/utils'),
  expect = require('../lib/expect.js');


/*!
 * The opt-in `dictIter` flag of the IRFor node and its helper,
 * `utils.dictIter`: a for loop over `<mapping>.keys`, `.values` or `.items`
 * reads the mapping's own key of that name first, as Django does, and only
 * otherwise applies the dict method. The Django frontend sets the flag and
 * has its own render tests (tests/swig-django/for-dict-parity.test.js and
 * for-dict-key.test.js).
 */
describe('swig-core — dict iteration (dictIter)', function () {

  // Compile a For node with the backend and call the body with a context, as
  // the engine does, without the filters and extensions it does not use.
  function run(node, ctx) {
    var body = backend.compile({ tokens: [node] }, [], {}),
      fn = new Function('_ctx', '_utils', 'var _output = "";\n' + body + '\nreturn _output;');
    return fn(ctx, utils);
  }

  // A Django-style loop: the mapping resolved through _utils.resolve, the
  // binding flag the Django tag sets for the number of names, and the flag.
  function loop(names, path, dictIter) {
    var ref = ir.varRef(path),
      node,
      parts = names.map(function (n) { return 'String(_ctx.' + n + ')'; });
    ref.resolve = true;
    node = ir.forStmt(names[names.length - 1], ref, [ir.legacyJS('_output += "[" + ' + parts.join(' + "=" + ') + ' + "]";\n')], names.length === 2 ? names[0] : '__k');
    if (names.length === 2) {
      node.unpack = true;
    } else {
      node.mapKeys = true;
    }
    if (dictIter) {
      node.dictIter = dictIter;
    }
    return node;
  }

  describe('utils.dictIter', function () {
    it('reads an own key of that name first', function () {
      expect(utils.dictIter({ items: [1, 2], z: 9 }, 'items')).to.eql([1, 2]);
      expect(utils.dictIter({ items: [1, 2], z: 9 }, 'items', true)).to.eql([1, 2]);
      expect(utils.dictIter({ keys: [7], z: 9 }, 'keys')).to.eql([7]);
      expect(utils.dictIter({ values: 'v', z: 9 }, 'values')).to.equal('v');
      expect(utils.dictIter({ values: null }, 'values')).to.equal(null);
    });

    it('calls a function held under the key, as the variable resolver does', function () {
      var held = { keys: function () { return ['F']; } },
        altering = function () { return ['X']; };
      altering.alters_data = true;
      expect(utils.dictIter(held, 'keys')).to.eql(['F']);
      expect(utils.dictIter({ items: altering }, 'items')).to.equal(undefined);
    });

    it('applies the dict method to a mapping without the key', function () {
      var d = { a: 1, b: 2 };
      expect(utils.dictIter(d, 'keys')).to.eql(['a', 'b']);
      expect(utils.dictIter(d, 'values')).to.eql([1, 2]);
      expect(utils.dictIter(d, 'items')).to.be(d);
      expect(utils.dictIter(d, 'items', true)).to.eql([['a', 1], ['b', 2]]);
      expect(utils.dictIter({ item: 1 }, 'items', true)).to.eql([['item', 1]]);
    });

    it('does not read an inherited key', function () {
      var obj = Object.create({ items: [9], keys: [9] });
      obj.a = 1;
      expect(utils.dictIter(obj, 'items')).to.be(obj);
      expect(utils.dictIter(obj, 'items', true)).to.eql([['a', 1]]);
      expect(utils.dictIter(obj, 'keys')).to.eql(['a']);
    });

    it('accepts a mapping without a prototype', function () {
      var held = Object.create(null),
        plain = Object.create(null);
      held.items = [1];
      plain.a = 1;
      expect(utils.dictIter(held, 'items', true)).to.eql([1]);
      expect(utils.dictIter(plain, 'keys')).to.eql(['a']);
      expect(utils.dictIter(plain, 'items', true)).to.eql([['a', 1]]);
    });

    it('does not read a named property of a list', function () {
      var arr = [1, 2];
      arr.items = [9];
      expect(utils.dictIter(arr, 'items')).to.eql([]);
      expect(utils.dictIter(arr, 'items', true)).to.eql([]);
    });

    it('gives a one-name items loop nothing for a value that is not a mapping', function () {
      expect(utils.dictIter(null, 'items', true)).to.eql([]);
      expect(utils.dictIter(undefined, 'items', true)).to.eql([]);
      expect(utils.dictIter('ab', 'items', true)).to.eql([]);
      expect(utils.dictIter(5, 'items', true)).to.eql([]);
      expect(utils.dictIter({}, 'items', true)).to.eql([]);
    });

    it('gives a missing mapping back to a two-name items loop, and no keys or values', function () {
      expect(utils.dictIter(undefined, 'items')).to.equal(undefined);
      expect(utils.dictIter(null, 'items')).to.equal(null);
      expect(utils.dictIter(undefined, 'keys')).to.eql([]);
      expect(utils.dictIter(null, 'values')).to.eql([]);
    });
  });

  describe('the For emit', function () {
    it('calls the helper on the mapping only when the flag is set', function () {
      var plain = backend.compile({ tokens: [loop(['k', 'v'], ['d'])] }, [], {}),
        two = backend.compile({ tokens: [loop(['k', 'v'], ['d'], { name: 'items' })] }, [], {}),
        one = backend.compile({ tokens: [loop(['p'], ['d'], { name: 'items', pairs: true })] }, [], {}),
        keys = backend.compile({ tokens: [loop(['k'], ['a', 'b'], { name: 'keys' })] }, [], {});
      expect(plain).to.not.contain('dictIter');
      expect(plain).to.contain('var __l = _utils.resolve(_ctx, ["d"]), __len');
      expect(two).to.contain('var __l = _utils.dictIter(_utils.resolve(_ctx, ["d"]), "items"), __len');
      expect(one).to.contain('var __l = _utils.dictIter(_utils.resolve(_ctx, ["d"]), "items", true), __len');
      expect(keys).to.contain('var __l = _utils.dictIter(_utils.resolve(_ctx, ["a","b"]), "keys"), __len');
    });

    it('iterates what the helper gives', function () {
      expect(run(loop(['x'], ['d'], { name: 'items', pairs: true }), { d: { items: [1, 2] } })).to.equal('[1][2]');
      expect(run(loop(['x'], ['d'], { name: 'items', pairs: true }), { d: { a: 1 } })).to.equal('[a,1]');
      expect(run(loop(['k', 'v'], ['d'], { name: 'items' }), { d: { items: [['x', 1]], z: 9 } })).to.equal('[x=1]');
      expect(run(loop(['k', 'v'], ['d'], { name: 'items' }), { d: { a: 1, b: 2 } })).to.equal('[a=1][b=2]');
      expect(run(loop(['k'], ['d'], { name: 'keys' }), { d: { a: 1, b: 2 } })).to.equal('[a][b]');
      expect(run(loop(['v'], ['d'], { name: 'values' }), { d: { values: [7], a: 1 } })).to.equal('[7]');
    });

    it('calls the helper through the closure, not through the template context', function () {
      var ctx = { d: { a: 1, b: 2 }, _utils: { dictIter: 0, keys: 0, values: 0 } };
      expect(run(loop(['k'], ['d'], { name: 'keys' }), ctx)).to.equal('[a][b]');
      expect(run(loop(['v'], ['d'], { name: 'values' }), ctx)).to.equal('[1][2]');
      expect(run(loop(['k', 'v'], ['d'], { name: 'items' }), ctx)).to.equal('[a=1][b=2]');
    });
  });
});
