var django = require('@rhinostone/swig-django'),
  expect = require('../lib/expect.js');


/*!
 * Django dict-iteration pseudo-methods on the `for` tag.
 *
 * `{% for k in d.keys %}`, `{% for v in d.values %}`, and the canonical
 * `{% for key, value in d.items %}` are how DTL walks a mapping. With the S5
 * variable resolver in place a trailing `.keys` / `.values` / `.items` would
 * otherwise resolve to a (usually missing) object property and yield an empty
 * loop, so the `for` tag intercepts it (packages/swig-django/lib/tags/for.js,
 * rewriteDictIterable) and `_utils.dictIter` reads, at render, a key of that
 * name when the mapping has its own (as Django does), and otherwise:
 *   - .keys   → the keys                       (one-name → key)
 *   - .values → the values                     (one-name → value)
 *   - .items  → the object, two-name iteration (two-name → key, value),
 *               or each [key, value] pair      (one-name → pair)
 *
 * Single-variable iteration over a bare dict yields the keys, as Django does,
 * and a mapping's own `items` / `keys` / `values` key is read before the
 * pseudo-method, as Django does (both covered below so they stay locked).
 */
describe('@rhinostone/swig-django — dict iteration', function () {

  function r(src, locals) {
    return django.render(src, { locals: locals || {} });
  }
  function threw(fn) {
    try { fn(); return false; } catch (e) { return e.message; }
  }

  var d = { a: 1, b: 2, c: 3 };

  /* ---- .keys / .values / .items ------------------------------- */

  it('iterates d.keys', function () {
    expect(r('{% for k in d.keys %}[{{ k }}]{% endfor %}', { d: d })).to.equal('[a][b][c]');
  });

  it('iterates d.values', function () {
    expect(r('{% for v in d.values %}[{{ v }}]{% endfor %}', { d: d })).to.equal('[1][2][3]');
  });

  it('iterates d.items with two loop variables (key, value)', function () {
    expect(r('{% for k, v in d.items %}[{{ k }}={{ v }}]{% endfor %}', { d: d })).to.equal('[a=1][b=2][c=3]');
  });

  it('resolves a nested object path before the pseudo-method', function () {
    expect(r('{% for k, v in a.b.items %}[{{ k }}={{ v }}]{% endfor %}', { a: { b: { x: 9, y: 8 } } }))
      .to.equal('[x=9][y=8]');
  });

  it('exposes forloop inside a d.items loop', function () {
    expect(r('{% for k, v in d.items %}{{ forloop.counter }}:{{ k }} {% endfor %}', { d: d }))
      .to.equal('1:a 2:b 3:c ');
  });

  /* ---- canonical real-world shape: list of dicts -------------- */

  it('walks a list of dicts via row.items', function () {
    var rows = [{ id: 1, name: 'x' }, { id: 2, name: 'y' }];
    expect(r('{% for row in rows %}{% for k, v in row.items %}{{ k }}={{ v }};{% endfor %}|{% endfor %}', { rows: rows }))
      .to.equal('id=1;name=x;|id=2;name=y;|');
  });

  /* ---- empty branch on a missing / empty mapping -------------- */

  it('fires {% empty %} for .keys on a missing object', function () {
    expect(r('{% for k in nope.keys %}[{{ k }}]{% empty %}EMPTY{% endfor %}')).to.equal('EMPTY');
  });

  it('fires {% empty %} for .values on a missing object', function () {
    expect(r('{% for v in nope.values %}[{{ v }}]{% empty %}EMPTY{% endfor %}')).to.equal('EMPTY');
  });

  it('fires {% empty %} for .items on a missing object', function () {
    expect(r('{% for k, v in nope.items %}[{{ k }}]{% empty %}EMPTY{% endfor %}')).to.equal('EMPTY');
  });

  it('fires {% empty %} for .keys on an empty object', function () {
    expect(r('{% for k in d.keys %}[{{ k }}]{% empty %}EMPTY{% endfor %}', { d: {} })).to.equal('EMPTY');
  });

  /* ---- one-name .items binds pairs ---------------------------- */

  it('binds each key and value in a one-name d.items loop, as Django does', function () {
    expect(r('{% for pair in d.items %}[{{ pair.0 }}={{ pair.1 }}]{% endfor %}', { d: d })).to.equal('[a=1][b=2][c=3]');
  });

  /* ---- no over-interception ----------------------------------- */

  it('does not intercept a bare variable named items / keys / values', function () {
    expect(r('{% for x in items %}[{{ x }}]{% endfor %}', { items: [10, 20] })).to.equal('[10][20]');
    expect(r('{% for x in keys %}[{{ x }}]{% endfor %}', { keys: ['p', 'q'] })).to.equal('[p][q]');
  });

  /* ---- CVE-2023-25345 guard still fires ----------------------- */

  it('rejects a dangerous segment before the pseudo-method', function () {
    expect(threw(function () { r('{% for k, v in d.__proto__.items %}{% endfor %}', { d: d }); }))
      .to.contain('prototype-chain guard');
  });

  /* ---- Django's binding and precedence (locked) --------------- */

  it('single-variable iteration over a bare dict yields KEYS, as Django does', function () {
    // Django yields the keys here, and so does swig-django.
    expect(r('{% for x in d %}[{{ x }}]{% endfor %}', { d: d })).to.equal('[a][b][c]');
  });

  it('reads a mapping\'s own "items" key before the pseudo-method, as Django does', function () {
    // Django returns d["items"] when present, before the dict method.
    var withKey = { items: [['x', 1], ['y', 2]], z: 9 };
    expect(r('{% for k, v in withKey.items %}[{{ k }}={{ v }}]{% endfor %}', { withKey: withKey }))
      .to.equal('[x=1][y=2]');
  });

});
