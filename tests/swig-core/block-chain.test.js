var expect = require('../lib/expect.js'),
  utils = require('../../packages/swig-core/lib/utils');


/*!
 * The block helpers of the async render path: chainBlocks folds a template's
 * own block functions with the overrides of the template that extends it, each
 * override getting this template's version as its parent; callBlock renders a
 * block through the folded functions and passes them down; callOwnBlock renders
 * a block tag that is not its template's definition of the name.
 */

function block(text) {
  return function (ctx, parentBlock) {
    return text + '(' + (parentBlock ? parentBlock(ctx) : '') + ')';
  };
}

describe('@rhinostone/swig-core — utils.callBlock', function () {

  it('renders its own version when no overrides are passed', function () {
    expect(utils.callBlock(undefined, 'b', {}, block('own'))).to.equal('own()');
  });

  it('renders its own version when the overrides hold no function of that name', function () {
    expect(utils.callBlock({ other: block('x') }, 'b', {}, block('own'))).to.equal('own()');
    expect(utils.callBlock({ b: 'not a function' }, 'b', {}, block('own'))).to.equal('own()');
  });

  it('calls the override with the template\'s own version as the parent, once folded', function () {
    var blocks = utils.chainBlocks({ b: block('own') }, { b: block('child') });
    expect(utils.callBlock(blocks, 'b', {})).to.equal('child(own())');
  });

  it('calls the function in the map with no parent of its own and passes the map down', function () {
    var seen, blocks = { b: function (c, parentBlock, map) { seen = [parentBlock, map]; return 'B'; } };
    expect(utils.callBlock(blocks, 'b', {})).to.equal('B');
    expect(seen[0]).to.be(undefined);
    expect(seen[1]).to.be(blocks);
  });

  it('keeps a body compiled by an earlier release working: its own version is the parent', function () {
    expect(utils.callBlock({ b: block('child') }, 'b', {}, block('own'))).to.equal('child(own())');
  });

  it('renders nothing when neither the map nor the tag holds the block', function () {
    expect(utils.callBlock(undefined, 'b', {})).to.equal('');
    expect(utils.callBlock({}, 'b', {})).to.equal('');
  });

  it('passes the context to the block it renders', function () {
    var ctx = { v: 1 }, seen;
    utils.callBlock({ b: function (c) { seen = c; return ''; } }, 'b', ctx, block('own'));
    expect(seen).to.be(ctx);
  });

  it('reads only the overrides own properties, whatever the block name', function () {
    var blocks = utils.chainBlocks({ hasOwnProperty: block('own') }, { hasOwnProperty: block('child') });
    expect(utils.callBlock(blocks, 'hasOwnProperty', {})).to.equal('child(own())');
    expect(utils.callBlock({}, 'toString', {}, block('own'))).to.equal('own()');
  });
});

describe('@rhinostone/swig-core — utils.callBlock nesting guard', function () {
  var DEEP = 'Block "b" is nested more than 200 levels deep: a block probably renders itself through a nested block or {% parent %}.';

  // A block that renders itself until the guard stops it, or `stop` levels down.
  function selfCalling(stop) {
    var calls = 0;
    return { calls: function () { return calls; }, fn: function fn(ctx, parentBlock, blocks) {
      calls += 1;
      return calls < stop ? utils.callBlock(blocks, 'b', ctx) : 'end';
    } };
  }

  it('runs 200 levels and stops at the next one', function () {
    var a = selfCalling(200), b = selfCalling(201);
    expect(utils.callBlock({ b: a.fn }, 'b', {})).to.equal('end');
    expect(a.calls()).to.equal(200);
    expect(function () { utils.callBlock({ b: b.fn }, 'b', {}); }).to.throwError(function (e) {
      expect(e.message).to.equal(DEEP);
    });
    expect(b.calls()).to.equal(200);
  });

  it('stops a block that renders itself across awaits', function (done) {
    var calls = 0;
    utils.callBlock({ b: async function (ctx, parentBlock, blocks) {
      calls += 1;
      await null;
      return utils.callBlock(blocks, 'b', ctx);
    } }, 'b', {}).then(function () {
      done(new Error('expected a rejection'));
    }, function (e) {
      expect(e.message).to.equal(DEEP);
      expect(calls).to.equal(200);
      done();
    }).catch(done);
  });

  it('restores the count after a block returns and after its promise resolves or rejects', function (done) {
    var blocks = {
      plain: function () { return 'p'; },
      later: function () { return Promise.resolve('l'); },
      rejects: function () { return Promise.reject(new Error('no')); }
    };
    function depth() {
      var syms = Object.getOwnPropertySymbols(blocks);
      return syms.length ? blocks[syms[0]] : 0;
    }
    expect(utils.callBlock(blocks, 'plain', {})).to.equal('p');
    expect(depth()).to.equal(0);
    utils.callBlock(blocks, 'later', {}).then(function (s) {
      expect(s).to.equal('l');
      expect(depth()).to.equal(0);
      return utils.callBlock(blocks, 'rejects', {});
    }).then(function () {
      throw new Error('expected a rejection');
    }, function (e) {
      expect(e.message).to.equal('no');
      expect(depth()).to.equal(0);
      done();
    }).catch(done);
  });

  it('counts per map, so another render inside this one starts at zero', function () {
    var inner = selfCalling(150), calls = 0, outer = { b: function (ctx, parentBlock, blocks) {
      calls += 1;
      return calls < 150 ? utils.callBlock(blocks, 'b', ctx) : utils.callBlock({ b: inner.fn }, 'b', ctx);
    } };
    expect(utils.callBlock(outer, 'b', {})).to.equal('end');
    expect(calls + inner.calls()).to.equal(300);
  });

  it('does not count when no map is passed', function () {
    expect(utils.callBlock(undefined, 'b', {}, block('own'))).to.equal('own()');
  });
});

