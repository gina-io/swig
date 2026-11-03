var swig = require('../../lib/swig'),
  twig = require('@rhinostone/swig-twig'),
  jinja2 = require('@rhinostone/swig-jinja2'),
  django = require('@rhinostone/swig-django'),
  utils = require('@rhinostone/swig-core/lib/utils'),
  expect = require('../lib/expect.js');

/*!
 * A key that comes from the data and names the prototype chain reads as
 * missing: a subscript, a call on a subscript, a custom tag's bracket
 * fragment and the swig-jinja2 attribute paths of groupby and sum give what
 * they give for a key the object does not hold ("zz" below), so a value read
 * with such a key cannot be Object.prototype, a constructor or Function. A
 * native {% set %} target throws on such a key. The key is compared as
 * JavaScript converts a property key, so the array ["__proto__"], which reads
 * the same property, counts too; "a" is the control, and each write shape
 * shows on the control key that it does reach a write.
 */
var mods = { native: swig, twig: twig, jinja2: jinja2, django: django },
  ctors = { native: 'Swig', twig: 'Twig', jinja2: 'Jinja2', django: 'Django' },
  all = ['native', 'twig', 'jinja2', 'django'],
  withSet = ['native', 'twig', 'jinja2'],
  guarded = ['__proto__', 'constructor', 'prototype', ['__proto__'], ['constructor'], ['prototype']],
  has = Object.prototype.hasOwnProperty;

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
 * The own property names a render must not add to the shared objects (a
 * write such as Object.constructor = "v" changes what later renders read),
 * taken when the file loads; polluted() names what a render added, and
 * restore() removes it so one failing case cannot change the next.
 */
var watched = [Object.prototype, Object, Function.prototype, Function],
  baseline = watched.map(function (o) { return Object.getOwnPropertyNames(o); });

function polluted() {
  var out = [];
  watched.forEach(function (o, i) {
    Object.getOwnPropertyNames(o).forEach(function (n) {
      if (baseline[i].indexOf(n) === -1) { out.push(n); }
    });
  });
  return out.join(',');
}

function restore() {
  watched.forEach(function (o, i) {
    Object.getOwnPropertyNames(o).forEach(function (n) {
      if (baseline[i].indexOf(n) === -1) { delete o[n]; }
    });
  });
}

// Render /t.html on the sync or the async path; cb gets "OUT <output>" or "ERR <message>".
function outcome(flavor, files, locals, async, cb) {
  if (async) {
    engine(flavor, files, true).renderFile('/t.html', locals, function (err, out) {
      cb(err ? 'ERR ' + err.message : 'OUT ' + out);
    });
    return;
  }
  var res;
  try {
    res = 'OUT ' + engine(flavor, files).renderFile('/t.html', locals);
  } catch (e) {
    res = 'ERR ' + e.message;
  }
  cb(res);
}

// Run outcome() for each key in turn and hand back
// { key: [outcome, locals, whether the render left Object.prototype polluted] }.
function outcomes(flavor, shape, keys, async, done) {
  var res = {}, i = 0;
  function next() {
    if (i === keys.length) { return done(res); }
    var key = keys[i], locals = shape.locals(key);
    i += 1;
    outcome(flavor, shape.files, locals, async, function (o) {
      res[JSON.stringify(key)] = [o, locals, polluted()];
      restore();
      next();
    });
  }
  next();
}

function fnWith(props) {
  var f = function () {};
  Object.keys(props).forEach(function (k) { f[k] = props[k]; });
  return f;
}

/*!
 * Each shape: the template set, the locals for a key, the flavors, the
 * output or write the control key gives, and extra keys that name the
 * prototype chain for that shape.
 */
