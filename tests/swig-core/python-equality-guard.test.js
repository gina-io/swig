var jinja2 = require('@rhinostone/swig-jinja2'),
  django = require('@rhinostone/swig-django'),
  backend = require('@rhinostone/swig-core/lib/backend'),
  ir = require('@rhinostone/swig-core/lib/ir'),
  expect = require('../lib/expect.js');

/*!
 * The operands of the Jinja2 and Django comparisons read their own value
 * (null or missing kept for Python's equality); the prototype-chain guard
 * still rejects a name on the prototype chain in every operand.
 */
describe('swig-core — prototype-chain guard on comparison operands', function () {

  function guarded(inst, expr) {
    try {
      inst.render('{% if ' + expr + ' %}Y{% else %}N{% endif %}', { locals: { a: {}, b: {}, c: [] } });
    } catch (e) {
      return (/prototype-chain guard/).test(e.message);
    }
    return false;
  }

  var flavors = [['swig-jinja2', new jinja2.Jinja2()], ['swig-django', new django.Django()]],
    inShapes = ['__proto__ in c', 'a.__proto__ in c', 'a in constructor', 'a in b.prototype', 'constructor not in c'],
    eqShapes = ['__proto__ == 1', 'a.__proto__ == 1', 'constructor != 1', 'a.constructor == b', '1 == a.prototype', 'a == __proto__'];

  flavors.forEach(function (f) {
    it(f[0] + ': `in` operands', function () {
      inShapes.forEach(function (s) {
        expect([s, guarded(f[1], s)]).to.eql([s, true]);
      });
      expect(guarded(f[1], 'a in c')).to.be(false);
    });

    it(f[0] + ': `==` and `!=` operands', function () {
      eqShapes.forEach(function (s) {
        expect([s, guarded(f[1], s)]).to.eql([s, true]);
      });
      expect(guarded(f[1], 'a == b')).to.be(false);
    });
  });

  it('swig-jinja2: subscripts in `in` operands', function () {
    expect(guarded(flavors[0][1], 'a["__proto__"] in c')).to.be(true);
    expect(guarded(flavors[0][1], 'a in b["constructor"]')).to.be(true);
    expect(guarded(flavors[0][1], 'a["__proto__"] == 1')).to.be(true);
    expect(guarded(flavors[0][1], 'a == b["constructor"]')).to.be(true);
  });

  /*!
   * The flavor parsers already reject these names; the backend guards the
   * raw operand reads too, for IR built by other code.
   */
  describe('in the backend, on IR that reaches it', function () {
    function emits(node) {
      try {
        backend.emitExpr(node);
      } catch (e) {
        return (/prototype-chain guard/).test(e.message) ? 'GUARD' : e.message;
      }
      return 'EMITS';
    }

    function flagged(op, left, right, flag) {
      var node = ir.binaryOp(op, left, right);
      node.membership = flag;
      return node;
    }

    it('a membership operand: a path, a conditional branch, an and / or operand, a subscript', function () {
      ['jinja2', 'django'].forEach(function (flag) {
        expect(emits(flagged('in', ir.varRef(['__proto__']), ir.varRef(['c']), flag))).to.be('GUARD');
        expect(emits(flagged('in', ir.varRef(['a']), ir.varRef(['b', 'constructor']), flag))).to.be('GUARD');
        expect(emits(flagged('in', ir.conditional(ir.varRef(['t']), ir.varRef(['a']), ir.varRef(['prototype'])), ir.varRef(['c']), flag))).to.be('GUARD');
        expect(emits(flagged('in', ir.binaryOp('||', ir.varRef(['a']), ir.varRef(['a', '__proto__'])), ir.varRef(['c']), flag))).to.be('GUARD');
        expect(emits(flagged('in', ir.access(ir.varRef(['a']), ir.literal('string', '__proto__')), ir.varRef(['c']), flag))).to.be('GUARD');
        expect(emits(flagged('in', ir.varRef(['a']), ir.varRef(['c']), flag))).to.be('EMITS');
      });
    });

    it('a pyEq operand of == and !=: a path, a conditional branch, an and / or operand', function () {
      ['jinja2', 'django'].forEach(function (flag) {
        ['==', '!='].forEach(function (op) {
          var eq = function (left, right) { var node = ir.binaryOp(op, left, right); node.pyEq = flag; return node; };
          expect(emits(eq(ir.varRef(['__proto__']), ir.literal('number', 1)))).to.be('GUARD');
          expect(emits(eq(ir.literal('number', 1), ir.varRef(['a', 'constructor'])))).to.be('GUARD');
          expect(emits(eq(ir.conditional(ir.varRef(['t']), ir.varRef(['prototype']), ir.varRef(['a'])), ir.varRef(['b'])))).to.be('GUARD');
          expect(emits(eq(ir.binaryOp('&&', ir.varRef(['a']), ir.varRef(['__proto__'])), ir.varRef(['b'])))).to.be('GUARD');
          expect(emits(eq(ir.varRef(['a']), ir.varRef(['b'])))).to.be('EMITS');
        });
      });
    });
  });
});
