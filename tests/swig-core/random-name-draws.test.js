var swig = require('../../lib/swig'),
  twig = require('@rhinostone/swig-twig'),
  jinja2 = require('@rhinostone/swig-jinja2'),
  django = require('@rhinostone/swig-django'),
  loaders = require('@rhinostone/swig-core/lib/loaders'),
  expect = require('../lib/expect.js');

/*!
 * A for loop's compiled code names its scratch variable, and a swig-django
 * {% cycle %} tag its state key, from Math.random(). A value under 1e-6
 * prints in exponent form ("1.01e-7"), and its minus sign made the template
 * fail to compile. These tests replace Math.random with such values while a
 * template compiles and renders, and expect the output the template gives
 * for any other value. Each case runs in each flavor that has its tags, on
 * the sync and the async render paths, with the memory cache and without a
 * cache; the expectations are generated from recorded renders.
 */
var CTORS = { native: swig.Swig, twig: twig.Twig, jinja2: jinja2.Jinja2, django: django.Django };

function smallDraws() {
  var n = 0;
  return function () { n += 1; return (1 + n / 100) * 1e-7; };
}

function make(f, files, isAsync, cache) {
  var mem = loaders.memory(files, '/'), loader = mem;
  if (isAsync) {
    loader = {
      async: true,
      resolve: mem.resolve,
      load: function (id, cb) {
        if (!cb) { return mem.load(id); }
        setImmediate(function () {
          var src;
          try { src = mem.load(id); } catch (e) { cb(e); return; }
          cb(null, src);
        });
      }
    };
  }
  return new CTORS[f]({ loader: loader, cache: cache });
}

function renderSync(f, files, locals, cache) {
  var saved = Math.random;
  Math.random = smallDraws();
  try { return make(f, files, false, cache).renderFile('/t.html', locals); } catch (e) { return 'THROW ' + e.message; } finally { Math.random = saved; }
}

function renderAsync(f, files, locals, cache) {
  var saved = Math.random;
  return new Promise(function (resolve) {
    function done(v) { Math.random = saved; resolve(v); }
    Math.random = smallDraws();
    try {
      make(f, files, true, cache).renderFile('/t.html', locals, function (err, out) {
        done(err ? 'THROW ' + err.message : out);
      });
    } catch (e) { done('THROW ' + e.message); }
  });
}

var FILES = {
  L1: { '/t.html': '{% for a in xs %}[{% for b in ys %}{{ a }}{{ b }}{% endfor %}]{% endfor %}' },
  L2: { '/t.html': '{{ a }}{% for a in xs %}{{ a }}{% endfor %}{{ a }}' },
  L3: { '/t.html': '{% for a in xs %}<{% include "inc.html" %}>{% endfor %}', '/inc.html': '{% for b in ys %}{{ a }}{{ b }}{% endfor %}' },
  L4: { '/t.html': '{% for a in xs %}[{{ _ctx__loopcache }}]{% endfor %}' },
  L5: { '/t.html': '{% for a in xs %}{% for b in ys %}{{ forloop.counter }}{{ forloop.parentloop.counter }}.{% endfor %}|{% endfor %}' },
  L6: { '/t.html': '{% for a in xs %}{% for b in ys %}{{ loop.index }}{% endfor %}{{ loop.index }}|{% endfor %}' },
  L7: { '/t.html': '{% for a in xs3 if a > 1 %}{{ a }}{% endfor %}' },
  C1: { '/t.html': '{% cycle "a" "b" %}{% cycle "c" "d" %}' },
  C2: { '/t.html': '{% for x in xs3 %}{% cycle "a" "b" %}{% endfor %}' },
  C3: { '/t.html': '{% for x in xs3 %}{% cycle "o1" "o2" %}<{% include "inc.html" %}>{% endfor %}', '/inc.html': '{% cycle "i1" "i2" "i3" %}' },
  C4: { '/t.html': '{% for x in xs3 %}<{% include "inc.html" %}{% include "inc.html" %}>{% endfor %}', '/inc.html': '{% cycle "i1" "i2" "i3" %}' }
};

function locals(extra) {
  var out = { xs: [1, 2], ys: ['x', 'y'], xs3: [1, 2, 3] }, k;
  for (k in extra) { if (Object.prototype.hasOwnProperty.call(extra, k)) { out[k] = extra[k]; } }
  return out;
}

