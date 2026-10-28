var django = require('@rhinostone/swig-django'),
  expect = require('../lib/expect.js');


/*!
 * for loops over .items, .keys and .values of a value that is not a mapping,
 * checked against Django 5.2. Each expectation is the output Django gives
 * for the same template.
 */
describe('@rhinostone/swig-django — for-loop dict methods over a value that is not a mapping', function () {

  function render(src, locals) {
    return django.render(src, { locals: locals || {} });
  }

  describe('a value that is not a mapping has no items, keys or values, as in Django', function () {
    it('a list', function () {
      expect(render('{% for k, v in arr.items %}[{{ k }}={{ v }}]{% empty %}E{% endfor %}', { arr: [[1, 2]] })).to.equal('E');
      expect(render('{% for k, v in arr.items %}[{{ k }}={{ v }}]{% endfor %}', { arr: [['a', 1], ['b', 2]] })).to.equal('');
      expect(render('{% for k in arr.keys %}[{{ k }}]{% empty %}E{% endfor %}', { arr: ['a', 'b'] })).to.equal('E');
      expect(render('{% for v in arr.values %}[{{ v }}]{% empty %}E{% endfor %}', { arr: ['a', 'b'] })).to.equal('E');
      expect(render('{% for k in arr.keys %}[{{ k }}]{% empty %}E{% endfor %}', { arr: [] })).to.equal('E');
    });
    it('a string', function () {
      expect(render('{% for k in s.keys %}[{{ k }}]{% empty %}E{% endfor %}', { s: 'ab' })).to.equal('E');
      expect(render('{% for v in s.values %}[{{ v }}]{% empty %}E{% endfor %}', { s: 'ab' })).to.equal('E');
      expect(render('{% for k, v in s.items %}[{{ k }}={{ v }}]{% empty %}E{% endfor %}', { s: 'ab' })).to.equal('E');
    });
    it('a number or a boolean', function () {
      expect(render('{% for k in n.keys %}[{{ k }}]{% empty %}E{% endfor %}', { n: 5 })).to.equal('E');
      expect(render('{% for v in n.values %}[{{ v }}]{% empty %}E{% endfor %}', { n: 5 })).to.equal('E');
      expect(render('{% for k, v in n.items %}[{{ k }}]{% empty %}E{% endfor %}', { n: 5 })).to.equal('E');
      expect(render('{% for k in b.keys %}[{{ k }}]{% empty %}E{% endfor %}', { b: true })).to.equal('E');
    });
    it('a list under a path', function () {
      expect(render('{% for k in a.b.keys %}[{{ k }}]{% empty %}E{% endfor %}', { a: { b: ['x', 'y'] } })).to.equal('E');
      expect(render('{% for v in a.b.values %}[{{ v }}]{% empty %}E{% endfor %}', { a: { b: ['x', 'y'] } })).to.equal('E');
    });
  });

  describe('a mapping keeps the dict methods', function () {
    it('keys, values and items', function () {
      expect(render('{% for k in d.keys %}[{{ k }}]{% endfor %}', { d: { a: 1, b: 2 } })).to.equal('[a][b]');
      expect(render('{% for v in d.values %}[{{ v }}]{% endfor %}', { d: { a: 1, b: 2 } })).to.equal('[1][2]');
      expect(render('{% for k, v in d.items %}[{{ k }}={{ v }}]{% endfor %}', { d: { a: 1 } })).to.equal('[a=1]');
    });
    it('a missing or None mapping runs the empty branch', function () {
      expect(render('{% for k in nope.keys %}[{{ k }}]{% empty %}E{% endfor %}')).to.equal('E');
      expect(render('{% for k, v in z.items %}[{{ k }}]{% empty %}E{% endfor %}', { z: null })).to.equal('E');
      expect(render('{% for v in z.values %}[{{ v }}]{% empty %}E{% endfor %}', { z: null })).to.equal('E');
    });
  });
});
