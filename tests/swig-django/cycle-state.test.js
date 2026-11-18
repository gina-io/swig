var django = require('@rhinostone/swig-django'),
  loaders = require('@rhinostone/swig-core/lib/loaders'),
  expect = require('../lib/expect.js');

/*!
 * A swig-django {% cycle %} tag keeps its position for one render of its
 * template, as Django keeps it in the template's render_context: an included
 * template's cycle starts again at each include, also under the memory cache,
 * and a cycle inside a {% with %} body carries on across the iterations of an
 * enclosing loop. Each case runs on the sync and the async render paths, with
 * the memory cache and without a cache. The tests are generated: each
 * expectation is the output of Django 5.2.18 for the same templates and locals
 * (through its locmem loader and through the cached loader over it, which
 * agree), except R1, where Django rejects a name that starts with an underscore
 * and swig reads the tag's state as a missing variable.
 */
function make(files, isAsync, cache) {
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
  return new django.Django({ loader: loader, cache: cache });
}

function locals() {
  return { xs: [1, 2], ys: ['x', 'y'], xs3: [1, 2, 3], name: 'inc.html', deep: { next: { next: null } }, nothing: [] };
}

function renderSync(files, cache, twice) {
  var inst = make(files, false, cache), out;
  try {
    out = inst.renderFile('/t.html', locals());
    if (twice) { out += '|' + inst.renderFile('/t.html', locals()); }
    return out;
  } catch (e) { return 'THROW ' + e.message; }
}

function renderAsync(files, cache, twice) {
  var inst = make(files, true, cache);
  function once() {
    return new Promise(function (resolve) {
      try {
        inst.renderFile('/t.html', locals(), function (err, out) { resolve(err ? 'THROW ' + err.message : out); });
      } catch (e) { resolve('THROW ' + e.message); }
    });
  }
  return once().then(function (first) {
    if (!twice || first.indexOf('THROW ') === 0) { return first; }
    return once().then(function (second) { return first + '|' + second; });
  });
}

