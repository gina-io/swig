var jinja2 = require('@rhinostone/swig-jinja2'),
  expect = require('expect.js');


/*!
 * Per-tag render tests. Each tag is exercised end-to-end through the
 * engine.install() pipeline so the IR shape and its runtime emission are
 * both verified.
 */
describe('@rhinostone/swig-jinja2 — tags', function () {

  function render(src, locals) {
    return jinja2.render(src, { locals: locals || {} });
  }

  describe('{% set %}', function () {

    it('assigns a literal and interpolates it', function () {
      expect(render('{% set x = 5 %}{{ x }}')).to.equal('5');
    });

    it('assigns an expression', function () {
      expect(render("{% set x = 'a' ~ 'b' %}{{ x }}")).to.equal('ab');
      expect(render('{% set x = 2 ** 3 %}{{ x }}')).to.equal('8');
    });

    it('assigns from locals', function () {
      expect(render('{% set y = x %}{{ y }}', { x: 'hi' })).to.equal('hi');
    });

    it('supports the body-capture form', function () {
      expect(render('{% set greeting %}hello{% endset %}{{ greeting }}')).to.equal('hello');
    });

    it('rejects bracket-notation assignment', function () {
      expect(function () {
        render('{% set x["a"] = 1 %}');
      }).to.throwError(/Bracket-notation assignment is not supported/);
    });

    it('blocks a dangerous assignment target', function () {
      expect(function () {
        render('{% set __proto__ = 1 %}');
      }).to.throwError(/CVE-2023-25345/);
    });

  });

  describe('{% if %} / {% elif %} / {% else %}', function () {

    it('renders the body when the condition is truthy', function () {
      expect(render('{% if flag %}on{% endif %}', { flag: true })).to.equal('on');
      expect(render('{% if flag %}on{% endif %}', { flag: false })).to.equal('');
    });

    it('walks an if / elif / else chain', function () {
      var tpl = '{% if a %}A{% elif b %}B{% else %}C{% endif %}';
      expect(render(tpl, { a: true, b: false })).to.equal('A');
      expect(render(tpl, { a: false, b: true })).to.equal('B');
      expect(render(tpl, { a: false, b: false })).to.equal('C');
    });

    it('supports multiple elif branches', function () {
      var tpl = '{% if n == 1 %}one{% elif n == 2 %}two{% elif n == 3 %}three{% else %}many{% endif %}';
      expect(render(tpl, { n: 2 })).to.equal('two');
      expect(render(tpl, { n: 3 })).to.equal('three');
      expect(render(tpl, { n: 9 })).to.equal('many');
    });

    it('honours `not` and logic operators', function () {
      expect(render('{% if not done %}pending{% endif %}', { done: false })).to.equal('pending');
      expect(render('{% if a and b %}both{% endif %}', { a: true, b: true })).to.equal('both');
    });

    it('integrates `is defined` tests', function () {
      expect(render('{% if x is defined %}yes{% else %}no{% endif %}', { x: 'hi' })).to.equal('yes');
      expect(render('{% if x is defined %}yes{% else %}no{% endif %}', {})).to.equal('no');
    });

    it('nests conditionals', function () {
      var tpl = '{% if a %}{% if b %}AB{% else %}A{% endif %}{% else %}none{% endif %}';
      expect(render(tpl, { a: true, b: true })).to.equal('AB');
      expect(render(tpl, { a: true, b: false })).to.equal('A');
      expect(render(tpl, { a: false, b: true })).to.equal('none');
    });

    it('rejects elif / else outside an if', function () {
      expect(function () { render('{% elif x %}y{% endif %}'); }).to.throwError(/"elif" is only valid inside an "if"/);
      expect(function () { render('{% else %}y'); }).to.throwError(/"else" is only valid inside/);
    });

    it('rejects a malformed chain (elif after else)', function () {
      expect(function () {
        render('{% if a %}A{% else %}B{% elif c %}C{% endif %}');
      }).to.throwError(/"elif" after "else"/);
    });

  });

});
