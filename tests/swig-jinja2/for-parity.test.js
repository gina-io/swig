var jinja2 = require('@rhinostone/swig-jinja2'),
  expect = require('../lib/expect.js');


/*!
 * for-loop binding checked against Python Jinja2 3.1.6. Each expectation is
 * the output Jinja2 gives for the same template, except in the tests that
 * say Jinja2 raises or unpacks otherwise: there the test pins what
 * swig-jinja2 renders.
 */
describe('@rhinostone/swig-jinja2 — for-loop binding parity with Jinja2', function () {

  function render(src, locals) {
    return jinja2.render(src, { locals: locals || {} });
  }

  describe('one loop variable over a mapping binds each key', function () {
    it('binds the keys in order', function () {
      expect(render('{% for x in d %}[{{ x }}]{% endfor %}', { d: { b: 1, a: 2 } })).to.equal('[b][a]');
      expect(render('{% for x in d %}{{ x }}={{ d[x] }};{% endfor %}', { d: { a: 1, b: 2 } })).to.equal('a=1;b=2;');
      expect(render('{% for x in d %}{{ x }}{% if not loop.last %},{% endif %}{% endfor %}', { d: { a: 1, b: 2, c: 3 } })).to.equal('a,b,c');
      expect(render('{% for x in d %}{{ loop.index }}/{{ loop.length }};{% endfor %}', { d: { a: 1, b: 2 } })).to.equal('1/2;2/2;');
    });
    it('an empty mapping runs the else branch', function () {
      expect(render('{% for x in d %}[{{ x }}]{% else %}E{% endfor %}', { d: {} })).to.equal('E');
    });
    it('a list and a string still bind their items', function () {
      expect(render('{% for x in l %}[{{ x }}]{% endfor %}', { l: [1, 2] })).to.equal('[1][2]');
      expect(render('{% for x in s %}[{{ x }}]{% endfor %}', { s: 'ab' })).to.equal('[a][b]');
    });
    it('loop.key holds the key, where Jinja2 has no loop.key', function () {
      expect(render('{% for x in d %}[{{ loop.key }}]{% endfor %}', { d: { a: 1, b: 2 } })).to.equal('[a][b]');
    });
  });

  describe('two loop variables over a list unpack each item', function () {
    it('unpacks pairs, dictsort and rows', function () {
      expect(render('{% for k, v in p %}[{{ k }}={{ v }}]{% endfor %}', { p: [['a', 1], ['b', 2]] })).to.equal('[a=1][b=2]');
      expect(render('{% for k, v in d|dictsort %}[{{ k }}={{ v }}]{% endfor %}', { d: { b: 2, a: 1 } })).to.equal('[a=1][b=2]');
      expect(render('{% for k, v in {"b":2,"a":1}|dictsort %}{{ k }}={{ v }};{% endfor %}')).to.equal('a=1;b=2;');
      expect(render('{% for i, row in r %}[{{ i }}:{{ row }}]{% endfor %}', { r: [[1, 2], [3, 4]] })).to.equal('[1:2][3:4]');
    });
    it('unpacks the characters of a string and the keys of a mapping', function () {
      expect(render('{% for k, v in p %}[{{ k }}={{ v }}]{% endfor %}', { p: ['ab', 'cd'] })).to.equal('[a=b][c=d]');
      expect(render('{% for k, v in p %}[{{ k }}={{ v }}]{% endfor %}', { p: ['\uD83D\uDE00x'] })).to.equal('[\uD83D\uDE00=x]');
      expect(render('{% for k, v in p %}[{{ k }}={{ v }}]{% endfor %}', { p: [{ x: 1, y: 2 }] })).to.equal('[x=y]');
    });
    it('keeps the loop variables and the else branch', function () {
      expect(render('{% for k, v in p %}{{ loop.index }}{{ k }}{{ loop.length }}{% endfor %}', { p: [['a', 1], ['b', 2]] })).to.equal('1a22b2');
      expect(render('{% for k, v in p %}x{% else %}E{% endfor %}', { p: [] })).to.equal('E');
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

  describe('an item that does not hold two values binds what it holds, where Jinja2 raises', function () {
    it('too many or too few values', function () {
      expect(render('{% for i, row in r %}[{{ i }}:{{ row }}]{% endfor %}', { r: [[1, 2, 3]] })).to.equal('[1:2]');
      expect(render('{% for k, v in p %}[{{ k }}={{ v }}]{% endfor %}', { p: [['a']] })).to.equal('[a=]');
      expect(render('{% for k, v in p %}[{{ k }}={{ v }}]{% endfor %}', { p: ['a'] })).to.equal('[a=]');
    });
    it('a scalar item binds nothing', function () {
      expect(render('{% for k, v in p %}[{{ k }}={{ v }}]{% endfor %}', { p: [1, 2] })).to.equal('[=][=]');
    });
    it('two names over a string bind each character and nothing', function () {
      expect(render('{% for a, b in s %}[{{ a }}={{ b }}]{% endfor %}', { s: 'ab' })).to.equal('[a=][b=]');
    });
  });

  describe('two loop variables over a mapping bind the key and the value, where Jinja2 unpacks each key', function () {
    it('binds the key and the value', function () {
      expect(render('{% for k, v in d %}[{{ k }}={{ v }}]{% endfor %}', { d: { a: 1, b: 2 } })).to.equal('[a=1][b=2]');
      expect(render('{% for k, v in d %}[{{ k }}={{ v }}]{% endfor %}', { d: { ab: 1, cd: 2 } })).to.equal('[ab=1][cd=2]');
    });
  });
});