var FILES = {
  C1: { '/t.html': '{% cycle "a" "b" %}{% cycle "c" "d" %}' },
  C2: { '/t.html': '{% for x in xs3 %}{% cycle "a" "b" %}{% endfor %}' },
  C3: { '/t.html': '{% for x in xs3 %}{% cycle "o1" "o2" %}<{% include "inc.html" %}>{% endfor %}', '/inc.html': '{% cycle "i1" "i2" "i3" %}' },
  C4: { '/t.html': '{% for x in xs3 %}<{% include "inc.html" %}{% include "inc.html" %}>{% endfor %}', '/inc.html': '{% cycle "i1" "i2" "i3" %}' },
  D1: { '/t.html': '{% include "inc.html" %}{% include "inc.html" with a=1 %}{% include "inc.html" %}', '/inc.html': '{% cycle "i1" "i2" "i3" %}' },
  D2: { '/t.html': '{% include "inc.html" only %}{% include "inc.html" only %}', '/inc.html': '{% cycle "i1" "i2" "i3" %}' },
  D3: { '/t.html': '{% for x in xs %}[{% include "a.html" %}]{% endfor %}', '/a.html': '{% cycle "a1" "a2" %}{% include "b.html" %}{% include "b.html" %}', '/b.html': '{% cycle "b1" "b2" "b3" %}' },
  D4: { '/t.html': '{% include "inc.html" %}|{% include "inc.html" %}', '/inc.html': '{% for y in ys %}{% cycle "c1" "c2" "c3" %}{% endfor %}' },
  D5: { '/t.html': '{% include "c.html" %}|{% include "c.html" %}', '/c.html': '{% extends "p.html" %}{% block b %}{% cycle "k1" "k2" "k3" %}{% endblock %}', '/p.html': '<{% for y in ys %}{% block b %}{% endblock %}{% endfor %}>' },
  D6: { '/t.html': '{% for x in xs3 %}{% include name %}{% endfor %}', '/inc.html': '{% cycle "i1" "i2" "i3" %}' },
  D7: { '/t.html': '{% for x in xs %}{% with a=1 %}{% include "inc.html" %}{% endwith %}{% endfor %}', '/inc.html': '{% cycle "i1" "i2" "i3" %}' },
  D8: { '/t.html': '{% cycle "r1" "r2" %}{% if deep %}{% with deep=deep.next %}{% include "t.html" %}{% endwith %}{% endif %}{% cycle "s1" "s2" %}' },
  W1: { '/t.html': '{% for x in xs3 %}{% with a=1 %}{% cycle "a" "b" %}{% endwith %}{% endfor %}' },
  W2: { '/t.html': '{% for x in xs3 %}{% cycle "a" "b" %}{% with a=1 %}{% cycle "c" "d" %}{% endwith %}{% endfor %}' },
  S1: { '/t.html': '{% for x in xs3 %}{% spaceless %}{% cycle "a" "b" %}{% endspaceless %}{% endfor %}' },
  E1: { '/t.html': '{% extends "p.html" %}{% block b %}{% for y in ys %}{% cycle "k1" "k2" "k3" %}{% endfor %}{% endblock %}', '/p.html': '{% cycle "p1" "p2" %}[{% block b %}{% endblock %}]{% cycle "p1" "p2" %}' },
  E2: { '/t.html': '{% extends "p.html" %}{% block b %}{% cycle "k1" "k2" "k3" %}{% endblock %}', '/p.html': '<{% for y in xs3 %}{% block b %}{% endblock %}{% endfor %}>' },
  R1: { '/t.html': '{% cycle "a" "b" %}[{{ __cycles }}][{{ __cycleSave }}]' },
  T1: { '/t.html': '{% for x in xs3 %}{% cycle "a" "b" %}{% endfor %}' },
  P1: { '/t.html': '{% for x in xs3 %}{% include "inc.html" %}{% endfor %}', '/inc.html': '{% cycle "i1" "i2" "i3" %}' },
  N1: { '/t.html': '{% for x in xs3 %}{% if x %}{% cycle "a" "b" %}{% endif %}{% endfor %}' },
  N2: { '/t.html': '{% for x in xs3 %}{% if not x %}-{% elif x %}{% cycle "a" "b" %}{% endif %}{% endfor %}' },
  N3: { '/t.html': '{% for x in xs3 %}{% if not x %}-{% else %}{% cycle "a" "b" %}{% endif %}{% endfor %}' },
  N4: { '/t.html': '{% for y in xs3 %}{% for x in nothing %}-{% empty %}{% cycle "a" "b" %}{% endfor %}{% endfor %}' },
  N5: { '/t.html': '{% for x in xs3 %}{% autoescape off %}{% cycle "<a>" "<b>" %}{% endautoescape %}{% endfor %}' },
  N6: { '/t.html': '{% for x in xs3 %}{% block b %}{% cycle "a" "b" %}{% endblock %}{% endfor %}' },
  N7: { '/t.html': '{% for x in xs3 %}{% with a=x %}{% if a %}{% for y in ys %}{% cycle "a" "b" "c" %}{% endfor %}{% endif %}{% endwith %}{% endfor %}' },
  N8: { '/t.html': '{% extends "p.html" %}{% cycle "z1" "z2" %}{% block b %}{% cycle "k1" "k2" %}{% endblock %}', '/p.html': '<{% for y in ys %}{% block b %}{% endblock %}{% endfor %}>' },
  N9: { '/t.html': '{% extends "p.html" %}', '/p.html': '<{% for y in xs3 %}{% block b %}{% cycle "q1" "q2" %}{% endblock %}{% endfor %}>' },
  N10: { '/t.html': '{% extends "m.html" %}{% block b %}{% cycle "k1" "k2" %}{% endblock %}', '/m.html': '{% extends "p.html" %}{% block c %}{% cycle "m1" "m2" %}{% endblock %}', '/p.html': '<{% for y in xs3 %}{% block b %}{% endblock %}{% block c %}{% endblock %}{% endfor %}>' }
};