var reads = [
  {
    name: 'a subscript', flavors: all,
    files: { '/t.html': '[{{ foo[k] }}]' },
    locals: function (k) { return { foo: { a: 'A' }, k: k }; },
    control: 'OUT [A]'
  },
  {
    name: 'a subscript of a value holding own keys of those names', flavors: all,
    files: { '/t.html': '[{{ foo[k] }}]' },
    locals: function (k) { return { foo: JSON.parse('{"__proto__": {"x": 1}, "constructor": "C", "prototype": "P", "a": "A"}'), k: k }; },
    control: 'OUT [A]'
  },
  {
    name: 'a subscript of a function', flavors: withSet,
    files: { '/t.html': '[{{ foo[k] }}]' },
    locals: function (k) { return { foo: fnWith({ a: 'A' }), k: k }; },
    control: 'OUT [A]'
  },
  {
    name: 'a subscript of a subscript', flavors: all,
    files: { '/t.html': '[{{ foo[k][k] }}]' },
    locals: function (k) { return { foo: { a: { a: 'AA' } }, k: k }; },
    control: 'OUT [AA]'
  },
  {
    name: 'a call on a subscript', flavors: all,
    files: { '/t.html': '[{{ foo[k][k](x) }}]' },
    locals: function (k) { return { foo: { a: { a: function (s) { return s + '!'; } } }, k: k, x: 'return 6*7' }; },
    control: 'OUT [return 6*7!]'
  },
  {
    name: 'a call on a call on a subscript', flavors: all,
    files: { '/t.html': '[{{ foo[k][k](x)() }}]' },
    locals: function (k) { return { foo: { a: { a: function () { return function () { return 'R'; }; } } }, k: k, x: 'return 6*7' }; },
    control: 'OUT [R]'
  },
  {
    name: 'groupby with an attribute', flavors: ['jinja2'],
    files: { '/t.html': '{% for g in items|groupby(k) %}[{{ g.grouper }}:{{ g.list|length }}]{% endfor %}' },
    locals: function (k) { return { items: [{ a: 1 }, { a: 2 }], k: k }; },
    control: 'OUT [1:1][2:1]',
    extra: ['constructor.constructor', 'a.constructor', 'a.__proto__']
  },
  {
    name: 'sum with an attribute', flavors: ['jinja2'],
    files: { '/t.html': '[{{ items|sum(k) }}]' },
    locals: function (k) { return { items: [{ a: 1 }, { a: 2 }], k: k }; },
    control: 'OUT [3]',
    extra: ['constructor.constructor', 'a.constructor', 'a.__proto__']
  }
];

var writes = [
  {
    name: 'a dotted set into a value read with the key', flavors: withSet,
    files: { '/t.html': '{% set x = obj[k] %}{% set x.polluted = "v" %}' },
    locals: function (k) { return { obj: { a: {} }, k: k }; }
  },
  {
    name: 'an include with the value as its only context', flavors: ['native', 'twig'],
    files: { '/t.html': '{% include "p.html" with obj[k] only %}', '/p.html': '{% set polluted = "v" %}' },
    locals: function (k) { return { obj: { a: {} }, k: k }; }
  },
  {
    name: 'a with block with the value as its only context', flavors: ['twig'],
    files: { '/t.html': '{% with obj[k] only %}{% set polluted = "v" %}{% endwith %}' },
    locals: function (k) { return { obj: { a: {} }, k: k }; }
  }
];

