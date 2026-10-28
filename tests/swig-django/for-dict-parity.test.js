var django = require('@rhinostone/swig-django'),
  expect = require('../lib/expect.js');


/*!
 * for loops over .items, .keys and .values checked against Django 5.2. Each
 * expectation is the output Django gives for the same template, except in
 * the test that says Django does otherwise: there the test pins what
 * swig-django renders.
 */
describe('@rhinostone/swig-django — for-loop .items / .keys / .values parity with Django', function () {

  function render(src, locals) {
    return django.render(src, { locals: locals || {} });
  }

  describe('a mapping\'s own items, keys or values key is read first, as in Django', function () {
    it('reads a key named items, keys or values', function () {
      expect(render('{% for item in page.data.items %}[{{ item }}]{% endfor %}', { page: { data: { items: [1, 2] } } })).to.equal('[1][2]');
      expect(render('{% for item in page.data.items %}<li>{{ item.name }}</li>{% endfor %}', { page: { data: { title: 'T', items: [{ name: 'a' }, { name: 'b' }] } } })).to.equal('<li>a</li><li>b</li>');
      expect(render('{% for v in d.values %}[{{ v }}]{% endfor %}', { d: { values: [7, 8], z: 1 } })).to.equal('[7][8]');
      expect(render('{% for k in d.keys %}[{{ k }}]{% endfor %}', { d: { keys: [7, 8], z: 1 } })).to.equal('[7][8]');
      expect(render('{% for k, v in d.items %}[{{ k }}={{ v }}]{% endfor %}', { d: { items: [['x', 1], ['y', 2]], z: 9 } })).to.equal('[x=1][y=2]');
      expect(render('{% for x in d.items %}[{{ x }}]{% empty %}E{% endfor %}', { d: { items: 'ab' } })).to.equal('[a][b]');
      expect(render('{% for k, v in a.b.items %}[{{ k }}={{ v }}]{% endfor %}', { a: { b: { items: [['p', 1]], q: 2 } } })).to.equal('[p=1]');
    });
    it('a key holding nothing runs the empty branch', function () {
      expect(render('{% for v in d.values %}[{{ v }}]{% empty %}E{% endfor %}', { d: { values: null, z: 1 } })).to.equal('E');
      expect(render('{% for x in d.items %}[{{ x }}]{% empty %}E{% endfor %}', { d: { items: [], z: 1 } })).to.equal('E');
    });
    it('a key holding a mapping is walked as a mapping', function () {
      expect(render('{% for x in d.items %}[{{ x }}]{% endfor %}', { d: { items: { a: 1, b: 2 } } })).to.equal('[a][b]');
    });
    it('escapes the values read from the key', function () {
      expect(render('{% for x in d.items %}{{ x }}{% endfor %}', { d: { items: ['<', '&'] } })).to.equal('&lt;&amp;');
    });
  });

  describe('a mapping without the key keeps the dict methods', function () {
    it('keys, values and items', function () {
      expect(render('{% for k, v in d.items %}[{{ k }}={{ v }}]{% endfor %}', { d: { a: 1, b: 2 } })).to.equal('[a=1][b=2]');
      expect(render('{% for k in d.keys %}[{{ k }}]{% endfor %}', { d: { a: 1, b: 2 } })).to.equal('[a][b]');
      expect(render('{% for v in d.values %}[{{ v }}]{% endfor %}', { d: { a: 1, b: 2 } })).to.equal('[1][2]');
      expect(render('{% for k, v in a.b.items %}[{{ k }}={{ v }}]{% endfor %}', { a: { b: { x: 1 } } })).to.equal('[x=1]');
      expect(render('{% for k, v in d.items %}[{{ k }}={{ v }}]{% endfor %}', { d: { item: 1, b: 2 } })).to.equal('[item=1][b=2]');
    });
    it('a missing mapping runs the empty branch', function () {
      expect(render('{% for k, v in nope.items %}[{{ k }}]{% empty %}E{% endfor %}')).to.equal('E');
      expect(render('{% for k in nope.keys %}[{{ k }}]{% empty %}E{% endfor %}')).to.equal('E');
      expect(render('{% for pair in nope.items %}[{{ pair }}]{% empty %}E{% endfor %}')).to.equal('E');
    });
  });

  describe('one loop variable over .items binds each key and value', function () {
    it('binds the pair', function () {
      expect(render('{% for pair in d.items %}[{{ pair.0 }}={{ pair.1 }}]{% endfor %}', { d: { a: 1, b: 2, c: 3 } })).to.equal('[a=1][b=2][c=3]');
      expect(render('{% for pair in d.items %}{% for x in pair %}{{ x }};{% endfor %}|{% endfor %}', { d: { a: 1, b: 2 } })).to.equal('a;1;|b;2;|');
      expect(render('{% for pair in d.items %}{{ forloop.counter }}:{{ pair.0 }} {% endfor %}', { d: { a: 1, b: 2 } })).to.equal('1:a 2:b ');
      expect(render('{% for row in rows %}{% for pair in row.items %}{{ pair.0 }}={{ pair.1 }};{% endfor %}|{% endfor %}', { rows: [{ id: 1, name: 'x' }, { id: 2, name: 'y' }] })).to.equal('id=1;name=x;|id=2;name=y;|');
    });
    it('runs the empty branch for an empty mapping and a value that is not a mapping', function () {
      expect(render('{% for pair in d.items %}[{{ pair }}]{% empty %}E{% endfor %}', { d: {} })).to.equal('E');
      expect(render('{% for pair in arr.items %}[{{ pair }}]{% empty %}E{% endfor %}', { arr: [1, 2] })).to.equal('E');
      expect(render('{% for pair in s.items %}[{{ pair }}]{% empty %}E{% endfor %}', { s: 'ab' })).to.equal('E');
      expect(render('{% for pair in n.items %}[{{ pair }}]{% empty %}E{% endfor %}', { n: 5 })).to.equal('E');
    });
    it('escapes the pair values', function () {
      expect(render('{% for pair in d.items %}{{ pair.1 }}{% endfor %}', { d: { a: '<&' } })).to.equal('&lt;&amp;');
    });
    it('restores the outer name after the loop', function () {
      expect(render('{% for pair in d.items %}{{ pair.0 }}{% endfor %}/{{ pair }}', { d: { a: 1 }, pair: 'P' })).to.equal('a/P');
    });
    it('a pair prints as JavaScript joins it, where Django prints the tuple', function () {
      expect(render('{% for pair in d.items %}[{{ pair }}]{% endfor %}', { d: { a: 1, b: 2 } })).to.equal('[a,1][b,2]');
    });
  });
});
