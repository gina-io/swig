var expect = require('../../lib/expect.js'),
  twigModule = require('../../../packages/swig-twig');


/*!
 * Statement bodies on the async render path (renderFile(path, locals, cb)
 * with a loader that sets loader.async): an include, import or block inside
 * a for loop, an apply tag, a set block or a with renders as on the sync
 * path. A macro whose body holds one throws a clear error when called on the
 * async path, and a template that only defines it renders.
 */

var templates = {
  '/p.html': '{{ x }}',
  '/m.html': '{% macro hi() %}H{% endmacro %}'
};

function render(src, cb) {
  var files = {}, k, mem, sync, asyncLoader;
  for (k in templates) {
    if (templates.hasOwnProperty(k)) {
      files[k] = templates[k];
    }
  }
  files['/t.html'] = src;
  mem = twigModule.loaders.memory(files, '/');
  try {
    sync = new twigModule.Twig({ loader: mem, cache: false }).renderFile('/t.html', locals());
  } catch (e) {
    sync = e;
  }
  asyncLoader = {
    async: true,
    resolve: mem.resolve,
    load: function (id, done) {
      setTimeout(function () {
        var out;
        try {
          out = mem.load(id);
        } catch (e) {
          return done(e);
        }
        done(null, out);
      }, 1);
    }
  };
  new twigModule.Twig({ loader: asyncLoader, cache: false }).renderFile('/t.html', locals(), function (err, out) {
    cb(sync, err, out);
  });
}

function locals() {
  return { xs: [1, 2], ys: ['p', 'q'], x: 'T', empty: [] };
}

describe('twig async render path — statement bodies', function () {

  var cases = [
    ['an include in a for loop', '{% for x in xs %}[{% include "p.html" %}]{% endfor %}', '[1][2]'],
    ['nested loops', '{% for a in xs %}{% for x in ys %}[{% include "p.html" %}]{% endfor %}{% endfor %}', '[p][q][p][q]'],
    ['the loop names, seen by the include and restored after the loop', '{% for x in xs %}{{ loop.index }}:{% include "p.html" %}{% if loop.last %}!{% endif %} {% endfor %}{{ x }}', '1:1 2:2! T'],
    ['an include in an apply tag', '{% apply upper %}[{% include "p.html" %}]{% endapply %}', '[T]'],
    ['an include in a set block', '{% set s %}[{% include "p.html" %}]{% endset %}{{ s }}', '[T]'],
    ['an include in a with', '{% with %}[{% include "p.html" %}]{% endwith %}', '[T]'],
    ['a with in a loop', '{% for x in xs %}{% with %}<{% include "p.html" %}>{% endwith %}{% endfor %}', '<1><2>'],
    ['a block in a loop', '{% for x in xs %}{% block c %}[{{ x }}]{% endblock %}{% endfor %}', '[1][2]'],
    ['a macro holding a from, defined and not called', '{% macro m() %}{% from "m.html" import hi %}{{ hi() }}{% endmacro %}ok', 'ok']
  ];

  cases.forEach(function (c) {
    it('renders ' + c[0] + ' as the sync path does', function (done) {
      render(c[1], function (sync, err, out) {
        expect(sync).to.equal(c[2]);
        if (err) {
          return done(err);
        }
        expect(out).to.equal(c[2]);
        done();
      });
    });
  });

  it('runs a from in a for loop on each item', function (done) {
    // The sync path discards the loop's output here: its from emit declares a
    // local _output (tracked separately).
    render('{% for x in xs %}{% from "m.html" import hi %}{{ hi() }}{% endfor %}', function (sync, err, out) {
      if (err) {
        return done(err);
      }
      expect(out).to.equal('HH');
      done();
    });
  });

  it('throws a clear error when a macro holding an include is called', function (done) {
    render('{% macro m() %}[{% include "p.html" %}]{% endmacro %}{{ m() }}', function (sync, err) {
      expect(sync).to.equal('[T]');
      expect(err).to.be.an(Error);
      expect(err.message).to.equal('The macro "m" in /t.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro.');
      done();
    });
  });
});