describe('A key from the data that names the prototype chain', function () {
  afterEach(restore);

  [false, true].forEach(function (async) {
    var path = async ? 'async' : 'sync';

    describe('reads as missing (' + path + ' path)', function () {
      reads.forEach(function (shape) {
        shape.flavors.forEach(function (flavor) {
          it(flavor + ': ' + shape.name, function (done) {
            var keys = ['a', ['a'], 'zz'].concat(guarded, shape.extra || []);
            outcomes(flavor, shape, keys, async, function (res) {
              try {
                expect(res['"a"'][0]).to.equal(shape.control);
                expect(res['["a"]'][0]).to.equal(shape.control);
                guarded.concat(shape.extra || []).forEach(function (key) {
                  var k = JSON.stringify(key);
                  expect(k + ' ' + res[k][0]).to.equal(k + ' ' + res['"zz"'][0]);
                  expect(k + ' polluted [' + res[k][2] + ']').to.equal(k + ' polluted []');
                });
                done();
              } catch (e) {
                done(e);
              }
            });
          });
        });
      });
    });

    describe('cannot write through a value read with it (' + path + ' path)', function () {
      writes.forEach(function (shape) {
        shape.flavors.forEach(function (flavor) {
          it(flavor + ': ' + shape.name, function (done) {
            var keys = ['a', 'zz'].concat(guarded);
            outcomes(flavor, shape, keys, async, function (res) {
              try {
                expect(res['"a"'][0]).to.equal('OUT ');
                expect(res['"a"'][1].obj.a.polluted).to.equal('v');
                guarded.forEach(function (key) {
                  var k = JSON.stringify(key);
                  expect(k + ' ' + res[k][0]).to.equal(k + ' ' + res['"zz"'][0]);
                  expect(k + ' polluted [' + res[k][2] + ']').to.equal(k + ' polluted []');
                });
                done();
              } catch (e) {
                done(e);
              }
            });
          });
        });
      });
    });

    describe('throws in a native set target (' + path + ' path)', function () {
      var targets = [
        ['{% set obj[k].polluted = "v" %}', function (o) { return o.a.polluted; }],
        ['{% set obj[k] = "v" %}', function (o) { return o.a; }],
        ['{% set obj[k][k] = "v" %}', function (o) { return o.a.a; }]
      ];
      targets.forEach(function (t) {
        it(t[0], function (done) {
          var shape = {
            files: { '/t.html': 'line 1\n' + t[0] },
            locals: function (k) { return { obj: { a: { a: {} } }, k: k }; }
          };
          outcomes('native', shape, ['a', ['a']].concat(guarded), async, function (res) {
            try {
              expect(res['"a"'][0]).to.equal('OUT line 1\n');
              expect(t[1](res['"a"'][1].obj)).to.equal('v');
              expect(t[1](res['["a"]'][1].obj)).to.equal('v');
              guarded.forEach(function (key) {
                var k = JSON.stringify(key);
                expect(k + ' ' + res[k][0]).to.equal(k + ' ERR Unsafe assignment to "' + String(key) + '" via bracket notation is not allowed (prototype-chain guard) on line 2.');
                expect(k + ' polluted [' + res[k][2] + ']').to.equal(k + ' polluted []');
              });
              done();
            } catch (e) {
              done(e);
            }
          });
        });
      });

      it('{% set obj[a][b][c] = "v" %} with the name at any of its keys', function (done) {
        var shape = {
          files: { '/t.html': '{% set obj[a][b][c] = "v" %}' },
          locals: function (k) { return { obj: { x: { y: {} } }, a: k[0], b: k[1], c: k[2] }; }
        };
        var keys = [['x', 'y', 'z'], ['constructor', 'prototype', 'polluted'], ['x', '__proto__', 'polluted'], ['x', 'y', '__proto__']];
        outcomes('native', shape, keys, async, function (res) {
          try {
            expect(res['["x","y","z"]'][0]).to.equal('OUT ');
            expect(res['["x","y","z"]'][1].obj.x.y.z).to.equal('v');
            expect(res['["constructor","prototype","polluted"]'][0]).to.match(/^ERR Unsafe assignment to "constructor" via bracket notation/);
            expect(res['["x","__proto__","polluted"]'][0]).to.match(/^ERR Unsafe assignment to "__proto__" via bracket notation/);
            expect(res['["x","y","__proto__"]'][0]).to.match(/^ERR Unsafe assignment to "__proto__" via bracket notation/);
            expect(res['["constructor","prototype","polluted"]'][2]).to.equal('');
            expect(res['["x","__proto__","polluted"]'][2]).to.equal('');
            done();
          } catch (e) {
            done(e);
          }
        });
      });
    });
  });

  describe('as a variable name inside a native set target', function () {
    it('throws when the template is compiled', function () {
      [['{% set obj[constructor] = 1 %}', 'constructor'], ['{% set obj[a.__proto__] = 1 %}', '__proto__'], ['{% set obj[a][prototype].b = 1 %}', 'prototype']].forEach(function (c) {
        expect(function () {
          new swig.Swig().compile(c[0]);
        }).to.throwException(new RegExp('^Unsafe access to "' + c[1] + '" is not allowed in templates \\(prototype-chain guard\\) on line 1\\.$'));
      });
      expect(new swig.Swig().render('{% set obj[k] = 1 %}{{ obj.x }}', { locals: { obj: {}, k: 'x' } })).to.equal('1');
    });
  });

  describe('in the bracket fragments a custom tag receives', function () {
    function echo(src, locals) {
      var s = new swig.Swig({ cache: false });
      s.setTag('echo', function () { return true; }, function (compiler, args) {
        return '_output += (' + args.join('') + ');\n';
      }, false);
      try {
        return 'OUT ' + s.render(src, { locals: locals });
      } catch (e) {
        return 'ERR ' + e.message;
      }
    }

    it('reads as missing', function () {
      expect(echo('[{% echo foo[k] %}]', { foo: { a: 'A' }, k: 'a' })).to.equal('OUT [A]');
      expect(echo('[{% echo foo[k] %}]', { foo: { a: 'A' }, k: ['a'] })).to.equal('OUT [A]');
      expect(echo('[{% echo foo[0] %}]', { foo: ['N'] })).to.equal('OUT [N]');
      guarded.forEach(function (key) {
        expect(JSON.stringify(key) + ' ' + echo('[{% echo foo[k] %}]', { foo: JSON.parse('{"constructor": "C", "a": "A"}'), k: key }))
          .to.equal(JSON.stringify(key) + ' ' + echo('[{% echo foo[k] %}]', { foo: { a: 'A' }, k: 'zz' }));
      });
    });

    it('cannot reach Function through a call on a call', function () {
      expect(echo('[{% echo foo[k][k](x)() %}]', { foo: { a: { a: function () { return function () { return 'R'; }; } } }, k: 'a' })).to.equal('OUT [R]');
      guarded.forEach(function (key) {
        expect(JSON.stringify(key) + ' ' + echo('[{% echo foo[k][k](x)() %}]', { foo: {}, k: key, x: 'return 6*7' }))
          .to.match(/^\S+ ERR Cannot read properties of undefined/);
      });
    });
  });

  describe('_utils helpers', function () {
    function flip(first, second) {
      var n = 0;
      return { toString: function () { n += 1; return n === 1 ? first : second; } };
    }

    it('access gives undefined for those names, own property or not, and converts the key once', function () {
      var own = JSON.parse('{"__proto__": {"x": 1}, "constructor": "C", "prototype": "P", "a": "A"}'),
        sym = Symbol('s'),
        o = { a: 'A' };
      o[sym] = 'S';
      guarded.forEach(function (key) {
        expect(utils.access(own, key)).to.be(undefined);
        expect(utils.access({}, key)).to.be(undefined);
        expect(utils.access('ab', key)).to.be(undefined);
        expect(utils.access(function () {}, key)).to.be(undefined);
      });
      expect(utils.access(own, 'a')).to.equal('A');
      expect(utils.access(o, ['a'])).to.equal('A');
      expect(utils.access(o, sym)).to.equal('S');
      expect(utils.access([5, 6], 1)).to.equal(6);
      expect(utils.access({ 'null': 'N' }, null)).to.equal('N');
      expect(utils.access(o, flip('a', '__proto__'))).to.equal('A');
      expect(utils.access(o, flip('__proto__', 'a'))).to.be(undefined);
    });

    it('callAccess gives "" for those names and converts the key once', function () {
      guarded.forEach(function (key) {
        expect(utils.callAccess('abc', key, ['x'])).to.equal('');
        expect(utils.callAccess({}, key, [])).to.equal('');
      });
      expect(utils.callAccess('abc', ['toUpperCase'], [])).to.equal('ABC');
      expect(utils.callAccess('abc', flip('toUpperCase', 'constructor'), [])).to.equal('ABC');
      expect(utils.callAccess('abc', flip('constructor', 'toUpperCase'), ['x'])).to.equal('');
    });

    it('assignKey throws for those names and gives the converted key otherwise', function () {
      guarded.forEach(function (key) {
        expect(function () { utils.assignKey(key, 3); }).to.throwException(new RegExp('^Unsafe assignment to "' + String(key) + '" via bracket notation is not allowed \\(prototype-chain guard\\) on line 3\\.$'));
      });
      expect(utils.assignKey('a', 1)).to.equal('a');
      expect(utils.assignKey(['a'], 1)).to.equal('a');
      expect(utils.assignKey(2, 1)).to.equal(2);
      expect(utils.assignKey(flip('a', '__proto__'), 1)).to.equal('a');
    });

    it('memberKey gives a key that reads as missing for those names', function () {
      guarded.forEach(function (key) {
        expect(({ constructor: 'C' })[utils.memberKey(key)]).to.be(undefined);
        expect('ab'[utils.memberKey(key)]).to.be(undefined);
        expect((function () {})[utils.memberKey(key)]).to.be(undefined);
      });
      expect(({ a: 'A' })[utils.memberKey('a')]).to.equal('A');
      expect(({ a: 'A' })[utils.memberKey(['a'])]).to.equal('A');
      expect(['N'][utils.memberKey(0)]).to.equal('N');
      expect(({ a: 'A' })[utils.memberKey(flip('a', '__proto__'))]).to.equal('A');
    });
  });
});

