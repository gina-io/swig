var django = require('@rhinostone/swig-django'),
  expect = require('../lib/expect.js');


/*!
 * Django for loops over `.items`, `.keys` and `.values`, beyond the cases
 * checked against Django in for-dict-parity.test.js: the async render path
 * renders what the sync path renders, a locals key named `_utils` does not
 * change the loop, values with no Django twin (a JavaScript function under
 * the key, an inherited method), and a one-name `.items` loop compiles.
 */
describe('@rhinostone/swig-django — for-loop .items / .keys / .values', function () {

  var cases = [
    ['{% for item in page.data.items %}[{{ item }}]{% endfor %}', function () { return { page: { data: { items: [1, 2] } } }; }],
    ['{% for v in d.values %}[{{ v }}]{% endfor %}', function () { return { d: { values: [7, 8], z: 1 } }; }],
    ['{% for k in d.keys %}[{{ k }}]{% endfor %}', function () { return { d: { keys: [7, 8], z: 1 } }; }],
    ['{% for a, b in d.items %}[{{ a }}={{ b }}]{% endfor %}', function () { return { d: { items: [[1, 2], [3, 4]], z: 1 } }; }],
    ['{% for x in d.items %}[{{ x }}]{% empty %}E{% endfor %}', function () { return { d: { items: 'ab' } }; }],
    ['{% for k, v in withKey.items %}[{{ k }}={{ v }}]{% endfor %}', function () { return { withKey: { items: [['x', 1], ['y', 2]], z: 9 } }; }],
    ['{% for pair in nope.items %}[{{ pair }}]{% empty %}E{% endfor %}', function () { return {}; }],
    ['{% for pair in d.items %}[{{ pair.0 }}={{ pair.1 }}]{% endfor %}', function () { return { d: { a: 1, b: 2 } }; }],
    ['{% for pair in arr.items %}[{{ pair }}]{% empty %}E{% endfor %}', function () { return { arr: [1, 2] }; }],
    ['{% for k, v in d.items %}[{{ k }}={{ v }}]{% endfor %}', function () { return { d: { a: 1, b: 2 } }; }]
  ];

  function render(src, locals) {
    return django.render(src, { locals: locals || {} });
  }

  function renderAsync(src, locals, cb) {
    var mem = django.loaders.memory({ '/t.html': src }, '/'),
      loader = {
        async: true,
        resolve: mem.resolve,
        load: function (id, done) {
          if (!done) {
            return mem.load(id);
          }
          setImmediate(function () {
            var out;
            try {
              out = mem.load(id);
            } catch (e) {
              return done(e);
            }
            done(null, out);
          });
        }
      };
    new django.Django({ loader: loader, cache: false }).renderFile('/t.html', locals, cb);
  }

  it('renders on the async render path what the sync path renders', function (done) {
    var pending = cases.length, failed = null;
    cases.forEach(function (c) {
      var sync = render(c[0], c[1]());
      renderAsync(c[0], c[1](), function (err, out) {
        if (!failed) {
          try {
            expect(err).to.equal(null);
            expect(out).to.equal(sync);
          } catch (e) {
            failed = e;
          }
        }
        pending -= 1;
        if (pending === 0) {
          done(failed);
        }
      });
    });
  });

  it('a locals key named _utils does not change the loop', function () {
    cases.forEach(function (c) {
      var plain = render(c[0], c[1]()),
        zero = c[1](),
        text = c[1]();
      zero._utils = { dictIter: 0, keys: 0, values: 0 };
      text._utils = { dictIter: 'x', keys: 'x', values: 'x' };
      expect(render(c[0], zero)).to.equal(plain);
      expect(render(c[0], text)).to.equal(plain);
    });
  });

  it('calls a function held under the key, as Django calls a callable', function () {
    expect(render('{% for k in d.keys %}[{{ k }}]{% endfor %}', { d: { keys: function () { return ['F']; }, z: 1 } })).to.equal('[F]');
  });

  it('walks the own keys of an object whose items method is inherited', function () {
    function Inst() {
      this.a = 1;
    }
    Inst.prototype.items = function () {
      return [['p', 'q']];
    };
    expect(render('{% for k, v in inst.items %}[{{ k }}={{ v }}]{% endfor %}', { inst: new Inst() })).to.equal('[a=1]');
  });

  it('compiles a one-name .items loop', function () {
    expect(function () {
      django.precompile('{% for pair in d.items %}{{ pair }}{% endfor %}', { filename: 'page.html' });
    }).to.not.throwException();
  });
});
