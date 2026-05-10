var expect = require('expect.js'),
  preWalker = require('../../../packages/swig-twig/lib/async/pre-walker');

var twigOpts = {
  varControls: ['{{', '}}'],
  tagControls: ['{%', '%}'],
  cmtControls: ['{#', '#}'],
  rawTag: 'verbatim',
  keywords: ['extends', 'include', 'import', 'from']
};

function makeMockLoader(templates) {
  return {
    resolve: function (to) {
      if (to.charAt(0) === '/') {
        return to;
      }
      return '/' + to;
    },
    load: function (id, cb) {
      Promise.resolve().then(function () {
        if (templates.hasOwnProperty(id)) {
          cb(null, templates[id]);
        } else {
          cb(new Error('Template not found: ' + id));
        }
      });
    }
  };
}

describe('packages/swig-twig/lib/async/pre-walker', function () {
  describe('scan', function () {
    it('returns [] for empty source', function () {
      expect(preWalker.scan('', twigOpts)).to.eql([]);
    });

    it('extracts extends with single quotes', function () {
      var out = preWalker.scan("{% extends 'layout.twig' %}", twigOpts);
      expect(out).to.eql([{ kind: 'extends', path: 'layout.twig' }]);
    });

    it('extracts include', function () {
      var out = preWalker.scan('{% include "partial.twig" %}', twigOpts);
      expect(out).to.eql([{ kind: 'include', path: 'partial.twig' }]);
    });

    it('extracts import with alias', function () {
      var out = preWalker.scan('{% import "macros.twig" as m %}', twigOpts);
      expect(out).to.eql([{ kind: 'import', path: 'macros.twig' }]);
    });

    it('extracts from-import (path only, ignores imported names)', function () {
      var out = preWalker.scan('{% from "macros.twig" import foo, bar as baz %}', twigOpts);
      expect(out).to.eql([{ kind: 'from', path: 'macros.twig' }]);
    });

    it('extracts multiple targets in one source', function () {
      var src = [
        '{% extends "layout.twig" %}',
        '{% from "macros.twig" import greet %}',
        '{% block body %}',
        '  {% include "partial.twig" %}',
        '{% endblock %}'
      ].join('\n');
      var out = preWalker.scan(src, twigOpts);
      expect(out).to.eql([
        { kind: 'extends', path: 'layout.twig' },
        { kind: 'from', path: 'macros.twig' },
        { kind: 'include', path: 'partial.twig' }
      ]);
    });

    it('skips content inside verbatim blocks', function () {
      var src = [
        '{% verbatim %}',
        '  {% include "fake.twig" %}',
        '{% endverbatim %}',
        '{% include "real.twig" %}'
      ].join('\n');
      var out = preWalker.scan(src, twigOpts);
      expect(out).to.eql([{ kind: 'include', path: 'real.twig' }]);
    });

    it('handles whitespace-control markers', function () {
      var out = preWalker.scan('{%- extends "layout.twig" -%}', twigOpts);
      expect(out).to.eql([{ kind: 'extends', path: 'layout.twig' }]);
    });

    it('skips dynamic paths', function () {
      var out = preWalker.scan('{% extends parent_var %}', twigOpts);
      expect(out).to.eql([]);
    });

    it('skips comments', function () {
      var src = '{# {% include "fake.twig" %} #}{% include "real.twig" %}';
      var out = preWalker.scan(src, twigOpts);
      expect(out).to.eql([{ kind: 'include', path: 'real.twig' }]);
    });

    it('honors custom controls', function () {
      var src = '<% extends "layout.twig" %>';
      var out = preWalker.scan(src, {
        varControls: ['<%=', '%>'],
        tagControls: ['<%', '%>'],
        cmtControls: ['<#', '#>'],
        rawTag: 'verbatim',
        keywords: ['extends', 'include', 'import', 'from']
      });
      expect(out).to.eql([{ kind: 'extends', path: 'layout.twig' }]);
    });
  });

  describe('walk', function () {
    it('walks a two-level extends chain', function (done) {
      var loader = makeMockLoader({
        '/page.twig': '{% extends "layout.twig" %}{% block body %}hi{% endblock %}',
        '/layout.twig': '<doc>{% block body %}{% endblock %}</doc>'
      });
      preWalker.walk('/page.twig', loader, twigOpts).then(function (memMap) {
        expect(Object.keys(memMap).sort()).to.eql(['/layout.twig', '/page.twig']);
        done();
      }).catch(done);
    });

    it('walks from-import dependencies', function (done) {
      var loader = makeMockLoader({
        '/entry.twig': '{% from "macros.twig" import greet %}',
        '/macros.twig': '{% macro greet() %}hi{% endmacro %}'
      });
      preWalker.walk('/entry.twig', loader, twigOpts).then(function (memMap) {
        expect(Object.keys(memMap).sort()).to.eql(['/entry.twig', '/macros.twig']);
        done();
      }).catch(done);
    });

    it('handles a diamond dep graph', function (done) {
      var loader = makeMockLoader({
        '/entry.twig': '{% include "a.twig" %}{% include "b.twig" %}',
        '/a.twig': '{% include "shared.twig" %}',
        '/b.twig': '{% include "shared.twig" %}',
        '/shared.twig': 'shared'
      });
      preWalker.walk('/entry.twig', loader, twigOpts).then(function (memMap) {
        expect(Object.keys(memMap).sort()).to.eql([
          '/a.twig',
          '/b.twig',
          '/entry.twig',
          '/shared.twig'
        ]);
        done();
      }).catch(done);
    });

    it('tolerates cycles', function (done) {
      var loader = makeMockLoader({
        '/a.twig': '{% include "b.twig" %}',
        '/b.twig': '{% include "a.twig" %}'
      });
      preWalker.walk('/a.twig', loader, twigOpts).then(function (memMap) {
        expect(Object.keys(memMap).sort()).to.eql(['/a.twig', '/b.twig']);
        done();
      }).catch(done);
    });

    it('rejects when loader.load yields an error', function (done) {
      var loader = makeMockLoader({
        '/entry.twig': '{% include "missing.twig" %}'
      });
      preWalker.walk('/entry.twig', loader, twigOpts).then(function () {
        done(new Error('expected rejection'));
      }, function (err) {
        expect(err.message).to.contain('Template not found: /missing.twig');
        done();
      }).catch(done);
    });
  });

  describe('makeMemoryWrapper', function () {
    var userLoader = {
      resolve: function (to) { return '/' + to; },
      load: function () { throw new Error('user loader.load should not be called'); }
    };

    it('returns source synchronously for a present path', function () {
      var mem = preWalker.makeMemoryWrapper(userLoader, { '/foo.twig': 'hi' });
      expect(mem.load('/foo.twig')).to.equal('hi');
    });

    it('calls cb(null, source) when cb is provided', function (done) {
      var mem = preWalker.makeMemoryWrapper(userLoader, { '/foo.twig': 'hi' });
      mem.load('/foo.twig', function (err, src) {
        expect(err).to.be(null);
        expect(src).to.equal('hi');
        done();
      });
    });

    it('throws synchronously for a missing path', function () {
      var mem = preWalker.makeMemoryWrapper(userLoader, {});
      expect(function () { mem.load('/nope.twig'); })
        .to.throwException(/Pre-walked map missing path/);
    });
  });
});
