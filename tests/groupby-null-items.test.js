var swig = require('../lib/swig'),
  filters = require('../lib/filters'),
  expect = require('./lib/expect.js'),
  Swig = swig.Swig;

/*!
 * Native groupBy leaves out a null or undefined item of the list, as it
 * leaves out an item that does not hold the key, where such an item made the
 * filter fail with a raw TypeError. The control cases rendered before the
 * fix too.
 */
var SRC = '{{ items|groupBy("k")|json }}';

function render(items) {
  return new Swig({ cache: false }).render(SRC, { locals: { items: items } });
}

function holed() {
  var items = [];
  items[1] = { k: 'a', v: 1 };
  return items;
}

describe('Filter: groupBy with null or undefined items', function () {
  it('leaves out a null item', function () {
    expect(render([null, { k: 'a', v: 1 }])).to.equal('{"a":[{"v":1}]}');
    expect(render([{ k: 'a', v: 1 }, null, { k: 'a', v: 2 }])).to.equal('{"a":[{"v":1},{"v":2}]}');
  });

  it('leaves out an undefined item and a hole', function () {
    expect(render([undefined, { k: 'b', v: 3 }])).to.equal('{"b":[{"v":3}]}');
    expect(render(holed())).to.equal('{"a":[{"v":1}]}');
  });

  it('gives an empty object for a list of null and undefined items only', function () {
    expect(render([null, undefined])).to.equal('{}');
  });

  it('leaves them out when called directly', function () {
    expect(filters.groupBy([null, { k: 'a', v: 1 }, undefined], 'k')).to.eql({ a: [{ v: 1 }] });
  });

  it('leaves them out on the async compile path', function (done) {
    var out = new Swig({ cache: false }).compile(SRC, { codegenMode: 'async' })({ items: [null, { k: 'a', v: 1 }, undefined] });
    out.then(function (r) {
      expect(r.output).to.equal('{"a":[{"v":1}]}');
      done();
    }).catch(done);
  });

  it('still groups a list without null or undefined items (control)', function () {
    expect(render([{ k: 'a', v: 1 }, { k: 'b', v: 2 }, { k: 'a', v: 3 }])).to.equal('{"a":[{"v":1},{"v":3}],"b":[{"v":2}]}');
  });

  it('still leaves out an item without the key, and returns a value that is not a list (control)', function () {
    expect(render([{ v: 1 }, { k: 'a', v: 2 }])).to.equal('{"a":[{"v":2}]}');
    expect(filters.groupBy('foo', 'k')).to.equal('foo');
    expect(filters.groupBy(null, 'k')).to.equal(null);
  });
});
