var backend = require('@rhinostone/swig-core/lib/backend'),
  engine = require('@rhinostone/swig-core/lib/engine'),
  ir = require('@rhinostone/swig-core/lib/ir'),
  utils = require('@rhinostone/swig-core/lib/utils'),
  swig = require('../../lib/swig'),
  expect = require('expect.js');


/*!
 * Acceptance tests for the async-codegen path introduced as Phase 3
 * slice 1 of #T22:
 *   - engine.buildTemplateFunction wrapping with AsyncFunction when
 *     options.codegenMode === 'async'.
 *   - backend.compile emitting the IRIncludeDeferred branch (await /
 *     _swig.getTemplate / double-await selector dispatch).
 *   - self.getTemplate runtime helper installed by engine.install
 *     (Promise<TemplateFn>; cb-shape loader preferred, sync fallback).
 *
 * Sync-mode behavior is verified untouched: codegenMode omitted or set
 * to 'sync' produces a regular Function and the sync IRInclude branch
 * keeps emitting `_swig.compileFile(...)` (covered by the existing
 * regressions suite — not re-asserted here).
 */
function efn() { return ''; }

describe('swig-core/lib/backend — async emit (codegenMode: "async")', function () {

  describe('engine.buildTemplateFunction wrapping', function () {

    it('wraps the body in an AsyncFunction when codegenMode is "async"', function (done) {
      var template = { tokens: [ir.text('hello async')] };
      var fn = engine.buildTemplateFunction(template, [], { codegenMode: 'async' });

      expect(fn.constructor.name).to.be('AsyncFunction');

      var ret = fn({ extensions: {} }, {}, {}, utils, efn);
      expect(typeof ret.then).to.be('function');

      ret.then(function (result) {
        expect(result).to.be('hello async');
        done();
      }).catch(done);
    });

    it('wraps the body in a regular Function when codegenMode is omitted (sync default)', function () {
      var template = { tokens: [ir.text('hello sync')] };
      var fn = engine.buildTemplateFunction(template, [], {});
      expect(fn.constructor.name).to.be('Function');
      var result = fn({ extensions: {} }, {}, {}, utils, efn);
      expect(result).to.be('hello sync');
    });

    it('wraps the body in a regular Function when options is undefined (sync default)', function () {
      var template = { tokens: [ir.text('hello sync')] };
      var fn = engine.buildTemplateFunction(template, []);
      expect(fn.constructor.name).to.be('Function');
    });

    it('wraps the body in a regular Function when codegenMode is explicitly "sync"', function () {
      var template = { tokens: [ir.text('hello sync')] };
      var fn = engine.buildTemplateFunction(template, [], { codegenMode: 'sync' });
      expect(fn.constructor.name).to.be('Function');
    });
  });

  describe('IRIncludeDeferred emit shape', function () {

    it('emits an await/getTemplate shape for a literal-path IRIncludeDeferred node', function () {
      var pathExpr = ir.literal('string', 'partial.html');
      var node = ir.includeDeferred(pathExpr, undefined, false, false, '');
      var body = backend.compile({ tokens: [node] }, [], { codegenMode: 'async' });

      expect(body).to.contain('_swig.getTemplate');
      expect(body).to.contain('await');
      expect(body).to.contain('"partial.html"');
    });

    it('does NOT wrap in try/catch when ignoreMissing is false', function () {
      var pathExpr = ir.literal('string', 'partial.html');
      var node = ir.includeDeferred(pathExpr, undefined, false, false, '');
      var body = backend.compile({ tokens: [node] }, [], { codegenMode: 'async' });

      expect(body).to.not.contain('try {');
      expect(body).to.not.contain('catch (e) {}');
    });

    it('wraps the await chain in try/catch when ignoreMissing is true', function () {
      var pathExpr = ir.literal('string', 'partial.html');
      var node = ir.includeDeferred(pathExpr, undefined, false, true, '');
      var body = backend.compile({ tokens: [node] }, [], { codegenMode: 'async' });

      expect(body).to.contain('try {');
      expect(body).to.contain('} catch (e) {}');
      expect(body).to.contain('_swig.getTemplate');
    });

    it('uses _ctx as the selector when no with-context is provided', function () {
      var pathExpr = ir.literal('string', 'partial.html');
      var node = ir.includeDeferred(pathExpr, undefined, false, false, '');
      var body = backend.compile({ tokens: [node] }, [], { codegenMode: 'async' });

      expect(body).to.contain(')(_ctx)');
    });

    it('uses _utils.extend({}, _ctx, <ctx>) when with-context is provided without "only"', function () {
      var pathExpr = ir.literal('string', 'partial.html');
      var ctxExpr = ir.varRef(['scope']);
      var node = ir.includeDeferred(pathExpr, ctxExpr, false, false, '');
      var body = backend.compile({ tokens: [node] }, [], { codegenMode: 'async' });

      expect(body).to.contain('_utils.extend({}, _ctx,');
    });

    it('uses just <ctx> when with-context is provided AND isolated (only)', function () {
      var pathExpr = ir.literal('string', 'partial.html');
      var ctxExpr = ir.varRef(['scope']);
      var node = ir.includeDeferred(pathExpr, ctxExpr, true, false, '');
      var body = backend.compile({ tokens: [node] }, [], { codegenMode: 'async' });

      expect(body).to.not.contain('_utils.extend');
    });

    it('embeds resolveFrom as a JS string literal in the options object', function () {
      var pathExpr = ir.literal('string', 'partial.html');
      var node = ir.includeDeferred(pathExpr, undefined, false, false, '/abs/path');
      var body = backend.compile({ tokens: [node] }, [], { codegenMode: 'async' });

      expect(body).to.contain('resolveFrom: "/abs/path"');
    });

    it('embeds an empty resolveFrom when none was supplied', function () {
      var pathExpr = ir.literal('string', 'partial.html');
      var node = ir.includeDeferred(pathExpr, undefined, false, false, undefined);
      var body = backend.compile({ tokens: [node] }, [], { codegenMode: 'async' });

      expect(body).to.contain('resolveFrom: ""');
    });
  });

  describe('IRIncludeDeferred end-to-end with mock _swig.getTemplate', function () {

    it('renders a sync-resolved child via mock getTemplate', function (done) {
      var pathExpr = ir.literal('string', 'partial.html');
      var template = {
        tokens: [
          ir.text('parent['),
          ir.includeDeferred(pathExpr, undefined, false, false, ''),
          ir.text(']parent')
        ]
      };
      var fn = engine.buildTemplateFunction(template, [], { codegenMode: 'async' });

      var captured = {};
      var mockSwig = {
        extensions: {},
        getTemplate: function (path, opts) {
          captured.path = path;
          captured.opts = opts;
          return Promise.resolve(function () { return 'CHILD'; });
        }
      };

      fn(mockSwig, {}, {}, utils, efn).then(function (result) {
        expect(result).to.be('parent[CHILD]parent');
        expect(captured.path).to.be('partial.html');
        expect(captured.opts).to.eql({ resolveFrom: '' });
        done();
      }).catch(done);
    });

    it('renders an async-compiled child (Promise-returning fn) via the double-await chain', function (done) {
      var pathExpr = ir.literal('string', 'partial.html');
      var template = {
        tokens: [
          ir.text('parent['),
          ir.includeDeferred(pathExpr, undefined, false, false, ''),
          ir.text(']parent')
        ]
      };
      var fn = engine.buildTemplateFunction(template, [], { codegenMode: 'async' });

      var mockSwig = {
        extensions: {},
        getTemplate: function () {
          return Promise.resolve(function () {
            return Promise.resolve('CHILD-ASYNC');
          });
        }
      };

      fn(mockSwig, {}, {}, utils, efn).then(function (result) {
        expect(result).to.be('parent[CHILD-ASYNC]parent');
        done();
      }).catch(done);
    });

    it('swallows missing-file errors when ignoreMissing is true (try/catch wrapping)', function (done) {
      var pathExpr = ir.literal('string', 'missing.html');
      var template = {
        tokens: [
          ir.text('before['),
          ir.includeDeferred(pathExpr, undefined, false, true, ''),
          ir.text(']after')
        ]
      };
      var fn = engine.buildTemplateFunction(template, [], { codegenMode: 'async' });

      var mockSwig = {
        extensions: {},
        getTemplate: function () {
          return Promise.reject(new Error('ENOENT: no such file'));
        }
      };

      fn(mockSwig, {}, {}, utils, efn).then(function (result) {
        expect(result).to.be('before[]after');
        done();
      }).catch(done);
    });

    it('rejects with the loader error when ignoreMissing is false', function (done) {
      var pathExpr = ir.literal('string', 'missing.html');
      var template = {
        tokens: [
          ir.includeDeferred(pathExpr, undefined, false, false, '')
        ]
      };
      var fn = engine.buildTemplateFunction(template, [], { codegenMode: 'async' });

      var mockSwig = {
        extensions: {},
        getTemplate: function () {
          return Promise.reject(new Error('ENOENT: no such file'));
        }
      };

      fn(mockSwig, {}, {}, utils, efn).then(function () {
        done(new Error('expected rejection but resolved'));
      }, function (err) {
        expect(err.message).to.match(/ENOENT/);
        done();
      });
    });

    it('passes a with-context selector through to the resolved fn (merged path)', function (done) {
      var pathExpr = ir.literal('string', 'partial.html');
      var ctxExpr = ir.varRef(['scope']);
      var template = {
        tokens: [
          ir.includeDeferred(pathExpr, ctxExpr, false, false, '')
        ]
      };
      var fn = engine.buildTemplateFunction(template, [], { codegenMode: 'async' });

      var capturedCtx;
      var mockSwig = {
        extensions: {},
        getTemplate: function () {
          return Promise.resolve(function (ctx) {
            capturedCtx = ctx;
            return '';
          });
        }
      };

      fn(mockSwig, { existing: 'A' }, {}, utils, efn).then(function () {
        expect(capturedCtx.existing).to.be('A');
        // scope is undefined in this _ctx — the merge still produces an object.
        expect(typeof capturedCtx).to.be('object');
        done();
      }).catch(done);
    });
  });

  describe('self.getTemplate runtime helper (integration via memory loader)', function () {

    it('returns a Promise<TemplateFn> for a memory-loaded template', function (done) {
      var instance = new swig.Swig({
        loader: swig.loaders.memory({ '/foo.html': 'foo content' })
      });

      var promise = instance.getTemplate('/foo.html');
      expect(typeof promise.then).to.be('function');

      promise.then(function (tpl) {
        expect(typeof tpl).to.be('function');
        var result = tpl({});
        // Compiled in async mode -> Promise<string>
        expect(typeof result.then).to.be('function');
        return result;
      }).then(function (output) {
        expect(output).to.be('foo content');
        done();
      }).catch(done);
    });

    it('rejects when the loader cannot find the template', function (done) {
      var instance = new swig.Swig({
        loader: swig.loaders.memory({})
      });

      instance.getTemplate('/missing.html').then(function () {
        done(new Error('expected rejection'));
      }, function (err) {
        expect(err).to.be.ok();
        done();
      });
    });

    it('threads resolveFrom through the loader resolve call', function (done) {
      var instance = new swig.Swig({
        loader: swig.loaders.memory({
          '/dir/sibling.html': 'sibling here'
        })
      });

      instance.getTemplate('/dir/sibling.html', { resolveFrom: '/dir/main.html' })
        .then(function (tpl) {
          return tpl({});
        }).then(function (output) {
          expect(output).to.be('sibling here');
          done();
        }).catch(done);
    });

    it('honors a sync loader (single-arg load) by wrapping in Promise', function (done) {
      var syncLoader = {
        resolve: function (to) { return to; },
        load: function (path) {
          return 'sync-loaded: ' + path;
        }
      };

      var instance = new swig.Swig({ loader: syncLoader });

      instance.getTemplate('/x.html').then(function (tpl) {
        return tpl({});
      }).then(function (output) {
        expect(output).to.be('sync-loaded: /x.html');
        done();
      }).catch(done);
    });

    it('honors a cb-shape loader (load(path, cb))', function (done) {
      var cbLoader = {
        resolve: function (to) { return to; },
        load: function (path, cb) {
          // Simulate async I/O.
          setImmediate(function () {
            cb(null, 'cb-loaded: ' + path);
          });
        }
      };

      var instance = new swig.Swig({ loader: cbLoader });

      instance.getTemplate('/y.html').then(function (tpl) {
        return tpl({});
      }).then(function (output) {
        expect(output).to.be('cb-loaded: /y.html');
        done();
      }).catch(done);
    });

    it('rejects when a cb-shape loader passes an error', function (done) {
      var cbLoader = {
        resolve: function (to) { return to; },
        load: function (path, cb) {
          setImmediate(function () { cb(new Error('boom')); });
        }
      };

      var instance = new swig.Swig({ loader: cbLoader });

      instance.getTemplate('/y.html').then(function () {
        done(new Error('expected rejection'));
      }, function (err) {
        expect(err.message).to.be('boom');
        done();
      });
    });

    it('end-to-end: hand-built async template includes a child via memory loader', function (done) {
      var instance = new swig.Swig({
        loader: swig.loaders.memory({ '/child.html': 'CHILD' })
      });

      var template = {
        tokens: [
          ir.text('parent['),
          ir.includeDeferred(ir.literal('string', '/child.html'), undefined, false, false, ''),
          ir.text(']parent')
        ]
      };
      var fn = engine.buildTemplateFunction(template, [], { codegenMode: 'async' });

      // Drive the template directly. _filters / _fn aren't referenced by
      // this body, so empty stubs are fine.
      fn(instance, {}, {}, utils, efn).then(function (output) {
        expect(output).to.be('parent[CHILD]parent');
        done();
      }).catch(done);
    });
  });
});
