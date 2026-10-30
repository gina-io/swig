var expect = require('../lib/expect.js'),
  swigModule = require('../../lib/swig'),
  engine = require('../../packages/swig-core/lib/engine');

/*!
 * engine.resolveBlocks builds the token list of an extending template on the
 * sync render path: one chain of definitions per block name, without changing
 * any parse tree.
 */

function parsed(files) {
  var eng = new swigModule.Swig({ loader: swigModule.loaders.memory(files, '/'), cache: false });
  return function (name) {
    return eng.parseFile(name, { filename: name });
  };
}

function snapshot(tree) {
  return JSON.stringify(tree, function (k, v) {
    return typeof v === 'function' ? 'fn:' + v.toString().length : v;
  });
}

var files = {
  '/base.html': '<{% block outer %}O[{% block inner %}I{% endblock %}]{% endblock %}|{% if x %}{% block other %}B{% endblock %}{% endif %}|{% if x %}Y{% endif %}>',
  '/mid.html': '{% extends "base.html" %}{% set a = "m" %}{% block inner %}M{% parent %}{% endblock %}',
  '/t.html': '{% extends "mid.html" %}{% set a = "c" %}{% block outer %}X[{% block inner %}C{% parent %}{% endblock %}]{% endblock %}{% block other %}Z{% endblock %}'
};

describe('@rhinostone/swig-core — engine.resolveBlocks', function () {

  it('leaves every parse tree as it was', function () {
    var parse = parsed(files), chain = [parse('/t.html'), parse('/mid.html'), parse('/base.html')],
      before = chain.map(snapshot),
      tokens = chain.map(function (t) { return t.tokens; }),
      inner = chain[2].tokens[1].content;
    engine.resolveBlocks(chain);
    expect(chain.map(snapshot)).to.eql(before);
    chain.forEach(function (t, i) { expect(t.tokens).to.be(tokens[i]); });
    expect(chain[2].tokens[1].content).to.be(inner);
  });

  it('copies a block tag it resolves, and a tag whose content holds one', function () {
    var parse = parsed(files), base = parse('/base.html'), out = engine.resolveBlocks([parse('/t.html'), parse('/mid.html'), base]),
      list = out.filter(function (t) { return t && t.name === 'if'; });
    expect(list.length).to.equal(2);
    expect(base.tokens.indexOf(list[0])).to.equal(-1);
  });

  it('keeps a tag whose content holds no block', function () {
    var parse = parsed(files), base = parse('/base.html'), out = engine.resolveBlocks([parse('/t.html'), parse('/mid.html'), base]),
      list = out.filter(function (t) { return t && t.name === 'if'; });
    expect(base.tokens.indexOf(list[1])).to.not.equal(-1);
  });

  it('prepends the block-level tags of the extending templates, nearest first', function () {
    var parse = parsed(files), out = engine.resolveBlocks([parse('/t.html'), parse('/mid.html'), parse('/base.html')]);
    expect(out[0].name).to.equal('set');
    expect(out[1].name).to.equal('set');
    expect(out[0].args.join('')).to.contain('"c"');
    expect(out[1].args.join('')).to.contain('"m"');
  });

  it('carries the farther definitions of a name as parents entries, nearest first', function () {
    var parse = parsed(files), out = engine.resolveBlocks([parse('/t.html'), parse('/mid.html'), parse('/base.html')]),
      outer = out.filter(function (t) { return t && t.name === 'block'; })[0],
      inner = outer.content.filter(function (t) { return t && t.name === 'block'; })[0];
    expect(outer.parentChain.map(function (e) { return e.name; })).to.eql(['/base.html']);
    expect(inner.parentChain.map(function (e) { return e.name; })).to.eql(['/mid.html', '/base.html']);
    expect(inner.parentChain[0].blocks.inner.name).to.equal('block');
  });

  it('returns the root token list as it is when no template holds a block', function () {
    var parse = parsed({ '/base.html': 'A{% if x %}B{% endif %}', '/t.html': '{% extends "base.html" %}' }),
      base = parse('/base.html'), out = engine.resolveBlocks([parse('/t.html'), base]);
    expect(out).to.eql(base.tokens);
    expect(out[1]).to.be(base.tokens[1]);
  });
});
