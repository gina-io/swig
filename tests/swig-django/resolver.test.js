var django = require('@rhinostone/swig-django'),
  expect = require('../lib/expect.js');


/*!
 * Django variable-resolver (change B) render-surface tests.
 *
 * S5 wires every USER-variable lookup in swig-django's parseExpr to swig-core's
 * `_utils.resolve` (via the opt-in IRVarRef.resolve flag), giving Django-faithful
 * resolution: dictionary / attribute / method lookup, numeric index access
 * (`{{ list.0 }}`), and auto-call of callable leaves (`{{ user.get_full_name }}`)
 * honoring `alters_data` / `do_not_call_in_templates`. Because resolve returns the
 * raw value (including null) rather than pre-coercing to "", a context `None`
 * reaches filters such as `default_if_none` / `yesno` intact, and the output drain
 * coerces the bare-null case to "" (the coerce companion in parseVariable).
 *
 * The per-segment unit behavior of `_utils.resolve` lives in
 * tests/swig-core/utils.test.js; this suite covers the end-to-end render wiring at
 * the three USER-variable sites: parsePrimary VAR, parsePostfix DOTKEY rebuild,
 * and parseFilterArg VAR.
 */
describe('@rhinostone/swig-django — variable resolver (change B)', function () {

  function r(src, locals) {
    return django.render(src, { locals: locals || {} });
  }
  function threw(fn) {
    try { fn(); return false; } catch (e) { return e.message; }
  }

  /* ---- numeric index access ----------------------------------- */

  it('resolves a numeric index ({{ list.0 }})', function () {
    expect(r('{{ list.0 }}', { list: ['a', 'b', 'c'] })).to.equal('a');
  });

  it('resolves a deeper dotted numeric path', function () {
    expect(r('{{ rows.1.name }}', { rows: [{ name: 'x' }, { name: 'y' }] })).to.equal('y');
  });

  /* ---- auto-call of callable leaves --------------------------- */

  it('auto-calls a callable leaf ({{ obj.method }})', function () {
    expect(r('{{ obj.method }}', { obj: { method: function () { return 'called'; } } })).to.equal('called');
  });

  it('auto-calls a method bound to its receiver (canonical Django idiom)', function () {
    var user = {
      first: 'Ada',
      last: 'Lovelace',
      get_full_name: function () { return this.first + ' ' + this.last; }
    };
    expect(r('{{ user.get_full_name }}', { user: user })).to.equal('Ada Lovelace');
  });

  it('does not call a method flagged alters_data — renders ""', function () {
    var save = function () { return 'SAVED'; };
    save.alters_data = true;
    expect(r('[{{ obj.save }}]', { obj: { save: save } })).to.equal('[]');
  });

  it('does not call a method flagged do_not_call_in_templates', function () {
    var called = false;
    var fn = function () { called = true; return 'X'; };
    fn.do_not_call_in_templates = true;
    r('{{ obj.fn }}', { obj: { fn: fn } });
    expect(called).to.equal(false);
  });

  it('renders "" when an auto-called method throws (string_if_invalid fallback)', function () {
    var boom = function () { throw new Error('needs args'); };
    expect(r('[{{ obj.boom }}]', { obj: { boom: boom } })).to.equal('[]');
  });

  /* ---- raw null reaches filters intact (was "" pre-S5) -------- */

  it('passes a context None to default_if_none', function () {
    expect(r('{{ x|default_if_none:"d" }}', { x: null })).to.equal('d');
  });

  it('passes a context None to yesno', function () {
    expect(r('{{ x|yesno:"y,n,m" }}', { x: null })).to.equal('m');
  });

  it('resolves (and auto-calls) a variable filter argument (parseFilterArg site)', function () {
    expect(r('{{ x|default_if_none:fb }}', { x: null, fb: function () { return 'AUTO'; } })).to.equal('AUTO');
  });

  /* ---- bare null / missing still drain to "" ------------------ */

  it('coerces a bare null variable to "" at the output drain', function () {
    expect(r('[{{ x }}]', { x: null })).to.equal('[]');
  });

  it('coerces a missing variable to ""', function () {
    expect(r('[{{ missing }}]')).to.equal('[]');
  });

  /* ---- CVE-2023-25345 parse-time guard still fires ------------ */

  it('rejects __proto__ in a resolved dotted path (CVE-2023-25345)', function () {
    expect(threw(function () { r('{{ a.__proto__ }}', { a: {} }); })).to.contain('CVE-2023-25345');
  });

  it('rejects constructor in a resolved dotted path (CVE-2023-25345)', function () {
    expect(threw(function () { r('{{ a.constructor }}', { a: {} }); })).to.contain('CVE-2023-25345');
  });

});
