var swig = require('../../lib/swig'),
  twig = require('@rhinostone/swig-twig'),
  jinja2 = require('@rhinostone/swig-jinja2'),
  django = require('@rhinostone/swig-django'),
  utils = require('@rhinostone/swig-core/lib/utils'),
  cache = require('@rhinostone/swig-core/lib/cache'),
  expect = require('../lib/expect.js');

/*!
 * A key in the data, or a template or block name, that is also the name of
 * an Object.prototype member (hasOwnProperty, constructor, toString) or is
 * "__proto__" works as any other key. The helpers read own keys through
 * Object.prototype.hasOwnProperty.call, so an own key named hasOwnProperty,
 * or an object with no prototype, does not break a loop, a copy or a macro
 * call; a copy defines an own key "__proto__" instead of assigning it, which
 * would replace the copy's prototype; and a map keyed by template data (the
 * memory loader, groupBy, groupby, the memory cache) does not take an
 * inherited member for an entry. The second case of each pair is a control
 * that rendered before the fix.
 */
var mods = { native: swig, twig: twig, jinja2: jinja2, django: django },
  ctors = { native: 'Swig', twig: 'Twig', jinja2: 'Jinja2', django: 'Django' },
  has = Object.prototype.hasOwnProperty;

function J(s) { return JSON.parse(s); }

function nullProto(o) {
  var out = Object.create(null);
  Object.keys(o).forEach(function (k) { out[k] = o[k]; });
  return out;
}

function engine(flavor, files, async) {
  var opts = { cache: false };
  if (async) {
    opts.loader = {
      async: true,
      resolve: function (to) { return to.charAt(0) === '/' ? to : '/' + to; },
      load: function (id, cb) {
        setImmediate(function () {
          if (!has.call(files, id)) { return cb(new Error('Unable to find template "' + id + '".')); }
          cb(null, files[id]);
        });
      }
    };
  } else {
    opts.loader = mods[flavor].loaders.memory(files);
  }
  return new mods[flavor][ctors[flavor]](opts);
}

/*!
 * Render files['/t.html'] on the sync and the async render path; locals is a
 * function, so each render gets its own object.
 */
function both(flavor, files, locals, expected, done) {
  expect(engine(flavor, files).renderFile('/t.html', locals())).to.equal(expected);
  engine(flavor, files, true).renderFile('/t.html', locals(), function (err, out) {
    if (err) { return done(err); }
    try {
      expect(out).to.equal(expected);
      done();
    } catch (e) {
      done(e);
    }
  });
}

var FOR2 = '{% for k, v in m %}[{{ k }}]{% endfor %}',
  FOR1 = '{% for k in m %}[{{ k }}]{% endfor %}',
  loops = { native: FOR2, twig: FOR2, jinja2: FOR1, django: FOR1 },
  MAC = '{% macro f() %}X{% endmacro %}[{{ f() }}]';

describe('Own keys named like Object.prototype members', function () {

  Object.keys(loops).forEach(function (flavor) {
    it(flavor + ': a for loop over a mapping holding a key hasOwnProperty', function (done) {
      both(flavor, { '/t.html': loops[flavor] }, function () { return J('{"m":{"hasOwnProperty":1,"b":2}}'); }, '[hasOwnProperty][b]', done);
    });

    it(flavor + ': a for loop over a mapping with no prototype', function (done) {
      both(flavor, { '/t.html': loops[flavor] }, function () { return { m: nullProto({ a: 1, b: 2 }) }; }, '[a][b]', done);
    });
  });

  ['native', 'twig', 'jinja2'].forEach(function (flavor) {
    it(flavor + ': a macro call with a locals key hasOwnProperty', function (done) {
      both(flavor, { '/t.html': MAC }, function () { return { hasOwnProperty: 1 }; }, '[X]', done);
    });

    it(flavor + ': a macro call with locals that have no prototype', function (done) {
      both(flavor, { '/t.html': MAC }, function () { return nullProto({ a: 1 }); }, '[X]', done);
    });

    it(flavor + ': a macro call, control', function (done) {
      both(flavor, { '/t.html': MAC }, function () { return { a: 1 }; }, '[X]', done);
    });
  });

  ['native', 'twig'].forEach(function (flavor) {
    it(flavor + ': an include with an object under locals that have no prototype', function (done) {
      both(flavor, { '/t.html': '{% include "/p.html" with o %}', '/p.html': '[{{ a }}{{ b }}]' }, function () { return nullProto({ a: 1, o: { b: 2 } }); }, '[12]', done);
    });
  });

  it('native: a block named hasOwnProperty through extends', function (done) {
    both('native', {
      '/b.html': '[{% block hasOwnProperty %}B{% endblock %}]',
      '/t.html': '{% extends "/b.html" %}{% block hasOwnProperty %}C{% endblock %}'
    }, function () { return {}; }, '[C]', done);
  });

  it('native: {% parent %} in a block named hasOwnProperty', function (done) {
    both('native', {
      '/b.html': '[{% block hasOwnProperty %}B{% endblock %}]',
      '/t.html': '{% extends "/b.html" %}{% block hasOwnProperty %}C{% parent %}{% endblock %}'
    }, function () { return {}; }, '[CB]', done);
  });

  it('native: a block through extends, control', function (done) {
    both('native', {
      '/b.html': '[{% block b %}B{% endblock %}]',
      '/t.html': '{% extends "/b.html" %}{% block b %}C{% parent %}{% endblock %}'
    }, function () { return {}; }, '[CB]', done);
  });
});

