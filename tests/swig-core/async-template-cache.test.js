var swigModule = require('../../lib/swig'),
  twigModule = require('@rhinostone/swig-twig'),
  jinja2Module = require('@rhinostone/swig-jinja2'),
  djangoModule = require('@rhinostone/swig-django'),
  runCapped = require('../lib/run-capped.js'),
  expect = require('../lib/expect.js');

var FLAVORS = [
  { name: 'swig', lib: swigModule, mod: require.resolve('../../lib/swig'), ctor: 'Swig' },
  { name: 'swig-twig', lib: twigModule, mod: require.resolve('@rhinostone/swig-twig'), ctor: 'Twig' },
  { name: 'swig-jinja2', lib: jinja2Module, mod: require.resolve('@rhinostone/swig-jinja2'), ctor: 'Jinja2' },
  { name: 'swig-django', lib: djangoModule, mod: require.resolve('@rhinostone/swig-django'), ctor: 'Django' }
];

// An async loader over a map of files, with a log of what it loaded.
function asyncLoader(files) {
  var loader = {
    async: true,
    log: [],
    resolve: function (to) { return to; },
    load: function (id, cb) {
      loader.log.push(id);
      if (!cb) {
        return files[id];
      }
      setImmediate(function () {
        if (files[id] === undefined) {
          cb(new Error('Missing ' + id));
        } else {
          cb(null, files[id]);
        }
      });
    }
  };
  return loader;
}

function render(s, path, locals) {
  return new Promise(function (resolve, reject) {
    s.renderFile(path, locals || {}, function (err, out) {
      if (err) { reject(err); } else { resolve(out); }
    });
  });
}

function failure(promise) {
  return promise.then(function () {
    throw new Error('expected a failure');
  }, function (err) {
    return err.message;
  });
}

// Runs in a child under a small heap: a template that includes itself and an extends cycle, with
// the memory cache, so that no load happens between the levels of the recursion.
function recursion(L, ctor) {
  var files = { '/self.html': 'a{% include "/self.html" %}', '/a.html': '{% extends "/b.html" %}', '/b.html': '{% extends "/a.html" %}' },
    loads = 0,
    loader = { async: true, resolve: function (to) { return to; }, load: function (id, cb) {
      loads += 1;
      if (!cb) { return files[id]; }
      setImmediate(function () { cb(null, files[id]); });
    } };
  function one(entry) {
    loads = 0;
    return new Promise(function (resolve) {
      new L[ctor]({ loader: loader }).renderFile(entry, {}, function (err) {
        resolve({ error: err ? err.message : null, loads: loads });
      });
    });
  }
  var out = {};
  one('/self.html').then(function (r) {
    out.self = r;
    return one('/a.html');
  }).then(function (r) {
    out.cycle = r;
    console.log(JSON.stringify(out));
  });
}

