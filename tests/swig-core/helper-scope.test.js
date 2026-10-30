var twig = require('@rhinostone/swig-twig'),
  jinja2 = require('@rhinostone/swig-jinja2'),
  django = require('@rhinostone/swig-django'),
  backend = require('@rhinostone/swig-core/lib/backend'),
  ir = require('@rhinostone/swig-core/lib/ir'),
  expect = require('../lib/expect.js');


/*!
 * The engine's own helpers that templates call (`_ext._test_<name>` for
 * Jinja2 and Twig tests, `_utils.range` for Twig ranges, `_utils.slice`
 * for Jinja2 and Django slices, `Math.pow` and `Math.floor` for Jinja2's
 * ** and //) are read from the compiled template's scope, so a locals key
 * named `_ext`, `_utils` or `Math` does not replace them. The Jinja2
 * expectations are Jinja2 3.1's output for the same template with the same
 * key in its context; the Twig and Django ones are the output without the
 * key.
 */
describe('swig-core — engine helpers are read from the template scope', function () {

  var flavors = { twig: twig, jinja2: jinja2, django: django };

  function render(flavor, src, locals) {
    return flavors[flavor].render(src, { locals: locals });
  }

  function withKey(locals, key) {
    var out = {}, k;
    for (k in locals) { if (locals.hasOwnProperty(k)) { out[k] = locals[k]; } }
    for (k in key) { if (key.hasOwnProperty(k)) { out[k] = key[k]; } }
    return out;
  }

  it('Jinja2: renders what Jinja2 renders with the same key in its context', function () {
    expect(render('jinja2', '{% if x is string %}Y{% else %}N{% endif %}', withKey({"x": "a"}, {"_ext": {"_test_string": 0}}))).to.equal('Y');
    expect(render('jinja2', '{% if x is string %}Y{% else %}N{% endif %}', withKey({"x": "a"}, {"_ext": "text"}))).to.equal('Y');
    expect(render('jinja2', '{% if x is not odd %}Y{% else %}N{% endif %}', withKey({"x": 2}, {"_ext": {"_test_odd": 0}}))).to.equal('Y');
    expect(render('jinja2', '[{{ l[1:]|join(",") }}]', withKey({"l": [1, 2, 3]}, {"_utils": {"slice": 0}}))).to.equal('[2,3]');
    expect(render('jinja2', '[{{ l[1:]|join(",") }}]', withKey({"l": [1, 2, 3]}, {"_utils": {"slice": "text"}}))).to.equal('[2,3]');
    expect(render('jinja2', '[{{ 2 ** 3 }}]', withKey({}, {"Math": {"pow": 0}}))).to.equal('[8]');
    expect(render('jinja2', '[{{ 7 // 2 }}]', withKey({}, {"Math": {"floor": 0}}))).to.equal('[3]');
  });

  it('Twig and Django: renders what the template renders without the key', function () {
    expect(render('twig', '[{% if x is even %}Y{% endif %}]', withKey({"x": 2}, {"_ext": {"_test_even": 0}}))).to.equal(render('twig', '[{% if x is even %}Y{% endif %}]', {"x": 2}));
    expect(render('twig', '{% for i in 1..n %}{{ i }}{% endfor %}', withKey({"n": 3}, {"_utils": {"range": 0}}))).to.equal(render('twig', '{% for i in 1..n %}{{ i }}{% endfor %}', {"n": 3}));
    expect(render('twig', '{% for i in 1..n %}{{ i }}{% endfor %}', withKey({"n": 3}, {"_utils": "text"}))).to.equal(render('twig', '{% for i in 1..n %}{{ i }}{% endfor %}', {"n": 3}));
    expect(render('django', '[{{ l[1:]|join:"," }}]', withKey({"l": [1, 2, 3]}, {"_utils": {"slice": 0}}))).to.equal(render('django', '[{{ l[1:]|join:"," }}]', {"l": [1, 2, 3]}));
    expect(render('django', '[{{ l[1:]|join:"," }}]', withKey({"l": [1, 2, 3]}, {"_utils": "text"}))).to.equal(render('django', '[{{ l[1:]|join:"," }}]', {"l": [1, 2, 3]}));
  });

  var cases = [
    { flavor: 'jinja2', src: '{% if x is string %}Y{% else %}N{% endif %}', locals: {"x": "a"}, key: {"_ext": {"_test_string": 0}}, want: 'Y' },
    { flavor: 'jinja2', src: '{% if x is string %}Y{% else %}N{% endif %}', locals: {"x": "a"}, key: {"_ext": "text"}, want: 'Y' },
    { flavor: 'jinja2', src: '{% if x is not odd %}Y{% else %}N{% endif %}', locals: {"x": 2}, key: {"_ext": {"_test_odd": 0}}, want: 'Y' },
    { flavor: 'jinja2', src: '[{{ l[1:]|join(",") }}]', locals: {"l": [1, 2, 3]}, key: {"_utils": {"slice": 0}}, want: '[2,3]' },
    { flavor: 'jinja2', src: '[{{ l[1:]|join(",") }}]', locals: {"l": [1, 2, 3]}, key: {"_utils": {"slice": "text"}}, want: '[2,3]' },
    { flavor: 'jinja2', src: '[{{ 2 ** 3 }}]', locals: {}, key: {"Math": {"pow": 0}}, want: '[8]' },
    { flavor: 'jinja2', src: '[{{ 7 // 2 }}]', locals: {}, key: {"Math": {"floor": 0}}, want: '[3]' },
    { flavor: 'twig', src: '[{% if x is even %}Y{% endif %}]', locals: {"x": 2}, key: {"_ext": {"_test_even": 0}}, want: null },
    { flavor: 'twig', src: '{% for i in 1..n %}{{ i }}{% endfor %}', locals: {"n": 3}, key: {"_utils": {"range": 0}}, want: null },
    { flavor: 'twig', src: '{% for i in 1..n %}{{ i }}{% endfor %}', locals: {"n": 3}, key: {"_utils": "text"}, want: null },
    { flavor: 'django', src: '[{{ l[1:]|join:"," }}]', locals: {"l": [1, 2, 3]}, key: {"_utils": {"slice": 0}}, want: null },
    { flavor: 'django', src: '[{{ l[1:]|join:"," }}]', locals: {"l": [1, 2, 3]}, key: {"_utils": "text"}, want: null }
  ];

  it('throws for an unknown test and never calls a function the locals carry under its name', function () {
    var called = false,
      locals = { x: 1, _ext: { _test_frobnicate: function () { called = true; return true; } } };
    expect(function () {
      render('jinja2', '{% if x is frobnicate %}Y{% else %}N{% endif %}', locals);
    }).to.throwError(/^Invalid test "frobnicate" on line 1\.$/);
    expect(called).to.be(false);
  });

  it('renders the same on the async render path', function (done) {
    var pending = cases.length, failed = null;
    cases.forEach(function (c) {
      var mem = flavors[c.flavor].loaders.memory({ '/t.html': c.src }, '/'),
        loader = {
          async: true,
          resolve: mem.resolve,
          load: function (id, cb) {
            if (!cb) {
              return mem.load(id);
            }
            setImmediate(function () {
              var out;
              try {
                out = mem.load(id);
              } catch (e) {
                return cb(e);
              }
              cb(null, out);
            });
          }
        },
        Ctor = c.flavor === 'twig' ? twig.Twig : (c.flavor === 'jinja2' ? jinja2.Jinja2 : django.Django);
      new Ctor({ loader: loader, cache: false }).renderFile('/t.html', withKey(c.locals, c.key), function (err, out) {
        if (!failed) {
          try {
            expect(err).to.be(null);
            expect(out).to.equal(c.want === null ? render(c.flavor, c.src, c.locals) : c.want);
          } catch (e) {
            failed = e;
          }
        }
        pending -= 1;
        if (!pending) {
          done(failed);
        }
      });
    });
  });

  describe('the closure flag on an IRFnCall', function () {
    function call(path, closure) {
      var node = ir.fnCall(ir.varRef(path), [ir.literal('number', 1), ir.literal('number', 3)]);
      if (closure) {
        node.closure = true;
      }
      return node;
    }

    it('reads the callee and its receiver from the scope, falling back to _fn', function () {
      expect(backend.emitExpr(call(['_utils', 'range'], true))).to.equal('(_utils.range || _fn).call(_utils, 1, 3)');
    });

    it('keeps the context-first lookup without the flag', function () {
      expect(backend.emitExpr(call(['_utils', 'range']))).to.contain('_ctx._utils');
      expect(backend.emitExpr(call(['_utils', 'range'], true))).to.not.contain('_ctx');
    });

    it('keeps the context-first lookup for a one-segment callee', function () {
      expect(backend.emitExpr(call(['foo'], true))).to.equal(backend.emitExpr(call(['foo'])));
    });

    it('still checks every segment of the callee', function () {
      expect(function () { backend.emitExpr(call(['_utils', '__proto__'], true)); }).to.throwError(/prototype-chain guard/);
    });
  });
});