describe('A map keyed by template data reads own entries only', function () {
  function inc(flavor, name) {
    return new mods[flavor][ctors[flavor]]({ cache: false, loader: swig.loaders.memory({ 'a.html': 'A' }) })
      .render('[{% include name %}]', { filename: '/p.html', locals: { name: name } });
  }

  ['native', 'jinja2'].forEach(function (flavor) {
    it(flavor + ': the memory loader serves no inherited member as template source', function () {
      ['__proto__', 'constructor', 'toString'].forEach(function (name) {
        expect(function () { inc(flavor, name); }).to.throwException(/Unable to find template "\/[a-zA-Z_]+"/);
      });
      expect(inc(flavor, 'a.html')).to.equal('[A]');
      expect(function () { inc(flavor, 'zz.html'); }).to.throwException(/Unable to find template "\/zz\.html"/);
    });
  });

  it('the memory loader still finds an own entry named like a member', function () {
    var mem = swig.loaders.memory(J('{"toString":"T","__proto__":"P"}'));
    expect(mem.load('toString')).to.equal('T');
    expect(mem.load('/__proto__')).to.equal('P');
  });

  it('native groupBy groups values named constructor, __proto__ or hasOwnProperty', function () {
    var r = function (items) { return swig.render('{{ items|groupBy("k")|json }}', { locals: { items: J(items) } }); };
    expect(r('[{"k":"constructor"},{"k":"a"}]')).to.equal('{"constructor":[{}],"a":[{}]}');
    expect(r('[{"k":"__proto__"},{"k":"a"},{"k":"__proto__"}]')).to.equal('{"__proto__":[{},{}],"a":[{}]}');
    expect(r('[{"k":"hasOwnProperty"},{"k":"a"}]')).to.equal('{"hasOwnProperty":[{}],"a":[{}]}');
    expect(r('[{"k":"x","hasOwnProperty":1}]')).to.equal('{"x":[{"hasOwnProperty":1}]}');
    expect(r('[{"k":"x"},{"k":"a"}]')).to.equal('{"x":[{}],"a":[{}]}');
  });

  it('swig-jinja2 groupby groups values named hasOwnProperty or __proto__', function () {
    var src = '{% for g in items|groupby("k") %}[{{ g.grouper }}:{{ g.list|length }}]{% endfor %}',
      r = function (items) { return new jinja2.Jinja2({ cache: false }).render(src, { locals: { items: J(items) } }); };
    expect(r('[{"k":"hasOwnProperty"},{"k":"hasOwnProperty"}]')).to.equal('[hasOwnProperty:2]');
    expect(r('[{"k":"__proto__"},{"k":"__proto__"}]')).to.equal('[__proto__:2]');
    expect(r('[{"k":"toString"},{"k":"a"}]')).to.equal('[a:1][toString:1]');
    expect(r('[{"k":"a"},{"k":"a"}]')).to.equal('[a:2]');
  });

  function bare(name) {
    var files = Object.create(null), loads = Object.create(null), s;
    files['p.html'] = '[{% include name %}]';
    files.__proto__ = 'P';
    files['q.html'] = 'Q';
    s = new swig.Swig({ loader: {
      resolve: function (to) { return to; },
      load: function (id, cb) {
        loads[id] = (loads[id] || 0) + 1;
        if (!has.call(files, id)) {
          var e = new Error('nf ' + id);
          if (cb) { return cb(e); }
          throw e;
        }
        return cb ? cb(null, files[id]) : files[id];
      }
    } });
    return s.renderFile('p.html', { name: name }) + s.renderFile('p.html', { name: name }) + ' loads=' + loads[name];
  }

  it('the memory cache keeps a template a custom loader names __proto__', function () {
    expect(bare('__proto__')).to.equal('[P][P] loads=1');
    expect(bare('q.html')).to.equal('[Q][Q] loads=1');
  });

  it('cacheSet defines an own key "__proto__" and cacheGet reads it', function () {
    var store = {}, val = function () {};
    cache.cacheSet('__proto__', {}, val, 'memory', store);
    expect(Object.getPrototypeOf(store)).to.be(Object.prototype);
    expect(has.call(store, '__proto__')).to.be(true);
    expect(cache.cacheGet('__proto__', {}, 'memory', store)).to.be(val);
  });
});

