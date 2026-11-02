var flavor = require('@rhinostone/swig-jinja2'),
  Jinja2 = flavor.Jinja2,
  parser = require('@rhinostone/swig-jinja2/lib/parser'),
  lexer = require('@rhinostone/swig-jinja2/lib/lexer'),
  tests = require('@rhinostone/swig-jinja2/lib/tests'),
  expect = require('../lib/expect.js');

/*!
 * Jinja2's comparison tests (eq, equalto, ne, lt, lessthan, le, gt,
 * greaterthan, ge). With one argument the parser compiles each one as the
 * operator it names, while the instance's helper for that name is the
 * built-in one; a test registered under one of these names before the
 * compile runs instead, and another number of arguments calls the helper.
 * Their outputs against Jinja2 are checked in comparison-tests-parity.test.js.
 */
describe('@rhinostone/swig-jinja2 — comparison tests', function () {

  var NAMES = ['eq', 'equalto', 'ne', 'lt', 'lessthan', 'le', 'gt', 'greaterthan', 'ge'],
    OPS = { eq: '==', equalto: '==', ne: '!=', lt: '<', lessthan: '<', le: '<=', gt: '>', greaterthan: '>', ge: '>=' };

  function parse(str) {
    return parser.parseExpr(lexer.read(str));
  }

  function body(inst, src) {
    return inst.precompile(src).tpl.toString();
  }

  function ifs(x) {
    return '{% if ' + x + ' %}Y{% else %}N{% endif %}';
  }

  function asyncInstance(files, setup) {
    var inst = new Jinja2({
      loader: {
        async: true,
        resolve: function (to) { return to; },
        load: function (id, cb) {
          if (!cb) { return files[id]; }
          setImmediate(function () { cb(null, files[id]); });
        }
      }
    });
    setup(inst);
    return inst;
  }

  describe('helpers', function () {

    it('eq and ne compare with Python\'s equality', function () {
      expect(tests.eq(1, 1)).to.be(true);
      expect(tests.eq(1, '1')).to.be(false);
      expect(tests.eq([1], [1])).to.be(true);
      expect(tests.eq(true, 1)).to.be(true);
      expect(tests.eq(null, undefined)).to.be(true);
      expect(tests.ne(1, '1')).to.be(true);
      expect(tests.ne([1], [1])).to.be(false);
    });

    it('lt, le, gt and ge are the JavaScript operators', function () {
      expect(tests.lt(1, 2)).to.be(true);
      expect(tests.lt(2, 1)).to.be(false);
      expect(tests.le(2, 2)).to.be(true);
      expect(tests.le(3, 2)).to.be(false);
      expect(tests.gt(2, 1)).to.be(true);
      expect(tests.gt(2, 2)).to.be(false);
      expect(tests.ge(2, 2)).to.be(true);
      expect(tests.ge(1, 2)).to.be(false);
    });

    it('lt and gt are false for two equal values', function () {
      expect(tests.lt(2, 2)).to.be(false);
      expect(tests.lt('a', 'a')).to.be(false);
      expect(tests.gt('a', 'a')).to.be(false);
    });

    it('the other names are the same helpers', function () {
      NAMES.concat(['==', '!=', '<', '<=', '>', '>=']).forEach(function (name) {
        expect(tests[name]).to.be.a('function');
      });
      expect(tests.equalto).to.be(tests.eq);
      expect(tests['==']).to.be(tests.eq);
      expect(tests['!=']).to.be(tests.ne);
      expect(tests.lessthan).to.be(tests.lt);
      expect(tests['<']).to.be(tests.lt);
      expect(tests['<=']).to.be(tests.le);
      expect(tests.greaterthan).to.be(tests.gt);
      expect(tests['>']).to.be(tests.gt);
      expect(tests['>=']).to.be(tests.ge);
    });

    it('an instance registers the nine names and the six symbols', function () {
      var inst = new Jinja2();
      NAMES.concat(['==', '!=', '<', '<=', '>', '>=']).forEach(function (name) {
        expect(inst.extensions['_test_' + name]).to.be.a('function');
        expect(inst.extensions['_test_' + name]).to.be(tests[name]);
      });
    });
  });

  describe('lowering', function () {

    it('parses a comparison test with one argument as the operator it names', function () {
      expect(parse('a is eq b')).to.eql({
        type: 'BinaryOp', op: '==', left: { type: 'VarRef', path: ['a'] }, right: { type: 'VarRef', path: ['b'] }, pyEq: 'jinja2'
      });
      expect(parse('a is lt b')).to.eql({
        type: 'BinaryOp', op: '<', left: { type: 'VarRef', path: ['a'] }, right: { type: 'VarRef', path: ['b'] }
      });
      expect(parse('a is not ge b')).to.eql({
        type: 'UnaryOp', op: '!', operand: {
          type: 'BinaryOp', op: '>=', left: { type: 'VarRef', path: ['a'] }, right: { type: 'VarRef', path: ['b'] }
        }
      });
      NAMES.forEach(function (name) {
        [parse('a is ' + name + ' b'), parse('a is ' + name + '(b)')].forEach(function (node) {
          expect(node.type).to.equal('BinaryOp');
          expect(node.op).to.equal(OPS[name]);
          expect(node.pyEq).to.be(OPS[name] === '==' || OPS[name] === '!=' ? 'jinja2' : undefined);
        });
      });
    });

    it('reads a name as a comparison test only from the names it provides', function () {
      // toString, valueOf and hasOwnProperty are on every object; with no
      // instance at parse they stay test calls, as any other unknown name.
      ['toString', 'valueOf', 'hasOwnProperty'].forEach(function (name) {
        var node = parse('a is ' + name + ' 1');
        expect(node.type).to.equal('FnCall');
        expect(node.callee.path).to.eql(['_ext', '_test_' + name]);
      });
    });

    it('compiles a comparison test without calling its helper', function () {
      var inst = new Jinja2();
      NAMES.forEach(function (name) {
        var src = body(inst, '{{ a is ' + name + ' b }}');
        expect(src).to.not.contain('_test_' + name);
        if (OPS[name] === '==' || OPS[name] === '!=') {
          expect(src).to.contain('_utils.pyEq(');
        } else {
          expect(src).to.not.contain('_utils.pyEq(');
          expect(src).to.contain(')' + OPS[name] + '(');
        }
      });
    });

    it('fails when reached with another number of arguments', function () {
      var inst = new Jinja2();
      expect(parse('a is eq').callee.path).to.eql(['_utils', 'invalidName']);
      expect(parse('a is eq(b, c)').callee.path).to.eql(['_utils', 'invalidName']);
      expect(body(inst, '{{ a is eq() }}')).to.not.contain('_ext._test_eq');
      expect(body(inst, '{{ a is lt(b, c) }}')).to.not.contain('_ext._test_lt');
      // Jinja2 raises a TypeError for these calls when they run.
      expect(function () { inst.render(ifs('1 is eq()')); }).to.throwError(/Test "eq" takes one argument, found none/);
      expect(function () { inst.render(ifs('1 is eq(1, 2)')); }).to.throwError(/Test "eq" takes one argument, found 2/);
      expect(inst.render('{% if false %}{{ 1 is eq() }}{% endif %}ok')).to.equal('ok');
    });

    it('lowers on the module\'s default instance too', function () {
      expect(flavor.render(ifs('2 is gt 1'))).to.equal('Y');
      expect(flavor.render(ifs('1 is eq "1"'))).to.equal('N');
    });

    it('lowers on the module\'s default instance, where a missing value equals none', function () {
      // Lowered, a missing x equals None, as == reads it. Through a helper
      // equivalent to the built-in one the same template renders N, so this
      // case tells the two paths apart, where the cases above do not.
      var inst = new Jinja2(),
        builtIn = inst.extensions._test_eq;
      inst.setExtension('_test_eq', function () { return builtIn.apply(this, arguments); });
      expect(inst.render(ifs('x is eq none'))).to.equal('N');
      expect(new Jinja2().render(ifs('x is eq none'))).to.equal('Y');
      expect(flavor.render(ifs('x is eq none'))).to.equal('Y');
    });
  });

  describe('a test registered under one of the names', function () {

    function always(value) {
      return function () { return value; };
    }

    it('runs instead of the operator', function () {
      var inst = new Jinja2();
      inst.setExtension('_test_eq', function (v, other) { return v + ':' + other; });
      inst.setExtension('_test_lt', always(true));
      expect(inst.render('{{ 1 is eq 2 }}')).to.equal('1:2');
      expect(inst.render(ifs('1 is not eq 2'))).to.equal('N');
      expect(inst.render(ifs('2 is lt 1'))).to.equal('Y');
      expect(body(inst, '{{ 1 is eq 2 }}')).to.contain('_ext._test_eq');
      expect(body(inst, '{{ 1 is eq 2 }}')).to.not.contain('_utils.pyEq(');
    });

    it('runs instead of the operator on the async render path', function (done) {
      var inst = asyncInstance({ '/t': ifs('2 is lt 1') + '|' + ifs('1 is eq 2') }, function (i) {
        i.setExtension('_test_lt', always(true));
      });
      inst.renderFile('/t', {}, function (err, out) {
        try {
          expect(err).to.be(null);
          expect(out).to.equal('Y|N');
          done();
        } catch (e) {
          done(e);
        }
      });
    });

    it('replaces only its own name', function () {
      var inst = new Jinja2();
      inst.setExtension('_test_eq', always(true));
      expect(inst.render(ifs('1 is eq 2'))).to.equal('Y');
      expect(inst.render(ifs('1 is equalto 2'))).to.equal('N');
      expect(body(inst, '{{ 1 is equalto 2 }}')).to.contain('_utils.pyEq(');
      expect(new Jinja2().render(ifs('1 is eq 2'))).to.equal('N');
    });

    it('is read when the template compiles', function () {
      var inst = new Jinja2(),
        before = inst.compile(ifs('1 is eq 2'));
      inst.setExtension('_test_eq', always(true));
      expect(before({})).to.equal('N');
      expect(inst.compile(ifs('1 is eq 2'))({})).to.equal('Y');
    });
  });
});
