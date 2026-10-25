var expect = require('../lib/expect.js'),
  utils = require('../../packages/swig-core/lib/utils');


/*!
 * The block helpers of the async render path: callBlock renders a block
 * through an override when one is passed, giving it this template's version
 * as its parent; chainBlocks merges a template's own block functions with the
 * overrides of the template that extends it.
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

  it('calls the override with its own version as the parent', function () {
    expect(utils.callBlock({ b: block('child') }, 'b', {}, block('own'))).to.equal('child(own())');
  });

  it('passes the context to the block it renders', function () {
    var ctx = { v: 1 }, seen;
    utils.callBlock({ b: function (c) { seen = c; return ''; } }, 'b', ctx, block('own'));
    expect(seen).to.be(ctx);
  });

  it('reads only the overrides own properties, whatever the block name', function () {
    expect(utils.callBlock({ hasOwnProperty: block('child') }, 'hasOwnProperty', {}, block('own'))).to.equal('child(own())');
    expect(utils.callBlock({}, 'toString', {}, block('own'))).to.equal('own()');
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
      top = utils.chainBlocks({ b: block('t') }, middle);
    expect(utils.callBlock(top, 'b', {}, block('root'))).to.equal('c(m(t(root())))');
  });

  it('leaves its arguments unchanged', function () {
    var own = { b: block('m') }, inherited = { b: block('c') }, ownB = own.b, inheritedB = inherited.b;
    utils.chainBlocks(own, inherited);
    expect(own.b).to.be(ownB);
    expect(inherited.b).to.be(inheritedB);
    expect(Object.keys(own)).to.eql(['b']);
  });
});