describe('A copy keeps an own key "__proto__" as an own key', function () {
  var PROTO = '{"__proto__":{"x":"y"},"a":"b"}';

  it('native: a filter mapped over an object', function () {
    var out = swig.render('{% set r = o|upper %}[{{ r|json }}][{{ r.x }}]', { locals: { o: J(PROTO) } });
    expect(out).to.equal('[{"__proto__":{"x":"Y"},"a":"B"}][]');
  });

  it('native: a filter mapped over an object, control', function () {
    var out = swig.render('{% set r = o|upper %}[{{ r|json }}][{{ r.x }}]', { locals: { o: J('{"p":{"x":"y"},"a":"b"}') } });
    expect(out).to.equal('[{"p":{"x":"Y"},"a":"B"}][]');
  });

  it('swig-twig merge copies an own key "__proto__"', function () {
    var out = new twig.Twig({ cache: false }).render('{% set r = a|merge(b) %}[{{ r|json_encode|raw }}][{{ r.x }}]', { locals: { a: J('{"__proto__":{"x":1},"p":2}'), b: J('{"__proto__":{"x":3},"q":4}') } });
    expect(out).to.equal('[{"__proto__":{"x":3},"p":2,"q":4}][]');
    out = new twig.Twig({ cache: false }).render('{% set r = a|merge(b) %}[{{ r|json_encode|raw }}][{{ r.x }}]', { locals: { a: J('{"p":2}'), b: J('{"__proto__":{"x":3},"q":4}') } });
    expect(out).to.equal('[{"p":2,"__proto__":{"x":3},"q":4}][]');
  });

  it('swig-jinja2: a loop filter over a mapping keeps a key "__proto__"', function () {
    var out = new jinja2.Jinja2({ cache: false }).render('{% for k, v in m if v %}[{{ k }}]{% endfor %}', { locals: { m: J('{"__proto__":{"x":1},"a":2,"b":0}') } });
    expect(out).to.equal('[__proto__][a]');
  });
});

describe('Native `in` leaves out what an object gets from Object.prototype', function () {
  var IN = '{% if k in obj %}Y{% else %}N{% endif %}';
  function Klass() { this.own = 1; }
  Klass.prototype.method = function () {};

  ['constructor', 'toString', '__proto__', 'hasOwnProperty'].forEach(function (k) {
    it('reads ' + k + ' as no key of a plain object', function (done) {
      both('native', { '/t.html': IN }, function () { return { k: k, obj: { b: 1 } }; }, 'N', done);
    });
  });

  it('still finds own keys, class members and array indexes', function (done) {
    var src = '[{{ "b" in obj }}][{{ "zz" in obj }}][{{ "method" in inst }}][{{ "own" in inst }}][{{ 0 in arr }}][{{ 2 in arr }}][{{ "toString" in tos }}]';
    both('native', { '/t.html': src }, function () { return { obj: { b: 1 }, inst: new Klass(), arr: ['x'], tos: { toString: 1 } }; }, '[true][false][true][true][true][false][true]', done);
  });

  it('still throws on a string, as `in` does', function () {
    expect(function () { swig.render('{% if "a" in s %}Y{% endif %}', { locals: { s: 'abc' } }); }).to.throwException(/Cannot use 'in' operator/);
  });
});

