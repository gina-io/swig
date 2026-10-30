var expect = require('../lib/expect.js'),
  swigModule = require('../../lib/swig');


/*!
 * {% parent %} on the async render path (renderFile(path, locals, cb) with a
 * loader that sets loader.async): the parent template loads at render time,
 * and each block receives the version of the template above as the block
 * that {% parent %} renders. The values where native sync differs are the
 * ones Jinja2 3.1.6 renders for super().
 */

function render(files, locals, cb) {
  var mem = swigModule.loaders.memory(files, '/'), sync, asyncLoader;
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
  return { xs: [1, 2], o: { a: 1 }, h: '<i>', layout: 'base.html' };
}

var simple = '<{% block b %}P{% endblock %}>',
  nested = '<{% block outer %}O[{% block inner %}I{% endblock %}]{% endblock %}>';

describe('async render path — {% parent %} (native)', function () {

  var sameAsSync = [
    ['a child block calling parent', { '/base.html': simple, '/t.html': '{% extends "base.html" %}{% block b %}X{% parent %}{% endblock %}' }, '<XP>'],
    ['three levels, each calling parent', { '/a.html': '<{% block b %}G{% endblock %}>', '/m.html': '{% extends "a.html" %}{% block b %}M{% parent %}{% endblock %}', '/t.html': '{% extends "m.html" %}{% block b %}C{% parent %}{% endblock %}' }, '<CMG>'],
    ['a middle level calling parent under a child that overrides nothing', { '/a.html': '<{% block b %}G{% endblock %}>', '/m.html': '{% extends "a.html" %}{% block b %}M{% parent %}{% endblock %}', '/t.html': '{% extends "m.html" %}' }, '<MG>'],
    ['four levels, each calling parent', { '/a.html': '<{% block b %}A{% endblock %}>', '/b.html': '{% extends "a.html" %}{% block b %}B{% parent %}{% endblock %}', '/c.html': '{% extends "b.html" %}{% block b %}C{% parent %}{% endblock %}', '/t.html': '{% extends "c.html" %}{% block b %}D{% parent %}{% endblock %}' }, '<DCBA>'],
    ['a middle level without the block', { '/a.html': '<{% block b %}A{% endblock %}>', '/b.html': '{% extends "a.html" %}{% block other %}{% endblock %}', '/t.html': '{% extends "b.html" %}{% block b %}T{% parent %}{% endblock %}' }, '<TA>'],
    ['parent called twice', { '/base.html': simple, '/t.html': '{% extends "base.html" %}{% block b %}{% parent %}-{% parent %}{% endblock %}' }, '<P-P>'],
    ['parent inside a for loop', { '/base.html': simple, '/t.html': '{% extends "base.html" %}{% block b %}{% for x in xs %}{{ x }}{% parent %}{% endfor %}{% endblock %}' }, '<1P2P>'],
    ['parent inside a loop over an object', { '/base.html': simple, '/t.html': '{% extends "base.html" %}{% block b %}{% for k, v in o %}{{ k }}{% parent %}{% endfor %}{% endblock %}' }, '<aP>'],
    ['parent inside an if', { '/base.html': simple, '/t.html': '{% extends "base.html" %}{% block b %}{% if true %}X{% parent %}{% endif %}{% endblock %}' }, '<XP>'],
    ['parent inside a filter tag', { '/base.html': '<{% block b %}p{% endblock %}>', '/t.html': '{% extends "base.html" %}{% block b %}{% filter upper %}x{% parent %}{% endfilter %}{% endblock %}' }, '<XP>'],
    ['parent inside spaceless', { '/base.html': '<{% block b %}<b>p</b>{% endblock %}>', '/t.html': '{% extends "base.html" %}{% block b %}{% spaceless %}<i> {% parent %} </i>{% endspaceless %}{% endblock %}' }, '<<i><b>p</b></i>>'],
    ['parent inside autoescape, escaped as its own template says', { '/base.html': '<{% block b %}{{ h }}{% endblock %}>', '/t.html': '{% extends "base.html" %}{% block b %}{% autoescape false %}{% parent %}{% endautoescape %}{% endblock %}' }, '<&lt;i&gt;>'],
    ['a parent block that holds a set', { '/base.html': '<{% block b %}{% set s = "S" %}P{% endblock %}>{{ s }}', '/t.html': '{% extends "base.html" %}{% block b %}X{% parent %}{{ s }}{% endblock %}' }, '<XPS>S'],
    ['a parent block that includes a partial', { '/base.html': '<{% block b %}p{% include "i.html" %}{% endblock %}>', '/i.html': 'I{{ h }}', '/t.html': '{% extends "base.html" %}{% block b %}X{% parent %}{% include "i.html" %}{% endblock %}' }, '<XpI&lt;i&gt;I&lt;i&gt;>'],
    ['parent in an override of an outer block', { '/base.html': nested, '/t.html': '{% extends "base.html" %}{% block outer %}X{% parent %}{% endblock %}' }, '<XO[I]>'],
    ['an orphan block calling parent', { '/base.html': simple, '/t.html': '{% extends "base.html" %}{% block zz %}Z{% parent %}{% endblock %}{% block b %}X{% endblock %}' }, '<X>'],
    ['parent outside any block of a child', { '/base.html': simple, '/t.html': '{% extends "base.html" %}{% parent %}{% block b %}X{% endblock %}' }, '<X>'],
    ['parent in a template that extends nothing', { '/t.html': '<{% block b %}R{% parent %}{% endblock %}>' }, '<R>']
  ];

  sameAsSync.forEach(function (c) {
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

  // Nested shapes: the async path renders what Jinja2 3.1.6 renders (the sync
  // path does too: tests/tags/nested-blocks.test.js).
  var asJinja2 = [
    ['an inner override calling parent', { '/base.html': nested, '/t.html': '{% extends "base.html" %}{% block inner %}C{% parent %}{% endblock %}' }, '<O[CI]>'],
    ['outer and inner overrides both calling parent', { '/base.html': nested, '/t.html': '{% extends "base.html" %}{% block outer %}X{% parent %}{% endblock %}{% block inner %}C{% parent %}{% endblock %}' }, '<XO[CI]>'],
    ['a middle inner override under a child outer override', { '/base.html': nested, '/m.html': '{% extends "base.html" %}{% block inner %}M{% parent %}{% endblock %}', '/t.html': '{% extends "m.html" %}{% block outer %}X{% parent %}{% endblock %}' }, '<XO[MI]>'],
    ['a child inner override under a middle outer override', { '/base.html': nested, '/m.html': '{% extends "base.html" %}{% block outer %}Y[{% block inner %}C{% endblock %}]{% endblock %}', '/t.html': '{% extends "m.html" %}{% block inner %}G{% parent %}{% endblock %}' }, '<Y[GC]>']
  ];

  asJinja2.forEach(function (c) {
    it('renders ' + c[0] + ' as Jinja2 renders super()', function (done) {
      render(c[1], locals, function (sync, err, out) {
        if (err) {
          return done(err);
        }
        expect(out).to.equal(c[2]);
        done();
      });
    });
  });

  it('renders parent under a dynamic extends', function (done) {
    render({ '/base.html': simple, '/t.html': '{% extends layout %}{% block b %}X{% parent %}{% endblock %}' }, locals, function (sync, err, out) {
      expect(sync).to.be.an(Error);
      if (err) {
        return done(err);
      }
      expect(out).to.equal('<XP>');
      done();
    });
  });

  it('keeps each concurrent render to its own blocks', function (done) {
    var files = { '/base.html': '<{% block b %}{{ v }}{% endblock %}>', '/t.html': '{% extends "base.html" %}{% block b %}[{% parent %}]{% endblock %}' },
      mem = swigModule.loaders.memory(files, '/'),
      left = 2,
      outs = {},
      engine = new swigModule.Swig({ cache: false, loader: { async: true, resolve: mem.resolve, load: function (id, cb) {
        setTimeout(function () { cb(null, mem.load(id)); }, id === '/base.html' ? 5 : 1);
      } } });
    [1, 2].forEach(function (v) {
      engine.renderFile('/t.html', { v: v }, function (err, out) {
        if (err) {
          return done(err);
        }
        outs[v] = out;
        left -= 1;
        if (!left) {
          expect(outs[1]).to.equal('<[1]>');
          expect(outs[2]).to.equal('<[2]>');
          done();
        }
      });
    });
  });

  it('throws a clear error naming parent when a macro calling it is called', function (done) {
    render({ '/base.html': '<{% block b %}p{% endblock %}>', '/t.html': '{% extends "base.html" %}{% block b %}{% macro m() %}M{% parent %}{% endmacro %}{{ m() }}{% endblock %}' }, locals, function (sync, err) {
      expect(sync).to.equal('<Mp>');
      expect(err).to.be.an(Error);
      expect(err.message).to.equal('The macro "m" in /t.html holds an {% include %}, {% import %}, {% from %}, {% block %} or {% parent %}, which the async render path does not support inside a macro.');
      done();
    });
  });

  it('renders a block whose macro calls parent when the macro is not called', function (done) {
    render({ '/base.html': '<{% block b %}p{% endblock %}>', '/t.html': '{% extends "base.html" %}{% block b %}{% macro m() %}M{% parent %}{% endmacro %}X{% endblock %}' }, locals, function (sync, err, out) {
      expect(sync).to.equal('<X>');
      if (err) {
        return done(err);
      }
      expect(out).to.equal('<X>');
      done();
    });
  });

  it('keeps the sync emit of parent', function () {
    var files = { '/base.html': simple },
      engine = new swigModule.Swig({ loader: swigModule.loaders.memory(files, '/') }),
      body = engine.precompile('{% extends "base.html" %}{% block b %}X{% parent %}{% endblock %}', { filename: '/t.html' }).tpl.toString();
    expect(body).to.contain('_output += "P";');
    expect(body).to.not.contain('_parentBlock');
    expect(body).to.not.contain('await');
  });
});
