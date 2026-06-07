var django = require('@rhinostone/swig-django'),
  expect = require('../lib/expect.js');


/*!
 * Django `{% for %}` / `{% empty %}` + `forloop.*` render tests.
 *
 * The loop-context object is surfaced via the swig-core opt-in `loopName` /
 * `loopFields` / `loopParent` flags (set by tags/for.js), so Django sees
 * `forloop.counter` / `counter0` / `revcounter` / `revcounter0` / `first` /
 * `last` / `parentloop` while the shared backend keeps native / Twig /
 * Jinja2 byte-identical (proven separately via precompile diff + the full
 * suite).
 */
describe('@rhinostone/swig-django — for / empty / forloop', function () {

  function r(src, locals) {
    return django.render(src, { locals: locals || {} });
  }
  function threw(src, locals) {
    try {
      django.render(src, { locals: locals || {} });
      return false;
    } catch (e) {
      return e.message;
    }
  }

  /* ---- Basic iteration ---------------------------------------- */

  it('iterates an array', function () {
    expect(r('{% for x in items %}{{ x }};{% endfor %}', { items: ['a', 'b', 'c'] })).to.equal('a;b;c;');
  });

  it('iterates a string by character', function () {
    expect(r('{% for c in word %}{{ c }}.{% endfor %}', { word: 'ab' })).to.equal('a.b.');
  });

  it('renders nothing for an empty array (no empty branch)', function () {
    expect(r('[{% for x in items %}{{ x }}{% endfor %}]', { items: [] })).to.equal('[]');
  });

  it('renders nothing for a missing iterable (no empty branch)', function () {
    expect(r('[{% for x in items %}{{ x }}{% endfor %}]')).to.equal('[]');
  });

  /* ---- forloop counters --------------------------------------- */

  it('forloop.counter is 1-indexed', function () {
    expect(r('{% for x in items %}{{ forloop.counter }}{% endfor %}', { items: ['a', 'b', 'c'] })).to.equal('123');
  });

  it('forloop.counter0 is 0-indexed', function () {
    expect(r('{% for x in items %}{{ forloop.counter0 }}{% endfor %}', { items: ['a', 'b', 'c'] })).to.equal('012');
  });

  it('forloop.revcounter counts down from length', function () {
    expect(r('{% for x in items %}{{ forloop.revcounter }}{% endfor %}', { items: ['a', 'b', 'c'] })).to.equal('321');
  });

  it('forloop.revcounter0 counts down from length-1', function () {
    expect(r('{% for x in items %}{{ forloop.revcounter0 }}{% endfor %}', { items: ['a', 'b', 'c'] })).to.equal('210');
  });

  it('forloop.first / forloop.last mark the edges', function () {
    expect(r('{% for x in items %}{% if forloop.first %}[{% endif %}{{ x }}{% if forloop.last %}]{% endif %}{% endfor %}', { items: ['a', 'b', 'c'] })).to.equal('[abc]');
  });

  it('forloop.first and forloop.last are both true for a single item', function () {
    expect(r('{% for x in items %}{% if forloop.first %}F{% endif %}{% if forloop.last %}L{% endif %}{% endfor %}', { items: ['only'] })).to.equal('FL');
  });

  /* ---- key, value binding ------------------------------------- */

  it('binds key, value over an object', function () {
    expect(r('{% for k, v in d %}{{ k }}={{ v }};{% endfor %}', { d: { a: 1, b: 2 } })).to.equal('a=1;b=2;');
  });

  it('exposes forloop.counter while iterating key, value pairs', function () {
    expect(r('{% for k, v in d %}{{ forloop.counter }}:{{ k }};{% endfor %}', { d: { a: 1, b: 2 } })).to.equal('1:a;2:b;');
  });

  /* ---- empty branch ------------------------------------------- */

  it('skips the empty branch when the iterable has items', function () {
    expect(r('{% for x in items %}{{ x }}{% empty %}NONE{% endfor %}', { items: ['a', 'b'] })).to.equal('ab');
  });

  it('renders the empty branch for an empty array', function () {
    expect(r('{% for x in items %}{{ x }}{% empty %}NONE{% endfor %}', { items: [] })).to.equal('NONE');
  });

  it('renders the empty branch for a missing iterable', function () {
    expect(r('{% for x in items %}{{ x }}{% empty %}NONE{% endfor %}')).to.equal('NONE');
  });

  it('rejects two empty branches in one for tag', function () {
    expect(threw('{% for x in items %}{{ x }}{% empty %}a{% empty %}b{% endfor %}', { items: [] })).to.contain('Multiple "empty"');
  });

  it('rejects empty outside a for tag', function () {
    expect(threw('{% empty %}')).to.contain('only valid inside a "for" tag');
  });

  /* ---- nesting + parentloop ----------------------------------- */

  it('forloop.parentloop reaches the enclosing loop counter', function () {
    expect(r('{% for x in outer %}{% for y in inner %}{{ forloop.parentloop.counter }}.{{ forloop.counter }} {% endfor %}{% endfor %}', { outer: ['p', 'q'], inner: ['m', 'n'] })).to.equal('1.1 1.2 2.1 2.2 ');
  });

  it('forloop.parentloop is empty at the outermost level (no throw)', function () {
    expect(r('{% for x in items %}[{{ forloop.parentloop.counter }}]{% endfor %}', { items: ['a', 'b'] })).to.equal('[][]');
  });

  it('a nested loop does not clobber the outer forloop counter', function () {
    expect(r('{% for x in outer %}{{ forloop.counter }}<{% for y in inner %}{{ forloop.counter }}{% endfor %}>{{ forloop.counter }}{% endfor %}', { outer: ['a', 'b'], inner: ['m', 'n'] })).to.equal('1<12>12<12>2');
  });

  it('forloop is restored to undefined after a top-level loop', function () {
    expect(r('{% for x in items %}{% endfor %}[{{ forloop.counter }}]', { items: ['a'] })).to.equal('[]');
  });

  /* ---- reversed (deferred) ------------------------------------ */

  it('rejects the reversed modifier with a clear message', function () {
    expect(threw('{% for x in items reversed %}{{ x }}{% endfor %}', { items: ['a'] })).to.contain('"reversed" modifier');
  });

  it('still treats a lone reversed as a variable name', function () {
    expect(r('{% for x in reversed %}{{ x }};{% endfor %}', { reversed: ['a', 'b'] })).to.equal('a;b;');
  });

  /* ---- security + bare-identifier guards (CVE-2023-25345) ------ */

  it('rejects __proto__ as a loop variable', function () {
    expect(threw('{% for __proto__ in items %}{% endfor %}', { items: ['a'] })).to.contain('CVE-2023-25345');
  });

  it('rejects constructor as a loop key', function () {
    expect(threw('{% for constructor, v in items %}{% endfor %}', { items: ['a'] })).to.contain('CVE-2023-25345');
  });

  it('rejects a dotted loop variable', function () {
    expect(threw('{% for a.b in items %}{% endfor %}', { items: ['a'] })).to.contain('bare identifier');
  });

  /* ---- parse errors ------------------------------------------- */

  it('rejects a for tag with no "in"', function () {
    expect(threw('{% for x items %}{% endfor %}', { items: ['a'] })).to.contain('Expected "in"');
  });

  it('rejects a for tag with no iterable', function () {
    expect(threw('{% for x in %}{% endfor %}')).to.contain('Expected iterable');
  });
});
