var swigModule = require('../../lib/swig'),
  twigModule = require('@rhinostone/swig-twig'),
  jinja2Module = require('@rhinostone/swig-jinja2'),
  djangoModule = require('@rhinostone/swig-django'),
  expect = require('../lib/expect.js');

/*!
 * With the default memory cache, a template compiled on its own (compileFile,
 * a direct render, an include of it) is cached with its parse tree, and a page
 * that extends it used that cached tree as its parent. The block remap rewrites
 * the parent tree it walks, so the first page that overrode a block nested in
 * another block (or inside an if or a for loop) put its block into the cached
 * tree, and every page compiled later that did not override it rendered that
 * block. getParents now remaps a copy of a cached parent tree, named after its
 * file.
 */

var flavors = [
  ['native', swigModule],
  ['twig', twigModule],
  ['jinja2', jinja2Module],
  ['django', djangoModule]
];

var files = {
  '/layout.html': '<{% block outer %}O[{% block inner %}I{% endblock %}]{% endblock %}>',
  '/admin.html': '{% extends "layout.html" %}{% block inner %}ADMIN{% endblock %}',
  '/plain.html': '{% extends "layout.html" %}',
  '/shell.html': 'S{% include "layout.html" %}',
  '/iflayout.html': '<{% if show %}[{% block side %}S{% endblock %}]{% endif %}>',
  '/ifadmin.html': '{% extends "iflayout.html" %}{% block side %}ADMIN{% endblock %}',
  '/ifplain.html': '{% extends "iflayout.html" %}',
  '/forlayout.html': '<{% for i in xs %}[{% block item %}F{% endblock %}]{% endfor %}>',
  '/foradmin.html': '{% extends "forlayout.html" %}{% block item %}ADMIN{% endblock %}',
  '/forplain.html': '{% extends "forlayout.html" %}',
  '/base.html': '<{% block body %}B{% endblock %}>',
  '/section.html': '{% extends "base.html" %}{% block body %}SEC[{% block content %}C{% endblock %}]{% endblock %}',
  '/pagea.html': '{% extends "section.html" %}{% block content %}PAGE-A{% endblock %}',
  '/pageb.html': '{% extends "section.html" %}'
};

flavors.forEach(function (flavor) {
  var lib = flavor[1],
    Ctor = lib[{ native: 'Swig', twig: 'Twig', jinja2: 'Jinja2', django: 'Django' }[flavor[0]]];

  function instance(cache) {
    return new Ctor({ loader: lib.loaders.memory(files, '/'), cache: cache === undefined ? 'memory' : cache });
  }

  function pages(s) {
    return [s.renderFile('/admin.html', {}), s.renderFile('/plain.html', {}), s.renderFile('/plain.html', {})];
  }

  describe(flavor[0] + ' — compile cache and the parents of a page', function () {
    it('keeps a nested block override to its page when the layout was compiled first', function () {
      var s = instance();
      s.compileFile('/layout.html');
      expect(pages(s)).to.eql(['<O[ADMIN]>', '<O[I]>', '<O[I]>']);
    });

    it('keeps a nested block override to its page when the layout was rendered first', function () {
      var s = instance();
      expect(s.renderFile('/layout.html', {})).to.equal('<O[I]>');
      expect(pages(s)).to.eql(['<O[ADMIN]>', '<O[I]>', '<O[I]>']);
    });

    it('keeps a nested block override to its page when the layout was included first', function () {
      var s = instance();
      expect(s.renderFile('/shell.html', {})).to.equal('S<O[I]>');
      expect(pages(s)).to.eql(['<O[ADMIN]>', '<O[I]>', '<O[I]>']);
    });

    it('keeps an override of a block inside an if to its page', function () {
      var s = instance();
      s.compileFile('/iflayout.html');
      expect(s.renderFile('/ifadmin.html', { show: true })).to.equal('<[ADMIN]>');
      expect(s.renderFile('/ifplain.html', { show: true })).to.equal('<[S]>');
    });

    it('keeps an override of a block inside a for loop to its page', function () {
      var s = instance();
      s.compileFile('/forlayout.html');
      expect(s.renderFile('/foradmin.html', { xs: [1] })).to.equal('<[ADMIN]>');
      expect(s.renderFile('/forplain.html', { xs: [1] })).to.equal('<[F]>');
    });

    it('keeps an override to its page when the middle template of three levels was rendered first', function () {
      var s = instance();
      expect(s.renderFile('/section.html', {})).to.equal('<SEC[C]>');
      expect(s.renderFile('/pagea.html', {})).to.equal('<SEC[PAGE-A]>');
      expect(s.renderFile('/pageb.html', {})).to.equal('<SEC[C]>');
    });

    it('renders the same pages with the cache disabled', function () {
      var s = instance(false);
      s.compileFile('/layout.html');
      expect(pages(s)).to.eql(['<O[ADMIN]>', '<O[I]>', '<O[I]>']);
    });
  });
});

describe('native — {% parent %} in a middle template that is in the compile cache', function () {
  var parentFiles = {
    '/base.html': '{% block content %}B{% endblock %}',
    '/mid.html': '{% extends "base.html" %}{% block content %}[{% parent %}]M{% endblock %}',
    '/leaf.html': '{% extends "mid.html" %}'
  };

  function instance() {
    return new swigModule.Swig({ loader: swigModule.loaders.memory(parentFiles, '/') });
  }

  it('renders the middle template\'s block once when that template was rendered first', function () {
    var s = instance();
    expect(s.renderFile('/mid.html', {})).to.equal('[B]M');
    expect(s.renderFile('/leaf.html', {})).to.equal('[B]M');
  });

  it('renders the middle template\'s block once when that template was compiled first', function () {
    var s = instance();
    s.compileFile('/mid.html');
    expect(s.renderFile('/leaf.html', {})).to.equal('[B]M');
  });
});