describe('A key from the data that an object gets only from Object.prototype reads as missing', function () {
  function Klass() { this.own = 1; }
  Klass.prototype.method = function () { return 'M'; };
  var j2 = function (src, locals) { return new jinja2.Jinja2({ cache: false }).render(src, { locals: locals }); };

  ['__defineGetter__', '__lookupGetter__', 'toString', 'hasOwnProperty', 'valueOf'].forEach(function (k) {
    it('native and swig-jinja2 subscripts read ' + k + ' as missing', function (done) {
      expect(j2('[{{ foo[k] }}]', { foo: {}, k: k })).to.equal('[]');
      both('native', { '/t.html': '[{{ foo[k] }}][{{ foo[k]("a") }}]' }, function () { return { foo: {}, k: k }; }, '[][]', done);
    });
  });

  it('a key a template looks up in a mapping', function () {
    var out = swig.render('{% for k in keys %}{% if seen[k] %}D{% else %}n{% endif %}{% endfor %}', { locals: { keys: ['a', 'toString', 'b'], seen: { a: 1 } } });
    expect(out).to.equal('Dnn');
  });

  it('own keys, class members and the methods of strings and arrays still read', function (done) {
    var src = '[{{ o[t] }}][{{ inst[m]() }}][{{ inst[w] }}][{{ s[u]() }}][{{ arr[j]("-") }}][{{ n[f](1) }}]';
    both('native', { '/t.html': src }, function () { return { o: { toString: 'T' }, t: 'toString', inst: new Klass(), m: 'method', w: 'own', s: 'ab', u: 'toUpperCase', arr: ['x', 'y'], j: 'join', n: 2, f: 'toFixed' }; }, '[T][M][1][AB][x-y][2.0]', done);
  });

  it('a native set target still writes such a key as an own key', function () {
    expect(swig.render('{% set o = {} %}{% set o[k] = 1 %}[{{ o[k] }}]', { locals: { k: '__defineGetter__' } })).to.equal('[1]');
  });

  it('swig-jinja2 attr and groupby read such an attribute as missing', function () {
    expect(j2('[{{ o|attr(k) }}]', { o: {}, k: 'toString' })).to.equal('[]');
    expect(j2('[{{ o|attr(k) }}]', { o: { toString: 'T' }, k: 'toString' })).to.equal('[T]');
    expect(j2('{% for g in items|groupby(k) %}[{{ g.grouper }}:{{ g.list|length }}]{% endfor %}', { items: [{ a: 1 }, { a: 2 }], k: 'toString' })).to.equal('[:2]');
  });

  it('protoMember and memberKey', function () {
    expect(utils.protoMember({}, 'toString')).to.be(true);
    expect(utils.protoMember(Object.create(null), 'toString')).to.be(true);
    expect(utils.protoMember('abc', 'hasOwnProperty')).to.be(true);
    expect(utils.protoMember({ toString: 1 }, 'toString')).to.be(false);
    expect(utils.protoMember('abc', 'toString')).to.be(false);
    expect(utils.protoMember(['x'], 'toString')).to.be(false);
    expect(utils.protoMember(new Klass(), 'method')).to.be(false);
    expect(utils.protoMember({}, 'a')).to.be(false);
    expect(utils.protoMember({}, 0)).to.be(false);
    ['__defineGetter__', '__defineSetter__', '__lookupGetter__', '__lookupSetter__', '__proto__', ['__lookupSetter__']].forEach(function (k) {
      expect(typeof utils.memberKey(k)).to.be('symbol');
    });
    expect(utils.memberKey('a')).to.be('a');
    expect(utils.memberKey('toString')).to.be('toString');
  });
});

