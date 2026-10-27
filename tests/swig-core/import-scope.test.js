var utils = require('@rhinostone/swig-core/lib/utils'),
  backend = require('@rhinostone/swig-core/lib/backend'),
  ir = require('@rhinostone/swig-core/lib/ir'),
  expect = require('../lib/expect.js');

/*!
 * The helpers behind a sync {% import %} or {% from %}. The backend emits a
 * scope function that binds the imported file's own imports and macros on a
 * scope object of the import and on closure variables of that function
 * (syncImport, scopeBinding); _utils.importScope runs it and returns the
 * named macros. A name of the scope that the macros read (macroRefs) is put
 * in the importer's context while a macro runs only when the context holds
 * that name or the name cannot be a closure variable, and the context gets
 * its own value back afterwards.
 */

var has = Object.prototype.hasOwnProperty;

function macro(out) {
  var fn = function () { return out; };
  fn.safe = true;
  return fn;
}

describe('@rhinostone/swig-core — utils.importScope', function () {

  it('runs the import on a scope object and returns the named exports, leaving the context alone', function () {
    var ctx = { who: 'W' }, a = macro('A'), b = macro('B'),
      exp = utils.importScope(ctx, function (scope) {
        scope.a = a;
        scope.b = b;
        scope.v = 'x';
      }, ['a', 'v'], [], []);
    expect(Object.keys(exp)).to.eql(['a', 'v']);
    expect(exp.a).to.be(a);
    expect(exp.v).to.be('x');
    expect(ctx).to.eql({ who: 'W' });
  });

  it('returns a macro as it is when the macros read no name of the scope', function () {
    var a = macro('A'),
      exp = utils.importScope({}, function (scope) { scope.a = a; }, ['a'], [], ['a']);
    expect(exp.a).to.be(a);
  });

  it('ignores a name the macros read that the import does not bind', function () {
    var ctx = { who: 'W' },
      a = function () { return ctx.who; },
      exp = utils.importScope(ctx, function (scope) { scope.a = a; }, ['a'], ['who'], []);
    expect(exp.a).to.be(a);
    expect(exp.a()).to.be('W');
  });

  it('leaves the context alone while a macro reaches a name through its closure variable', function () {
    var ctx = {}, during,
      a = function () { during = has.call(ctx, 'b'); return 'A'; },
      exp = utils.importScope(ctx, function (scope) {
        scope.a = a;
        scope.b = macro('B');
      }, ['a'], ['b'], ['a', 'b']);
    expect(exp.a()).to.be('A');
    expect(during).to.be(false);
    expect(Object.keys(ctx)).to.eql([]);
  });

  it('puts the value of the scope in the context while a macro runs when the context holds the name, then restores it', function () {
    var ctx = { b: 'V', c: 'W' }, during = [], b = macro('B'), c = macro('C'),
      a = function (x) { during.push(ctx.b, ctx.c); return 'A' + x; },
      exp = utils.importScope(ctx, function (scope) {
        scope.a = a;
        scope.b = b;
        scope.c = c;
      }, ['a'], ['b', 'c'], ['a', 'b', 'c']);
    expect(exp.a(7)).to.be('A7');
    expect(during[0]).to.be(b);
    expect(during[1]).to.be(c);
    expect(ctx).to.eql({ b: 'V', c: 'W' });
  });

  it('puts a name that has no closure variable in the context while a macro runs, then removes it', function () {
    var ctx = {}, during, b = macro('B'),
      a = function (x) { during = ctx.b; return 'A' + x; },
      exp = utils.importScope(ctx, function (scope) {
        scope.a = a;
        scope.b = b;
      }, ['a'], ['b'], ['a']);
    expect(exp.a(7)).to.be('A7');
    expect(during).to.be(b);
    expect(has.call(ctx, 'b')).to.be(false);
  });

  it('restores the context when a macro throws', function () {
    var ctx = { b: 'V' },
      exp = utils.importScope(ctx, function (scope) {
        scope.a = function () { throw new Error('boom'); };
        scope.b = macro('B');
        scope.c = macro('C');
      }, ['a'], ['b', 'c'], []);
    expect(function () { exp.a(); }).to.throwException(/boom/);
    expect(ctx).to.eql({ b: 'V' });
    expect(has.call(ctx, 'c')).to.be(false);
  });

  it('restores an inherited value of the context by removing the own copy', function () {
    var ctx = Object.create({ b: 'P' }), during, b = macro('B'),
      a = function () { during = ctx.b; return 'A'; },
      exp = utils.importScope(ctx, function (scope) {
        scope.a = a;
        scope.b = b;
      }, ['a'], ['b'], ['a', 'b']);
    expect(exp.a()).to.be('A');
    expect(during).to.be(b);
    expect(has.call(ctx, 'b')).to.be(false);
    expect(ctx.b).to.be('P');
  });

  it('keeps the safe flag of a wrapped macro and passes this, the arguments and the result through', function () {
    var self = {}, r,
      a = function (x, y) { return [this, x, y]; },
      exp;
    a.safe = true;
    exp = utils.importScope({}, function (scope) {
      scope.a = a;
      scope.b = macro('B');
    }, ['a'], ['b'], ['a', 'b']);
    expect(exp.a).to.not.be(a);
    expect(exp.a.safe).to.be(true);
    r = exp.a.call(self, 1, 2);
    expect(r[0]).to.be(self);
    expect(r[1]).to.be(1);
    expect(r[2]).to.be(2);
  });

  it('wraps function exports only', function () {
    var exp = utils.importScope({}, function (scope) {
      scope.a = macro('A');
      scope.v = 'x';
    }, ['a', 'v'], ['a'], []);
    expect(exp.v).to.be('x');
    expect(exp.a()).to.be('A');
  });
});

