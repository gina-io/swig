var swig = require('../lib/swig'),
  expect = require('./lib/expect.js'),
  path = require('path'),
  fs = require('fs'),
  efn = function () {};


describe('swig.loaders', function () {

  describe('API', function () {
    it('requires load and resolve methods', function () {
      expect(function () {
        swig.setDefaults({ loader: 'foobar' });
      }).to.throwError(/Invalid loader option "foobar" found\..*/);

      expect(function () {
        swig.setDefaults({ loader: { load: efn } });
      }).to.throwError(/Invalid loader option \{\} found\..*/);

      expect(function () {
        swig.setDefaults({ loader: { resolve: efn } });
      }).to.throwError(/Invalid loader option \{\} found\..*/);
    });
  });

  describe('Memory', function () {
    it('rejects a climbing path when a basepath is set', function () {
      var loader = swig.loaders.memory({}, '/views');

      expect(function () {
        loader.resolve('../secret.html', '/views/page.html');
      }).to.throwError(/resolves outside the loader root/);

      expect(function () {
        loader.resolve('../../etc/passwd', '/views/page.html');
      }).to.throwError(/resolves outside the loader root/);

      // A root basepath is the case that used to clamp silently and return a
      // different template rather than escaping.
      expect(function () {
        swig.loaders.memory({}, '/').resolve('../shared/foot.html', '/sub/dir/page.html');
      }).to.throwError(/resolves outside the loader root/);
    });

    it('still resolves in-root paths when a basepath is set', function () {
      var loader = swig.loaders.memory({}, '/views');

      expect(loader.resolve('page.html')).to.equal(path.resolve('/views/page.html'));
      expect(loader.resolve('/page.html')).to.equal(path.resolve('/page.html'));
      expect(loader.resolve('partials/nav.html')).to.equal(path.resolve('/views/partials/nav.html'));
      // Interior climbs that stay inside the root remain legal.
      expect(loader.resolve('partials/../page.html')).to.equal(path.resolve('/views/page.html'));
    });

    it('leaves relative resolution alone with no basepath', function () {
      var loader = swig.loaders.memory({});

      expect(loader.resolve('../shared/foot.html', '/sub/dir/page.html'))
        .to.equal(path.resolve('/sub/shared/foot.html'));
    });

    it('can use extends', function () {
      var templates, html, s;

      templates = {
        'page.html': '{% extends "layout.html" %}{% block content %}Hello {{ name }}!{% endblock %}'
      };
      templates[path.sep + 'layout.html'] = '<html>{% block content %}{% endblock %}</html>';

      s = new swig.Swig({ loader: swig.loaders.memory(templates) });
      html = s.renderFile('page.html', {name: 'world'});
      expect(html).to.equal('<html>Hello world!</html>');
    });

    it('can use include', function () {
      var templates, s, html;

      templates = {
        'page.html': '<html>{% include "content.html" %}</html>',
        'content.html': 'Hello {{ name }}!'
      };

      s = new swig.Swig({ loader: swig.loaders.memory(templates) });
      html = s.renderFile('page.html', {name: 'world'});
      expect(html).to.equal('<html>Hello world!</html>');
    });

    it('can use base paths', function () {
      var templates, s, html;

      templates = {
        '/baz/bar/page.html': '<html>{% include "content.html" %}</html>',
        '/baz/content.html': 'Hello {{ name }}!'
      };

      s = new swig.Swig({ loader: swig.loaders.memory(templates, '/baz') });
      html = s.renderFile('bar/page.html', {name: 'world'});
      expect(html).to.equal('<html>Hello world!</html>');
    });

    it('throws on undefined template', function () {
      var s = new swig.Swig({ loader: swig.loaders.memory({}) });
      expect(function () {
        s.renderFile('foobar');
      }).to.throwError(/Unable to find template "\/foobar"\./);
    });

    it('will run asynchronously', function (done) {
      var t = { 'content.html': 'Hello {{ name }}!' },
        s = new swig.Swig({ loader: swig.loaders.memory(t) });
      s.renderFile('/content.html', { name: 'Tacos' }, function (err, out) {
        expect(out).to.equal('Hello Tacos!');
        done();
      });
    });
  });

  // The following tests should *not* run in the browser
  if (!fs || !fs.readFileSync) {
    return;
  }
  describe('FileSystem', function () {
    var macroExpectation = '\n\nasfdasdf\n\n\n\n\nHahahahahah!\n\n\n\n\n\n\n\n\n\n';
    it('is the default', function () {
      var s = new swig.Swig(),
        file = s.options.loader.load(__dirname + '/cases/macros.html');
      expect(typeof file).to.be.a('string');
    });

    it('can take a base path', function () {
      var s = new swig.Swig({ loader: swig.loaders.fs(__dirname + '/cases') });
      expect(s.renderFile('macros.html')).to.equal(macroExpectation);
    });

    it('will run asynchronously', function (done) {
      var t = { 'content.html': 'Hello {{ name }}!' },
        s = new swig.Swig({ loader: swig.loaders.fs(__dirname + '/cases') });
      s.renderFile('macros.html', {}, function (err, out) {
        expect(out).to.equal(macroExpectation);
        done();
      });
    });

    it('takes cwd as default base path', function () {
      var filepath = path.relative(process.cwd(), __dirname + '/cases/macros.html'),
        s = new swig.Swig();

      expect(s.renderFile(filepath)).to.equal(macroExpectation);
    });
  });

});