describe('_utils own-key helpers', function () {
  it('each, eachAsync and map visit an own key hasOwnProperty and objects with no prototype', function () {
    var seen = [], mapped;
    utils.each({ hasOwnProperty: 1, b: 2 }, function (v, k) { seen.push(k + '=' + v); });
    utils.each(nullProto({ c: 3 }), function (v, k) { seen.push(k + '=' + v); });
    expect(seen).to.eql(['hasOwnProperty=1', 'b=2', 'c=3']);
    mapped = utils.map(J('{"__proto__":1,"hasOwnProperty":2}'), function (v) { return v * 10; });
    expect(has.call(mapped, '__proto__')).to.be(true);
    expect(mapped.__proto__).to.equal(10);
    expect(Object.keys(mapped)).to.eql(['__proto__', 'hasOwnProperty']);
    expect(mapped.hasOwnProperty).to.equal(20);
    return utils.eachAsync(nullProto({ hasOwnProperty: 1, d: 4 }), function (v, k) { seen.push(k); }).then(function () {
      expect(seen.slice(3)).to.eql(['hasOwnProperty', 'd']);
    });
  });

  it('extend copies an own key "__proto__" as an own key and reads sources with no prototype', function () {
    var out = utils.extend({}, J('{"__proto__":{"x":1},"a":2}'), nullProto({ hasOwnProperty: 3 }));
    expect(Object.getPrototypeOf(out)).to.be(Object.prototype);
    expect(Object.keys(out)).to.eql(['__proto__', 'a', 'hasOwnProperty']);
    expect(out.x).to.be(undefined);
    expect(out.hasOwnProperty).to.equal(3);
  });

  it('setOwn defines "__proto__" and assigns every other key', function () {
    var o = {};
    utils.setOwn(o, '__proto__', { x: 1 });
    utils.setOwn(o, 'a', 2);
    expect(Object.getPrototypeOf(o)).to.be(Object.prototype);
    expect(Object.keys(o)).to.eql(['__proto__', 'a']);
    expect(o.x).to.be(undefined);
  });

  it('hasKey leaves out what an object gets only from Object.prototype', function () {
    function Klass() { this.own = 1; }
    Klass.prototype.method = function () {};
    expect(utils.hasKey('a', { a: 1 })).to.be(true);
    expect(utils.hasKey('zz', { a: 1 })).to.be(false);
    ['toString', 'constructor', 'hasOwnProperty', '__proto__', 'valueOf'].forEach(function (k) {
      expect(utils.hasKey(k, { a: 1 })).to.be(false);
    });
    expect(utils.hasKey('toString', { toString: 1 })).to.be(true);
    expect(utils.hasKey('__proto__', J('{"__proto__":1}'))).to.be(true);
    expect(utils.hasKey('method', new Klass())).to.be(true);
    expect(utils.hasKey('constructor', new Klass())).to.be(true);
    expect(utils.hasKey('a', Object.create({ a: 1 }))).to.be(true);
    expect(utils.hasKey(0, ['x'])).to.be(true);
    expect(utils.hasKey('length', ['x'])).to.be(true);
    expect(utils.hasKey('toString', ['x'])).to.be(true);
    expect(utils.hasKey('toString', Object.create(null))).to.be(false);
    expect(function () { utils.hasKey('a', 'abc'); }).to.throwException(/Cannot use 'in' operator/);
  });
});

/*!
 * An async {% from %} binds only what the imported template exports, a
 * native block cannot be named __proto__, and an object literal key
 * "__proto__" is an own key: each name below is one an object gets from
 * Object.prototype, and each control rendered before the fix.
 */
function bothError(flavor, files, pattern, done) {
  var syncErr;
  try {
    engine(flavor, files).renderFile('/t.html', {});
  } catch (e) {
    syncErr = e;
  }
  try {
    expect(syncErr).to.be.an(Error);
    expect(syncErr.message).to.match(pattern);
  } catch (e) {
    return done(e);
  }
  engine(flavor, files, true).renderFile('/t.html', {}, function (err) {
    try {
      expect(err).to.be.an(Error);
      expect(err.message).to.match(pattern);
      done();
    } catch (e) {
      done(e);
    }
  });
}

function async(flavor, files, expected, done) {
  engine(flavor, files, true).renderFile('/t.html', {}, function (err, out) {
    if (err) { return done(err); }
    try {
      expect(out).to.equal(expected);
      done();
    } catch (e) {
      done(e);
    }
  });
}