/*!
 * Two inputs the mutation pass found unpinned. An empty member bracket stays a
 * compile error: a malformed native output takes the legacy walk, which wraps
 * a member key, and a custom tag receives those fragments; with the key
 * missing, the wrap must not read foo["undefined"]. And a value from the data
 * that answers every key (a Proxy) reads as missing for those names too: the
 * readers check the converted key before they read, not what the read returns.
 */
describe('The prototype-chain key guard on edge inputs', function () {
  afterEach(restore);

  it('refuses an empty member bracket in a native output and in a custom tag', function () {
    var s = new swig.Swig({ cache: false }), locals = { foo: { undefined: 'U', u: 'U' }, k: 'u' };
    s.setTag('echo', function () { return true; }, function (compiler, args) {
      return '_output += (' + args.join('') + ');\n';
    }, false);
    [{}, { codegenMode: 'async' }].forEach(function (opts) {
      expect(function () {
        new swig.Swig({ cache: false }).precompile('[{{ foo[] }}]', opts);
      }).to.throwException(/^Unexpected closing square bracket on line 1\.$/);
      expect(function () {
        s.precompile('[{% echo foo[] %}]', opts);
      }).to.throwException(/^Unexpected closing square bracket on line 1\.$/);
    });
    expect(new swig.Swig({ cache: false }).render('[{{ foo[k] }}]', { locals: locals })).to.equal('[U]');
    expect(s.render('[{% echo foo[k] %}]', { locals: locals })).to.equal('[U]');
  });

  [false, true].forEach(function (async) {
    var path = async ? 'async' : 'sync';
    all.forEach(function (flavor) {
      it(flavor + ': a value that answers every key reads as missing for those names (' + path + ' path)', function (done) {
        var files = { '/t.html': '[{{ p[k] }}|{{ q[k](x) }}]' },
          answer = new Proxy({}, { get: function (t, name) { return typeof name === 'symbol' ? 'S' : 'X'; } }),
          callable = new Proxy({}, { get: function () { return function () { return 'CALLED'; }; } }),
          keys = ['a', ['a']].concat(guarded), res = {}, i = 0;
        function next() {
          var key;
          if (i === keys.length) {
            try {
              expect(res['"a"']).to.equal('OUT [X|CALLED]');
              expect(res['["a"]']).to.equal('OUT [X|CALLED]');
              guarded.forEach(function (g) {
                var k = JSON.stringify(g);
                expect(k + ' ' + res[k]).to.equal(k + ' OUT [|]');
              });
              done();
            } catch (e) {
              done(e);
            }
            return;
          }
          key = keys[i];
          i += 1;
          outcome(flavor, files, { p: answer, q: callable, k: key, x: 1 }, async, function (o) {
            res[JSON.stringify(key)] = o;
            next();
          });
        }
        next();
      });
    });
  });
});

