var expect = require('expect.js'),
  preWalker = require('../../lib/async/pre-walker');

var defaultControls = {
  varControls: ['{{', '}}'],
  tagControls: ['{%', '%}'],
  cmtControls: ['{#', '#}']
};

var nativeOpts = {
  varControls: defaultControls.varControls,
  tagControls: defaultControls.tagControls,
  cmtControls: defaultControls.cmtControls,
  rawTag: 'raw',
  keywords: ['extends', 'include', 'import']
};

var twigOpts = {
  varControls: defaultControls.varControls,
  tagControls: defaultControls.tagControls,
  cmtControls: defaultControls.cmtControls,
  rawTag: 'verbatim',
  keywords: ['extends', 'include', 'import', 'from']
};

function makeMockLoader(templates) {
  return {
    resolve: function (to, from) {
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

describe('lib/async/pre-walker', function () {
  describe('scan', function () {
    it('returns [] for empty source', function () {
      expect(preWalker.scan('', nativeOpts)).to.eql([]);
    });

    it('returns [] for plain text', function () {
      expect(preWalker.scan('Hello world!', nativeOpts)).to.eql([]);
    });

    it('extracts static extends with double quotes', function () {
      var out = preWalker.scan('{% extends "layout.html" %}', nativeOpts);
      expect(out).to.eql([{ kind: 'extends', path: 'layout.html' }]);
    });

    it('extracts static extends with single quotes', function () {
      var out = preWalker.scan("{% extends 'layout.html' %}", nativeOpts);
      expect(out).to.eql([{ kind: 'extends', path: 'layout.html' }]);
    });

    it('extracts include with trailing args', function () {
      var out = preWalker.scan('{% include "partial.html" with { foo: "bar" } %}', nativeOpts);
      expect(out).to.eql([{ kind: 'include', path: 'partial.html' }]);
    });

    it('extracts import with alias', function () {
      var out = preWalker.scan('{% import "macros.html" as m %}', nativeOpts);
      expect(out).to.eql([{ kind: 'import', path: 'macros.html' }]);
    });

    it('extracts Twig from-import (only the path, not the imported names)', function () {
      var out = preWalker.scan('{% from "macros.html" import foo, bar as baz %}', twigOpts);
      expect(out).to.eql([{ kind: 'from', path: 'macros.html' }]);
    });

    it('does not match `from` for native opts (keyword set excludes from)', function () {
      var out = preWalker.scan('{% from "macros.html" import foo %}', nativeOpts);
      expect(out).to.eql([]);
    });

    it('extracts multiple targets in one source', function () {
      var src = [
        '{% extends "layout.html" %}',
        '{% block body %}',
        '  {% include "partial.html" %}',
        '  {% import "macros.html" as m %}',
        '{% endblock %}'
      ].join('\n');
      var out = preWalker.scan(src, nativeOpts);
      expect(out).to.eql([
        { kind: 'extends', path: 'layout.html' },
        { kind: 'include', path: 'partial.html' },
        { kind: 'import', path: 'macros.html' }
      ]);
    });

    it('handles whitespace-control markers', function () {
      var out = preWalker.scan('{%- extends "layout.html" -%}', nativeOpts);
      expect(out).to.eql([{ kind: 'extends', path: 'layout.html' }]);
    });

    it('skips dynamic paths (no leading quote after keyword)', function () {
      var out = preWalker.scan('{% extends parent_var %}', nativeOpts);
      expect(out).to.eql([]);
    });

    it('skips content inside raw blocks', function () {
      var src = [
        '{% extends "layout.html" %}',
        '{% raw %}',
        '  {% include "should-not-load.html" %}',
        '{% endraw %}',
        '{% include "real.html" %}'
      ].join('\n');
      var out = preWalker.scan(src, nativeOpts);
      expect(out).to.eql([
        { kind: 'extends', path: 'layout.html' },
        { kind: 'include', path: 'real.html' }
      ]);
    });

    it('skips content inside Twig verbatim blocks', function () {
      var src = [
        '{% verbatim %}',
        '  {% include "fake.html" %}',
        '{% endverbatim %}',
        '{% include "real.html" %}'
      ].join('\n');
      var out = preWalker.scan(src, twigOpts);
      expect(out).to.eql([{ kind: 'include', path: 'real.html' }]);
    });

    it('skips comment chunks', function () {
      var src = '{# {% include "fake.html" %} #}{% include "real.html" %}';
      var out = preWalker.scan(src, nativeOpts);
      expect(out).to.eql([{ kind: 'include', path: 'real.html' }]);
    });

    it('does not match keywords inside other tag bodies', function () {
      var src = '{% set foo = "include \'fake.html\'" %}';
      var out = preWalker.scan(src, nativeOpts);
      expect(out).to.eql([]);
    });

    it('does not match keywords as substrings of identifiers', function () {
      var src = '{% extendsmenotreally %}';
      var out = preWalker.scan(src, nativeOpts);
      expect(out).to.eql([]);
    });

    it('honors custom controls', function () {
      var src = '<% extends "layout.html" %>';
      var out = preWalker.scan(src, {
        varControls: ['<%=', '%>'],
        tagControls: ['<%', '%>'],
        cmtControls: ['<#', '#>'],
        rawTag: 'raw',
        keywords: ['extends', 'include', 'import']
      });
      expect(out).to.eql([{ kind: 'extends', path: 'layout.html' }]);
    });

    it('normalizes CRLF before scanning', function () {
      var out = preWalker.scan('{% extends "layout.html" %}\r\n{% include "x.html" %}', nativeOpts);
      expect(out).to.eql([
        { kind: 'extends', path: 'layout.html' },
        { kind: 'include', path: 'x.html' }
      ]);
    });
  });

  describe('walk', function () {
    it('resolves a single template with no deps', function (done) {
      var loader = makeMockLoader({
        '/entry.html': 'Hello, {{ name }}!'
      });
      preWalker.walk('/entry.html', loader, nativeOpts).then(function (memMap) {
        expect(memMap).to.eql({
          '/entry.html': 'Hello, {{ name }}!'
        });
        done();
      }).catch(done);
    });

    it('walks a two-level extends chain', function (done) {
      var loader = makeMockLoader({
        '/page.html': '{% extends "layout.html" %}{% block body %}hi{% endblock %}',
        '/layout.html': '<!doctype html>{% block body %}{% endblock %}'
      });
      preWalker.walk('/page.html', loader, nativeOpts).then(function (memMap) {
        expect(Object.keys(memMap).sort()).to.eql(['/layout.html', '/page.html']);
        done();
      }).catch(done);
    });

    it('walks a three-level chain', function (done) {
      var loader = makeMockLoader({
        '/page.html': '{% extends "section.html" %}',
        '/section.html': '{% extends "layout.html" %}',
        '/layout.html': '<!doctype html>'
      });
      preWalker.walk('/page.html', loader, nativeOpts).then(function (memMap) {
        expect(Object.keys(memMap).sort()).to.eql([
          '/layout.html',
          '/page.html',
          '/section.html'
        ]);
        done();
      }).catch(done);
    });

    it('handles a diamond dep graph', function (done) {
      var loader = makeMockLoader({
        '/entry.html': '{% include "a.html" %}{% include "b.html" %}',
        '/a.html': '{% include "shared.html" %}',
        '/b.html': '{% include "shared.html" %}',
        '/shared.html': 'shared content'
      });
      preWalker.walk('/entry.html', loader, nativeOpts).then(function (memMap) {
        expect(Object.keys(memMap).sort()).to.eql([
          '/a.html',
          '/b.html',
          '/entry.html',
          '/shared.html'
        ]);
        done();
      }).catch(done);
    });

    it('tolerates cycles without infinite recursion', function (done) {
      var loader = makeMockLoader({
        '/a.html': '{% include "b.html" %}',
        '/b.html': '{% include "a.html" %}'
      });
      preWalker.walk('/a.html', loader, nativeOpts).then(function (memMap) {
        expect(Object.keys(memMap).sort()).to.eql(['/a.html', '/b.html']);
        done();
      }).catch(done);
    });

    it('rejects when loader.load yields an error', function (done) {
      var loader = makeMockLoader({
        '/entry.html': '{% include "missing.html" %}'
      });
      preWalker.walk('/entry.html', loader, nativeOpts).then(function () {
        done(new Error('expected rejection'));
      }, function (err) {
        expect(err.message).to.contain('Template not found: /missing.html');
        done();
      }).catch(done);
    });

    it('rejects when the entry path itself is missing', function (done) {
      var loader = makeMockLoader({});
      preWalker.walk('/never.html', loader, nativeOpts).then(function () {
        done(new Error('expected rejection'));
      }, function (err) {
        expect(err.message).to.contain('Template not found: /never.html');
        done();
      }).catch(done);
    });

    it('rejects when loader.load returns a non-string source', function (done) {
      var loader = {
        resolve: function (to) { return to; },
        load: function (id, cb) {
          Promise.resolve().then(function () { cb(null, undefined); });
        }
      };
      preWalker.walk('/entry.html', loader, nativeOpts).then(function () {
        done(new Error('expected rejection'));
      }, function (err) {
        expect(err.message).to.contain('non-string source');
        done();
      }).catch(done);
    });

    it('rejects when loader.resolve throws on a child path', function (done) {
      var loader = {
        resolve: function (to, from) {
          if (from && to.indexOf('boom') !== -1) {
            throw new Error('resolve refused: ' + to);
          }
          return '/' + to;
        },
        load: function (id, cb) {
          Promise.resolve().then(function () {
            if (id === '/entry.html') {
              cb(null, '{% include "boom.html" %}');
            } else {
              cb(new Error('unexpected: ' + id));
            }
          });
        }
      };
      preWalker.walk('/entry.html', loader, nativeOpts).then(function () {
        done(new Error('expected rejection'));
      }, function (err) {
        expect(err.message).to.contain('resolve refused');
        done();
      }).catch(done);
    });

    it('skips dynamic include paths (leaves them for sync render)', function (done) {
      var loader = makeMockLoader({
        '/entry.html': '{% include parent_var %}{% include "real.html" %}',
        '/real.html': 'real content'
      });
      preWalker.walk('/entry.html', loader, nativeOpts).then(function (memMap) {
        expect(Object.keys(memMap).sort()).to.eql(['/entry.html', '/real.html']);
        done();
      }).catch(done);
    });
  });

  describe('makeMemoryWrapper', function () {
    var userLoader = {
      resolve: function (to, from) {
        return '/' + to;
      },
      load: function () { throw new Error('user loader.load should not be called'); }
    };

    it('delegates resolve to the user loader', function () {
      var mem = preWalker.makeMemoryWrapper(userLoader, {});
      expect(mem.resolve('foo.html')).to.equal('/foo.html');
    });

    it('returns source synchronously for a present path', function () {
      var mem = preWalker.makeMemoryWrapper(userLoader, { '/foo.html': 'hi' });
      expect(mem.load('/foo.html')).to.equal('hi');
    });

    it('calls cb(null, source) asynchronously when cb is provided', function (done) {
      var mem = preWalker.makeMemoryWrapper(userLoader, { '/foo.html': 'hi' });
      mem.load('/foo.html', function (err, src) {
        expect(err).to.be(null);
        expect(src).to.equal('hi');
        done();
      });
    });

    it('throws synchronously for a missing path', function () {
      var mem = preWalker.makeMemoryWrapper(userLoader, {});
      expect(function () { mem.load('/nope.html'); })
        .to.throwException(/Pre-walked map missing path/);
    });

    it('calls cb(err) for a missing path when cb is provided', function (done) {
      var mem = preWalker.makeMemoryWrapper(userLoader, {});
      mem.load('/nope.html', function (err, src) {
        expect(err).to.be.an(Error);
        expect(err.message).to.contain('Pre-walked map missing path');
        expect(src).to.be(undefined);
        done();
      });
    });
  });
});
