var swig = require('../../lib/swig'),
  filters = require('../../lib/filters'),
  utils = require('@rhinostone/swig-core/lib/utils'),
  cache = require('@rhinostone/swig-core/lib/cache'),
  runCapped = require('../lib/run-capped.js'),
  expect = require('../lib/expect.js');

/*!
 * Two limits of the own-key helpers. A key is converted once, as JavaScript
 * converts a property key, before setOwn and cacheSet compare it with
 * "__proto__", so a key such as the array ["__proto__"], which names the
 * same property, is defined as an own key instead of replacing the
 * object's prototype. And the prototype walks of hasKey and protoMember
 * look at the first 1000 objects of a chain at most, so a Proxy whose
 * getPrototypeOf trap never reaches Object.prototype no longer makes a
 * render run forever; past that many objects the key reads as missing.
 */
var has = Object.prototype.hasOwnProperty;

function render(src, locals, async, done) {
  var files = { '/t.html': src }, opts = { cache: false };
  if (!async) {
    opts.loader = swig.loaders.memory(files);
    return done(null, new swig.Swig(opts).renderFile('/t.html', locals));
  }
  opts.loader = {
    async: true,
    resolve: function (to) { return to.charAt(0) === '/' ? to : '/' + to; },
    load: function (id, cb) { setImmediate(function () { cb(null, files[id]); }); }
  };
  new swig.Swig(opts).renderFile('/t.html', locals, done);
}

/*!
 * Render `src` on the sync and the async render path; locals is a
 * function, so each render gets its own object.
 */
function both(src, locals, expected, done) {
  render(src, locals(), false, function (err, out) {
    expect(out).to.equal(expected);
    render(src, locals(), true, function (err2, out2) {
      if (err2) { return done(err2); }
      try {
        expect(out2).to.equal(expected);
      } catch (e) {
        return done(e);
      }
      done();
    });
  });
}

/*!
 * An object whose prototype chain holds `n` objects before Object.prototype,
 * the last of them (the n-th the walk meets) holding an own toString and an
 * own `b`.
 */
function chain(n) {
  var o = { toString: function () { return 'T'; }, b: 1 }, i;
  for (i = 1; i < n; i += 1) {
    o = Object.create(o);
  }
  return o;
}

describe('A key that converts to "__proto__" is written as an own key', function () {
  it('setOwn defines a key ["__proto__"] and keeps the prototype', function () {
    var o = {}, v = [];
    utils.setOwn(o, ['__proto__'], v);
    expect(has.call(o, '__proto__')).to.be(true);
    expect(Object.getPrototypeOf(o)).to.be(Object.prototype);
    expect(o['__proto__']).to.be(v);
  });

  it('setOwn assigns a key ["y"] as "y", control', function () {
    var o = {};
    utils.setOwn(o, ['y'], 1);
    expect(o).to.eql({ y: 1 });
  });

  it('setOwn and cacheSet keep a symbol key a symbol, control', function () {
    var o = {}, store = {}, sym = Symbol('k'), fn = function () {};
    utils.setOwn(o, sym, 1);
    expect(o[sym]).to.be(1);
    cache.cacheSet(sym, {}, fn, 'memory', store);
    expect(cache.cacheGet(sym, {}, 'memory', store)).to.be(fn);
  });

  it('native groupBy groups a value ["__proto__"] as it groups the string', function () {
    var src = '{{ items|groupBy("g")|json }}',
      items = function (g) { return JSON.parse('[{"g":' + g + ',"n":1},{"g":' + g + ',"n":2},{"g":"x","n":3}]'); },
      out = filters.groupBy(items('["__proto__"]'), 'g');
    expect(has.call(out, '__proto__')).to.be(true);
    expect(Object.getPrototypeOf(out)).to.be(Object.prototype);
    expect(out['__proto__']).to.eql([{ n: 1 }, { n: 2 }]);
    expect(swig.render(src, { locals: { items: items('["__proto__"]') } })).to.equal('{"__proto__":[{"n":1},{"n":2}],"x":[{"n":3}]}');
    expect(swig.render(src, { locals: { items: items('"__proto__"') } })).to.equal('{"__proto__":[{"n":1},{"n":2}],"x":[{"n":3}]}');
    expect(swig.render(src, { locals: { items: items('["y"]') } })).to.equal('{"y":[{"n":1},{"n":2}],"x":[{"n":3}]}');
  });

  it('cacheSet stores a key ["__proto__"] as an own entry that cacheGet reads', function () {
    var store = {}, fn = function () {};
    cache.cacheSet(['__proto__'], {}, fn, 'memory', store);
    expect(has.call(store, '__proto__')).to.be(true);
    expect(Object.getPrototypeOf(store)).to.be(Object.prototype);
    expect(cache.cacheGet('__proto__', {}, 'memory', store)).to.be(fn);
    expect(cache.cacheGet('name', {}, 'memory', store)).to.be(undefined);
  });
});

/*!
 * Runs in a capped child: renders each form over each Proxy shape with each
 * key, on the sync and the async render path, and prints one JSON line.
 * A walk with no limit never ends on these shapes, so the child is killed
 * at the timeout instead of the test run hanging.
 */