describe('Loop and cycle names under a Math.random draw below 1e-6', function () {
  it('the draws print in exponent form', function () {
    var draw = smallDraws();
    expect(String(draw())).to.match(/e-/);
    expect(String(draw())).to.match(/e-/);
  });

  describe('L1 nested loops', function () {
    it('native, sync, cache memory', function () {
      expect(renderSync('native', FILES.L1, locals({}), 'memory')).to.equal('[1x1y][2x2y]');
    });
    it('native, sync, no cache', function () {
      expect(renderSync('native', FILES.L1, locals({}), false)).to.equal('[1x1y][2x2y]');
    });
    it('native, async, cache memory', function () {
      return renderAsync('native', FILES.L1, locals({}), 'memory').then(function (out) {
        expect(out).to.equal('[1x1y][2x2y]');
      });
    });
    it('native, async, no cache', function () {
      return renderAsync('native', FILES.L1, locals({}), false).then(function (out) {
        expect(out).to.equal('[1x1y][2x2y]');
      });
    });
    it('twig, sync, cache memory', function () {
      expect(renderSync('twig', FILES.L1, locals({}), 'memory')).to.equal('[1x1y][2x2y]');
    });
    it('twig, sync, no cache', function () {
      expect(renderSync('twig', FILES.L1, locals({}), false)).to.equal('[1x1y][2x2y]');
    });
    it('twig, async, cache memory', function () {
      return renderAsync('twig', FILES.L1, locals({}), 'memory').then(function (out) {
        expect(out).to.equal('[1x1y][2x2y]');
      });
    });
    it('twig, async, no cache', function () {
      return renderAsync('twig', FILES.L1, locals({}), false).then(function (out) {
        expect(out).to.equal('[1x1y][2x2y]');
      });
    });
    it('jinja2, sync, cache memory', function () {
      expect(renderSync('jinja2', FILES.L1, locals({}), 'memory')).to.equal('[1x1y][2x2y]');
    });
    it('jinja2, sync, no cache', function () {
      expect(renderSync('jinja2', FILES.L1, locals({}), false)).to.equal('[1x1y][2x2y]');
    });
    it('jinja2, async, cache memory', function () {
      return renderAsync('jinja2', FILES.L1, locals({}), 'memory').then(function (out) {
        expect(out).to.equal('[1x1y][2x2y]');
      });
    });
    it('jinja2, async, no cache', function () {
      return renderAsync('jinja2', FILES.L1, locals({}), false).then(function (out) {
        expect(out).to.equal('[1x1y][2x2y]');
      });
    });
    it('django, sync, cache memory', function () {
      expect(renderSync('django', FILES.L1, locals({}), 'memory')).to.equal('[1x1y][2x2y]');
    });
    it('django, sync, no cache', function () {
      expect(renderSync('django', FILES.L1, locals({}), false)).to.equal('[1x1y][2x2y]');
    });
    it('django, async, cache memory', function () {
      return renderAsync('django', FILES.L1, locals({}), 'memory').then(function (out) {
        expect(out).to.equal('[1x1y][2x2y]');
      });
    });
    it('django, async, no cache', function () {
      return renderAsync('django', FILES.L1, locals({}), false).then(function (out) {
        expect(out).to.equal('[1x1y][2x2y]');
      });
    });
  });

  describe('L2 a loop name restored after the loop', function () {
    it('native, sync, cache memory', function () {
      expect(renderSync('native', FILES.L2, locals({ a: 'A' }), 'memory')).to.equal('A12A');
    });
    it('native, sync, no cache', function () {
      expect(renderSync('native', FILES.L2, locals({ a: 'A' }), false)).to.equal('A12A');
    });
    it('native, async, cache memory', function () {
      return renderAsync('native', FILES.L2, locals({ a: 'A' }), 'memory').then(function (out) {
        expect(out).to.equal('A12A');
      });
    });
    it('native, async, no cache', function () {
      return renderAsync('native', FILES.L2, locals({ a: 'A' }), false).then(function (out) {
        expect(out).to.equal('A12A');
      });
    });
    it('twig, sync, cache memory', function () {
      expect(renderSync('twig', FILES.L2, locals({ a: 'A' }), 'memory')).to.equal('A12A');
    });
    it('twig, sync, no cache', function () {
      expect(renderSync('twig', FILES.L2, locals({ a: 'A' }), false)).to.equal('A12A');
    });
    it('twig, async, cache memory', function () {
      return renderAsync('twig', FILES.L2, locals({ a: 'A' }), 'memory').then(function (out) {
        expect(out).to.equal('A12A');
      });
    });
    it('twig, async, no cache', function () {
      return renderAsync('twig', FILES.L2, locals({ a: 'A' }), false).then(function (out) {
        expect(out).to.equal('A12A');
      });
    });
    it('jinja2, sync, cache memory', function () {
      expect(renderSync('jinja2', FILES.L2, locals({ a: 'A' }), 'memory')).to.equal('A12A');
    });
    it('jinja2, sync, no cache', function () {
      expect(renderSync('jinja2', FILES.L2, locals({ a: 'A' }), false)).to.equal('A12A');
    });
    it('jinja2, async, cache memory', function () {
      return renderAsync('jinja2', FILES.L2, locals({ a: 'A' }), 'memory').then(function (out) {
        expect(out).to.equal('A12A');
      });
    });
    it('jinja2, async, no cache', function () {
      return renderAsync('jinja2', FILES.L2, locals({ a: 'A' }), false).then(function (out) {
        expect(out).to.equal('A12A');
      });
    });
    it('django, sync, cache memory', function () {
      expect(renderSync('django', FILES.L2, locals({ a: 'A' }), 'memory')).to.equal('A12A');
    });
    it('django, sync, no cache', function () {
      expect(renderSync('django', FILES.L2, locals({ a: 'A' }), false)).to.equal('A12A');
    });
    it('django, async, cache memory', function () {
      return renderAsync('django', FILES.L2, locals({ a: 'A' }), 'memory').then(function (out) {
        expect(out).to.equal('A12A');
      });
    });
    it('django, async, no cache', function () {
      return renderAsync('django', FILES.L2, locals({ a: 'A' }), false).then(function (out) {
        expect(out).to.equal('A12A');
      });
    });
  });

  describe('L3 a loop in an include inside a loop', function () {
    it('native, sync, cache memory', function () {
      expect(renderSync('native', FILES.L3, locals({}), 'memory')).to.equal('<1x1y><2x2y>');
    });
    it('native, sync, no cache', function () {
      expect(renderSync('native', FILES.L3, locals({}), false)).to.equal('<1x1y><2x2y>');
    });
    it('native, async, cache memory', function () {
      return renderAsync('native', FILES.L3, locals({}), 'memory').then(function (out) {
        expect(out).to.equal('<1x1y><2x2y>');
      });
    });
    it('native, async, no cache', function () {
      return renderAsync('native', FILES.L3, locals({}), false).then(function (out) {
        expect(out).to.equal('<1x1y><2x2y>');
      });
    });
    it('twig, sync, cache memory', function () {
      expect(renderSync('twig', FILES.L3, locals({}), 'memory')).to.equal('<1x1y><2x2y>');
    });
    it('twig, sync, no cache', function () {
      expect(renderSync('twig', FILES.L3, locals({}), false)).to.equal('<1x1y><2x2y>');
    });
    it('twig, async, cache memory', function () {
      return renderAsync('twig', FILES.L3, locals({}), 'memory').then(function (out) {
        expect(out).to.equal('<1x1y><2x2y>');
      });
    });
    it('twig, async, no cache', function () {
      return renderAsync('twig', FILES.L3, locals({}), false).then(function (out) {
        expect(out).to.equal('<1x1y><2x2y>');
      });
    });
    it('jinja2, sync, cache memory', function () {
      expect(renderSync('jinja2', FILES.L3, locals({}), 'memory')).to.equal('<1x1y><2x2y>');
    });
    it('jinja2, sync, no cache', function () {
      expect(renderSync('jinja2', FILES.L3, locals({}), false)).to.equal('<1x1y><2x2y>');
    });
    it('jinja2, async, cache memory', function () {
      return renderAsync('jinja2', FILES.L3, locals({}), 'memory').then(function (out) {
        expect(out).to.equal('<1x1y><2x2y>');
      });
    });
    it('jinja2, async, no cache', function () {
      return renderAsync('jinja2', FILES.L3, locals({}), false).then(function (out) {
        expect(out).to.equal('<1x1y><2x2y>');
      });
    });
    it('django, sync, cache memory', function () {
      expect(renderSync('django', FILES.L3, locals({}), 'memory')).to.equal('<1x1y><2x2y>');
    });
    it('django, sync, no cache', function () {
      expect(renderSync('django', FILES.L3, locals({}), false)).to.equal('<1x1y><2x2y>');
    });
    it('django, async, cache memory', function () {
      return renderAsync('django', FILES.L3, locals({}), 'memory').then(function (out) {
        expect(out).to.equal('<1x1y><2x2y>');
      });
    });
    it('django, async, no cache', function () {
      return renderAsync('django', FILES.L3, locals({}), false).then(function (out) {
        expect(out).to.equal('<1x1y><2x2y>');
      });
    });
  });

  describe('L4 the scratch name read as a variable in a loop', function () {
    it('native, sync, cache memory', function () {
      expect(renderSync('native', FILES.L4, locals({}), 'memory')).to.equal('[][]');
    });
    it('native, sync, no cache', function () {
      expect(renderSync('native', FILES.L4, locals({}), false)).to.equal('[][]');
    });
    it('native, async, cache memory', function () {
      return renderAsync('native', FILES.L4, locals({}), 'memory').then(function (out) {
        expect(out).to.equal('[][]');
      });
    });
    it('native, async, no cache', function () {
      return renderAsync('native', FILES.L4, locals({}), false).then(function (out) {
        expect(out).to.equal('[][]');
      });
    });
    it('twig, sync, cache memory', function () {
      expect(renderSync('twig', FILES.L4, locals({}), 'memory')).to.equal('[][]');
    });
    it('twig, sync, no cache', function () {
      expect(renderSync('twig', FILES.L4, locals({}), false)).to.equal('[][]');
    });
    it('twig, async, cache memory', function () {
      return renderAsync('twig', FILES.L4, locals({}), 'memory').then(function (out) {
        expect(out).to.equal('[][]');
      });
    });
    it('twig, async, no cache', function () {
      return renderAsync('twig', FILES.L4, locals({}), false).then(function (out) {
        expect(out).to.equal('[][]');
      });
    });
    it('jinja2, sync, cache memory', function () {
      expect(renderSync('jinja2', FILES.L4, locals({}), 'memory')).to.equal('[][]');
    });
    it('jinja2, sync, no cache', function () {
      expect(renderSync('jinja2', FILES.L4, locals({}), false)).to.equal('[][]');
    });
    it('jinja2, async, cache memory', function () {
      return renderAsync('jinja2', FILES.L4, locals({}), 'memory').then(function (out) {
        expect(out).to.equal('[][]');
      });
    });
    it('jinja2, async, no cache', function () {
      return renderAsync('jinja2', FILES.L4, locals({}), false).then(function (out) {
        expect(out).to.equal('[][]');
      });
    });
    it('django, sync, cache memory', function () {
      expect(renderSync('django', FILES.L4, locals({}), 'memory')).to.equal('[][]');
    });
    it('django, sync, no cache', function () {
      expect(renderSync('django', FILES.L4, locals({}), false)).to.equal('[][]');
    });
    it('django, async, cache memory', function () {
      return renderAsync('django', FILES.L4, locals({}), 'memory').then(function (out) {
        expect(out).to.equal('[][]');
      });
    });
    it('django, async, no cache', function () {
      return renderAsync('django', FILES.L4, locals({}), false).then(function (out) {
        expect(out).to.equal('[][]');
      });
    });
  });

  describe('L5 forloop.parentloop in nested loops', function () {
    it('django, sync, cache memory', function () {
      expect(renderSync('django', FILES.L5, locals({}), 'memory')).to.equal('11.21.|12.22.|');
    });
    it('django, sync, no cache', function () {
      expect(renderSync('django', FILES.L5, locals({}), false)).to.equal('11.21.|12.22.|');
    });
    it('django, async, cache memory', function () {
      return renderAsync('django', FILES.L5, locals({}), 'memory').then(function (out) {
        expect(out).to.equal('11.21.|12.22.|');
      });
    });
    it('django, async, no cache', function () {
      return renderAsync('django', FILES.L5, locals({}), false).then(function (out) {
        expect(out).to.equal('11.21.|12.22.|');
      });
    });
  });

  describe('L6 loop.index in nested loops', function () {
    it('native, sync, cache memory', function () {
      expect(renderSync('native', FILES.L6, locals({}), 'memory')).to.equal('121|122|');
    });
    it('native, sync, no cache', function () {
      expect(renderSync('native', FILES.L6, locals({}), false)).to.equal('121|122|');
    });
    it('native, async, cache memory', function () {
      return renderAsync('native', FILES.L6, locals({}), 'memory').then(function (out) {
        expect(out).to.equal('121|122|');
      });
    });
    it('native, async, no cache', function () {
      return renderAsync('native', FILES.L6, locals({}), false).then(function (out) {
        expect(out).to.equal('121|122|');
      });
    });
    it('twig, sync, cache memory', function () {
      expect(renderSync('twig', FILES.L6, locals({}), 'memory')).to.equal('121|122|');
    });
    it('twig, sync, no cache', function () {
      expect(renderSync('twig', FILES.L6, locals({}), false)).to.equal('121|122|');
    });
    it('twig, async, cache memory', function () {
      return renderAsync('twig', FILES.L6, locals({}), 'memory').then(function (out) {
        expect(out).to.equal('121|122|');
      });
    });
    it('twig, async, no cache', function () {
      return renderAsync('twig', FILES.L6, locals({}), false).then(function (out) {
        expect(out).to.equal('121|122|');
      });
    });
    it('jinja2, sync, cache memory', function () {
      expect(renderSync('jinja2', FILES.L6, locals({}), 'memory')).to.equal('121|122|');
    });
    it('jinja2, sync, no cache', function () {
      expect(renderSync('jinja2', FILES.L6, locals({}), false)).to.equal('121|122|');
    });
    it('jinja2, async, cache memory', function () {
      return renderAsync('jinja2', FILES.L6, locals({}), 'memory').then(function (out) {
        expect(out).to.equal('121|122|');
      });
    });
    it('jinja2, async, no cache', function () {
      return renderAsync('jinja2', FILES.L6, locals({}), false).then(function (out) {
        expect(out).to.equal('121|122|');
      });
    });
  });

  describe('L7 a loop filter', function () {
    it('jinja2, sync, cache memory', function () {
      expect(renderSync('jinja2', FILES.L7, locals({}), 'memory')).to.equal('23');
    });
    it('jinja2, sync, no cache', function () {
      expect(renderSync('jinja2', FILES.L7, locals({}), false)).to.equal('23');
    });
    it('jinja2, async, cache memory', function () {
      return renderAsync('jinja2', FILES.L7, locals({}), 'memory').then(function (out) {
        expect(out).to.equal('23');
      });
    });
    it('jinja2, async, no cache', function () {
      return renderAsync('jinja2', FILES.L7, locals({}), false).then(function (out) {
        expect(out).to.equal('23');
      });
    });
  });

  describe('C1 two cycle tags', function () {
    it('django, sync, cache memory', function () {
      expect(renderSync('django', FILES.C1, locals({}), 'memory')).to.equal('ac');
    });
    it('django, sync, no cache', function () {
      expect(renderSync('django', FILES.C1, locals({}), false)).to.equal('ac');
    });
    it('django, async, cache memory', function () {
      return renderAsync('django', FILES.C1, locals({}), 'memory').then(function (out) {
        expect(out).to.equal('ac');
      });
    });
    it('django, async, no cache', function () {
      return renderAsync('django', FILES.C1, locals({}), false).then(function (out) {
        expect(out).to.equal('ac');
      });
    });
  });

  describe('C2 a cycle tag in a loop', function () {
    it('django, sync, cache memory', function () {
      expect(renderSync('django', FILES.C2, locals({}), 'memory')).to.equal('aba');
    });
    it('django, sync, no cache', function () {
      expect(renderSync('django', FILES.C2, locals({}), false)).to.equal('aba');
    });
    it('django, async, cache memory', function () {
      return renderAsync('django', FILES.C2, locals({}), 'memory').then(function (out) {
        expect(out).to.equal('aba');
      });
    });
    it('django, async, no cache', function () {
      return renderAsync('django', FILES.C2, locals({}), false).then(function (out) {
        expect(out).to.equal('aba');
      });
    });
  });

  describe('C3 a cycle loop that includes a template with its own cycle', function () {
    it('django, sync, cache memory', function () {
      expect(renderSync('django', FILES.C3, locals({}), 'memory')).to.equal('o1<i1>o2<i2>o1<i3>');
    });
    it('django, sync, no cache', function () {
      expect(renderSync('django', FILES.C3, locals({}), false)).to.equal('o1<i1>o2<i1>o1<i1>');
    });
    it('django, async, cache memory', function () {
      return renderAsync('django', FILES.C3, locals({}), 'memory').then(function (out) {
        expect(out).to.equal('o1<i1>o2<i2>o1<i3>');
      });
    });
    it('django, async, no cache', function () {
      return renderAsync('django', FILES.C3, locals({}), false).then(function (out) {
        expect(out).to.equal('o1<i1>o2<i1>o1<i1>');
      });
    });
  });

  describe('C4 two includes of a cycle per iteration', function () {
    it('django, sync, cache memory', function () {
      expect(renderSync('django', FILES.C4, locals({}), 'memory')).to.equal('<i1i2><i3i1><i2i3>');
    });
    it('django, sync, no cache', function () {
      expect(renderSync('django', FILES.C4, locals({}), false)).to.equal('<i1i1><i1i1><i1i1>');
    });
    it('django, async, cache memory', function () {
      return renderAsync('django', FILES.C4, locals({}), 'memory').then(function (out) {
        expect(out).to.equal('<i1i2><i3i1><i2i3>');
      });
    });
    it('django, async, no cache', function () {
      return renderAsync('django', FILES.C4, locals({}), false).then(function (out) {
        expect(out).to.equal('<i1i1><i1i1><i1i1>');
      });
    });
  });
});
