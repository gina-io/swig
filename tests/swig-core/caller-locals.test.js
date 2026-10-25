var swigModule = require('../../lib/swig'),
  runtimeModule = require('../../lib/runtime'),
  twigModule = require('@rhinostone/swig-twig'),
  jinja2Module = require('@rhinostone/swig-jinja2'),
  djangoModule = require('@rhinostone/swig-django'),
  AsyncLocalStorage = require('async_hooks').AsyncLocalStorage,
  expect = require('../lib/expect.js');

/*!
 * On an instance without default locals a render used the locals object the
 * caller passed as its context, so the names the template set ({% set %},
 * macros, loop names, Django cycle state) landed in that object: a later
 * render given the same object read them, and two concurrent async renders
 * given one object read each other's. A render now works on a copy of the
 * caller's locals made at its top; a template rendered as part of that render
 * (an include, sync or async) still works on the context it is given, so an
 * include's names still reach its includer.
 */

var flavors = [
  ['native', swigModule, 'Swig'],
  ['twig', twigModule, 'Twig'],
  ['jinja2', jinja2Module, 'Jinja2']
];

var files = {
  '/cond.html': '{% if who %}{% set secret = who %}{% endif %}[{{ secret }}]',
  '/writes.html': '{% set s = 1 %}{% for x in items %}{% endfor %}{% macro m() %}{% endmacro %}x',
  '/page.html': '{% set me = who() %}{% include "slow.html" %}[{{ me }}]',
  '/slow.html': 's',
  '/boom.html': '{{ boom() }}',
  '/set.html': '{% set x = "I" %}',
  '/mac.html': '{% macro hi() %}H{% endmacro %}',
  '/a.html': '{% include "b.html" %}',
  '/b.html': '{% set y = "B" %}',
  '/t1.html': '{% include "set.html" %}[{{ x }}]',
  '/t2.html': '{% include "mac.html" %}[{{ hi() }}]',
  '/t3.html': '{% include "a.html" %}[{{ y }}]'
};

function asyncLoader(lib, map, delays) {
  var mem = lib.loaders.memory(map, '/');
  return {
    async: true,
    resolve: mem.resolve,
    load: function (id, cb) {
      if (!cb) {
        return mem.load(id);
      }
      setTimeout(function () {
        var src;
        try {
          src = mem.load(id);
        } catch (e) {
          cb(e);
          return;
        }
        cb(null, src);
      }, (delays && delays[id]) || 0);
    }
  };
}

function renderAsync(s, path, locals) {
  return new Promise(function (resolve, reject) {
    s.renderFile(path, locals, function (err, out) {
      if (err) {
        reject(err);
        return;
      }
      resolve(out);
    });
  });
}

