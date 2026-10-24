var expect = require('../lib/expect.js'),
  swigModule = require('../../lib/swig');


/*!
 * Statement bodies on the async render path (renderFile(path, locals, cb)
 * with a loader that sets loader.async): an include, import or block inside
 * a for loop or a filter tag renders as on the sync path. A macro whose body
 * holds one throws a clear error when called on the async path, and a
 * template that only defines it renders.
 */

var templates = {
  '/p.html': '{{ x }}',
  '/v.html': '{{ v }}',
  '/c.html': '{{ c }}',
  '/m.html': '{% macro hi() %}H{% endmacro %}',
  '/mi.html': '{% macro plain() %}P{% endmacro %}{% macro inc() %}[{% include "p.html" %}]{% endmacro %}',
  '/base.html': '<{% block b %}{% endblock %}>'
};

function render(src, locals, cb) {
  var files = {}, k, mem, sync, asyncLoader;
  for (k in templates) {
    if (templates.hasOwnProperty(k)) {
      files[k] = templates[k];
    }
  }
  files['/t.html'] = src;
  mem = swigModule.loaders.memory(files, '/');
  try {
    sync = new swigModule.Swig({ loader: mem, cache: false }).renderFile('/t.html', locals());
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
  new swigModule.Swig({ loader: asyncLoader, cache: false }).renderFile('/t.html', locals(), function (err, out) {
    cb(sync, err, out);
  });
}

function locals() {
  return { xs: [1, 2], ys: ['p', 'q'], x: 'T', obj: { a: 1, b: 2 } };
}

describe('async render path — statement bodies (native)', function () {

  var cases = [
    ['an include in a for loop', '{% for x in xs %}[{% include "p.html" %}]{% endfor %}', '[1][2]'],
    ['an include in a loop over an object', '{% for k, v in obj %}{{ k }}={% include "v.html" %};{% endfor %}', 'a=1;b=2;'],
    ['an include in a loop over a string', '{% for c in "ab" %}<{% include "c.html" %}>{% endfor %}', '<a><b>'],
    ['the loop names, seen by the include and restored after the loop', '{% for x in xs %}{{ loop.index }}:{% include "p.html" %}{% if loop.last %}!{% endif %} {% endfor %}{{ x }}', '1:1 2:2! T'],
    ['nested loops', '{% for a in xs %}{% for x in ys %}[{% include "p.html" %}]{% endfor %}{% endfor %}', '[p][q][p][q]'],
    ['a missing iterable', '{% for x in nothing %}[{% include "p.html" %}]{% endfor %}.', '.'],
    ['an include ignore missing in a loop', '{% for x in xs %}[{% include "nope.html" ignore missing %}]{% endfor %}', '[][]'],
    ['a block in a loop', '{% for x in xs %}{% block c %}[{{ x }}]{% endblock %}{% endfor %}', '[1][2]'],
    ['an include in a filter tag', '{% filter upper %}[{% include "p.html" %}]{% endfilter %}', '[T]'],
    ['a filter tag in a loop', '{% for x in xs %}{% filter upper %}<{% include "c.html" %}>{% endfilter %}{% endfor %}', '<><>'],
    ['a loop in a block of an extends child', '{% extends "base.html" %}{% block b %}{% for x in xs %}[{% include "p.html" %}]{% endfor %}{% endblock %}', '<[1][2]>'],
    ['a loop whose text holds the word await', '{% for x in xs %}await {{ x }};{% endfor %}', 'await 1;await 2;'],
    ['a macro holding an include, defined and not called', '{% macro m() %}[{% include "p.html" %}]{% endmacro %}ok', 'ok']
  ];

  cases.forEach(function (c) {
    it('renders ' + c[0] + ' as the sync path does', function (done) {
      render(c[1], locals, function (sync, err, out) {
        expect(sync).to.equal(c[2]);
        if (err) {
          return done(err);
        }
        expect(out).to.equal(c[2]);
        done();
      });
    });
  });

  it('runs an import in a for loop on each item', function (done) {
    render('{% for x in xs %}{% import "m.html" as mm %}{{ mm.hi() }}{% endfor %}', locals, function (sync, err, out) {
      if (err) {
        return done(err);
      }
      expect(sync).to.equal('HH');
      expect(out).to.equal('HH');
      done();
    });
  });

  it('rejects an include that fails inside a loop', function (done) {
    render('{% for x in xs %}{% include "nope.html" %}{% endfor %}', locals, function (sync, err) {
      expect(sync).to.be.an(Error);
      expect(err).to.be.an(Error);
      expect(err.message).to.match(/nope\.html/);
      done();
    });
  });

  it('throws a clear error when a macro holding an include is called', function (done) {
    render('{% macro m() %}[{% include "p.html" %}]{% endmacro %}{{ m() }}', locals, function (sync, err) {
      expect(sync).to.equal('[T]');
      expect(err).to.be.an(Error);
      expect(err.message).to.equal('The macro "m" in /t.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro.');
      done();
    });
  });

  it('throws that error from an imported macro only when it is called', function (done) {
    render('{% import "mi.html" as mm %}{{ mm.plain() }}', locals, function (sync, err, out) {
      expect(sync).to.equal('P');
      if (err) {
        return done(err);
      }
      expect(out).to.equal('P');
      render('{% import "mi.html" as mm %}{{ mm.inc() }}', locals, function (sync2, err2) {
        expect(sync2).to.equal('[T]');
        expect(err2).to.be.an(Error);
        expect(err2.message).to.match(/^The macro "inc" in \/mi\.html holds an \{% include %\}/);
        done();
      });
    });
  });

  it('keeps the plain loop emit when the body holds no await', function () {
    var engine = new swigModule.Swig(),
      body = engine.precompile('{% for x in xs %}[{{ x }}]{% endfor %}', { codegenMode: 'async' }).tpl.toString();
    expect(body).to.contain('_utils.each(__l, function (x, __k) {');
    expect(body).to.not.contain('eachAsync');
    expect(body).to.not.contain('async function (');
  });

  it('keeps the sync emit of a loop holding an include', function () {
    var engine = new swigModule.Swig({ loader: swigModule.loaders.memory(templates, '/') }),
      body = engine.precompile('{% for x in xs %}[{% include "p.html" %}]{% endfor %}', { filename: '/t.html' }).tpl.toString();
    expect(body).to.contain('_utils.each(__l, function (x, __k) {');
    expect(body).to.not.contain('await');
  });
});