FLAVORS.forEach(function (flavor) {
  var Ctor = flavor.lib[flavor.ctor];

  describe(flavor.name + ' async render path and the template cache', function () {
    it('loads a template once over several renders, each with its own locals', function () {
      var loader = asyncLoader({ '/page.html': '[{{ x }}]' }),
        s = new Ctor({ loader: loader });
      return render(s, '/page.html', { x: 'a' }).then(function (out) {
        expect(out).to.equal('[a]');
        return render(s, '/page.html', { x: 'b' });
      }).then(function (out) {
        expect(out).to.equal('[b]');
        return render(s, '/page.html');
      }).then(function (out) {
        expect(out).to.equal('[]');
        expect(loader.log).to.eql(['/page.html']);
      });
    });

    it('loads a partial once for an include in a loop', function () {
      var loader = asyncLoader({ '/page.html': '{% for i in items %}{% include "/p.html" %}{% endfor %}', '/p.html': '[{{ i }}]' }),
        s = new Ctor({ loader: loader });
      return render(s, '/page.html', { items: [1, 2, 3] }).then(function (out) {
        expect(out).to.equal('[1][2][3]');
        return render(s, '/page.html', { items: [4] });
      }).then(function (out) {
        expect(out).to.equal('[4]');
        expect(loader.log).to.eql(['/page.html', '/p.html']);
      });
    });

    it('shares an extends parent, and each child keeps its own blocks', function () {
      var loader = asyncLoader({
          '/base.html': '<{% block b %}P{% endblock %}>',
          '/one.html': '{% extends "/base.html" %}{% block b %}C{% endblock %}',
          '/two.html': '{% extends "/base.html" %}'
        }),
        s = new Ctor({ loader: loader });
      return render(s, '/one.html').then(function (out) {
        expect(out).to.equal('<C>');
        return render(s, '/two.html');
      }).then(function (out) {
        expect(out).to.equal('<P>');
        return render(s, '/one.html');
      }).then(function (out) {
        expect(out).to.equal('<C>');
        return render(s, '/base.html');
      }).then(function (out) {
        expect(out).to.equal('<P>');
        expect(loader.log).to.eql(['/one.html', '/base.html', '/two.html']);
      });
    });

    it('picks a dynamic extends parent on each render', function () {
      var loader = asyncLoader({
          '/child.html': '{% extends layout %}{% block b %}C{% endblock %}',
          '/a.html': 'a{% block b %}{% endblock %}',
          '/b.html': 'b{% block b %}{% endblock %}'
        }),
        s = new Ctor({ loader: loader });
      return render(s, '/child.html', { layout: '/a.html' }).then(function (out) {
        expect(out).to.equal('aC');
        return render(s, '/child.html', { layout: '/b.html' });
      }).then(function (out) {
        expect(out).to.equal('bC');
        expect(loader.log).to.eql(['/child.html', '/a.html', '/b.html']);
      });
    });

    it('loads on every render with cache: false on the instance', function () {
      var loader = asyncLoader({ '/page.html': '[{{ x }}]{% include "/p.html" %}', '/p.html': 'p' }),
        s = new Ctor({ loader: loader, cache: false });
      return render(s, '/page.html', { x: 'a' }).then(function () {
        return render(s, '/page.html', { x: 'b' });
      }).then(function (out) {
        expect(out).to.equal('[b]p');
        expect(loader.log).to.eql(['/page.html', '/p.html', '/page.html', '/p.html']);
      });
    });

    it('skips the cache for a getTemplate call with cache: false, and leaves no entry', function () {
      var loader = asyncLoader({ '/page.html': '[{{ x }}]' }),
        s = new Ctor({ loader: loader });
      return s.getTemplate('/page.html', { cache: false }).then(function () {
        return s.getTemplate('/page.html', { cache: false });
      }).then(function () {
        expect(loader.log.length).to.equal(2);
        expect(Object.keys(s.cache)).to.eql([]);
      });
    });

    it('passes over a cached entry for a getTemplate call with cache: false', function () {
      var loader = asyncLoader({ '/page.html': '[{{ x }}]' }),
        s = new Ctor({ loader: loader });
      return render(s, '/page.html', { x: 'a' }).then(function () {
        return s.getTemplate('/page.html', { cache: false });
      }).then(function () {
        expect(loader.log).to.eql(['/page.html', '/page.html']);
      });
    });

    it('uses a custom cache, under the key of the async mode', function () {
      var entries = {},
        cache = { get: function (key) { return entries[key]; }, set: function (key, val) { entries[key] = val; } },
        loader = asyncLoader({ '/page.html': '[{{ x }}]{% include "/p.html" %}', '/p.html': 'p' }),
        s = new Ctor({ loader: loader, cache: cache });
      return render(s, '/page.html', { x: 'a' }).then(function () {
        return render(s, '/page.html', { x: 'b' });
      }).then(function (out) {
        expect(out).to.equal('[b]p');
        expect(Object.keys(entries).sort()).to.eql(['/p.html#async', '/page.html#async']);
        expect(loader.log).to.eql(['/page.html', '/p.html']);
      });
    });

    it('serves the compiled template until invalidateCache', function () {
      var files = { '/page.html': 'old' },
        loader = asyncLoader(files),
        s = new Ctor({ loader: loader });
      return render(s, '/page.html').then(function (out) {
        expect(out).to.equal('old');
        files['/page.html'] = 'new';
        return render(s, '/page.html');
      }).then(function (out) {
        expect(out).to.equal('old');
        s.invalidateCache();
        return render(s, '/page.html');
      }).then(function (out) {
        expect(out).to.equal('new');
        expect(loader.log.length).to.equal(2);
      });
    });

    it('gives two concurrent renders their own output', function () {
      var loader = asyncLoader({ '/page.html': '{% include "/p.html" %}[{{ x }}]', '/p.html': '<{{ x }}>' }),
        s = new Ctor({ loader: loader });
      return Promise.all([render(s, '/page.html', { x: 'a' }), render(s, '/page.html', { x: 'b' })]).then(function (outs) {
        expect(outs).to.eql(['<a>[a]', '<b>[b]']);
        var before = loader.log.length;
        return render(s, '/page.html', { x: 'c' }).then(function (out) {
          expect(out).to.equal('<c>[c]');
          expect(loader.log.length).to.equal(before);
        });
      });
    });

    it('does not cache a load failure', function () {
      var files = {},
        loader = asyncLoader(files),
        s = new Ctor({ loader: loader });
      return failure(render(s, '/page.html')).then(function (message) {
        expect(message).to.equal('Missing /page.html');
        files['/page.html'] = 'ok';
        return render(s, '/page.html');
      }).then(function (out) {
        expect(out).to.equal('ok');
      });
    });

    it('does not cache a compile failure', function () {
      var files = { '/page.html': '{% nosuchtag %}' },
        loader = asyncLoader(files),
        s = new Ctor({ loader: loader });
      return failure(render(s, '/page.html')).then(function (message) {
        expect(message).to.match(/nosuchtag/);
        files['/page.html'] = 'ok';
        return render(s, '/page.html');
      }).then(function (out) {
        expect(out).to.equal('ok');
      });
    });

    it('keeps a render that fails out of the next one', function () {
      var loader = asyncLoader({ '/page.html': '{% include inc %}' , '/p.html': 'p' }),
        s = new Ctor({ loader: loader });
      return failure(render(s, '/page.html', { inc: '/missing.html' })).then(function (message) {
        expect(message).to.equal('Missing /missing.html');
        return render(s, '/page.html', { inc: '/p.html' });
      }).then(function (out) {
        expect(out).to.equal('p');
      });
    });

    it('binds the locals of each getTemplate call to that call only', function () {
      var loader = asyncLoader({ '/page.html': '[{{ x }}]' }),
        s = new Ctor({ loader: loader });
      return Promise.all([s.getTemplate('/page.html', { locals: { x: 'a' } })]).then(function (fns) {
        return s.getTemplate('/page.html', { locals: { x: 'b' } }).then(function (fnB) {
          return s.getTemplate('/page.html').then(function (fnC) {
            return Promise.all([fns[0](), fnB(), fnC(), fnB({ x: 'c' })]);
          });
        });
      }).then(function (results) {
        expect(results.map(function (r) { return r.output; })).to.eql(['[a]', '[b]', '[]', '[c]']);
        expect(loader.log).to.eql(['/page.html']);
      });
    });

    it('never serves the function of the other mode', function () {
      var loader = asyncLoader({ '/page.html': '[{{ x }}]' }),
        s = new Ctor({ loader: loader });
      return render(s, '/page.html', { x: 'a' }).then(function () {
        expect(s.compileFile('/page.html')({ x: 'b' })).to.equal('[b]');
        return render(s, '/page.html', { x: 'c' });
      }).then(function (out) {
        expect(out).to.equal('[c]');
      });
    });

    it('still stops a template that includes itself, and an extends cycle', function () {
      var code = 'var L = require(' + JSON.stringify(flavor.mod) + ');(' + recursion.toString() + ')(L, ' + JSON.stringify(flavor.ctor) + ');',
        res = runCapped(code),
        parts = res.split(' '),
        out;
      expect(parts.slice(0, 2).join(' ')).to.equal('null 0');
      out = JSON.parse(parts.slice(2).join(' '));
      expect(out.self.error).to.equal('Template "/self.html" is nested more than 1000 levels deep: a template probably includes, imports or extends itself.');
      expect(out.self.loads).to.equal(1);
      expect(out.cycle.error).to.equal('Illegal circular extends of "/b.html".');
      expect(out.cycle.loads).to.equal(2);
    });
  });
});