flavors.forEach(function (flavor) {
  var name = flavor[0],
    lib = flavor[1],
    Ctor = lib[flavor[2]];

  function sync() {
    return new Ctor({ loader: lib.loaders.memory(files, '/'), cache: false });
  }

  function async(delays) {
    return new Ctor({ loader: asyncLoader(lib, files, delays), cache: false });
  }

  describe(name + ' — the locals object a caller passes', function () {
    it('keeps a name one render sets out of a later render given the same object', function () {
      var s = sync(), shared = { who: 'alice' };
      expect(s.renderFile('/cond.html', shared)).to.equal('[alice]');
      delete shared.who;
      expect(s.renderFile('/cond.html', shared)).to.equal('[]');
      expect(Object.keys(shared)).to.eql([]);
    });

    it('keeps a name one async render sets out of a later async render given the same object', function () {
      var s = async(), shared = { who: 'alice' };
      return renderAsync(s, '/cond.html', shared).then(function (out) {
        expect(out).to.equal('[alice]');
        delete shared.who;
        return renderAsync(s, '/cond.html', shared);
      }).then(function (out) {
        expect(out).to.equal('[]');
        expect(Object.keys(shared)).to.eql([]);
      });
    });

    it('leaves the caller\'s object unchanged after a render that sets names', function () {
      var locals = { items: [1] };
      expect(sync().renderFile('/writes.html', locals)).to.equal('x');
      expect(Object.keys(locals)).to.eql(['items']);
      locals = { items: [1] };
      return renderAsync(async(), '/writes.html', locals).then(function (out) {
        expect(out).to.equal('x');
        expect(Object.keys(locals)).to.eql(['items']);
      });
    });

    it('keeps two concurrent async renders given one object apart', function () {
      var s = async({ '/slow.html': 30 }), als = new AsyncLocalStorage(), shared = { who: function () { return als.getStore(); } };
      return Promise.all([
        als.run('alice', function () { return renderAsync(s, '/page.html', shared); }),
        new Promise(function (resolve) { setTimeout(resolve, 5); }).then(function () {
          return als.run('bob', function () { return renderAsync(s, '/page.html', shared); });
        })
      ]).then(function (outs) {
        expect(outs).to.eql(['s[alice]', 's[bob]']);
        expect(Object.keys(shared)).to.eql(['who']);
      });
    });

    it('lets an include\'s set reach its includer through every sync entry point', function () {
      var s = sync(), src = files['/t1.html'], tpl = s.precompile(src, { filename: '/t1.html' }).tpl, reg = new Ctor({ loader: lib.loaders.memory(files, '/') });
      reg.register('/r1.html', reg.precompile(src, { filename: '/t1.html' }).tpl);
      expect([
        s.renderFile('/t1.html'),
        s.renderFile('/t1.html', {}),
        s.renderFile('/t1.html', { z: 1 }),
        s.compileFile('/t1.html')(),
        s.compileFile('/t1.html')({}),
        s.render(src, { filename: '/t1.html' }),
        s.render(src, { filename: '/t1.html', locals: { z: 1 } }),
        s.run(tpl),
        s.run(tpl, {}),
        reg.renderFile('/r1.html'),
        reg.renderFile('/r1.html', {})
      ]).to.eql(['[I]', '[I]', '[I]', '[I]', '[I]', '[I]', '[I]', '[I]', '[I]', '[I]', '[I]']);
    });

    it('lets a set two includes deep, and a macro an include defines, reach the page', function () {
      var s = sync();
      expect([s.renderFile('/t3.html'), s.renderFile('/t3.html', {}), s.renderFile('/t2.html'), s.renderFile('/t2.html', {})]).to.eql(['[B]', '[B]', '[H]', '[H]']);
      return Promise.all([
        renderAsync(async(), '/t3.html', undefined),
        renderAsync(async(), '/t3.html', {}),
        renderAsync(async(), '/t2.html', undefined),
        renderAsync(async(), '/t2.html', {})
      ]).then(function (outs) {
        expect(outs).to.eql(['[B]', '[B]', '[H]', '[H]']);
      });
    });

    it('lets an include\'s set reach its includer on the async path, with and without locals', function () {
      return Promise.all([renderAsync(async(), '/t1.html', undefined), renderAsync(async(), '/t1.html', {})]).then(function (outs) {
        expect(outs).to.eql(['[I]', '[I]']);
      });
    });

    it('works on a copy at the top of each render, whatever ran before it', function () {
      // The count of sync renders in progress goes back down after every kind
      // of render, also one that throws, so a later render still copies.
      var s = new Ctor({ loader: lib.loaders.memory(files, '/') }),
        thrower = { boom: function () { throw new Error('boom'); } };
      s.register('/rw.html', s.precompile(files['/writes.html'], { filename: '/rw.html' }).tpl);
      s.register('/rb.html', s.precompile(files['/boom.html'], { filename: '/rb.html' }).tpl);
      function rendersOnACopy(render) {
        var obj = { items: [1] };
        expect(render(obj)).to.equal('x');
        expect(Object.keys(obj)).to.eql(['items']);
      }
      function page(obj) {
        return s.renderFile('/writes.html', obj);
      }
      rendersOnACopy(page);
      rendersOnACopy(page);
      rendersOnACopy(function (obj) { return s.renderFile('/rw.html', obj); });
      rendersOnACopy(page);
      rendersOnACopy(function (obj) { return s.run(s.precompile(files['/writes.html'], { filename: '/w.html' }).tpl, obj); });
      rendersOnACopy(page);
      expect(function () { s.renderFile('/boom.html', thrower); }).to.throwException(/boom/);
      rendersOnACopy(page);
      expect(function () { s.renderFile('/rb.html', thrower); }).to.throwException(/boom/);
      rendersOnACopy(page);
      expect(function () { s.run(s.precompile(files['/boom.html'], { filename: '/b.html' }).tpl, thrower); }).to.throwException(/boom/);
      rendersOnACopy(page);
    });

    it('lets the set of a registered template a page includes reach the page', function () {
      var s = new Ctor({ loader: lib.loaders.memory(files, '/') });
      s.register('/set.html', s.precompile(files['/set.html'], { filename: '/set.html' }).tpl);
      expect([s.renderFile('/t1.html'), s.renderFile('/t1.html', {})]).to.eql(['[I]', '[I]']);
    });

    it('reads the caller\'s own enumerable values once, at the top of the render', function () {
      var calls = 0,
        s = new Ctor({ loader: lib.loaders.memory({ '/n.html': '[{{ n }}|{{ n }}]', '/v.html': '[{{ v }}]', '/h.html': '[{{ h }}]' }, '/'), cache: false }),
        hidden = {},
        proto = {},
        own;
      expect(s.renderFile('/n.html', { get n() { calls += 1; return calls; } })).to.equal('[1|1]');
      expect(calls).to.equal(1);
      Object.defineProperty(hidden, 'h', { value: 'H', enumerable: false });
      expect(s.renderFile('/h.html', hidden)).to.equal('[]');
      expect(s.renderFile('/v.html', Object.create({ v: 'P' }))).to.equal('[P]');
      expect(s.renderFile('/v.html', new Proxy({}, { get: function (t, k) { return k === 'v' ? 'P' : undefined; } }))).to.equal('[]');
      Object.defineProperty(proto, 'v', { get: function () { return 'P'; }, set: function () { throw new Error('the copy ran a setter'); } });
      own = Object.create(proto);
      Object.defineProperty(own, 'v', { value: 'own', enumerable: true, writable: true });
      expect(s.renderFile('/v.html', own)).to.equal('[own]');
    });

    it('renders frozen locals with a set', function () {
      var s = new Ctor({ loader: lib.loaders.memory({ '/m.html': '{% set m = "M" %}[{{ m }}]' }, '/'), cache: false });
      expect(s.renderFile('/m.html', Object.freeze({ a: 1 }))).to.equal('[M]');
    });

    it('keeps an own "__proto__" key of JSON locals a plain key', function () {
      var src = '[{{ x }}|{{ v }}]', locals = function () { return JSON.parse('{"__proto__": {"x": "inherited"}, "v": "ok"}'); };
      expect(new Ctor({ loader: lib.loaders.memory({ '/p.html': src }, '/'), cache: false }).renderFile('/p.html', locals())).to.equal('[|ok]');
      return renderAsync(new Ctor({ loader: asyncLoader(lib, { '/p.html': src }), cache: false }), '/p.html', locals()).then(function (out) {
        expect(out).to.equal('[|ok]');
      });
    });
  });
});