describe('An import, a block name or an object literal key named like an Object.prototype member', function () {
  var MACROS = '{% macro hi() %}H{% endmacro %}',
    BLOCK_ERR = /^Unsafe block name "__proto__" is not allowed \(prototype-chain guard\) on line 1\./;

  ['twig', 'jinja2'].forEach(function (flavor) {
    ['toString', 'valueOf', 'hasOwnProperty'].forEach(function (name) {
      it(flavor + ': an async {% from %} of ' + name + ' binds nothing, as a name the template does not export', function (done) {
        async(flavor, { '/m.html': MACROS, '/t.html': '{% from "m.html" import ' + name + ' as t %}[{{ t }}]' }, '[]', done);
      });
    });
    it(flavor + ': an async {% from %} still binds an exported macro, control', function (done) {
      async(flavor, { '/m.html': MACROS, '/t.html': '{% from "m.html" import hi as t %}[{{ t() }}]' }, '[H]', done);
    });
    it(flavor + ': an async {% from %} of a name the template does not export, control', function (done) {
      async(flavor, { '/m.html': MACROS, '/t.html': '{% from "m.html" import nosuch as t %}[{{ t }}]' }, '[]', done);
    });
  });

  it('native: a block named __proto__ is refused', function (done) {
    bothError('native', { '/t.html': '<{% block __proto__ %}R{% endblock %}>' }, BLOCK_ERR, done);
  });
  it('native: a child block named __proto__ is refused', function (done) {
    bothError('native', {
      '/b.html': '<{% block a %}A{% endblock %}>',
      '/t.html': '{% extends "b.html" %}{% block __proto__ %}C{% endblock %}'
    }, BLOCK_ERR, done);
  });
  it('native: a block name whose tokens join to __proto__ is refused', function (done) {
    bothError('native', { '/t.html': '<{% block __pro to__ %}R{% endblock %}>' }, BLOCK_ERR, done);
  });
  ['constructor', 'prototype', 'toString', '__proto__x', 'x__proto__'].forEach(function (name) {
    it('native: a child still overrides a block named ' + name, function (done) {
      both('native', {
        '/b.html': '<{% block ' + name + ' %}P{% endblock %}>',
        '/t.html': '{% extends "b.html" %}{% block ' + name + ' %}C{% endblock %}'
      }, function () { return {}; }, '<C>', done);
    });
  });

  var LIT = '{% set o = {"__proto__": {"a": "P"}, "b": 1} %}[{{ o.a }}]',
    json = { native: '|json', twig: '|json_encode|raw', jinja2: '|tojson' };
  ['native', 'twig', 'jinja2'].forEach(function (flavor) {
    it(flavor + ': an object literal key "__proto__" is an own key', function (done) {
      both(flavor, { '/t.html': LIT + '[{{ o' + json[flavor] + ' }}]' }, function () { return {}; },
        '[][{"__proto__":{"a":"P"},"b":1}]', done);
    });
    it(flavor + ': an object literal key named otherwise, control', function (done) {
      both(flavor, { '/t.html': '{% set o = {"x": {"a": "P"}, "b": 1} %}[{{ o.x.a }}][{{ o' + json[flavor] + ' }}]' },
        function () { return {}; }, '[P][{"x":{"a":"P"},"b":1}]', done);
    });
  });
  it('native: an object literal key "__proto__" beside a string and a number key', function (done) {
    both('native', { '/t.html': '{% set o = {"__proto__": 1, "a": 2, 3: 4} %}[{{ o|json }}][{{ o.a }}]' },
      function () { return {}; }, '[{"3":4,"__proto__":1,"a":2}][2]', done);
  });

  it('_utils.ownValue reads own keys only', function () {
    var np = Object.create(null);
    np.k = 'v';
    expect(utils.ownValue({ a: 1 }, 'a')).to.be(1);
    expect(utils.ownValue({}, 'toString')).to.be(undefined);
    expect(utils.ownValue({}, 'hasOwnProperty')).to.be(undefined);
    expect(utils.ownValue({ toString: 'own' }, 'toString')).to.be('own');
    expect(utils.ownValue(J('{"__proto__":{"x":1}}'), '__proto__')).to.eql({ x: 1 });
    expect(utils.ownValue(np, 'k')).to.be('v');
    expect(utils.ownValue(null, 'a')).to.be(undefined);
    expect(utils.ownValue(undefined, 'a')).to.be(undefined);
  });
});
