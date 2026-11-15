var swig = require('../../lib/swig'),
  expect = require('../lib/expect.js'),
  Swig = swig.Swig;

function render(src, locals) {
  return new Swig({ cache: false }).render(src, { locals: locals || {} });
}

describe('Tag: for over a numeric subscript', function () {
  it('loops over arr[0]', function () {
    expect(render('{% for x in arr[0] %}{{ x }}{% endfor %}', { arr: [[1, 2]] })).to.equal('12');
  });

  it('loops over arr[1]', function () {
    expect(render('{% for x in arr[1] %}{{ x }}{% endfor %}', { arr: [[1], [2, 3]] })).to.equal('23');
  });

  it('loops over two numeric subscripts', function () {
    expect(render('{% for x in m[0][1] %}{{ x }}{% endfor %}', { m: [[0, [7, 8]]] })).to.equal('78');
  });

  it('binds a key and a value over obj[0]', function () {
    expect(render('{% for k, v in arr[0] %}{{ k }}{{ v }}{% endfor %}', { arr: [{ a: 1 }] })).to.equal('a1');
  });

  it('loops over a member after a numeric subscript', function () {
    expect(render('{% for x in arr[0].list %}{{ x }}{% endfor %}', { arr: [{ list: [4, 5] }] })).to.equal('45');
  });

  it('runs no item over a subscript that finds nothing', function () {
    expect(render('[{% for x in arr[5] %}x{% endfor %}]', { arr: [] })).to.equal('[]');
  });

  it('still refuses a bare number after in', function () {
    expect(function () {
      render('{% for x in 5 %}{{ x }}{% endfor %}');
    }).to.throwError(/^Unexpected number "5" on line 1\.$/);
  });

  it('loops over arr[0] on the async compile path', function (done) {
    var out = new Swig({ cache: false }).compile('{% for x in arr[0] %}{{ x }}{% endfor %}', { codegenMode: 'async' })({ arr: [[1, 2]] });
    Promise.resolve(out).then(function (r) {
      try {
        expect(r.output).to.equal('12');
        done();
      } catch (e) {
        done(e);
      }
    }, done);
  });
});
