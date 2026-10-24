var django = require('@rhinostone/swig-django'),
  expect = require('../lib/expect.js');


/*!
 * for-loop binding checked against Django 5.2. Each expectation is the
 * output Django gives for the same template, except in the tests that say
 * Django raises or unpacks otherwise: there the test pins what swig-django
 * renders.
 */
describe('@rhinostone/swig-django — for-loop binding parity with Django', function () {

  function render(src, locals) {
    return django.render(src, { locals: locals || {} });
  }

  describe('two loop variables over a list unpack each item', function () {
    it('unpacks pairs and rows', function () {
      expect(render('{% for k, v in p %}[{{ k }}={{ v }}]{% endfor %}', { p: [['a', 1], ['b', 2]] })).to.equal('[a=1][b=2]');
      expect(render('{% for i, row in r %}[{{ i }}:{{ row }}]{% endfor %}', { r: [[1, 2], [3, 4]] })).to.equal('[1:2][3:4]');
    });
    it('unpacks the characters of a string and the keys of a mapping', function () {
      expect(render('{% for k, v in p %}[{{ k }}={{ v }}]{% endfor %}', { p: ['ab', 'cd'] })).to.equal('[a=b][c=d]');
      expect(render('{% for k, v in p %}[{{ k }}={{ v }}]{% endfor %}', { p: ['\uD83D\uDE00x'] })).to.equal('[\uD83D\uDE00=x]');
      expect(render('{% for k, v in p %}[{{ k }}={{ v }}]{% endfor %}', { p: [{ x: 1, y: 2 }] })).to.equal('[x=y]');
    });
    it('keeps forloop and the empty branch', function () {
      expect(render('{% for k, v in p %}{{ forloop.counter }}{{ k }}{% endfor %}', { p: [['a', 1], ['b', 2]] })).to.equal('1a2b');
      expect(render('{% for k, v in p %}x{% empty %}E{% endfor %}', { p: [] })).to.equal('E');
      expect(render('{% for k, v in p %}[{{ k }}={{ v }}]{% empty %}E{% endfor %}', { p: [['a', 1]] })).to.equal('[a=1]');
    });
    it('nests, and restores the outer names', function () {
      expect(render('{% for k, v in p %}{% for x in v %}{{ x }}{% endfor %};{% endfor %}', { p: [['a', [1, 2]], ['b', [3]]] })).to.equal('12;3;');
      expect(render('{% for k, v in p %}{% for k, v in q %}{{ k }}{% endfor %}/{{ k }};{% endfor %}', { p: [['a', 1]], q: [['x', 9], ['y', 8]] })).to.equal('xy/a;');
      expect(render('{% for k, v in p %}[{{ k }}={{ v }}]{% endfor %}{{ k }}{{ v }}', { p: [['a', 1]], k: 'K', v: 'V' })).to.equal('[a=1]KV');
    });
    it('escapes the unpacked values', function () {
      expect(render('{% for k, v in p %}{{ k }}{{ v }}{% endfor %}', { p: [['<', '&']] })).to.equal('&lt;&amp;');
    });
  });

  describe('an item that does not hold two values binds what it holds, where Django raises', function () {
    it('too many or too few values', function () {
      expect(render('{% for i, row in r %}[{{ i }}:{{ row }}]{% endfor %}', { r: [[1, 2, 3]] })).to.equal('[1:2]');
      expect(render('{% for k, v in p %}[{{ k }}={{ v }}]{% endfor %}', { p: [['a']] })).to.equal('[a=]');
      expect(render('{% for k, v in p %}[{{ k }}={{ v }}]{% endfor %}', { p: ['a'] })).to.equal('[a=]');
    });
    it('a scalar item binds nothing', function () {
      expect(render('{% for k, v in p %}[{{ k }}={{ v }}]{% endfor %}', { p: [1, 2] })).to.equal('[=][=]');
    });
  });

  describe('two loop variables over a mapping bind the key and the value, where Django unpacks each key', function () {
    it('binds the key and the value', function () {
      expect(render('{% for k, v in d %}[{{ k }}={{ v }}]{% endfor %}', { d: { a: 1, b: 2 } })).to.equal('[a=1][b=2]');
      expect(render('{% for k, v in d %}[{{ k }}={{ v }}]{% endfor %}', { d: { ab: 1, cd: 2 } })).to.equal('[ab=1][cd=2]');
    });
  });
});
