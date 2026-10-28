var swig = require('../../lib/swig'),
  twig = require('@rhinostone/swig-twig'),
  jinja2 = require('@rhinostone/swig-jinja2'),
  django = require('@rhinostone/swig-django'),
  expect = require('../lib/expect.js');

var lexers = {
  native: { read: require('../../lib/lexer').read, TYPES: require('@rhinostone/swig-core/lib/tokentypes') },
  twig: { read: require('@rhinostone/swig-twig/lib/lexer').read, TYPES: require('@rhinostone/swig-twig/lib/tokentypes') },
  jinja2: { read: require('@rhinostone/swig-jinja2/lib/lexer').read, TYPES: require('@rhinostone/swig-jinja2/lib/tokentypes') },
  django: { read: require('@rhinostone/swig-django/lib/lexer').read, TYPES: require('@rhinostone/swig-django/lib/tokentypes') }
};


/*!
 * `and`, `or`, `not` and `in` written directly before "(" are the operators
 * in every flavor (Jinja2 also `if` and `else`), as Jinja2 and Twig read
 * them: `not(x)` is `not (x)`, not a call of a function named `not`, and a
 * name that starts with a keyword (`notify(x)`) or an object key named like
 * one (`{and: 1}`) is unchanged. Jinja2 expectations are Jinja2 3.1's output;
 * the others are the truth value of the expression, and the relation block
 * compares the precedence-sensitive shapes with their spaced form.
 */