describe('twig — an include inside a with block', function () {
  var withFiles = {
    '/set.html': '{% set x = "I" %}',
    '/w1.html': '{% with {a: 1} %}{% include "set.html" %}[{{ x }}]{% endwith %}',
    '/w2.html': '{% with %}{% include "set.html" %}[{{ x }}]{% endwith %}',
    '/w3.html': '{% with {a: 1} only %}{% include "set.html" %}[{{ x }}]{% endwith %}'
  };

  it('lets the include\'s set reach the with block, sync and async', function () {
    var s = new twigModule.Twig({ loader: twigModule.loaders.memory(withFiles, '/'), cache: false }),
      a = new twigModule.Twig({ loader: asyncLoader(twigModule, withFiles), cache: false });
    expect([s.renderFile('/w1.html'), s.renderFile('/w2.html', {}), s.renderFile('/w3.html', {})]).to.eql(['[I]', '[I]', '[I]']);
    return Promise.all([renderAsync(a, '/w1.html', undefined), renderAsync(a, '/w2.html', {}), renderAsync(a, '/w3.html', {})]).then(function (outs) {
      expect(outs).to.eql(['[I]', '[I]', '[I]']);
    });
  });
});

describe('jinja2 — an include inside a with block', function () {
  var withFiles = { '/set.html': '{% set x = "I" %}', '/w1.html': '{% with a = 1 %}{% include "set.html" %}[{{ x }}]{% endwith %}' };

  it('lets the include\'s set reach the with block, sync and async', function () {
    var s = new jinja2Module.Jinja2({ loader: jinja2Module.loaders.memory(withFiles, '/'), cache: false });
    expect([s.renderFile('/w1.html'), s.renderFile('/w1.html', {})]).to.eql(['[I]', '[I]']);
    return renderAsync(new jinja2Module.Jinja2({ loader: asyncLoader(jinja2Module, withFiles), cache: false }), '/w1.html', {}).then(function (out) {
      expect(out).to.equal('[I]');
    });
  });
});