describe('@rhinostone/swig-core — backend.syncImport', function () {

  it('wraps the body in a scope function with a closure variable for each bound name', function () {
    expect(backend.syncImport('_scope.a = a = function () {…};\n', ['a'], ['a'], ['a']))
      .to.equal('_utils.importScope(_ctx, function (_scope) {\nvar a;\n_scope.a = a = function () {…};\n}, ["a"], ["a"], ["a"])');
  });

  it('exports each name once', function () {
    expect(backend.syncImport('', ['a', 'a', 'b'], [], ['a', 'b']))
      .to.equal('_utils.importScope(_ctx, function (_scope) {\nvar a, b;\n}, ["a","b"], [], ["a","b"])');
  });

  it('keeps a name the macros read only when the import binds it, each once', function () {
    expect(backend.syncImport('', ['a'], ['a', 'who', 'a', 'b'], ['a', 'b']))
      .to.equal('_utils.importScope(_ctx, function (_scope) {\nvar a, b;\n}, ["a"], ["a","b"], ["a","b"])');
  });

  it('declares no closure variable for a reserved word, a standard global, an internal name or a name starting with __', function () {
    expect(backend.syncImport('', ['a'], [], ['a', 'class', 'String', '_utils', '_scope', '__l', '$x']))
      .to.equal('_utils.importScope(_ctx, function (_scope) {\nvar a, $x;\n}, ["a"], [], ["a","$x"])');
  });

  it('declares nothing when no bound name can be a closure variable', function () {
    expect(backend.syncImport('X;\n', ['class'], [], ['class']))
      .to.equal('_utils.importScope(_ctx, function (_scope) {\nX;\n}, ["class"], [], [])');
  });

  it('accepts missing refs and bound names', function () {
    expect(backend.syncImport('', ['a']))
      .to.equal('_utils.importScope(_ctx, function (_scope) {\n}, ["a"], [], [])');
  });
});

describe('@rhinostone/swig-core — backend.scopeBinding', function () {

  it('binds a name on the scope and on its closure variable', function () {
    expect(backend.scopeBinding('field')).to.equal('_scope.field = field = ');
    expect(backend.scopeBinding('$x')).to.equal('_scope.$x = $x = ');
    expect(backend.scopeBinding('_h')).to.equal('_scope._h = _h = ');
  });

  it('binds a name that cannot be a closure variable on the scope only', function () {
    expect(backend.scopeBinding('class')).to.equal('_scope.class = ');
    expect(backend.scopeBinding('String')).to.equal('_scope.String = ');
    expect(backend.scopeBinding('_scope')).to.equal('_scope._scope = ');
    expect(backend.scopeBinding('__l')).to.equal('_scope.__l = ');
  });
});

describe('@rhinostone/swig-core — backend.macroRefs', function () {

  it('lists the names a macro reads in the context, not its parameter shadowing', function () {
    expect(backend.macroRefs(ir.macro('a', [ir.macroParam('x')], [ir.legacyJS('_output += _ctx.b();\n')]), {})).to.eql(['b']);
  });

  it('lists each name once, in the order it first appears', function () {
    expect(backend.macroRefs(ir.macro('a', [], [ir.legacyJS('_output += _ctx.b() + _ctx.c + _ctx.b;\n')]), {})).to.eql(['b', 'c']);
  });

  it('includes a name a parameter default reads', function () {
    expect(backend.macroRefs(ir.macro('a', [ir.macroParam('x', ir.varRef(['d']))], [ir.text('T')]), {})).to.eql(['d']);
  });

  it('works without options', function () {
    expect(backend.macroRefs(ir.macro('a', [], [ir.text('T')]))).to.eql([]);
  });
});

describe('@rhinostone/swig-core — the Macro node on a sync import', function () {

  it('binds the macro on the import\'s scope and its closure variable, with the same function', function () {
    var node = ir.macro('a', [ir.macroParam('x')], [ir.text('T')]),
      scoped = backend.compile([node], [], { macroScope: true }),
      plain = backend.compile([node], [], {});
    expect(scoped.indexOf('_scope.a = a = function (x) {')).to.equal(0);
    expect(scoped).to.contain('\n_scope.a.safe = true;\n');
    expect(scoped).to.not.contain('_ctx.a =');
    expect(scoped.replace('_scope.a = a = ', '_ctx.a = ').replace('_scope.a.safe', '_ctx.a.safe')).to.equal(plain);
  });

  it('binds a macro whose name cannot be a closure variable on the scope only', function () {
    var scoped = backend.compile([ir.macro('class', [], [ir.text('T')])], [], { macroScope: true });
    expect(scoped.indexOf('_scope.class = function () {')).to.equal(0);
    expect(scoped).to.contain('\n_scope.class.safe = true;\n');
  });
});
