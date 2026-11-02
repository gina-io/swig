var flavor = require('@rhinostone/swig-jinja2'),
  Jinja2 = flavor.Jinja2,
  expect = require('../lib/expect.js');

/*!
 * A built-in test that takes one argument (divisibleby, sameas and the
 * comparison tests) fails when the expression is reached if it gets another
 * number of arguments; Jinja2 3.1.6 raises a TypeError for each shape below
 * (measured). The bare argument takes no sign, so `x is gt -1` is
 * `(x is gt) - 1`: before, the test with no argument gave a value and the if
 * took a branch whatever x was. A test registered under one of these names
 * receives any number of arguments.
 */
describe('@rhinostone/swig-jinja2 — tests that take one argument', function () {

  function ifs(x) {
    return '{% if ' + x + ' %}Y{% else %}N{% endif %}';
  }

  function render(src, locals) {
    return new Jinja2({ cache: false }).render(src, { locals: locals || {} });
  }

  function renderAsync(src, locals, setup, cb) {
    var inst = new Jinja2({
      loader: {
        async: true,
        resolve: function (to) { return to; },
        load: function (id, done) {
          if (!done) { return src; }
          setImmediate(function () { done(null, src); });
        }
      }
    });
    if (setup) { setup(inst); }
    inst.renderFile('/t', locals || {}, cb);
  }

  function noArgument(name) {
    return new RegExp('Test "' + name + '" takes one argument, found none \\(write a negative number in parentheses: x is ' +
      name + '\\(-1\\)\\) on line 1\\.');
  }

  it('throws when a test that takes one argument gets none', function () {
    [
      ['x is gt -1', { x: 5 }, 'gt'],
      ['x is gt -1', { x: -5 }, 'gt'],
      ['t is lt -5', { t: 3 }, 'lt'],
      ['x is eq -1', { x: 3 }, 'eq'],
      ['x is eq +1', { x: 3 }, 'eq'],
      ['x is not gt -1', { x: 5 }, 'gt'],
      ['x is ge', { x: 1 }, 'ge'],
      ['x is greaterthan -1', { x: 1 }, 'greaterthan'],
      ['x is divisibleby -3', { x: 4 }, 'divisibleby'],
      ['x is divisibleby', { x: 4 }, 'divisibleby'],
      ['x is sameas -1', { x: 3 }, 'sameas']
    ].forEach(function (c) {
      expect(function () { render(ifs(c[0]), c[1]); }).to.throwError(noArgument(c[2]));
    });
  });

  it('throws when a test that takes one argument gets two', function () {
    ['x is eq(1, 2)', 'x is lt(1, 2)', 'x is divisibleby(3, 1)', 'x is sameas(1, 2)'].forEach(function (src) {
      var name = src.slice(5, src.indexOf('('));
      expect(function () { render(ifs(src), { x: 6 }); }).to.throwError(new RegExp('Test "' + name + '" takes one argument, found 2 on line 1\\.'));
    });
  });

  it('throws in an output and in a loop filter too', function () {
    expect(function () { render('{{ x is gt -1 }}', { x: 5 }); }).to.throwError(noArgument('gt'));
    expect(function () { render('{% for t in ts if t is lt -5 %}F{% endfor %}', { ts: [-10, 0, 10] }); }).to.throwError(noArgument('lt'));
  });

  it('renders a branch that is not reached', function () {
    expect(render('{% if false %}{{ x is gt -1 }}{% endif %}ok', { x: 1 })).to.equal('ok');
    expect(render('{{ "a" if true else (x is divisibleby) }}', { x: 1 })).to.equal('a');
  });

  it('takes a signed number in parentheses', function () {
    expect(render(ifs('x is gt(-1)'), { x: 5 })).to.equal('Y');
    expect(render(ifs('x is gt(-1)'), { x: -5 })).to.equal('N');
    expect(render('{% for t in ts if t is lt(-5) %}{{ t }}{% endfor %}', { ts: [-10, 0, 10] })).to.equal('-10');
    expect(render(ifs('x is divisibleby(-3)'), { x: 6 })).to.equal('Y');
    expect(render(ifs('x is divisibleby(-3)'), { x: 4 })).to.equal('N');
    expect(render(ifs('x is sameas(-1)'), { x: 3 })).to.equal('N');
  });

  it('throws on the async render path', function (done) {
    renderAsync(ifs('x is gt -1'), { x: 5 }, null, function (err) {
      try {
        expect(err.message).to.match(/^Test "gt" takes one argument, found none \(write a negative number in parentheses: x is gt\(-1\)\) on line 1 in file \/t\.$/);
        done();
      } catch (e) {
        done(e);
      }
    });
  });

  it('lets a test registered under one of the names receive any number of arguments', function (done) {
    function count() { return arguments.length; }
    var inst = new Jinja2();
    inst.setExtension('_test_gt', count);
    inst.setExtension('_test_divisibleby', count);
    inst.setExtension('_test_sameas', count);
    expect(inst.render('{{ 1 is gt() }}|{{ 1 is gt(2, 3) }}|{{ 4 is divisibleby }}|{{ 3 is sameas(1, 2) }}')).to.equal('1|3|1|3');
    renderAsync('{{ 1 is gt() }}|{{ 4 is divisibleby(1, 2) }}', {}, function (i) {
      i.setExtension('_test_gt', count);
      i.setExtension('_test_divisibleby', count);
    }, function (err, out) {
      try {
        expect(err).to.be(null);
        expect(out).to.equal('1|3');
        done();
      } catch (e) {
        done(e);
      }
    });
  });
});
