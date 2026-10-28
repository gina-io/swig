var django = require('@rhinostone/swig-django'),
  filters = require('@rhinostone/swig-django/lib/filters'),
  expect = require('../lib/expect.js');


/*!
 * `{% cycle %}` escapes its value with the region's strategy, as `{{ }}` and
 * `{% firstof %}` do. Django has no `js` strategy, so the expectations are
 * swig's own `{{ }}` output and the `e` filter with the same strategy.
 */
describe('@rhinostone/swig-django — cycle and a string autoescape strategy', function () {

  var val = '<x\'"&>';

  function render(opts, src) {
    return new django.Django(Object.assign({ cache: false }, opts)).render(src, { locals: { a: val } });
  }

  it('escapes for JavaScript under the js strategy, as {{ }} and firstof do', function () {
    var js = { autoescape: 'js' };
    expect(render(js, '{% cycle a "z" %}')).to.equal(filters.e(val, 'js'));
    expect(render(js, '{% cycle a "z" %}')).to.equal(render(js, '{{ a }}'));
    expect(render(js, '{% cycle a "z" %}')).to.equal(render(js, '{% firstof a %}'));
    expect(render(js, '{% for i in "ab" %}[{% cycle a "z" %}]{% endfor %}')).to.equal('[' + filters.e(val, 'js') + '][z]');
  });

  it('keeps HTML escaping under html and true, and no escaping when it is off', function () {
    expect(render({ autoescape: 'html' }, '{% cycle a "z" %}')).to.equal(filters.e(val));
    expect(render({ autoescape: true }, '{% cycle a "z" %}')).to.equal(filters.e(val));
    expect(render({ autoescape: false }, '{% cycle a "z" %}')).to.equal(val);
    expect(render({ autoescape: 'js' }, '{% autoescape off %}{% cycle a "z" %}{% endautoescape %}')).to.equal(val);
  });

  it('escapes the same way on the async render path', function (done) {
    var mem = django.loaders.memory({ '/e.html': '{% for i in "ab" %}[{% cycle a "z" %}]{% endfor %}' }, '/'),
      loader = {
        async: true,
        resolve: mem.resolve,
        load: function (id, cb) {
          if (!cb) {
            return mem.load(id);
          }
          setImmediate(function () {
            var out;
            try {
              out = mem.load(id);
            } catch (e) {
              return cb(e);
            }
            cb(null, out);
          });
        }
      };
    new django.Django({ loader: loader, cache: false, autoescape: 'js' }).renderFile('/e.html', { a: val }, function (err, out) {
      try {
        expect(err).to.be(null);
        expect(out).to.equal('[' + filters.e(val, 'js') + '][z]');
        done();
      } catch (e) {
        done(e);
      }
    });
  });
});
