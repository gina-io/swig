var django = require('@rhinostone/swig-django'),
  expect = require('../lib/expect.js');


/*!
 * for-loop binding checked against Django 5.2. Each expectation is the
 * output Django gives for the same template, except in the tests that say
 * Django raises or unpacks otherwise: there the test pins what swig-django
 * renders.
 */
describe('@rhinostone/swig-django — for-loop dict keys parity with Django', function () {

  function render(src, locals) {
    return django.render(src, { locals: locals || {} });
  }

  describe('one loop variable over a dict binds each key', function () {
    it('binds the keys in order', function () {
      expect(render('{% for x in d %}[{{ x }}]{% endfor %}', { d: { b: 1, a: 2 } })).to.equal('[b][a]');
      expect(render('{% for x in d %}{{ forloop.counter }}{{ x }};{% endfor %}', { d: { a: 1, b: 2 } })).to.equal('1a;2b;');
      expect(render('{% for x in d %}{{ x }}{% if not forloop.last %},{% endif %}{% endfor %}', { d: { a: 1, b: 2, c: 3 } })).to.equal('a,b,c');
    });
    it('an empty dict runs the empty branch', function () {
      expect(render('{% for x in d %}[{{ x }}]{% empty %}E{% endfor %}', { d: {} })).to.equal('E');
    });
    it('.values, .keys and .items still give the values, the keys and the pairs', function () {
      expect(render('{% for v in d.values %}[{{ v }}]{% endfor %}', { d: { a: 1, b: 2 } })).to.equal('[1][2]');
      expect(render('{% for k in d.keys %}[{{ k }}]{% endfor %}', { d: { a: 1, b: 2 } })).to.equal('[a][b]');
      expect(render('{% for k, v in d.items %}[{{ k }}={{ v }}]{% endfor %}', { d: { a: 1, b: 2 } })).to.equal('[a=1][b=2]');
    });
    it('a list and a string still bind their items', function () {
      expect(render('{% for x in l %}[{{ x }}]{% endfor %}', { l: [1, 2] })).to.equal('[1][2]');
      expect(render('{% for x in s %}[{{ x }}]{% endfor %}', { s: 'ab' })).to.equal('[a][b]');
    });
  });
});