describe('swig-django cycle state per render of its template', function () {
  describe('C1 two cycle tags', function () {
    it('C1 (memory cache, sync)', function () {
      expect(renderSync(FILES.C1, 'memory', false)).to.equal('ac');
    });
    it('C1 (no cache, sync)', function () {
      expect(renderSync(FILES.C1, false, false)).to.equal('ac');
    });
    it('C1 (memory cache, async)', function () {
      return renderAsync(FILES.C1, 'memory', false).then(function (out) {
        expect(out).to.equal('ac');
      });
    });
    it('C1 (no cache, async)', function () {
      return renderAsync(FILES.C1, false, false).then(function (out) {
        expect(out).to.equal('ac');
      });
    });
  });

  describe('C2 a cycle in a loop', function () {
    it('C2 (memory cache, sync)', function () {
      expect(renderSync(FILES.C2, 'memory', false)).to.equal('aba');
    });
    it('C2 (no cache, sync)', function () {
      expect(renderSync(FILES.C2, false, false)).to.equal('aba');
    });
    it('C2 (memory cache, async)', function () {
      return renderAsync(FILES.C2, 'memory', false).then(function (out) {
        expect(out).to.equal('aba');
      });
    });
    it('C2 (no cache, async)', function () {
      return renderAsync(FILES.C2, false, false).then(function (out) {
        expect(out).to.equal('aba');
      });
    });
  });

  describe('C3 a cycle loop that includes a template with its own cycle', function () {
    it('C3 (memory cache, sync)', function () {
      expect(renderSync(FILES.C3, 'memory', false)).to.equal('o1<i1>o2<i1>o1<i1>');
    });
    it('C3 (no cache, sync)', function () {
      expect(renderSync(FILES.C3, false, false)).to.equal('o1<i1>o2<i1>o1<i1>');
    });
    it('C3 (memory cache, async)', function () {
      return renderAsync(FILES.C3, 'memory', false).then(function (out) {
        expect(out).to.equal('o1<i1>o2<i1>o1<i1>');
      });
    });
    it('C3 (no cache, async)', function () {
      return renderAsync(FILES.C3, false, false).then(function (out) {
        expect(out).to.equal('o1<i1>o2<i1>o1<i1>');
      });
    });
  });

  describe('C4 two includes of a cycle per iteration', function () {
    it('C4 (memory cache, sync)', function () {
      expect(renderSync(FILES.C4, 'memory', false)).to.equal('<i1i1><i1i1><i1i1>');
    });
    it('C4 (no cache, sync)', function () {
      expect(renderSync(FILES.C4, false, false)).to.equal('<i1i1><i1i1><i1i1>');
    });
    it('C4 (memory cache, async)', function () {
      return renderAsync(FILES.C4, 'memory', false).then(function (out) {
        expect(out).to.equal('<i1i1><i1i1><i1i1>');
      });
    });
    it('C4 (no cache, async)', function () {
      return renderAsync(FILES.C4, false, false).then(function (out) {
        expect(out).to.equal('<i1i1><i1i1><i1i1>');
      });
    });
  });

  describe('D1 a plain include, one with with, a plain include', function () {
    it('D1 (memory cache, sync)', function () {
      expect(renderSync(FILES.D1, 'memory', false)).to.equal('i1i1i1');
    });
    it('D1 (no cache, sync)', function () {
      expect(renderSync(FILES.D1, false, false)).to.equal('i1i1i1');
    });
    it('D1 (memory cache, async)', function () {
      return renderAsync(FILES.D1, 'memory', false).then(function (out) {
        expect(out).to.equal('i1i1i1');
      });
    });
    it('D1 (no cache, async)', function () {
      return renderAsync(FILES.D1, false, false).then(function (out) {
        expect(out).to.equal('i1i1i1');
      });
    });
  });

  describe('D2 two includes with only', function () {
    it('D2 (memory cache, sync)', function () {
      expect(renderSync(FILES.D2, 'memory', false)).to.equal('i1i1');
    });
    it('D2 (no cache, sync)', function () {
      expect(renderSync(FILES.D2, false, false)).to.equal('i1i1');
    });
    it('D2 (memory cache, async)', function () {
      return renderAsync(FILES.D2, 'memory', false).then(function (out) {
        expect(out).to.equal('i1i1');
      });
    });
    it('D2 (no cache, async)', function () {
      return renderAsync(FILES.D2, false, false).then(function (out) {
        expect(out).to.equal('i1i1');
      });
    });
  });

  describe('D3 nested includes in a loop', function () {
    it('D3 (memory cache, sync)', function () {
      expect(renderSync(FILES.D3, 'memory', false)).to.equal('[a1b1b1][a1b1b1]');
    });
    it('D3 (no cache, sync)', function () {
      expect(renderSync(FILES.D3, false, false)).to.equal('[a1b1b1][a1b1b1]');
    });
    it('D3 (memory cache, async)', function () {
      return renderAsync(FILES.D3, 'memory', false).then(function (out) {
        expect(out).to.equal('[a1b1b1][a1b1b1]');
      });
    });
    it('D3 (no cache, async)', function () {
      return renderAsync(FILES.D3, false, false).then(function (out) {
        expect(out).to.equal('[a1b1b1][a1b1b1]');
      });
    });
  });

  describe('D4 a loop in an included template, included twice', function () {
    it('D4 (memory cache, sync)', function () {
      expect(renderSync(FILES.D4, 'memory', false)).to.equal('c1c2|c1c2');
    });
    it('D4 (no cache, sync)', function () {
      expect(renderSync(FILES.D4, false, false)).to.equal('c1c2|c1c2');
    });
    it('D4 (memory cache, async)', function () {
      return renderAsync(FILES.D4, 'memory', false).then(function (out) {
        expect(out).to.equal('c1c2|c1c2');
      });
    });
    it('D4 (no cache, async)', function () {
      return renderAsync(FILES.D4, false, false).then(function (out) {
        expect(out).to.equal('c1c2|c1c2');
      });
    });
  });

  describe('D5 two includes of an extending template whose parent renders the block in a loop', function () {
    it('D5 (memory cache, sync)', function () {
      expect(renderSync(FILES.D5, 'memory', false)).to.equal('<k1k2>|<k1k2>');
    });
    it('D5 (no cache, sync)', function () {
      expect(renderSync(FILES.D5, false, false)).to.equal('<k1k2>|<k1k2>');
    });
    it('D5 (memory cache, async)', function () {
      return renderAsync(FILES.D5, 'memory', false).then(function (out) {
        expect(out).to.equal('<k1k2>|<k1k2>');
      });
    });
    it('D5 (no cache, async)', function () {
      return renderAsync(FILES.D5, false, false).then(function (out) {
        expect(out).to.equal('<k1k2>|<k1k2>');
      });
    });
  });

  describe('D6 a dynamic include in a loop', function () {
    it('D6 (memory cache, sync)', function () {
      expect(renderSync(FILES.D6, 'memory', false)).to.equal('i1i1i1');
    });
    it('D6 (no cache, sync)', function () {
      expect(renderSync(FILES.D6, false, false)).to.equal('i1i1i1');
    });
    it('D6 (memory cache, async)', function () {
      return renderAsync(FILES.D6, 'memory', false).then(function (out) {
        expect(out).to.equal('i1i1i1');
      });
    });
    it('D6 (no cache, async)', function () {
      return renderAsync(FILES.D6, false, false).then(function (out) {
        expect(out).to.equal('i1i1i1');
      });
    });
  });

  describe('D7 an include in a with body in a loop', function () {
    it('D7 (memory cache, sync)', function () {
      expect(renderSync(FILES.D7, 'memory', false)).to.equal('i1i1');
    });
    it('D7 (no cache, sync)', function () {
      expect(renderSync(FILES.D7, false, false)).to.equal('i1i1');
    });
    it('D7 (memory cache, async)', function () {
      return renderAsync(FILES.D7, 'memory', false).then(function (out) {
        expect(out).to.equal('i1i1');
      });
    });
    it('D7 (no cache, async)', function () {
      return renderAsync(FILES.D7, false, false).then(function (out) {
        expect(out).to.equal('i1i1');
      });
    });
  });

  describe('D8 a template that includes itself through with', function () {
    it('D8 (memory cache, sync)', function () {
      expect(renderSync(FILES.D8, 'memory', false)).to.equal('r1r1r1s1s1s1');
    });
    it('D8 (no cache, sync)', function () {
      expect(renderSync(FILES.D8, false, false)).to.equal('r1r1r1s1s1s1');
    });
    it('D8 (memory cache, async)', function () {
      return renderAsync(FILES.D8, 'memory', false).then(function (out) {
        expect(out).to.equal('r1r1r1s1s1s1');
      });
    });
    it('D8 (no cache, async)', function () {
      return renderAsync(FILES.D8, false, false).then(function (out) {
        expect(out).to.equal('r1r1r1s1s1s1');
      });
    });
  });

  describe('W1 a cycle in a with body in a loop', function () {
    it('W1 (memory cache, sync)', function () {
      expect(renderSync(FILES.W1, 'memory', false)).to.equal('aba');
    });
    it('W1 (no cache, sync)', function () {
      expect(renderSync(FILES.W1, false, false)).to.equal('aba');
    });
    it('W1 (memory cache, async)', function () {
      return renderAsync(FILES.W1, 'memory', false).then(function (out) {
        expect(out).to.equal('aba');
      });
    });
    it('W1 (no cache, async)', function () {
      return renderAsync(FILES.W1, false, false).then(function (out) {
        expect(out).to.equal('aba');
      });
    });
  });

  describe('W2 cycles outside and inside a with body in a loop', function () {
    it('W2 (memory cache, sync)', function () {
      expect(renderSync(FILES.W2, 'memory', false)).to.equal('acbdac');
    });
    it('W2 (no cache, sync)', function () {
      expect(renderSync(FILES.W2, false, false)).to.equal('acbdac');
    });
    it('W2 (memory cache, async)', function () {
      return renderAsync(FILES.W2, 'memory', false).then(function (out) {
        expect(out).to.equal('acbdac');
      });
    });
    it('W2 (no cache, async)', function () {
      return renderAsync(FILES.W2, false, false).then(function (out) {
        expect(out).to.equal('acbdac');
      });
    });
  });

  describe('S1 a cycle in a spaceless body in a loop', function () {
    it('S1 (memory cache, sync)', function () {
      expect(renderSync(FILES.S1, 'memory', false)).to.equal('aba');
    });
    it('S1 (no cache, sync)', function () {
      expect(renderSync(FILES.S1, false, false)).to.equal('aba');
    });
    it('S1 (memory cache, async)', function () {
      return renderAsync(FILES.S1, 'memory', false).then(function (out) {
        expect(out).to.equal('aba');
      });
    });
    it('S1 (no cache, async)', function () {
      return renderAsync(FILES.S1, false, false).then(function (out) {
        expect(out).to.equal('aba');
      });
    });
  });

  describe('E1 cycles in the parent and in the child block', function () {
    it('E1 (memory cache, sync)', function () {
      expect(renderSync(FILES.E1, 'memory', false)).to.equal('p1[k1k2]p1');
    });
    it('E1 (no cache, sync)', function () {
      expect(renderSync(FILES.E1, false, false)).to.equal('p1[k1k2]p1');
    });
    it('E1 (memory cache, async)', function () {
      return renderAsync(FILES.E1, 'memory', false).then(function (out) {
        expect(out).to.equal('p1[k1k2]p1');
      });
    });
    it('E1 (no cache, async)', function () {
      return renderAsync(FILES.E1, false, false).then(function (out) {
        expect(out).to.equal('p1[k1k2]p1');
      });
    });
  });

  describe('E2 a child block with a cycle that the parent renders in a loop', function () {
    it('E2 (memory cache, sync)', function () {
      expect(renderSync(FILES.E2, 'memory', false)).to.equal('<k1k2k3>');
    });
    it('E2 (no cache, sync)', function () {
      expect(renderSync(FILES.E2, false, false)).to.equal('<k1k2k3>');
    });
    it('E2 (memory cache, async)', function () {
      return renderAsync(FILES.E2, 'memory', false).then(function (out) {
        expect(out).to.equal('<k1k2k3>');
      });
    });
    it('E2 (no cache, async)', function () {
      return renderAsync(FILES.E2, false, false).then(function (out) {
        expect(out).to.equal('<k1k2k3>');
      });
    });
  });

  describe('R1 the cycle state is not a template variable', function () {
    it('R1 (memory cache, sync)', function () {
      expect(renderSync(FILES.R1, 'memory', false)).to.equal('a[][]');
    });
    it('R1 (no cache, sync)', function () {
      expect(renderSync(FILES.R1, false, false)).to.equal('a[][]');
    });
    it('R1 (memory cache, async)', function () {
      return renderAsync(FILES.R1, 'memory', false).then(function (out) {
        expect(out).to.equal('a[][]');
      });
    });
    it('R1 (no cache, async)', function () {
      return renderAsync(FILES.R1, false, false).then(function (out) {
        expect(out).to.equal('a[][]');
      });
    });
  });

  describe('T1 two renders on one instance', function () {
    it('T1 (memory cache, sync)', function () {
      expect(renderSync(FILES.T1, 'memory', true)).to.equal('aba|aba');
    });
    it('T1 (no cache, sync)', function () {
      expect(renderSync(FILES.T1, false, true)).to.equal('aba|aba');
    });
    it('T1 (memory cache, async)', function () {
      return renderAsync(FILES.T1, 'memory', true).then(function (out) {
        expect(out).to.equal('aba|aba');
      });
    });
    it('T1 (no cache, async)', function () {
      return renderAsync(FILES.T1, false, true).then(function (out) {
        expect(out).to.equal('aba|aba');
      });
    });
  });

  describe('P1 a loop that includes a template with a cycle', function () {
    it('P1 (memory cache, sync)', function () {
      expect(renderSync(FILES.P1, 'memory', false)).to.equal('i1i1i1');
    });
    it('P1 (no cache, sync)', function () {
      expect(renderSync(FILES.P1, false, false)).to.equal('i1i1i1');
    });
    it('P1 (memory cache, async)', function () {
      return renderAsync(FILES.P1, 'memory', false).then(function (out) {
        expect(out).to.equal('i1i1i1');
      });
    });
    it('P1 (no cache, async)', function () {
      return renderAsync(FILES.P1, false, false).then(function (out) {
        expect(out).to.equal('i1i1i1');
      });
    });
  });

  describe('N1 a cycle in an if branch in a loop', function () {
    it('N1 (memory cache, sync)', function () {
      expect(renderSync(FILES.N1, 'memory', false)).to.equal('aba');
    });
    it('N1 (no cache, sync)', function () {
      expect(renderSync(FILES.N1, false, false)).to.equal('aba');
    });
    it('N1 (memory cache, async)', function () {
      return renderAsync(FILES.N1, 'memory', false).then(function (out) {
        expect(out).to.equal('aba');
      });
    });
    it('N1 (no cache, async)', function () {
      return renderAsync(FILES.N1, false, false).then(function (out) {
        expect(out).to.equal('aba');
      });
    });
  });

  describe('N2 a cycle in an elif branch in a loop', function () {
    it('N2 (memory cache, sync)', function () {
      expect(renderSync(FILES.N2, 'memory', false)).to.equal('aba');
    });
    it('N2 (no cache, sync)', function () {
      expect(renderSync(FILES.N2, false, false)).to.equal('aba');
    });
    it('N2 (memory cache, async)', function () {
      return renderAsync(FILES.N2, 'memory', false).then(function (out) {
        expect(out).to.equal('aba');
      });
    });
    it('N2 (no cache, async)', function () {
      return renderAsync(FILES.N2, false, false).then(function (out) {
        expect(out).to.equal('aba');
      });
    });
  });

  describe('N3 a cycle in an else branch in a loop', function () {
    it('N3 (memory cache, sync)', function () {
      expect(renderSync(FILES.N3, 'memory', false)).to.equal('aba');
    });
    it('N3 (no cache, sync)', function () {
      expect(renderSync(FILES.N3, false, false)).to.equal('aba');
    });
    it('N3 (memory cache, async)', function () {
      return renderAsync(FILES.N3, 'memory', false).then(function (out) {
        expect(out).to.equal('aba');
      });
    });
    it('N3 (no cache, async)', function () {
      return renderAsync(FILES.N3, false, false).then(function (out) {
        expect(out).to.equal('aba');
      });
    });
  });

  describe('N4 a cycle in an empty branch in a loop', function () {
    it('N4 (memory cache, sync)', function () {
      expect(renderSync(FILES.N4, 'memory', false)).to.equal('aba');
    });
    it('N4 (no cache, sync)', function () {
      expect(renderSync(FILES.N4, false, false)).to.equal('aba');
    });
    it('N4 (memory cache, async)', function () {
      return renderAsync(FILES.N4, 'memory', false).then(function (out) {
        expect(out).to.equal('aba');
      });
    });
    it('N4 (no cache, async)', function () {
      return renderAsync(FILES.N4, false, false).then(function (out) {
        expect(out).to.equal('aba');
      });
    });
  });

  describe('N5 a cycle in an autoescape body in a loop', function () {
    it('N5 (memory cache, sync)', function () {
      expect(renderSync(FILES.N5, 'memory', false)).to.equal('<a><b><a>');
    });
    it('N5 (no cache, sync)', function () {
      expect(renderSync(FILES.N5, false, false)).to.equal('<a><b><a>');
    });
    it('N5 (memory cache, async)', function () {
      return renderAsync(FILES.N5, 'memory', false).then(function (out) {
        expect(out).to.equal('<a><b><a>');
      });
    });
    it('N5 (no cache, async)', function () {
      return renderAsync(FILES.N5, false, false).then(function (out) {
        expect(out).to.equal('<a><b><a>');
      });
    });
  });

  describe('N6 a cycle in a block of a template that extends nothing', function () {
    it('N6 (memory cache, sync)', function () {
      expect(renderSync(FILES.N6, 'memory', false)).to.equal('aba');
    });
    it('N6 (no cache, sync)', function () {
      expect(renderSync(FILES.N6, false, false)).to.equal('aba');
    });
    it('N6 (memory cache, async)', function () {
      return renderAsync(FILES.N6, 'memory', false).then(function (out) {
        expect(out).to.equal('aba');
      });
    });
    it('N6 (no cache, async)', function () {
      return renderAsync(FILES.N6, false, false).then(function (out) {
        expect(out).to.equal('aba');
      });
    });
  });

  describe('N7 a cycle in a loop in an if in a with body in a loop', function () {
    it('N7 (memory cache, sync)', function () {
      expect(renderSync(FILES.N7, 'memory', false)).to.equal('abcabc');
    });
    it('N7 (no cache, sync)', function () {
      expect(renderSync(FILES.N7, false, false)).to.equal('abcabc');
    });
    it('N7 (memory cache, async)', function () {
      return renderAsync(FILES.N7, 'memory', false).then(function (out) {
        expect(out).to.equal('abcabc');
      });
    });
    it('N7 (no cache, async)', function () {
      return renderAsync(FILES.N7, false, false).then(function (out) {
        expect(out).to.equal('abcabc');
      });
    });
  });

  describe('N8 a cycle outside the blocks of an extending template', function () {
    it('N8 (memory cache, sync)', function () {
      expect(renderSync(FILES.N8, 'memory', false)).to.equal('<k1k2>');
    });
    it('N8 (no cache, sync)', function () {
      expect(renderSync(FILES.N8, false, false)).to.equal('<k1k2>');
    });
    it('N8 (memory cache, async)', function () {
      return renderAsync(FILES.N8, 'memory', false).then(function (out) {
        expect(out).to.equal('<k1k2>');
      });
    });
    it('N8 (no cache, async)', function () {
      return renderAsync(FILES.N8, false, false).then(function (out) {
        expect(out).to.equal('<k1k2>');
      });
    });
  });

  describe('N9 a cycle in a parent block the child does not override', function () {
    it('N9 (memory cache, sync)', function () {
      expect(renderSync(FILES.N9, 'memory', false)).to.equal('<q1q2q1>');
    });
    it('N9 (no cache, sync)', function () {
      expect(renderSync(FILES.N9, false, false)).to.equal('<q1q2q1>');
    });
    it('N9 (memory cache, async)', function () {
      return renderAsync(FILES.N9, 'memory', false).then(function (out) {
        expect(out).to.equal('<q1q2q1>');
      });
    });
    it('N9 (no cache, async)', function () {
      return renderAsync(FILES.N9, false, false).then(function (out) {
        expect(out).to.equal('<q1q2q1>');
      });
    });
  });

  describe('N10 cycles in a child block and in a middle block of three templates', function () {
    it('N10 (memory cache, sync)', function () {
      expect(renderSync(FILES.N10, 'memory', false)).to.equal('<k1m1k2m2k1m1>');
    });
    it('N10 (no cache, sync)', function () {
      expect(renderSync(FILES.N10, false, false)).to.equal('<k1m1k2m2k1m1>');
    });
    it('N10 (memory cache, async)', function () {
      return renderAsync(FILES.N10, 'memory', false).then(function (out) {
        expect(out).to.equal('<k1m1k2m2k1m1>');
      });
    });
    it('N10 (no cache, async)', function () {
      return renderAsync(FILES.N10, false, false).then(function (out) {
        expect(out).to.equal('<k1m1k2m2k1m1>');
      });
    });
  });
});