describe('swig-core — a keyword written directly before "("', function () {

  var flavors = { native: swig, twig: twig, jinja2: jinja2, django: django };

  function render(flavor, src, locals) {
    return flavors[flavor].render(src, { locals: locals || {} });
  }

  function call(prefix) {
    return function (v) { return prefix + (v === undefined ? '' : v); };
  }

  function tokens(flavor, src) {
    var lx = lexers[flavor];
    return lx.read(src).filter(function (t) { return t.type !== lx.TYPES.WHITESPACE; });
  }

  function lexesAs(flavor, src, expected) {
    var lx = lexers[flavor], got = tokens(flavor, src);
    expect(got.length).to.equal(expected.length);
    expected.forEach(function (e, i) {
      expect(got[i].type).to.equal(lx.TYPES[e[0]]);
      if (e[1] !== null) {
        expect(got[i].match).to.equal(e[1]);
      }
    });
  }

  function fns() {
    return { android: call('A'), index: call('I'), notify: call('N'), order: call('O'), info: call('F'), ifx: call('X'), elsewhere: call('E'), andy: call('Y'), orb: call('B'), nothing: call('T'), inner: call('R') };
  }

  describe('lexers', function () {
    it('native: the keyword is the operator before "(", a longer name stays a call', function () {
      lexesAs('native', 'not(x)', [['NOT', '!'], ['PARENOPEN', null], ['VAR', 'x'], ['PARENCLOSE', null]]);
      lexesAs('native', 'not()', [['NOT', '!'], ['PARENOPEN', null], ['PARENCLOSE', null]]);
      lexesAs('native', 'a and(b)', [['VAR', 'a'], ['LOGIC', '&&'], ['PARENOPEN', null], ['VAR', 'b'], ['PARENCLOSE', null]]);
      lexesAs('native', 'a or(b)', [['VAR', 'a'], ['LOGIC', '||'], ['PARENOPEN', null], ['VAR', 'b'], ['PARENCLOSE', null]]);
      lexesAs('native', '1 in(l)', [['NUMBER', '1'], ['COMPARATOR', 'in'], ['PARENOPEN', null], ['VAR', 'l'], ['PARENCLOSE', null]]);
      lexesAs('native', 'notify(x)', [['FUNCTION', 'notify'], ['VAR', 'x'], ['PARENCLOSE', null]]);
      lexesAs('native', 'android()', [['FUNCTIONEMPTY', 'android']]);
      lexesAs('native', 'index(1)', [['FUNCTION', 'index'], ['NUMBER', '1'], ['PARENCLOSE', null]]);
      lexesAs('native', 'order(1)', [['FUNCTION', 'order'], ['NUMBER', '1'], ['PARENCLOSE', null]]);
      lexesAs('native', '{and: 1}', [['CURLYOPEN', null], ['VAR', 'and'], ['COLON', null], ['NUMBER', '1'], ['CURLYCLOSE', null]]);
    });
    it('twig: the keyword is the operator before "(", a longer name stays a call', function () {
      lexesAs('twig', 'not(x)', [['NOT', '!'], ['PARENOPEN', null], ['VAR', 'x'], ['PARENCLOSE', null]]);
      lexesAs('twig', 'not()', [['NOT', '!'], ['PARENOPEN', null], ['PARENCLOSE', null]]);
      lexesAs('twig', 'a and(b)', [['VAR', 'a'], ['LOGIC', '&&'], ['PARENOPEN', null], ['VAR', 'b'], ['PARENCLOSE', null]]);
      lexesAs('twig', 'a or(b)', [['VAR', 'a'], ['LOGIC', '||'], ['PARENOPEN', null], ['VAR', 'b'], ['PARENCLOSE', null]]);
      lexesAs('twig', '1 in(l)', [['NUMBER', '1'], ['COMPARATOR', 'in'], ['PARENOPEN', null], ['VAR', 'l'], ['PARENCLOSE', null]]);
      lexesAs('twig', 'notify(x)', [['FUNCTION', 'notify'], ['VAR', 'x'], ['PARENCLOSE', null]]);
      lexesAs('twig', 'android()', [['FUNCTIONEMPTY', 'android']]);
      lexesAs('twig', 'index(1)', [['FUNCTION', 'index'], ['NUMBER', '1'], ['PARENCLOSE', null]]);
      lexesAs('twig', 'order(1)', [['FUNCTION', 'order'], ['NUMBER', '1'], ['PARENCLOSE', null]]);
      lexesAs('twig', '{and: 1}', [['CURLYOPEN', null], ['VAR', 'and'], ['COLON', null], ['NUMBER', '1'], ['CURLYCLOSE', null]]);
      lexesAs('twig', '1 not in(l)', [['NUMBER', '1'], ['COMPARATOR', 'not in'], ['PARENOPEN', null], ['VAR', 'l'], ['PARENCLOSE', null]]);
    });
    it('jinja2: the keyword is the operator before "(", a longer name stays a call', function () {
      lexesAs('jinja2', 'not(x)', [['NOT', '!'], ['PARENOPEN', null], ['VAR', 'x'], ['PARENCLOSE', null]]);
      lexesAs('jinja2', 'not()', [['NOT', '!'], ['PARENOPEN', null], ['PARENCLOSE', null]]);
      lexesAs('jinja2', 'a and(b)', [['VAR', 'a'], ['LOGIC', '&&'], ['PARENOPEN', null], ['VAR', 'b'], ['PARENCLOSE', null]]);
      lexesAs('jinja2', 'a or(b)', [['VAR', 'a'], ['LOGIC', '||'], ['PARENOPEN', null], ['VAR', 'b'], ['PARENCLOSE', null]]);
      lexesAs('jinja2', '1 in(l)', [['NUMBER', '1'], ['COMPARATOR', 'in'], ['PARENOPEN', null], ['VAR', 'l'], ['PARENCLOSE', null]]);
      lexesAs('jinja2', 'notify(x)', [['FUNCTION', 'notify'], ['VAR', 'x'], ['PARENCLOSE', null]]);
      lexesAs('jinja2', 'android()', [['FUNCTIONEMPTY', 'android']]);
      lexesAs('jinja2', 'index(1)', [['FUNCTION', 'index'], ['NUMBER', '1'], ['PARENCLOSE', null]]);
      lexesAs('jinja2', 'order(1)', [['FUNCTION', 'order'], ['NUMBER', '1'], ['PARENCLOSE', null]]);
      lexesAs('jinja2', '{and: 1}', [['CURLYOPEN', null], ['VAR', 'and'], ['COLON', null], ['NUMBER', '1'], ['CURLYCLOSE', null]]);
      lexesAs('jinja2', '1 not in(l)', [['NUMBER', '1'], ['COMPARATOR', 'not in'], ['PARENOPEN', null], ['VAR', 'l'], ['PARENCLOSE', null]]);
      lexesAs('jinja2', 'a if(c) else(d)', [['VAR', 'a'], ['VAR', 'if'], ['PARENOPEN', null], ['VAR', 'c'], ['PARENCLOSE', null], ['VAR', 'else'], ['PARENOPEN', null], ['VAR', 'd'], ['PARENCLOSE', null]]);
      lexesAs('jinja2', 'ifx(1)', [['FUNCTION', 'ifx'], ['NUMBER', '1'], ['PARENCLOSE', null]]);
      lexesAs('jinja2', 'elsewhere()', [['FUNCTIONEMPTY', 'elsewhere']]);
    });
    it('django: the keyword is the operator before "(", a longer name stays a call', function () {
      lexesAs('django', 'not(x)', [['NOT', '!'], ['PARENOPEN', null], ['VAR', 'x'], ['PARENCLOSE', null]]);
      lexesAs('django', 'not()', [['NOT', '!'], ['PARENOPEN', null], ['PARENCLOSE', null]]);
      lexesAs('django', 'a and(b)', [['VAR', 'a'], ['LOGIC', '&&'], ['PARENOPEN', null], ['VAR', 'b'], ['PARENCLOSE', null]]);
      lexesAs('django', 'a or(b)', [['VAR', 'a'], ['LOGIC', '||'], ['PARENOPEN', null], ['VAR', 'b'], ['PARENCLOSE', null]]);
      lexesAs('django', '1 in(l)', [['NUMBER', '1'], ['COMPARATOR', 'in'], ['PARENOPEN', null], ['VAR', 'l'], ['PARENCLOSE', null]]);
      lexesAs('django', 'notify(x)', [['FUNCTION', 'notify'], ['VAR', 'x'], ['PARENCLOSE', null]]);
      lexesAs('django', 'android()', [['FUNCTIONEMPTY', 'android']]);
      lexesAs('django', 'index(1)', [['FUNCTION', 'index'], ['NUMBER', '1'], ['PARENCLOSE', null]]);
      lexesAs('django', 'order(1)', [['FUNCTION', 'order'], ['NUMBER', '1'], ['PARENCLOSE', null]]);
      lexesAs('django', '{and: 1}', [['CURLYOPEN', null], ['VAR', 'and'], ['COLON', null], ['NUMBER', '1'], ['CURLYCLOSE', null]]);
      lexesAs('django', '1 not in(l)', [['NUMBER', '1'], ['COMPARATOR', 'not in'], ['PARENOPEN', null], ['VAR', 'l'], ['PARENCLOSE', null]]);
    });
  });

  describe('swig-jinja2 renders what Jinja2 3.1 renders', function () {
    it('the keyword written before ( is the operator', function () {
      expect(render('jinja2', '{% if not(x) %}Y{% else %}N{% endif %}', { x: false })).to.equal('Y');
      expect(render('jinja2', '{% if not(x) %}Y{% else %}N{% endif %}', { x: true })).to.equal('N');
      expect(render('jinja2', '{% if not(x) %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('Y');
      expect(render('jinja2', '{% if not(x) %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('N');
      expect(render('jinja2', '{% if not(x) %}Y{% else %}N{% endif %}', { x: '' })).to.equal('Y');
      expect(render('jinja2', '{% if not(x) %}Y{% else %}N{% endif %}', { x: 'a' })).to.equal('N');
      expect(render('jinja2', '{% if not((x)) %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('Y');
      expect(render('jinja2', '{% if not((x)) %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('N');
      expect(render('jinja2', '{% if a and(b) %}Y{% else %}N{% endif %}', { a: 1, b: 0 })).to.equal('N');
      expect(render('jinja2', '{% if a and(b) %}Y{% else %}N{% endif %}', { a: 1, b: 1 })).to.equal('Y');
      expect(render('jinja2', '{% if a and(b) %}Y{% else %}N{% endif %}', { a: 0, b: 1 })).to.equal('N');
      expect(render('jinja2', '{% if a and(b) %}Y{% else %}N{% endif %}', { a: 0, b: 0 })).to.equal('N');
      expect(render('jinja2', '{% if a or(b) %}Y{% else %}N{% endif %}', { a: 1, b: 0 })).to.equal('Y');
      expect(render('jinja2', '{% if a or(b) %}Y{% else %}N{% endif %}', { a: 1, b: 1 })).to.equal('Y');
      expect(render('jinja2', '{% if a or(b) %}Y{% else %}N{% endif %}', { a: 0, b: 1 })).to.equal('Y');
      expect(render('jinja2', '{% if a or(b) %}Y{% else %}N{% endif %}', { a: 0, b: 0 })).to.equal('N');
      expect(render('jinja2', '{% if (a)or(b) %}Y{% else %}N{% endif %}', { a: 1, b: 0 })).to.equal('Y');
      expect(render('jinja2', '{% if (a)or(b) %}Y{% else %}N{% endif %}', { a: 1, b: 1 })).to.equal('Y');
      expect(render('jinja2', '{% if (a)or(b) %}Y{% else %}N{% endif %}', { a: 0, b: 1 })).to.equal('Y');
      expect(render('jinja2', '{% if (a)or(b) %}Y{% else %}N{% endif %}', { a: 0, b: 0 })).to.equal('N');
      expect(render('jinja2', '{% if not(a) and(b) %}Y{% else %}N{% endif %}', { a: 1, b: 0 })).to.equal('N');
      expect(render('jinja2', '{% if not(a) and(b) %}Y{% else %}N{% endif %}', { a: 1, b: 1 })).to.equal('N');
      expect(render('jinja2', '{% if not(a) and(b) %}Y{% else %}N{% endif %}', { a: 0, b: 1 })).to.equal('Y');
      expect(render('jinja2', '{% if not(a) and(b) %}Y{% else %}N{% endif %}', { a: 0, b: 0 })).to.equal('N');
      expect(render('jinja2', '{% if 1 in(l) %}Y{% else %}N{% endif %}', { l: [1] })).to.equal('Y');
      expect(render('jinja2', '{% if 1 in(l) %}Y{% else %}N{% endif %}', { l: [2] })).to.equal('N');
      expect(render('jinja2', '{% if 1 in(l) %}Y{% else %}N{% endif %}', { l: [] })).to.equal('N');
      expect(render('jinja2', '{% if 1 not in(l) %}Y{% else %}N{% endif %}', { l: [1] })).to.equal('N');
      expect(render('jinja2', '{% if 1 not in(l) %}Y{% else %}N{% endif %}', { l: [2] })).to.equal('Y');
      expect(render('jinja2', '{% if 1 not in(l) %}Y{% else %}N{% endif %}', { l: [] })).to.equal('Y');
    });
    it('if( and else( in an inline if and a loop filter, and not( in a comparison', function () {
      expect(render('jinja2', '[{{ "a" if(c) else "b" }}]', { c: 0 })).to.equal('[b]');
      expect(render('jinja2', '[{{ "a" if(c) else "b" }}]', { c: 1 })).to.equal('[a]');
      expect(render('jinja2', '[{{ "a" if c else("b") }}]', { c: 0 })).to.equal('[b]');
      expect(render('jinja2', '[{{ "a" if c else("b") }}]', { c: 1 })).to.equal('[a]');
      expect(render('jinja2', '[{{ ("a")if(c)else("b") }}]', { c: 0 })).to.equal('[b]');
      expect(render('jinja2', '[{{ ("a")if(c)else("b") }}]', { c: 1 })).to.equal('[a]');
      expect(render('jinja2', '{% for i in [1, 2, 3] if(i > 1) %}{{ i }}{% endfor %}', {})).to.equal('23');
      expect(render('jinja2', '{% for i in [1, 2, 3] if(i > 1) and(i < 3) %}{{ i }}{% endfor %}', {})).to.equal('2');
      expect(render('jinja2', '{% if not(x) == 1 %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('Y');
      expect(render('jinja2', '{% if not(x) == 1 %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('N');
      expect(render('jinja2', '{% if not(x) in [1] %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('Y');
      expect(render('jinja2', '{% if not(x) in [1] %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('N');
    });
    it('a name that starts with a keyword is still a call', function () {
      expect(render('jinja2', '[{{ android() }}|{{ index(1) }}|{{ notify(2) }}|{{ order(3) }}|{{ info() }}|{{ ifx(4) }}|{{ elsewhere(5) }}|{{ andy(6) }}|{{ orb(7) }}|{{ nothing() }}|{{ inner(8) }}]', fns())).to.equal('[A|I1|N2|O3|F|X4|E5|Y6|B7|T|R8]');
    });
  });

  describe('swig-twig, swig-django and native swig read the keyword as the operator', function () {
    it('native: the truth value of the expression', function () {
      expect(render('native', '{% if not(x) %}Y{% else %}N{% endif %}', { x: false })).to.equal('Y');
      expect(render('native', '{% if not(x) %}Y{% else %}N{% endif %}', { x: true })).to.equal('N');
      expect(render('native', '{% if not(x) %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('Y');
      expect(render('native', '{% if not(x) %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('N');
      expect(render('native', '{% if not(x) %}Y{% else %}N{% endif %}', { x: '' })).to.equal('Y');
      expect(render('native', '{% if not(x) %}Y{% else %}N{% endif %}', { x: 'a' })).to.equal('N');
      expect(render('native', '{% if not((x)) %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('Y');
      expect(render('native', '{% if not((x)) %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('N');
      expect(render('native', '{% if a and(b) %}Y{% else %}N{% endif %}', { a: 1, b: 0 })).to.equal('N');
      expect(render('native', '{% if a and(b) %}Y{% else %}N{% endif %}', { a: 1, b: 1 })).to.equal('Y');
      expect(render('native', '{% if a and(b) %}Y{% else %}N{% endif %}', { a: 0, b: 1 })).to.equal('N');
      expect(render('native', '{% if a and(b) %}Y{% else %}N{% endif %}', { a: 0, b: 0 })).to.equal('N');
      expect(render('native', '{% if a or(b) %}Y{% else %}N{% endif %}', { a: 1, b: 0 })).to.equal('Y');
      expect(render('native', '{% if a or(b) %}Y{% else %}N{% endif %}', { a: 1, b: 1 })).to.equal('Y');
      expect(render('native', '{% if a or(b) %}Y{% else %}N{% endif %}', { a: 0, b: 1 })).to.equal('Y');
      expect(render('native', '{% if a or(b) %}Y{% else %}N{% endif %}', { a: 0, b: 0 })).to.equal('N');
      expect(render('native', '{% if (a)or(b) %}Y{% else %}N{% endif %}', { a: 1, b: 0 })).to.equal('Y');
      expect(render('native', '{% if (a)or(b) %}Y{% else %}N{% endif %}', { a: 1, b: 1 })).to.equal('Y');
      expect(render('native', '{% if (a)or(b) %}Y{% else %}N{% endif %}', { a: 0, b: 1 })).to.equal('Y');
      expect(render('native', '{% if (a)or(b) %}Y{% else %}N{% endif %}', { a: 0, b: 0 })).to.equal('N');
      expect(render('native', '{% if not(a) and(b) %}Y{% else %}N{% endif %}', { a: 1, b: 0 })).to.equal('N');
      expect(render('native', '{% if not(a) and(b) %}Y{% else %}N{% endif %}', { a: 1, b: 1 })).to.equal('N');
      expect(render('native', '{% if not(a) and(b) %}Y{% else %}N{% endif %}', { a: 0, b: 1 })).to.equal('Y');
      expect(render('native', '{% if not(a) and(b) %}Y{% else %}N{% endif %}', { a: 0, b: 0 })).to.equal('N');
      expect(render('native', '{% if "a" in(o) %}Y{% else %}N{% endif %}', { o: { a: 1 } })).to.equal('Y');
      expect(render('native', '{% if "a" in(o) %}Y{% else %}N{% endif %}', { o: { b: 1 } })).to.equal('N');
    });
    it('native: precedence-sensitive shapes read like their spaced form', function () {
      expect(render('native', '{% if not(x) == 1 %}Y{% else %}N{% endif %}', { x: 0 })).to.equal(render('native', '{% if not (x) == 1 %}Y{% else %}N{% endif %}', { x: 0 }));
      expect(render('native', '{% if not(x) == 1 %}Y{% else %}N{% endif %}', { x: 1 })).to.equal(render('native', '{% if not (x) == 1 %}Y{% else %}N{% endif %}', { x: 1 }));
      expect(render('native', '{% if not(a) or b %}Y{% else %}N{% endif %}', { a: 1, b: 0 })).to.equal(render('native', '{% if not (a) or b %}Y{% else %}N{% endif %}', { a: 1, b: 0 }));
      expect(render('native', '{% if not(a) or b %}Y{% else %}N{% endif %}', { a: 1, b: 1 })).to.equal(render('native', '{% if not (a) or b %}Y{% else %}N{% endif %}', { a: 1, b: 1 }));
      expect(render('native', '{% if not(a) or b %}Y{% else %}N{% endif %}', { a: 0, b: 1 })).to.equal(render('native', '{% if not (a) or b %}Y{% else %}N{% endif %}', { a: 0, b: 1 }));
      expect(render('native', '{% if not(a) or b %}Y{% else %}N{% endif %}', { a: 0, b: 0 })).to.equal(render('native', '{% if not (a) or b %}Y{% else %}N{% endif %}', { a: 0, b: 0 }));
    });
    it('twig: the truth value of the expression', function () {
      expect(render('twig', '{% if not(x) %}Y{% endif %}', { x: false })).to.equal('Y');
      expect(render('twig', '{% if not(x) %}Y{% endif %}', { x: true })).to.equal('');
      expect(render('twig', '{% if not(x) %}Y{% endif %}', { x: 0 })).to.equal('Y');
      expect(render('twig', '{% if not(x) %}Y{% endif %}', { x: 1 })).to.equal('');
      expect(render('twig', '{% if not(x) %}Y{% endif %}', { x: '' })).to.equal('Y');
      expect(render('twig', '{% if not(x) %}Y{% endif %}', { x: 'a' })).to.equal('');
      expect(render('twig', '{% if not((x)) %}Y{% endif %}', { x: 0 })).to.equal('Y');
      expect(render('twig', '{% if not((x)) %}Y{% endif %}', { x: 1 })).to.equal('');
      expect(render('twig', '{% if a and(b) %}Y{% endif %}', { a: 1, b: 0 })).to.equal('');
      expect(render('twig', '{% if a and(b) %}Y{% endif %}', { a: 1, b: 1 })).to.equal('Y');
      expect(render('twig', '{% if a and(b) %}Y{% endif %}', { a: 0, b: 1 })).to.equal('');
      expect(render('twig', '{% if a and(b) %}Y{% endif %}', { a: 0, b: 0 })).to.equal('');
      expect(render('twig', '{% if a or(b) %}Y{% endif %}', { a: 1, b: 0 })).to.equal('Y');
      expect(render('twig', '{% if a or(b) %}Y{% endif %}', { a: 1, b: 1 })).to.equal('Y');
      expect(render('twig', '{% if a or(b) %}Y{% endif %}', { a: 0, b: 1 })).to.equal('Y');
      expect(render('twig', '{% if a or(b) %}Y{% endif %}', { a: 0, b: 0 })).to.equal('');
      expect(render('twig', '{% if (a)or(b) %}Y{% endif %}', { a: 1, b: 0 })).to.equal('Y');
      expect(render('twig', '{% if (a)or(b) %}Y{% endif %}', { a: 1, b: 1 })).to.equal('Y');
      expect(render('twig', '{% if (a)or(b) %}Y{% endif %}', { a: 0, b: 1 })).to.equal('Y');
      expect(render('twig', '{% if (a)or(b) %}Y{% endif %}', { a: 0, b: 0 })).to.equal('');
      expect(render('twig', '{% if not(a) and(b) %}Y{% endif %}', { a: 1, b: 0 })).to.equal('');
      expect(render('twig', '{% if not(a) and(b) %}Y{% endif %}', { a: 1, b: 1 })).to.equal('');
      expect(render('twig', '{% if not(a) and(b) %}Y{% endif %}', { a: 0, b: 1 })).to.equal('Y');
      expect(render('twig', '{% if not(a) and(b) %}Y{% endif %}', { a: 0, b: 0 })).to.equal('');
      expect(render('twig', '{% if 1 in(l) %}Y{% endif %}', { l: [1] })).to.equal('Y');
      expect(render('twig', '{% if 1 in(l) %}Y{% endif %}', { l: [2] })).to.equal('');
      expect(render('twig', '{% if 1 in(l) %}Y{% endif %}', { l: [] })).to.equal('');
      expect(render('twig', '{% if 1 not in(l) %}Y{% endif %}', { l: [1] })).to.equal('');
      expect(render('twig', '{% if 1 not in(l) %}Y{% endif %}', { l: [2] })).to.equal('Y');
      expect(render('twig', '{% if 1 not in(l) %}Y{% endif %}', { l: [] })).to.equal('Y');
    });
    it('twig: precedence-sensitive shapes read like their spaced form', function () {
      expect(render('twig', '{% if not(x) == 1 %}Y{% endif %}', { x: 0 })).to.equal(render('twig', '{% if not (x) == 1 %}Y{% endif %}', { x: 0 }));
      expect(render('twig', '{% if not(x) == 1 %}Y{% endif %}', { x: 1 })).to.equal(render('twig', '{% if not (x) == 1 %}Y{% endif %}', { x: 1 }));
      expect(render('twig', '{% if not(a) or b %}Y{% endif %}', { a: 1, b: 0 })).to.equal(render('twig', '{% if not (a) or b %}Y{% endif %}', { a: 1, b: 0 }));
      expect(render('twig', '{% if not(a) or b %}Y{% endif %}', { a: 1, b: 1 })).to.equal(render('twig', '{% if not (a) or b %}Y{% endif %}', { a: 1, b: 1 }));
      expect(render('twig', '{% if not(a) or b %}Y{% endif %}', { a: 0, b: 1 })).to.equal(render('twig', '{% if not (a) or b %}Y{% endif %}', { a: 0, b: 1 }));
      expect(render('twig', '{% if not(a) or b %}Y{% endif %}', { a: 0, b: 0 })).to.equal(render('twig', '{% if not (a) or b %}Y{% endif %}', { a: 0, b: 0 }));
    });
    it('django: the truth value of the expression', function () {
      expect(render('django', '{% if not(x) %}Y{% else %}N{% endif %}', { x: false })).to.equal('Y');
      expect(render('django', '{% if not(x) %}Y{% else %}N{% endif %}', { x: true })).to.equal('N');
      expect(render('django', '{% if not(x) %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('Y');
      expect(render('django', '{% if not(x) %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('N');
      expect(render('django', '{% if not(x) %}Y{% else %}N{% endif %}', { x: '' })).to.equal('Y');
      expect(render('django', '{% if not(x) %}Y{% else %}N{% endif %}', { x: 'a' })).to.equal('N');
      expect(render('django', '{% if not((x)) %}Y{% else %}N{% endif %}', { x: 0 })).to.equal('Y');
      expect(render('django', '{% if not((x)) %}Y{% else %}N{% endif %}', { x: 1 })).to.equal('N');
      expect(render('django', '{% if a and(b) %}Y{% else %}N{% endif %}', { a: 1, b: 0 })).to.equal('N');
      expect(render('django', '{% if a and(b) %}Y{% else %}N{% endif %}', { a: 1, b: 1 })).to.equal('Y');
      expect(render('django', '{% if a and(b) %}Y{% else %}N{% endif %}', { a: 0, b: 1 })).to.equal('N');
      expect(render('django', '{% if a and(b) %}Y{% else %}N{% endif %}', { a: 0, b: 0 })).to.equal('N');
      expect(render('django', '{% if a or(b) %}Y{% else %}N{% endif %}', { a: 1, b: 0 })).to.equal('Y');
      expect(render('django', '{% if a or(b) %}Y{% else %}N{% endif %}', { a: 1, b: 1 })).to.equal('Y');
      expect(render('django', '{% if a or(b) %}Y{% else %}N{% endif %}', { a: 0, b: 1 })).to.equal('Y');
      expect(render('django', '{% if a or(b) %}Y{% else %}N{% endif %}', { a: 0, b: 0 })).to.equal('N');
      expect(render('django', '{% if (a)or(b) %}Y{% else %}N{% endif %}', { a: 1, b: 0 })).to.equal('Y');
      expect(render('django', '{% if (a)or(b) %}Y{% else %}N{% endif %}', { a: 1, b: 1 })).to.equal('Y');
      expect(render('django', '{% if (a)or(b) %}Y{% else %}N{% endif %}', { a: 0, b: 1 })).to.equal('Y');
      expect(render('django', '{% if (a)or(b) %}Y{% else %}N{% endif %}', { a: 0, b: 0 })).to.equal('N');
      expect(render('django', '{% if not(a) and(b) %}Y{% else %}N{% endif %}', { a: 1, b: 0 })).to.equal('N');
      expect(render('django', '{% if not(a) and(b) %}Y{% else %}N{% endif %}', { a: 1, b: 1 })).to.equal('N');
      expect(render('django', '{% if not(a) and(b) %}Y{% else %}N{% endif %}', { a: 0, b: 1 })).to.equal('Y');
      expect(render('django', '{% if not(a) and(b) %}Y{% else %}N{% endif %}', { a: 0, b: 0 })).to.equal('N');
      expect(render('django', '{% if 1 in(l) %}Y{% else %}N{% endif %}', { l: [1] })).to.equal('Y');
      expect(render('django', '{% if 1 in(l) %}Y{% else %}N{% endif %}', { l: [2] })).to.equal('N');
      expect(render('django', '{% if 1 in(l) %}Y{% else %}N{% endif %}', { l: [] })).to.equal('N');
      expect(render('django', '{% if 1 not in(l) %}Y{% else %}N{% endif %}', { l: [1] })).to.equal('N');
      expect(render('django', '{% if 1 not in(l) %}Y{% else %}N{% endif %}', { l: [2] })).to.equal('Y');
      expect(render('django', '{% if 1 not in(l) %}Y{% else %}N{% endif %}', { l: [] })).to.equal('Y');
    });
    it('django: precedence-sensitive shapes read like their spaced form', function () {
      expect(render('django', '{% if not(x) == 1 %}Y{% else %}N{% endif %}', { x: 0 })).to.equal(render('django', '{% if not (x) == 1 %}Y{% else %}N{% endif %}', { x: 0 }));
      expect(render('django', '{% if not(x) == 1 %}Y{% else %}N{% endif %}', { x: 1 })).to.equal(render('django', '{% if not (x) == 1 %}Y{% else %}N{% endif %}', { x: 1 }));
      expect(render('django', '{% if not(a) or b %}Y{% else %}N{% endif %}', { a: 1, b: 0 })).to.equal(render('django', '{% if not (a) or b %}Y{% else %}N{% endif %}', { a: 1, b: 0 }));
      expect(render('django', '{% if not(a) or b %}Y{% else %}N{% endif %}', { a: 1, b: 1 })).to.equal(render('django', '{% if not (a) or b %}Y{% else %}N{% endif %}', { a: 1, b: 1 }));
      expect(render('django', '{% if not(a) or b %}Y{% else %}N{% endif %}', { a: 0, b: 1 })).to.equal(render('django', '{% if not (a) or b %}Y{% else %}N{% endif %}', { a: 0, b: 1 }));
      expect(render('django', '{% if not(a) or b %}Y{% else %}N{% endif %}', { a: 0, b: 0 })).to.equal(render('django', '{% if not (a) or b %}Y{% else %}N{% endif %}', { a: 0, b: 0 }));
    });
    it('a name that starts with a keyword is still a call, and an object key named like one is still a key', function () {
      expect(render('native', '[{{ android() }}|{{ index(1) }}|{{ notify(2) }}|{{ order(3) }}|{{ info() }}|{{ ifx(4) }}|{{ elsewhere(5) }}|{{ andy(6) }}|{{ orb(7) }}|{{ nothing() }}|{{ inner(8) }}]', fns())).to.equal('[A|I1|N2|O3|F|X4|E5|Y6|B7|T|R8]');
      expect(render('twig', '[{{ android() }}|{{ index(1) }}|{{ notify(2) }}|{{ order(3) }}|{{ info() }}|{{ ifx(4) }}|{{ elsewhere(5) }}|{{ andy(6) }}|{{ orb(7) }}|{{ nothing() }}|{{ inner(8) }}]', fns())).to.equal('[A|I1|N2|O3|F|X4|E5|Y6|B7|T|R8]');
      expect(render('django', '[{{ android() }}|{{ index(1) }}|{{ notify(2) }}|{{ order(3) }}|{{ info() }}|{{ ifx(4) }}|{{ elsewhere(5) }}|{{ andy(6) }}|{{ orb(7) }}|{{ nothing() }}|{{ inner(8) }}]', fns())).to.equal('[A|I1|N2|O3|F|X4|E5|Y6|B7|T|R8]');
      expect(render('native', '{% set d = {and: 1, or: 2, not: 3} %}[{{ d.and }}|{{ d.or }}|{{ d.not }}]')).to.equal('[1|2|3]');
      expect(render('twig', '{% set d = {and: 1, or: 2, not: 3, in: 4} %}[{{ d.and }}|{{ d.or }}|{{ d.not }}|{{ d.in }}]')).to.equal('[1|2|3|4]');
      expect(render('jinja2', '{% set d = {and: 1, or: 2, not: 3, in: 4} %}[{{ d.and }}|{{ d.or }}|{{ d.not }}|{{ d.in }}]')).to.equal('[1|2|3|4]');
      expect(render('django', '[{{ {and: 1}.and }}|{{ {or: 2}.or }}|{{ {not: 3}.not }}|{{ {in: 4}.in }}]')).to.equal('[1|2|3|4]');
    });
  });

  describe('native swig', function () {
    it('not( negates and and( / or( fail to compile, even with a locals function of that name', function () {
      var locals = { not: call('n'), and: call('a'), or: call('o') };
      expect(render('native', '[{{ not(1) }}|{{ not(0) }}]', locals)).to.equal('[false|true]');
      expect(function () { render('native', '{{ and(1) }}', locals); }).to.throwError(/Unexpected logic/);
      expect(function () { render('native', '{{ or(1) }}', locals); }).to.throwError(/Unexpected logic/);
    });
    it('a macro head that is not a name fails to compile', function () {
      expect(function () { render('native', '{% macro not(a) %}X{% endmacro %}'); }).to.throwError(/Expected a macro name on line 1/);
      expect(function () { render('native', '{% macro and(b) %}X{% endmacro %}'); }).to.throwError(/Expected a macro name on line 1/);
      expect(function () { render('native', '{% macro or() %}X{% endmacro %}'); }).to.throwError(/Expected a macro name on line 1/);
      expect(function () { render('native', '{% macro !(a) %}X{% endmacro %}'); }).to.throwError(/Expected a macro name on line 1/);
      expect(render('native', '{% macro android(a) %}A{{ a }}{% endmacro %}{{ android(1) }}')).to.equal('A1');
      expect(render('native', '{% macro notify() %}N{% endmacro %}{{ notify() }}')).to.equal('N');
      expect(render('native', '{% macro foo(a, b) %}{{ a }}{{ b }}{% endmacro %}[{{ foo(1, 2) }}]')).to.equal('[12]');
      expect(render('native', '{% macro  foo( a ) %}{{ a }}{% endmacro %}[{{ foo(3) }}]')).to.equal('[3]');
      expect(render('native', '{% macro foo %}F{% endmacro %}[{{ foo() }}]')).to.equal('[F]');
    });
  });
});