describe('@rhinostone/swig-core — utils.callOwnBlock', function () {

  it('renders its own function when no nearer template holds the name', function () {
    var blocks = { b: block('chain') };
    expect(utils.callOwnBlock(blocks, undefined, 'b', {}, block('own'))).to.equal('own()');
    expect(utils.callOwnBlock(blocks, {}, 'b', {}, block('own'))).to.equal('own()');
    expect(utils.callOwnBlock(blocks, { other: block('x') }, 'b', {}, block('own'))).to.equal('own()');
  });

  it('renders the chain when a nearer template holds the name', function () {
    expect(utils.callOwnBlock({ b: block('chain') }, { b: block('near') }, 'b', {}, block('own'))).to.equal('chain()');
  });

  it('reads only own properties of the nearer functions', function () {
    expect(utils.callOwnBlock({}, {}, 'toString', {}, block('own'))).to.equal('own()');
    expect(utils.callOwnBlock({}, { toString: 'not a function' }, 'toString', {}, block('own'))).to.equal('own()');
  });

  it('passes the map down and counts the nesting on it', function () {
    var calls = 0, blocks = {}, own = function (ctx, parentBlock, map) {
      calls += 1;
      expect(map).to.be(blocks);
      return utils.callOwnBlock(map, undefined, 'b', ctx, own);
    };
    expect(function () { utils.callOwnBlock(blocks, undefined, 'b', {}, own); }).to.throwError(/nested more than 200 levels deep/);
    expect(calls).to.equal(200);
  });
});

describe('@rhinostone/swig-core — utils.chainBlocks', function () {

  it('keeps a template\'s own blocks when nothing extends it', function () {
    var own = block('m'), merged = utils.chainBlocks({ b: own }, undefined);
    expect(merged.b).to.be(own);
  });

  it('passes an override through when the template has no block of that name', function () {
    var child = block('c'), merged = utils.chainBlocks({}, { b: child });
    expect(merged.b).to.be(child);
  });

  it('gives an override this template\'s version as its parent, whose parent comes from above', function () {
    var merged = utils.chainBlocks({ b: block('m') }, { b: block('c') });
    expect(merged.b({}, block('g'))).to.equal('c(m(g()))');
    expect(merged.b({}, undefined)).to.equal('c(m())');
  });

  it('composes three levels in order', function () {
    var middle = utils.chainBlocks({ b: block('m') }, { b: block('c') }),
      top = utils.chainBlocks({ b: block('t') }, middle),
      root = utils.chainBlocks({ b: block('root') }, top);
    expect(utils.callBlock(root, 'b', {})).to.equal('c(m(t(root())))');
  });

  it('returns a map without a prototype, so a block name cannot find an inherited function', function () {
    var merged = utils.chainBlocks({ b: block('m') }, undefined);
    expect(Object.getPrototypeOf(merged)).to.be(null);
    expect(utils.callBlock(merged, 'toString', {})).to.equal('');
    expect(utils.callBlock(merged, 'constructor', {})).to.equal('');
  });

  it('passes the map down to the override and to the version it chains to', function () {
    var seen = [], fold = { marker: true }, merged = utils.chainBlocks({
      b: function (c, parentBlock, map) { seen.push(map); return 'm'; }
    }, {
      b: function (c, parentBlock, map) { seen.push(map); return parentBlock(c); }
    });
    expect(merged.b({}, undefined, fold)).to.equal('m');
    expect(seen[0]).to.be(fold);
    expect(seen[1]).to.be(fold);
  });

  it('leaves its arguments unchanged', function () {
    var own = { b: block('m') }, inherited = { b: block('c') }, ownB = own.b, inheritedB = inherited.b;
    utils.chainBlocks(own, inherited);
    expect(own.b).to.be(ownB);
    expect(inherited.b).to.be(inheritedB);
    expect(Object.keys(own)).to.eql(['b']);
  });
});
