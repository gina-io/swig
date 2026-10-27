var utils = require('@rhinostone/swig-core/lib/utils'),
  swigModule = require('../../lib/swig'),
  twigModule = require('@rhinostone/swig-twig'),
  jinja2Module = require('@rhinostone/swig-jinja2'),
  expect = require('../lib/expect.js');

/*!
 * An async import (utils.importIsolated) puts back, while one of its macros
 * runs, the names the imported template bound. It puts only those a call
 * can reach: the names the macros read or write, as their compiled code
 * records them (utils.exportRefs), followed through the macros and imports
 * the template bound; and every name the template bound when one of them
 * leads to a value nothing recorded.
 */

describe('swig-core utils.exportRefs and utils.importIsolated', function () {
  var has = Object.prototype.hasOwnProperty;

  // An import whose template binds `binds` in the importer's context and
  // returns `exports`.
  function importOf(ctx, binds, exports) {
    return utils.importIsolated(ctx, async function () {
      Object.keys(binds).forEach(function (k) {
        ctx[k] = binds[k];
      });
      return exports;
    });
  }

  // A macro recording `refs` that logs, when called, what the context holds
  // for each of `names` ('-' when it does not hold the name).
  function probe(ctx, refs, names, log) {
    var fn = function () {
      var seen = {};
      names.forEach(function (k) {
        seen[k] = has.call(ctx, k) ? (typeof ctx[k] === 'function' ? 'fn' : ctx[k]) : '-';
      });
      log.push(seen);
      return 'M';
    };
    return refs ? utils.exportRefs(fn, refs) : fn;
  }

  it('exportRefs returns what it is given and records only a function', function () {
    var f = function () {};
    expect(utils.exportRefs(f, ['a'])).to.be(f);
    expect(utils.exportRefs('x', ['a'])).to.be('x');
    expect(utils.exportRefs(undefined, ['a'])).to.be(undefined);
  });

  it('puts in place, while a macro runs, only the names it reads among those its template bound', function () {
    var ctx = { a: 'mine' }, log = [], m = probe(ctx, ['a'], ['a', 'b'], log);
    return importOf(ctx, { a: 'A', b: 'B', m: m }, { m: m }).then(function (exp) {
      expect(ctx).to.eql({ a: 'mine' });
      expect(exp.m()).to.equal('M');
      expect(log).to.eql([{ a: 'A', b: '-' }]);
      expect(ctx).to.eql({ a: 'mine' });
    });
  });

  it('puts in place the names read by a macro its template bound and a call reaches', function () {
    var ctx = {}, log = [], g = utils.exportRefs(function () { return 'G'; }, ['b']), m = probe(ctx, ['g'], ['b', 'c', 'g'], log);
    return importOf(ctx, { b: 'B', c: 'C', g: g, m: m }, { m: m }).then(function (exp) {
      exp.m();
      expect(log).to.eql([{ b: 'B', c: '-', g: 'fn' }]);
      expect(ctx).to.eql({});
    });
  });

  it('follows the names an inner import returned its exports with', function () {
    var ctx = {}, log = [], f = probe(ctx, ['z'], ['z', 'w'], log), om;
    return utils.importIsolated(ctx, async function () {
      var t = await importOf(ctx, { f: f }, { f: f });
      om = utils.exportRefs(function () { return t.f(); }, ['t']);
      ctx.t = t;
      ctx.z = 'Z';
      ctx.w = 'W';
      ctx.om = om;
      return { om: om };
    }).then(function (exp) {
      expect(exp.om()).to.equal('M');
      expect(log).to.eql([{ z: 'Z', w: '-' }]);
      expect(ctx).to.eql({});
    });
  });

  it('follows the names of an inner import whose macros it wraps, through its alias and through a macro taken from it', function () {
    var ctx = {}, log = [], f = probe(ctx, ['y', 'z'], ['y', 'z', 'w'], log);
    return utils.importIsolated(ctx, async function () {
      var t = await importOf(ctx, { y: 'Y', f: f }, { f: f }), om, og;
      expect(t.f).to.not.be(f);
      om = utils.exportRefs(function () { return t.f(); }, ['t']);
      og = utils.exportRefs(function () { return ctx.g(); }, ['g']);
      ctx.t = t;
      ctx.g = t.f;
      ctx.z = 'Z';
      ctx.w = 'W';
      ctx.om = om;
      ctx.og = og;
      return { om: om, og: og };
    }).then(function (exp) {
      exp.om();
      exp.og();
      expect(log).to.eql([{ y: 'Y', z: 'Z', w: '-' }, { y: 'Y', z: 'Z', w: '-' }]);
      expect(ctx).to.eql({});
    });
  });

  it('follows the names of an inner import that bound no names', function () {
    var ctx = {}, log = [], f = probe(ctx, ['z'], ['z', 'w'], log), inner = { f: f };
    return utils.importIsolated(ctx, async function () {
      var t = await importOf(ctx, {}, inner), om;
      expect(t).to.be(inner);
      om = utils.exportRefs(function () { return t.f(); }, ['t']);
      ctx.t = t;
      ctx.z = 'Z';
      ctx.w = 'W';
      ctx.om = om;
      return { om: om };
    }).then(function (exp) {
      exp.om();
      expect(log).to.eql([{ z: 'Z', w: '-' }]);
    });
  });

  it('puts in place every name its template bound when a name holds a function nothing recorded', function () {
    var ctx = {}, log = [], m = probe(ctx, ['h'], ['b', 'h'], log);
    return importOf(ctx, { b: 'B', h: function () {}, m: m }, { m: m }).then(function (exp) {
      exp.m();
      expect(log).to.eql([{ b: 'B', h: 'fn' }]);
      expect(ctx).to.eql({});
    });
  });

  it('puts in place every name its template bound when a name holds an object or an array', function () {
    var ctx = {}, log = [], m = probe(ctx, ['o', 'a'], ['b'], log);
    return importOf(ctx, { b: 'B', o: { x: 1 }, m: m }, { m: m }).then(function (exp) {
      exp.m();
      return importOf(ctx, { b: 'B', a: [1, 2], m: m }, { m: m });
    }).then(function (exp) {
      exp.m();
      expect(log).to.eql([{ b: 'B' }, { b: 'B' }]);
      expect(ctx).to.eql({});
    });
  });

  it('puts in place every name its template bound when a macro recorded no names', function () {
    var ctx = {}, log = [], m = probe(ctx, null, ['a', 'b'], log);
    return importOf(ctx, { a: 'A', b: 'B', m: m }, { m: m }).then(function (exp) {
      exp.m();
      expect(log).to.eql([{ a: 'A', b: 'B' }]);
    });
  });

  it('returns the exports as they are when a call needs none of the names its template bound', function () {
    var ctx = { x: 'mine' }, log = [], m = probe(ctx, ['x'], ['x', 'b'], log), exports = { m: m };
    return importOf(ctx, { b: 'B', m: m }, exports).then(function (exp) {
      expect(exp).to.be(exports);
      expect(exp.m).to.be(m);
      exp.m();
      expect(log).to.eql([{ x: 'mine', b: '-' }]);
    });
  });

  it('keeps an export that is not a function, and the safe flag of a wrapped macro', function () {
    var ctx = {}, m = utils.exportRefs(function () { return ctx.a + '|' + (has.call(ctx, 'b') ? ctx.b : '-'); }, ['a']);
    m.safe = true;
    return importOf(ctx, { a: 'A', b: 'B', m: m }, { m: m, v: 5 }).then(function (exp) {
      expect(exp.v).to.equal(5);
      expect(exp.m).to.not.be(m);
      expect(exp.m.safe).to.equal(true);
      expect(exp.m()).to.equal('A|-');
    });
  });
});