/*!
 * A custom tag receives the fragments of the legacy walk, which decides at
 * `[` between a member read and an array literal by the token before it.
 * JavaScript reads `[` as a member access after a name, `]` or `)`, and
 * also after a string, number or boolean literal, `.name`, `f()`, an
 * empty-argument filter or `}`: there a key from the data that names the
 * prototype chain reads as missing ("toString" is the control that reads).
 * A token that a tag's own handler consumed without emitting it leaves its
 * bracket as before, so a list after it stays a list.
 */
describe('The bracket fragments a custom tag receives, after each kind of operand', function () {
  afterEach(restore);

  var positions = [
    ['a double-quoted string', '"s"[k]'],
    ['a single-quoted string', '\'s\'[k]'],
    ['a number', '5[k]'],
    ['a boolean', 'true [k]'],
    ['.name after ]', 'list[0].o[k]'],
    ['.name after a space', 'foo .bar[k]'],
    ['f()', 'mk()[k]'],
    ['an empty-argument filter', 'list|first[k]'],
    ['}', '{a: 1}[k]'],
    ['a name', 'obj[k]'],
    [']', 'list[0][k]'],
    [')', 'mk(1)[k]'],
    // A space before the bracket is a whitespace token of its own here
    // (the lexer keeps the space after true in the boolean's token).
    ['a string and a space', '"s" [k]'],
    ['a name and a space', 'obj [k]']
  ];

  // Each custom tag outputs what its compile builds from the fragments.
  function tags(s) {
    function none() { return true; }
    function consume(type, emit) {
      return function (str, line, parser, types) {
        var seen;
        parser.on(types[type], function (token) {
          if (seen) { return true; }
          seen = true;
          if (emit) { this.out.push(token.match); }
          return false;
        });
        return true;
      };
    }
    function out(wrap) {
      return function (compiler, args) {
        return '_output += ' + wrap + '(' + args.join('') + ');\n';
      };
    }
    s.setTag('ty', none, out('typeof '), false);
    s.setTag('str', none, out('String'), false);
    // js and nm consume their first string or name and emit nothing for it;
    // inc emits its first string itself, as the built-in include tag does.
    s.setTag('js', consume('STRING', false), out('JSON.stringify'), false);
    s.setTag('nm', consume('VAR', false), out('JSON.stringify'), false);
    s.setTag('inc', consume('STRING', true), out('typeof '), false);
    // own opens each bracket itself and leaves its `]` to the walk.
    s.setTag('own', function (str, line, parser, types) {
      parser.on(types.BRACKETOPEN, function () {
        this.out.push('[');
        this.state.push(types.BRACKETOPEN);
        return false;
      });
      return true;
    }, out('String'), false);
    return s;
  }

  // Render src on a native engine with the tags above; cb gets "OUT <output>" or "ERR <message>".
  function run(src, k, async, cb) {
    var s = tags(engine('native', { '/t.html': src }, async)),
      locals = {
        k: k,
        i: 5,
        j: 1,
        ix: [1],
        nm: { b: 'B' },
        obj: { x: 1 },
        list: [{ o: { x: 1 } }],
        foo: { bar: { x: 1 } },
        mk: function () { return { x: 1 }; }
      },
      res;
    if (async) {
      s.renderFile('/t.html', locals, function (err, out) {
        cb(err ? 'ERR ' + err.message : 'OUT ' + out);
      });
      return;
    }
    try {
      res = 'OUT ' + s.renderFile('/t.html', locals);
    } catch (e) {
      res = 'ERR ' + e.message;
    }
    cb(res);
  }

  // The outcome of each [src, key] pair, in order.
  function runAll(pairs, async, done) {
    var outs = [], i = 0;
    function next() {
      if (i === pairs.length) { return done(outs); }
      var p = pairs[i];
      i += 1;
      run(p[0], p[1], async, function (o) {
        outs.push(o);
        restore();
        next();
      });
    }
    next();
  }

  // Each pair gives the expected outcome.
  function gives(pairs, expected, async, done) {
    runAll(pairs, async, function (outs) {
      try {
        outs.forEach(function (o, n) {
          var label = pairs[n][0] + ' k=' + JSON.stringify(pairs[n][1]) + ' ';
          expect(label + o).to.equal(label + expected[n]);
        });
        done();
      } catch (e) {
        done(e);
      }
    });
  }

  // The control reads a function; "zz" and every guarded key read as missing.
  function readsAsMissing(src, async, done) {
    var keys = ['toString', 'zz'].concat(guarded);
    gives(keys.map(function (k) { return [src, k]; }), keys.map(function (k, n) {
      return n ? 'OUT [undefined]' : 'OUT [function]';
    }), async, done);
  }

  [false, true].forEach(function (async) {
    var path = async ? 'async' : 'sync';

    positions.forEach(function (pos) {
      it('after ' + pos[0] + ', a key naming the prototype chain reads as missing (' + path + ' path)', function (done) {
        readsAsMissing('[{% ty ' + pos[1] + ' %}]', async, done);
      });
    });

    // -5[k] is -(5[k]), which is NaN for every key but __proto__: its value,
    // Number.prototype, reads as 0. So every key must give what "zz" gives.
    it('after a negative number, a key naming the prototype chain reads as missing (' + path + ' path)', function (done) {
      var keys = ['zz'].concat(guarded);
      gives(keys.map(function (k) { return ['[{% str -5[k] %}]', k]; }), keys.map(function () {
        return 'OUT [NaN]';
      }), async, done);
    });

    it('after a string a tag emitted itself, a key naming the prototype chain reads as missing (' + path + ' path)', function (done) {
      readsAsMissing('[{% inc "s"[k] %}]', async, done);
    });

    it('keeps JavaScript\'s reading of a comma in a bracket after a literal (' + path + ' path)', function (done) {
      gives([['[{% str "abc"[i, j] %}]', 'zz']], ['OUT [b]'], async, done);
    });

    it('closes nested brackets that opened differently (' + path + ' path)', function (done) {
      gives([
        ['[{% str "abc"[ix[0]] %}]', 'zz'],
        ['[{% str nm["ab"[j]] %}]', 'zz']
      ], ['OUT [b]', 'OUT [B]'], async, done);
    });

    it('closes a bracket that a tag\'s handler opened with a plain ] (' + path + ' path)', function (done) {
      gives([['[{% own ix[0] %}]', 'zz']], ['OUT [1]'], async, done);
    });

    it('refuses an empty bracket after a literal, as foo[] (' + path + ' path)', function (done) {
      gives([['[{% str "s"[] %}]', 'zz']], ['ERR Unexpected closing square bracket on line 1 in file /t.html.'], async, done);
    });

    it('leaves a list after a string the tag consumed as it was (' + path + ' path)', function (done) {
      gives([
        ['{% js "key" ["a", "b"] %}', 'zz'],
        ['{% js "key" [obj] %}', 'zz'],
        ['{% js "key" [] %}', 'zz']
      ], ['OUT ["a","b"]', 'OUT [{"x":1}]', 'OUT []'], async, done);
    });

    it('leaves a list after a name the tag consumed as it was (' + path + ' path)', function (done) {
      gives([
        ['{% nm label [obj] %}', 'zz'],
        ['{% nm label [] %}', 'zz']
      ], ['OUT [{"x":1}]', 'OUT []'], async, done);
    });
  });
});