function runProxyShapes(args) {
  var out = {}, jobs = [], i = 0;
  function shapes() {
    var self = new Proxy({}, { getPrototypeOf: function () { return self; } }),
      a = new Proxy({}, { getPrototypeOf: function () { return b; } }),
      b = new Proxy({}, { getPrototypeOf: function () { return a; } }),
      fresh = function () { return new Proxy({}, { getPrototypeOf: function () { return fresh(); } }); };
    return { self: self, cycle: a, fresh: fresh(), below: Object.create(self) };
  }
  Object.keys(args.mods).forEach(function (flavor) {
    out[flavor] = {};
    Object.keys(args.forms[flavor]).forEach(function (form) {
      Object.keys(shapes()).forEach(function (shape) {
        args.keys.forEach(function (k) {
          [false, true].forEach(function (async) {
            jobs.push({ flavor: flavor, form: form, shape: shape, k: k, async: async });
          });
        });
      });
    });
  });
  function slot(o, key) {
    if (!Object.prototype.hasOwnProperty.call(o, key)) {
      o[key] = {};
    }
    return o[key];
  }
  function record(job, v) {
    slot(slot(slot(out[job.flavor], job.shape), job.form), job.k)[job.async ? 'async' : 'sync'] = v;
  }
  function next() {
    var job, lib, files, p, locals, opts;
    if (i >= jobs.length) {
      console.log(JSON.stringify(out));
      return;
    }
    job = jobs[i];
    i += 1;
    lib = require(args.mods[job.flavor]);
    files = { '/t.html': args.forms[job.flavor][job.form] };
    p = shapes()[job.shape];
    locals = { p: p, k: job.k, items: [p] };
    if (!job.async) {
      try {
        record(job, new lib[args.ctors[job.flavor]]({ cache: false, loader: lib.loaders.memory(files) }).renderFile('/t.html', locals));
      } catch (e) {
        record(job, 'THROW ' + e.message);
      }
      return next();
    }
    opts = { cache: false, loader: { async: true, resolve: function (to) { return to.charAt(0) === '/' ? to : '/' + to; },
      load: function (id, cb) { setImmediate(function () { cb(null, files[id]); }); } } };
    new lib[args.ctors[job.flavor]](opts).renderFile('/t.html', locals, function (err, res) {
      record(job, err ? 'THROW ' + err.message : res);
      next();
    });
  }
  next();
}

describe('A Proxy whose prototype chain never ends', function () {
  var keys = ['toString', 'valueOf', 'zz'],
    forms = {
      native: { 'in': '{% if k in p %}Y{% else %}N{% endif %}', sub: '[{% if p[k] %}T{% else %}F{% endif %}]', call: '[{{ p[k]() }}]' },
      jinja2: { sub: '[{% if p[k] %}T{% else %}F{% endif %}]', call: '[{{ p[k]() }}]', attr: '[{{ p|attr(k) }}]', groupby: '[{% for g in items|groupby(k) %}{{ g.list|length }}{% endfor %}]' }
    },
    expected = {
      native: { 'in': 'N', sub: '[F]', call: '[]' },
      jinja2: { sub: '[F]', call: '[]', attr: '[]', groupby: '[1]' }
    },
    results;

  before(function () {
    var res = runCapped('(' + runProxyShapes.toString() + ')(' + JSON.stringify({
        mods: { native: require.resolve('../../lib/swig'), jinja2: require.resolve('@rhinostone/swig-jinja2') },
        ctors: { native: 'Swig', jinja2: 'Jinja2' },
        keys: keys,
        forms: forms
      }) + ');'),
      m = /^(\S+) (\S+) ([\s\S]*)$/.exec(res);
    if (!m || m[1] !== 'null' || m[2] !== '0') {
      throw new Error('the child did not finish: ' + res.slice(0, 200));
    }
    results = JSON.parse(m[3]);
  });

  ['self', 'cycle', 'fresh', 'below'].forEach(function (shape) {
    Object.keys(forms).forEach(function (flavor) {
      it(flavor + ': a Proxy chain (' + shape + ') reads toString and valueOf as missing, as a key it never holds', function () {
        Object.keys(forms[flavor]).forEach(function (form) {
          keys.forEach(function (k) {
            expect(results[flavor][shape][form][k]).to.eql({ sync: expected[flavor][form], async: expected[flavor][form] });
          });
        });
      });
    });
  });
});

describe('A prototype walk stops after 1000 objects', function () {
  it('hasKey and protoMember find a member held by the 1000th object of a chain', function () {
    var o = chain(1000);
    expect(utils.hasKey('toString', o)).to.be(true);
    expect(utils.protoMember(o, 'toString')).to.be(false);
  });

  it('hasKey and protoMember read a member held by the 1001st object as missing', function () {
    var o = chain(1001);
    expect(utils.hasKey('toString', o)).to.be(false);
    expect(utils.protoMember(o, 'toString')).to.be(true);
    expect(utils.hasKey('b', o)).to.be(true);
    expect(utils.protoMember(o, 'b')).to.be(false);
  });

  it('native `in` and a subscript at the boundary, 1000 objects', function (done) {
    both('{% if k in o %}Y{% else %}N{% endif %}[{% if o[k] %}T{% else %}F{% endif %}]', function () { return { o: chain(1000), k: 'toString' }; }, 'Y[T]', done);
  });

  it('native `in` and a subscript past the boundary, 1001 objects', function (done) {
    both('{% if k in o %}Y{% else %}N{% endif %}[{% if o[k] %}T{% else %}F{% endif %}]', function () { return { o: chain(1001), k: 'toString' }; }, 'N[F]', done);
  });

  it('a key that is no Object.prototype member reads at any depth, control', function (done) {
    both('{% if k in o %}Y{% else %}N{% endif %}[{% if o[k] %}T{% else %}F{% endif %}]', function () { return { o: chain(1001), k: 'b' }; }, 'Y[T]', done);
  });
});