describe('native — templates rendered as part of a render', function () {
  var more = {
    '/set.html': '{% set x = "I" %}',
    '/w.html': '{% set x = "W" %}',
    '/t1.html': '{% include "set.html" %}[{{ x }}]',
    '/o1.html': '{% set o = {} %}{% include "w.html" with o only %}[{{ o.x }}]',
    '/o2.html': '{% include "w.html" with o only %}[{{ o.x }}]',
    '/helper.html': '[{{ helper() }}]'
  };

  it('works on the object an include is given with "with ... only"', function () {
    // As before this change: the include renders on that object, and the
    // changelog names it.
    var s = new swigModule.Swig({ loader: swigModule.loaders.memory(more, '/'), cache: false }), caller = { o: {} };
    expect(s.renderFile('/o1.html', {})).to.equal('[W]');
    expect(s.renderFile('/o2.html', caller)).to.equal('[W]');
    expect(caller.o).to.eql({ x: 'W' });
  });

  it('works on the object a helper passes to a render it starts inside a template', function () {
    // As before this change: that render runs while the page renders, so it
    // is not the top of a render; the changelog names it.
    var s = new swigModule.Swig({ loader: swigModule.loaders.memory(more, '/'), cache: false }), own = {}, top = {};
    expect(s.renderFile('/helper.html', { helper: function () { return s.renderFile('/set.html', own); } })).to.equal('[]');
    expect(own).to.eql({ x: 'I' });
    s.renderFile('/set.html', top);
    expect(top).to.eql({});
  });

  it('lets an include\'s set reach its includer under run() of an async-compiled template', function () {
    var s = new swigModule.Swig({ loader: asyncLoader(swigModule, more), cache: false }),
      tpl = s.precompile(more['/t1.html'], { filename: '/t1.html', codegenMode: 'async' }).tpl;
    return s.run(tpl, {}).then(function (result) {
      expect(result.output).to.equal('[I]');
    });
  });

  it('keeps a registered async template\'s names out of the caller\'s object, and its include\'s set in the render', function () {
    var s = new swigModule.Swig({ loader: asyncLoader(swigModule, more) }), caller = { z: 1 };
    s.register('/r.html', s.precompile('{% include "set.html" %}[{{ x }}]{% set y = "Y" %}', { filename: '/r.html', codegenMode: 'async' }).tpl);
    return s.compileFile('/r.html')(caller).then(function (result) {
      expect(result.output).to.equal('[I]');
      expect(caller).to.eql({ z: 1 });
    });
  });
});

describe('django — the cycle tag and the locals object a caller passes', function () {
  var cyc = { '/c.html': '{% for x in items %}{% cycle "a" "b" "c" %}{% endfor %}' };

  it('starts the cycle afresh on each render given the same object, sync and async', function () {
    var s = new djangoModule.Django({ loader: djangoModule.loaders.memory(cyc, '/') }),
      a = new djangoModule.Django({ loader: asyncLoader(djangoModule, cyc) }),
      shared = { items: [1, 2] },
      first;
    expect([s.renderFile('/c.html', shared), s.renderFile('/c.html', shared)]).to.eql(['ab', 'ab']);
    expect(Object.keys(shared)).to.eql(['items']);
    return renderAsync(a, '/c.html', shared).then(function (out) {
      first = out;
      return renderAsync(a, '/c.html', shared);
    }).then(function (out) {
      expect([first, out]).to.eql(['ab', 'ab']);
      expect(Object.keys(shared)).to.eql(['items']);
    });
  });
});

describe('runtime — the locals object a caller passes', function () {
  function build() {
    var rt = new runtimeModule.Swig();
    Object.keys(files).forEach(function (n) {
      rt.register(n, swigModule.precompile(files[n], { filename: n }).tpl);
    });
    return rt;
  }

  it('keeps a name one render sets out of a later render given the same object', function () {
    var rt = build(), shared = { who: 'alice' };
    expect(rt.renderFile('/cond.html', shared)).to.equal('[alice]');
    delete shared.who;
    expect(rt.renderFile('/cond.html', shared)).to.equal('[]');
    expect(Object.keys(shared)).to.eql([]);
  });

  it('works on a copy at the top of each render, after a render that threw and after run', function () {
    var rt = build(), thrower = { boom: function () { throw new Error('boom'); } };
    function rendersOnACopy() {
      var obj = { items: [1] };
      expect(rt.renderFile('/writes.html', obj)).to.equal('x');
      expect(Object.keys(obj)).to.eql(['items']);
    }
    rendersOnACopy();
    rendersOnACopy();
    expect(function () { rt.renderFile('/boom.html', thrower); }).to.throwException(/boom/);
    rendersOnACopy();
    expect(rt.run(swigModule.precompile(files['/writes.html'], { filename: '/w.html' }).tpl, { items: [1] })).to.equal('x');
    rendersOnACopy();
    expect(function () { rt.run(swigModule.precompile(files['/boom.html'], { filename: '/b.html' }).tpl, thrower); }).to.throwException(/boom/);
    rendersOnACopy();
  });

  it('lets an include\'s set reach its includer in a registered template and in run', function () {
    var rt = build(), tpl = swigModule.precompile(files['/t1.html'], { filename: '/t1.html' }).tpl;
    expect([rt.renderFile('/t1.html'), rt.renderFile('/t1.html', {}), rt.renderFile('/t3.html', {}), rt.run(tpl), rt.run(tpl, {})]).to.eql(['[I]', '[I]', '[B]', '[I]', '[I]']);
  });
});