describe('swig-core backend: the async Macro emit records the names a macro reads or writes', function () {
  var flavors = [
    ['native', swigModule, 'Swig'],
    ['twig', twigModule, 'Twig'],
    ['jinja2', jinja2Module, 'Jinja2']
  ];

  flavors.forEach(function (fv) {
    var name = fv[0], Ctor = fv[1][fv[2]];

    // The compiled function of a template holding macro m0 (one parameter, a).
    function compiled(body, async, setup) {
      var s = new Ctor({ cache: false }), opts = { filename: '/p.html' };
      if (setup) {
        setup(s);
      }
      if (async) {
        opts.codegenMode = 'async';
      }
      return s.precompile('{% macro m0(a) %}' + body + '{% endmacro %}', opts).tpl.toString();
    }

    // The names recorded for macro m0, or null when none are.
    function recorded(js) {
      var m = /_utils\.exportRefs\(_exports\.m0, (\[[^\]]*\])\);/.exec(js);
      return m ? JSON.parse(m[1]) : null;
    }

    function passCtxTags(s) {
      s.setTag('passctx', function () { return true; }, function () { return '_output += _ext.f(_ctx);\n'; }, false);
      s.setTag('passcopy', function () { return true; }, function () { return '_output += _ext.f(_utils.extend({}, _ctx));\n'; }, false);
    }

    describe(name, function () {
      it('records the names the macro reads and writes in the context', function () {
        var r = recorded(compiled('{{ a }}{{ b.c }}{% set d = 1 %}{{ e("x") }}', true));
        expect(r).to.contain('b');
        expect(r).to.contain('d');
        expect(r).to.contain('e');
        expect(r).to.not.contain('c');
      });

      it('records nothing on the sync path', function () {
        expect(compiled('{{ b }}', false)).to.not.match(/exportRefs/);
      });

      it('records the names of a macro defined in the macro', function () {
        expect(recorded(compiled('{% macro inner() %}{{ y }}{% endmacro %}{{ inner() }}', true))).to.contain('y');
      });

      it('records no names for a macro that hands the context, or a copy of it, to other code', function () {
        expect(recorded(compiled('{{ f(_ctx) }}', true))).to.be(null);
        expect(recorded(compiled('{{ f(__ctx) }}', true))).to.be(null);
        expect(recorded(compiled('{% passctx %}', true, passCtxTags))).to.be(null);
        expect(recorded(compiled('{% passcopy %}', true, passCtxTags))).to.be(null);
      });

      if (name !== 'native') {
        it('records no names for a macro holding a {% with %}', function () {
          var body = (name === 'twig') ? '{% with {"w": b} %}{{ w }}{% endwith %}' : '{% with w = b %}{{ w }}{% endwith %}';
          expect(recorded(compiled(body, true))).to.be(null);
        });
      }

      if (name === 'jinja2') {
        it('records the names a parameter default reads', function () {
          var s = new Ctor({ cache: false }),
            js = s.precompile('{% macro m0(a, b=x) %}{{ b }}{% endmacro %}', { filename: '/p.html', codegenMode: 'async' }).tpl.toString();
          expect(recorded(js)).to.contain('x');
        });
      }
    });
  });
});
