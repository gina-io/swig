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
 * rewriteDictIterable):
 *   - .keys   → _utils.keys(obj) array         (one-name → key)
 *   - .values → the object, one-name iteration (one-name → value)
 *   - .items  → the object, two-name iteration (two-name → key, value)
 * The one-name `.items` tuple form is rejected (no _utils.entries to
 * synthesize a (key, value) sequence flavor-locally).
 *
 * Documented divergences (covered below so they stay locked): single-variable
 * iteration over a bare dict yields VALUES not keys (swig object iteration),
 * and the pseudo-method interception is unconditional (an object with a literal
 * `items` / `keys` / `values` key is still treated as the pseudo-method).
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

  /* ---- one-name .items is rejected ---------------------------- */

  it('rejects one-name {% for x in d.items %} with a clear message', function () {
    var msg = threw(function () { r('{% for pair in d.items %}{{ pair }}{% endfor %}', { d: d }); });
    expect(msg).to.contain('requires two loop variables');
  });

  /* ---- no over-interception ----------------------------------- */

  it('does not intercept a bare variable named items / keys / values', function () {
    expect(r('{% for x in items %}[{{ x }}]{% endfor %}', { items: [10, 20] })).to.equal('[10][20]');
    expect(r('{% for x in keys %}[{{ x }}]{% endfor %}', { keys: ['p', 'q'] })).to.equal('[p][q]');
  });

  /* ---- CVE-2023-25345 guard still fires ----------------------- */

  it('rejects a dangerous segment before the pseudo-method', function () {
    expect(threw(function () { r('{% for k, v in d.__proto__.items %}{% endfor %}', { d: d }); }))
      .to.contain('CVE-2023-25345');
  });

  /* ---- documented divergences (locked) ------------------------ */

  it('single-variable iteration over a bare dict yields VALUES (swig divergence)', function () {
    // Real Django yields keys here; swig's object iteration binds the value.
    expect(r('{% for x in d %}[{{ x }}]{% endfor %}', { d: d })).to.equal('[1][2][3]');
  });

  it('treats a literal "items" key as the pseudo-method (precedence divergence)', function () {
    // Real Django returns d["items"] when present; swig always treats the
    // trailing .items as the pseudo-method, so it walks the whole object.
    var withKey = { items: 'LITERAL', z: 9 };
    expect(r('{% for k, v in withKey.items %}[{{ k }}={{ v }}]{% endfor %}', { withKey: withKey }))
      .to.equal('[items=LITERAL][z=9]');
  });

});
