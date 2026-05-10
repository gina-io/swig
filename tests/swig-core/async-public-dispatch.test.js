var swigModule = require('../../lib/swig'),
  twigModule = require('@rhinostone/swig-twig'),
  expect = require('expect.js');


/*!
 * Acceptance tests for the Phase 4 public-API async dispatch.
 *
 * Wires renderFile(path, locals, cb): when the active loader sets
 * `loader.async === true`, the cb path routes through self.getTemplate
 * (async-codegen mode) and awaits the Promise<{output, exports}>
 * result. Without the flag the existing sync-cb path runs regardless of
 * load arity — the explicit flag is the only dispatch signal.
 *
 * This suite asserts the dispatch routing. End-to-end render
 * correctness through Phase 2+3+4 (dynamic-extends, dynamic-include,
 * cross-flavor) is covered separately by render-file-cb-dispatch tests
 * under tests/async/ and tests/swig-twig/async/.
 */


function makeAsyncLoaderWithFlag(templates) {
  return {
    async: true,
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


function makeDualLoaderWithoutFlag(templates) {
  // load.length === 2 with both sync + cb arms. Proves length-sniff is
  // NOT used as a dispatch signal: cb mode still routes through the
  // existing sync-cb path because `async` is unset.
  return {
    resolve: function (to, from) {
      if (to.charAt(0) === '/') {
        return to;
      }
      return '/' + to;
    },
    load: function (id, cb) {
      if (cb) {
        Promise.resolve().then(function () {
          if (templates.hasOwnProperty(id)) {
            cb(null, templates[id]);
          } else {
            cb(new Error('Template not found: ' + id));
          }
        });
        return;
      }
      if (templates.hasOwnProperty(id)) {
        return templates[id];
      }
      throw new Error('Template not found: ' + id);
    }
  };
}


describe('renderFile public-API async dispatch', function () {

  describe('native @rhinostone/swig', function () {

    it('routes to async path when loader.async === true and cb provided', function (done) {
      var swig = new swigModule.Swig({
        loader: makeAsyncLoaderWithFlag({ '/hello.html': 'Hello, {{ name }}!' })
      });
      swig.renderFile('hello.html', { name: 'world' }, function (err, out) {
        expect(err).to.be(null);
        expect(out).to.equal('Hello, world!');
        done();
      });
    });

    it('does NOT route to async path when loader.async is unset, even with load.length >= 2', function (done) {
      var swig = new swigModule.Swig({
        loader: makeDualLoaderWithoutFlag({ '/hello.html': 'Hello, {{ name }}!' })
      });
      var getTemplateCalled = false;
      var origGetTemplate = swig.getTemplate;
      swig.getTemplate = function () {
        getTemplateCalled = true;
        return origGetTemplate.apply(swig, arguments);
      };
      swig.renderFile('hello.html', { name: 'world' }, function (err, out) {
        expect(err).to.be(null);
        expect(out).to.equal('Hello, world!');
        expect(getTemplateCalled).to.be(false);
        done();
      });
    });

    it('stays on sync path when no cb is provided (even if loader.async === true)', function () {
      var loader = makeDualLoaderWithoutFlag({ '/hello.html': 'Hello, {{ name }}!' });
      loader.async = true;
      var swig = new swigModule.Swig({ loader: loader });
      var out = swig.renderFile('hello.html', { name: 'world' });
      expect(out).to.equal('Hello, world!');
    });

    it('propagates loader errors via the cb in the async path', function (done) {
      var swig = new swigModule.Swig({
        loader: makeAsyncLoaderWithFlag({})
      });
      swig.renderFile('missing.html', {}, function (err, out) {
        expect(err).to.be.an(Error);
        expect(err.message).to.contain('Template not found');
        expect(out).to.be(undefined);
        done();
      });
    });

    it('propagates compile errors via the cb in the async path', function (done) {
      var swig = new swigModule.Swig({
        loader: makeAsyncLoaderWithFlag({ '/bad.html': '{% endif %}' })
      });
      swig.renderFile('bad.html', {}, function (err, out) {
        expect(err).to.be.an(Error);
        expect(out).to.be(undefined);
        done();
      });
    });
  });

  describe('Twig @rhinostone/swig-twig', function () {

    it('routes to async path when loader.async === true and cb provided', function (done) {
      var twig = new twigModule.Twig({
        loader: makeAsyncLoaderWithFlag({ '/hello.twig': 'Hello, {{ name }}!' })
      });
      twig.renderFile('hello.twig', { name: 'world' }, function (err, out) {
        expect(err).to.be(null);
        expect(out).to.equal('Hello, world!');
        done();
      });
    });

    it('does NOT route to async path when loader.async is unset', function (done) {
      var twig = new twigModule.Twig({
        loader: makeDualLoaderWithoutFlag({ '/hello.twig': 'Hello, {{ name }}!' })
      });
      var getTemplateCalled = false;
      var origGetTemplate = twig.getTemplate;
      twig.getTemplate = function () {
        getTemplateCalled = true;
        return origGetTemplate.apply(twig, arguments);
      };
      twig.renderFile('hello.twig', { name: 'world' }, function (err, out) {
        expect(err).to.be(null);
        expect(out).to.equal('Hello, world!');
        expect(getTemplateCalled).to.be(false);
        done();
      });
    });
  });
});
