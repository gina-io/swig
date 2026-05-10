var backend = require('@rhinostone/swig-core/lib/backend'),
  engine = require('@rhinostone/swig-core/lib/engine'),
  ir = require('@rhinostone/swig-core/lib/ir'),
  utils = require('@rhinostone/swig-core/lib/utils'),
  swig = require('../../lib/swig'),
  expect = require('expect.js');


/*!
 * Acceptance tests for the async-codegen path introduced as Phase 3
 * of #T22:
 *   - engine.buildTemplateFunction wrapping with AsyncFunction when
 *     options.codegenMode === 'async'. Body returns
 *     `Promise<{output: string, exports: object}>` so importers can
 *     pick up top-level macros via the .exports field.
 *   - backend.compile emitting the IRIncludeDeferred branch (await /
 *     _swig.getTemplate / .output extraction), the IRImportDeferred
 *     branch (.exports → _ctx[<alias>] bind), and the
 *     IRFromImportDeferred branch (per-entry alias bind via async IIFE).
 *   - IRMacro async-emit copies _ctx.<name> to _exports.<name> so cross-
 *     template imports can resolve macros.
 *   - self.getTemplate runtime helper installed by engine.install
 *     (Promise<TemplateFn>; cb-shape loader preferred, sync fallback).
 *
 * Sync-mode behavior is verified untouched: codegenMode omitted or set
 * to 'sync' produces a regular Function, the sync IRInclude / IRImport
 * branches keep emitting `_swig.compileFile(...)` + parse-time
 * regex-namespaced macro inlining (covered by the existing regressions
 * suite — not re-asserted here).
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
        expect(result).to.be.an('object');
        expect(result.output).to.be('hello async');
        expect(result.exports).to.be.an('object');
        expect(Object.keys(result.exports).length).to.be(0);
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

    it('emits an await/getTemplate shape with .output extraction for a literal-path node', function () {
      var pathExpr = ir.literal('string', 'partial.html');
      var node = ir.includeDeferred(pathExpr, undefined, false, false, '');
      var body = backend.compile({ tokens: [node] }, [], { codegenMode: 'async' });

      expect(body).to.contain('_swig.getTemplate');
      expect(body).to.contain('await');
      expect(body).to.contain('"partial.html"');
      expect(body).to.contain(').output');
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

      expect(body).to.contain(')(_ctx)).output');
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

    function mockTemplate(output, exports) {
      return function () {
        return { output: output, exports: exports || {} };
      };
    }

    function mockAsyncTemplate(output, exports) {
      return function () {
        return Promise.resolve({ output: output, exports: exports || {} });
      };
    }

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
          return Promise.resolve(mockTemplate('CHILD'));
        }
      };

      fn(mockSwig, {}, {}, utils, efn).then(function (result) {
        expect(result.output).to.be('parent[CHILD]parent');
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
          return Promise.resolve(mockAsyncTemplate('CHILD-ASYNC'));
        }
      };

      fn(mockSwig, {}, {}, utils, efn).then(function (result) {
        expect(result.output).to.be('parent[CHILD-ASYNC]parent');
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
        expect(result.output).to.be('before[]after');
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
            return { output: '', exports: {} };
          });
        }
      };

      fn(mockSwig, { existing: 'A' }, {}, utils, efn).then(function () {
        expect(capturedCtx.existing).to.be('A');
        expect(typeof capturedCtx).to.be('object');
        done();
      }).catch(done);
    });
  });

  describe('IRMacro async-emit (cross-template export wiring)', function () {

    it('declares _exports in the prelude and returns it on the resolved value', function (done) {
      var template = { tokens: [ir.text('body text')] };
      var fn = engine.buildTemplateFunction(template, [], { codegenMode: 'async' });

      fn({ extensions: {} }, {}, {}, utils, efn).then(function (result) {
        expect(result.exports).to.be.an('object');
        expect(Object.keys(result.exports).length).to.be(0);
        done();
      }).catch(done);
    });

    it('IRMacro async-emit assigns to both _ctx and _exports', function () {
      var macroNode = ir.macro('greet', [ir.macroParam('name')], [
        ir.legacyJS('_output += "hello " + name;\n')
      ]);
      var body = backend.compile({ tokens: [macroNode] }, [], { codegenMode: 'async' });

      expect(body).to.contain('_ctx.greet = function');
      expect(body).to.contain('_exports.greet = _ctx.greet;');
    });

    it('IRMacro sync-emit does NOT assign to _exports', function () {
      var macroNode = ir.macro('greet', [ir.macroParam('name')], [
        ir.legacyJS('_output += "hello " + name;\n')
      ]);
      var body = backend.compile({ tokens: [macroNode] }, [], {});

      expect(body).to.contain('_ctx.greet = function');
      expect(body).to.not.contain('_exports.greet');
    });

    it('throws on a dangerousProps macro name in async mode', function () {
      var macroNode = ir.macro('__proto__', [], [ir.legacyJS('_output += "x";\n')]);
      expect(function () {
        backend.compile({ tokens: [macroNode] }, [], { codegenMode: 'async' });
      }).to.throwException(/reserved/);
    });
  });

  describe('IRImportDeferred emit shape', function () {

    it('emits a single await/getTemplate call with .exports extraction', function () {
      var node = ir.importDeferred(ir.literal('string', 'macros.html'), 'forms', '');
      var body = backend.compile({ tokens: [node] }, [], { codegenMode: 'async' });

      expect(body).to.contain('_ctx.forms = ');
      expect(body).to.contain('_swig.getTemplate');
      expect(body).to.contain('.exports;');
    });

    it('passes parent _ctx to the imported tpl call', function () {
      var node = ir.importDeferred(ir.literal('string', 'macros.html'), 'forms', '');
      var body = backend.compile({ tokens: [node] }, [], { codegenMode: 'async' });

      expect(body).to.contain('))(_ctx)).exports');
    });

    it('throws on dangerousProps alias at backend emit time', function () {
      var node = ir.importDeferred(ir.literal('string', 'macros.html'), '__proto__', '');
      expect(function () {
        backend.compile({ tokens: [node] }, [], { codegenMode: 'async' });
      }).to.throwException(/reserved/);
    });
  });

  describe('IRImportDeferred end-to-end with mock _swig.getTemplate', function () {

    it('binds the imported template\'s exports onto _ctx[<alias>]', function (done) {
      var greet = function (name) { return 'hi ' + name; };
      var bye = function () { return 'bye'; };

      var template = {
        tokens: [
          ir.importDeferred(ir.literal('string', 'macros.html'), 'forms', ''),
          ir.text('imported')
        ]
      };
      var fn = engine.buildTemplateFunction(template, [], { codegenMode: 'async' });

      var mockSwig = {
        extensions: {},
        getTemplate: function () {
          return Promise.resolve(function () {
            return { output: '', exports: { greet: greet, bye: bye } };
          });
        }
      };

      var ctx = {};
      fn(mockSwig, ctx, {}, utils, efn).then(function (result) {
        expect(result.output).to.be('imported');
        expect(ctx.forms).to.be.an('object');
        expect(ctx.forms.greet).to.be(greet);
        expect(ctx.forms.bye).to.be(bye);
        done();
      }).catch(done);
    });
  });

  describe('IRFromImportDeferred emit shape', function () {

    it('emits an async IIFE with single getTemplate call and per-entry _ctx bind', function () {
      var node = ir.fromImportDeferred(
        ir.literal('string', 'macros.html'),
        [
          { name: 'a', alias: null },
          { name: 'b', alias: 'c' }
        ],
        ''
      );
      var body = backend.compile({ tokens: [node] }, [], { codegenMode: 'async' });

      expect(body).to.contain('await (async function () {');
      expect(body).to.contain('_swig.getTemplate');
      expect(body).to.contain('_imp = ');
      expect(body).to.contain('_ctx.a = _imp["a"];');
      expect(body).to.contain('_ctx.c = _imp["b"];');
    });

    it('rejects dangerousProps in either name or alias', function () {
      var badName = ir.fromImportDeferred(
        ir.literal('string', 'macros.html'),
        [{ name: '__proto__', alias: 'safe' }],
        ''
      );
      expect(function () {
        backend.compile({ tokens: [badName] }, [], { codegenMode: 'async' });
      }).to.throwException(/reserved/);

      var badAlias = ir.fromImportDeferred(
        ir.literal('string', 'macros.html'),
        [{ name: 'safe', alias: 'constructor' }],
        ''
      );
      expect(function () {
        backend.compile({ tokens: [badAlias] }, [], { codegenMode: 'async' });
      }).to.throwException(/reserved/);
    });
  });

  describe('IRFromImportDeferred end-to-end', function () {

    it('binds named entries (and aliased entries) onto _ctx', function (done) {
      var fnA = function () { return 'A'; };
      var fnB = function () { return 'B'; };

      var template = {
        tokens: [
          ir.fromImportDeferred(
            ir.literal('string', 'macros.html'),
            [
              { name: 'a', alias: null },
              { name: 'b', alias: 'aliasedB' }
            ],
            ''
          ),
          ir.text('done')
        ]
      };
      var fn = engine.buildTemplateFunction(template, [], { codegenMode: 'async' });

      var mockSwig = {
        extensions: {},
        getTemplate: function () {
          return Promise.resolve(function () {
            return { output: '', exports: { a: fnA, b: fnB } };
          });
        }
      };

      var ctx = {};
      fn(mockSwig, ctx, {}, utils, efn).then(function (result) {
        expect(result.output).to.be('done');
        expect(ctx.a).to.be(fnA);
        expect(ctx.aliasedB).to.be(fnB);
        // Original 'b' name is NOT bound — alias takes precedence
        expect(ctx.b).to.be(undefined);
        done();
      }).catch(done);
    });

    it('handles two from-imports in the same template without _imp variable collision', function (done) {
      var fnA = function () { return 'A'; };
      var fnX = function () { return 'X'; };

      var template = {
        tokens: [
          ir.fromImportDeferred(
            ir.literal('string', 'one.html'),
            [{ name: 'a', alias: null }],
            ''
          ),
          ir.fromImportDeferred(
            ir.literal('string', 'two.html'),
            [{ name: 'x', alias: null }],
            ''
          )
        ]
      };
      var fn = engine.buildTemplateFunction(template, [], { codegenMode: 'async' });

      var mockSwig = {
        extensions: {},
        getTemplate: function (path) {
          if (path === 'one.html') {
            return Promise.resolve(function () { return { output: '', exports: { a: fnA } }; });
          }
          return Promise.resolve(function () { return { output: '', exports: { x: fnX } }; });
        }
      };

      var ctx = {};
      fn(mockSwig, ctx, {}, utils, efn).then(function () {
        expect(ctx.a).to.be(fnA);
        expect(ctx.x).to.be(fnX);
        done();
      }).catch(done);
    });
  });

  describe('self.getTemplate runtime helper (integration via memory loader)', function () {

    it('returns a Promise<TemplateFn> that resolves to a fn returning {output, exports}', function (done) {
      var instance = new swig.Swig({
        loader: swig.loaders.memory({ '/foo.html': 'foo content' })
      });

      var promise = instance.getTemplate('/foo.html');
      expect(typeof promise.then).to.be('function');

      promise.then(function (tpl) {
        expect(typeof tpl).to.be('function');
        var result = tpl({});
        expect(typeof result.then).to.be('function');
        return result;
      }).then(function (resolved) {
        expect(resolved).to.be.an('object');
        expect(resolved.output).to.be('foo content');
        expect(resolved.exports).to.be.an('object');
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
        }).then(function (resolved) {
          expect(resolved.output).to.be('sibling here');
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
      }).then(function (resolved) {
        expect(resolved.output).to.be('sync-loaded: /x.html');
        done();
      }).catch(done);
    });

    it('honors a cb-shape loader (load(path, cb))', function (done) {
      var cbLoader = {
        resolve: function (to) { return to; },
        load: function (path, cb) {
          setImmediate(function () {
            cb(null, 'cb-loaded: ' + path);
          });
        }
      };

      var instance = new swig.Swig({ loader: cbLoader });

      instance.getTemplate('/y.html').then(function (tpl) {
        return tpl({});
      }).then(function (resolved) {
        expect(resolved.output).to.be('cb-loaded: /y.html');
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

      fn(instance, {}, {}, utils, efn).then(function (resolved) {
        expect(resolved.output).to.be('parent[CHILD]parent');
        done();
      }).catch(done);
    });
  });

  describe('IRBlock async-emit (block override runtime contract)', function () {

    it('AsyncFunction wrapper signature accepts a 6th _blocks positional arg', function () {
      var template = { tokens: [ir.text('x')] };
      var fn = engine.buildTemplateFunction(template, [], { codegenMode: 'async' });
      expect(fn.length).to.be(6);
    });

    it('sync wrapper signature is unchanged (5 args, no _blocks)', function () {
      var template = { tokens: [ir.text('x')] };
      var fn = engine.buildTemplateFunction(template, [], {});
      expect(fn.length).to.be(5);
    });

    it('IRBlock sync emit is unchanged — no _blocks check', function () {
      var blockNode = ir.block('content', [ir.text('default body')]);
      var body = backend.compile({ tokens: [blockNode] }, [], {});

      expect(body).to.contain('_output += "default body"');
      expect(body).to.not.contain('_blocks');
      expect(body).to.not.contain('await');
    });

    it('IRBlock async emit wraps inline body in _blocks check', function () {
      var blockNode = ir.block('content', [ir.text('default body')]);
      var body = backend.compile({ tokens: [blockNode] }, [], { codegenMode: 'async' });

      expect(body).to.contain('if (_blocks && _blocks["content"]) {');
      expect(body).to.contain('_output += await _blocks["content"](_ctx);');
      expect(body).to.contain('} else {');
      expect(body).to.contain('_output += "default body"');
    });

    it('IRBlock async emit JSON-stringifies the block name (handles quotes / unicode)', function () {
      var blockNode = ir.block('weird "name"', [ir.text('body')]);
      var body = backend.compile({ tokens: [blockNode] }, [], { codegenMode: 'async' });

      expect(body).to.contain('_blocks["weird \\"name\\""]');
    });

    it('end-to-end: emits inline body when _blocks is undefined', function (done) {
      var template = {
        tokens: [
          ir.text('['),
          ir.block('A', [ir.text('default-A')]),
          ir.text(']')
        ]
      };
      var fn = engine.buildTemplateFunction(template, [], { codegenMode: 'async' });

      fn({ extensions: {} }, {}, {}, utils, efn /* no _blocks */).then(function (result) {
        expect(result.output).to.be('[default-A]');
        done();
      }).catch(done);
    });

    it('end-to-end: emits inline body when _blocks is empty object', function (done) {
      var template = {
        tokens: [
          ir.block('A', [ir.text('default-A')])
        ]
      };
      var fn = engine.buildTemplateFunction(template, [], { codegenMode: 'async' });

      fn({ extensions: {} }, {}, {}, utils, efn, {}).then(function (result) {
        expect(result.output).to.be('default-A');
        done();
      }).catch(done);
    });

    it('end-to-end: calls override fn when _blocks contains the block name', function (done) {
      var template = {
        tokens: [
          ir.text('['),
          ir.block('A', [ir.text('default-A')]),
          ir.text(']')
        ]
      };
      var fn = engine.buildTemplateFunction(template, [], { codegenMode: 'async' });

      var overrideFn = async function (_ctx) {
        return 'override-A';
      };

      fn({ extensions: {} }, {}, {}, utils, efn, { A: overrideFn }).then(function (result) {
        expect(result.output).to.be('[override-A]');
        done();
      }).catch(done);
    });

    it('end-to-end: override receives _ctx and can read locals', function (done) {
      var template = {
        tokens: [ir.block('A', [ir.text('default')])]
      };
      var fn = engine.buildTemplateFunction(template, [], { codegenMode: 'async' });

      var capturedCtx;
      var overrideFn = async function (_ctx) {
        capturedCtx = _ctx;
        return 'name=' + _ctx.name;
      };

      fn({ extensions: {} }, { name: 'world' }, {}, utils, efn, { A: overrideFn }).then(function (result) {
        expect(result.output).to.be('name=world');
        expect(capturedCtx.name).to.be('world');
        done();
      }).catch(done);
    });

    it('end-to-end: override is awaited (Promise return resolves before next emit)', function (done) {
      var template = {
        tokens: [
          ir.text('before:'),
          ir.block('A', [ir.text('default')]),
          ir.text(':after')
        ]
      };
      var fn = engine.buildTemplateFunction(template, [], { codegenMode: 'async' });

      var overrideFn = async function () {
        // Force a microtask tick before resolving
        await new Promise(function (resolve) { setImmediate(resolve); });
        return 'ASYNC-A';
      };

      fn({ extensions: {} }, {}, {}, utils, efn, { A: overrideFn }).then(function (result) {
        expect(result.output).to.be('before:ASYNC-A:after');
        done();
      }).catch(done);
    });

    it('end-to-end: only the matching named block is overridden — other blocks fall back', function (done) {
      var template = {
        tokens: [
          ir.block('A', [ir.text('default-A')]),
          ir.text('|'),
          ir.block('B', [ir.text('default-B')])
        ]
      };
      var fn = engine.buildTemplateFunction(template, [], { codegenMode: 'async' });

      var overrideA = async function () { return 'OVERRIDE-A'; };

      fn({ extensions: {} }, {}, {}, utils, efn, { A: overrideA }).then(function (result) {
        expect(result.output).to.be('OVERRIDE-A|default-B');
        done();
      }).catch(done);
    });

    it('compiled closure forwards blocks param through self.compile -> pre.tpl', function (done) {
      var instance = new swig.Swig({
        loader: swig.loaders.memory({
          '/has-block.html': '{% block A %}default-A{% endblock %}'
        })
      });

      // Use getTemplate to build an async-compiled template, then call
      // it directly with a blocks override to confirm the closure forwards
      // the 6th arg correctly.
      instance.getTemplate('/has-block.html').then(function (compiled) {
        var override = async function () { return 'OVERRIDE'; };
        return compiled({}, { A: override });
      }).then(function (resolved) {
        expect(resolved.output).to.be('OVERRIDE');
        done();
      }).catch(done);
    });
  });

  describe('IRExtendsDeferred emit shape', function () {

    it('emits _localChildBlocks declaration even when childBlocks is empty', function () {
      var node = ir.extendsDeferred(ir.literal('string', 'base.html'), {}, [], '');
      var body = backend.compile({ tokens: [node] }, [], { codegenMode: 'async' });

      expect(body).to.contain('var _localChildBlocks = {};');
    });

    it('emits an async function for each childBlock, keyed by block name', function () {
      var node = ir.extendsDeferred(
        ir.literal('string', 'base.html'),
        {
          A: ir.block('A', [ir.text('child-A')]),
          B: ir.block('B', [ir.text('child-B')])
        },
        [],
        ''
      );
      var body = backend.compile({ tokens: [node] }, [], { codegenMode: 'async' });

      expect(body).to.contain('_localChildBlocks["A"] = async function (_ctx) {');
      expect(body).to.contain('_localChildBlocks["B"] = async function (_ctx) {');
      expect(body).to.contain('_output += "child-A"');
      expect(body).to.contain('_output += "child-B"');
      expect(body).to.contain('return _output;');
    });

    it('shadows _output inside each block fn with a local accumulator', function () {
      var node = ir.extendsDeferred(
        ir.literal('string', 'base.html'),
        { A: ir.block('A', [ir.text('hi')]) },
        [],
        ''
      );
      var body = backend.compile({ tokens: [node] }, [], { codegenMode: 'async' });

      // The block fn body declares its own var _output = ""; so writes
      // accumulate locally and don't leak into the outer wrapper's _output.
      expect(body).to.match(/_localChildBlocks\["A"\] = async function \(_ctx\) \{\s*\n\s*var _output = "";/);
    });

    it('merges _localChildBlocks with inherited _blocks (child wins)', function () {
      var node = ir.extendsDeferred(ir.literal('string', 'base.html'), {}, [], '');
      var body = backend.compile({ tokens: [node] }, [], { codegenMode: 'async' });

      expect(body).to.contain('var _mergedBlocks = _utils.extend({}, _localChildBlocks, _blocks || {});');
    });

    it('awaits _swig.getTemplate then awaits _parent call with merged blocks', function () {
      var node = ir.extendsDeferred(ir.literal('string', 'base.html'), {}, [], '');
      var body = backend.compile({ tokens: [node] }, [], { codegenMode: 'async' });

      expect(body).to.contain('var _parentTpl = await _swig.getTemplate("base.html", {resolveFrom: ""});');
      expect(body).to.contain('var _parentResult = await _parentTpl(_ctx, _mergedBlocks);');
    });

    it('takes parent.output but discards parent.exports (sync parity)', function () {
      var node = ir.extendsDeferred(ir.literal('string', 'base.html'), {}, [], '');
      var body = backend.compile({ tokens: [node] }, [], { codegenMode: 'async' });

      expect(body).to.contain('_output = _parentResult.output;');
      expect(body).to.not.contain('_exports = _parentResult.exports');
      expect(body).to.not.contain('_utils.extend({}, _parentResult.exports');
      expect(body).to.not.contain('_utils.extend({}, _exports, _parentResult.exports');
    });

    it('embeds resolveFrom as a JS string literal in the options object', function () {
      var node = ir.extendsDeferred(ir.literal('string', 'base.html'), {}, [], '/abs/child.html');
      var body = backend.compile({ tokens: [node] }, [], { codegenMode: 'async' });

      expect(body).to.contain('resolveFrom: "/abs/child.html"');
    });

    it('emits childIRs preludes BEFORE the _localChildBlocks declaration', function () {
      // Use a LegacyJS prelude so we can assert ordering by substring index.
      var node = ir.extendsDeferred(
        ir.literal('string', 'base.html'),
        { A: ir.block('A', [ir.text('hi')]) },
        [ir.legacyJS('/* PRELUDE_MARKER */\n')],
        ''
      );
      var body = backend.compile({ tokens: [node] }, [], { codegenMode: 'async' });

      var preludeIdx = body.indexOf('PRELUDE_MARKER');
      var localBlocksIdx = body.indexOf('var _localChildBlocks');
      expect(preludeIdx).to.be.greaterThan(-1);
      expect(localBlocksIdx).to.be.greaterThan(-1);
      expect(preludeIdx).to.be.lessThan(localBlocksIdx);
    });

    it('emits childIRs preludes via recursive backend.compile (handles real IR)', function () {
      // A macro IR in childIRs should produce real macro emission, not
      // be lifted to LegacyJS or dropped silently.
      var node = ir.extendsDeferred(
        ir.literal('string', 'base.html'),
        {},
        [ir.macro('greet', [ir.macroParam('name')], [ir.legacyJS('_output += "hi " + name;\n')])],
        ''
      );
      var body = backend.compile({ tokens: [node] }, [], { codegenMode: 'async' });

      expect(body).to.contain('_ctx.greet = function');
      expect(body).to.contain('_exports.greet = _ctx.greet;');
    });
  });

  describe('IRExtendsDeferred end-to-end with mock _swig.getTemplate', function () {

    function asyncTpl(output, exports) {
      return function () {
        return Promise.resolve({ output: output, exports: exports || {} });
      };
    }

    it('renders a single-level extends — parent default block when no override', function (done) {
      // grandparent.html: `<base>{% block A %}DEFAULT-A{% endblock %}</base>`
      // child.html: `{% extends "grandparent.html" %}` (no block override)
      var grandparentTpl = engine.buildTemplateFunction({
        tokens: [
          ir.text('<base>'),
          ir.block('A', [ir.text('DEFAULT-A')]),
          ir.text('</base>')
        ]
      }, [], { codegenMode: 'async' });

      var childTpl = engine.buildTemplateFunction({
        tokens: [
          ir.extendsDeferred(ir.literal('string', 'grandparent.html'), {}, [], '')
        ]
      }, [], { codegenMode: 'async' });

      var capturedPath;
      var mockSwig = {
        extensions: {},
        getTemplate: function (path) {
          capturedPath = path;
          return Promise.resolve(function (ctx, blocks) {
            return grandparentTpl(mockSwig, ctx, {}, utils, efn, blocks);
          });
        }
      };

      childTpl(mockSwig, {}, {}, utils, efn).then(function (result) {
        expect(result.output).to.be('<base>DEFAULT-A</base>');
        expect(capturedPath).to.be('grandparent.html');
        done();
      }).catch(done);
    });

    it('renders single-level extends — override replaces default block', function (done) {
      var grandparentTpl = engine.buildTemplateFunction({
        tokens: [
          ir.text('<base>'),
          ir.block('A', [ir.text('DEFAULT-A')]),
          ir.text('</base>')
        ]
      }, [], { codegenMode: 'async' });

      var childTpl = engine.buildTemplateFunction({
        tokens: [
          ir.extendsDeferred(
            ir.literal('string', 'grandparent.html'),
            { A: ir.block('A', [ir.text('CHILD-A')]) },
            [],
            ''
          )
        ]
      }, [], { codegenMode: 'async' });

      var mockSwig = {
        extensions: {},
        getTemplate: function () {
          return Promise.resolve(function (ctx, blocks) {
            return grandparentTpl(mockSwig, ctx, {}, utils, efn, blocks);
          });
        }
      };

      childTpl(mockSwig, {}, {}, utils, efn).then(function (result) {
        expect(result.output).to.be('<base>CHILD-A</base>');
        done();
      }).catch(done);
    });

    it('renders multi-level extends — child override propagates through middle to grandparent', function (done) {
      // grandparent: `<g>{block A}gA{/}{block B}gB{/}{block C}gC{/}</g>`
      // middle: extends grandparent; defines block A and block B (overrides both)
      // child: extends middle; defines block A only (overrides A inherited or own)
      // Expected: A = child's, B = middle's, C = grandparent's default.
      var grandparentTpl = engine.buildTemplateFunction({
        tokens: [
          ir.text('<g>'),
          ir.block('A', [ir.text('gA')]),
          ir.block('B', [ir.text('gB')]),
          ir.block('C', [ir.text('gC')]),
          ir.text('</g>')
        ]
      }, [], { codegenMode: 'async' });

      var middleTpl = engine.buildTemplateFunction({
        tokens: [
          ir.extendsDeferred(
            ir.literal('string', 'grandparent.html'),
            {
              A: ir.block('A', [ir.text('mA')]),
              B: ir.block('B', [ir.text('mB')])
            },
            [],
            ''
          )
        ]
      }, [], { codegenMode: 'async' });

      var childTpl = engine.buildTemplateFunction({
        tokens: [
          ir.extendsDeferred(
            ir.literal('string', 'middle.html'),
            { A: ir.block('A', [ir.text('cA')]) },
            [],
            ''
          )
        ]
      }, [], { codegenMode: 'async' });

      var mockSwig = {
        extensions: {},
        getTemplate: function (path) {
          if (path === 'middle.html') {
            return Promise.resolve(function (ctx, blocks) {
              return middleTpl(mockSwig, ctx, {}, utils, efn, blocks);
            });
          }
          if (path === 'grandparent.html') {
            return Promise.resolve(function (ctx, blocks) {
              return grandparentTpl(mockSwig, ctx, {}, utils, efn, blocks);
            });
          }
          return Promise.reject(new Error('Unknown path: ' + path));
        }
      };

      childTpl(mockSwig, {}, {}, utils, efn).then(function (result) {
        expect(result.output).to.be('<g>cAmBgC</g>');
        done();
      }).catch(done);
    });

    it('child preludes (childIRs containing macros) populate child._exports', function (done) {
      var grandparentTpl = engine.buildTemplateFunction({
        tokens: [ir.text('GP')]
      }, [], { codegenMode: 'async' });

      var childTpl = engine.buildTemplateFunction({
        tokens: [
          ir.extendsDeferred(
            ir.literal('string', 'grandparent.html'),
            {},
            [ir.macro('childMacro', [], [ir.legacyJS('_output += "hello";\n')])],
            ''
          )
        ]
      }, [], { codegenMode: 'async' });

      var mockSwig = {
        extensions: {},
        getTemplate: function () {
          return Promise.resolve(function (ctx, blocks) {
            return grandparentTpl(mockSwig, ctx, {}, utils, efn, blocks);
          });
        }
      };

      childTpl(mockSwig, {}, {}, utils, efn).then(function (result) {
        expect(result.output).to.be('GP');
        // Child's preludes-defined macro is in _exports
        expect(typeof result.exports.childMacro).to.be('function');
        done();
      }).catch(done);
    });

    it('parent.exports is DISCARDED — sync parity (importer of child sees own only)', function (done) {
      // Grandparent defines its own macro and surfaces it via _exports.
      // Child extends grandparent. Result.exports should NOT contain
      // grandparent's macro.
      var grandparentTpl = engine.buildTemplateFunction({
        tokens: [
          ir.macro('grandparentMacro', [], [ir.legacyJS('_output += "g";\n')]),
          ir.text('GP-output')
        ]
      }, [], { codegenMode: 'async' });

      var childTpl = engine.buildTemplateFunction({
        tokens: [
          ir.extendsDeferred(ir.literal('string', 'grandparent.html'), {}, [], '')
        ]
      }, [], { codegenMode: 'async' });

      var mockSwig = {
        extensions: {},
        getTemplate: function () {
          return Promise.resolve(function (ctx, blocks) {
            return grandparentTpl(mockSwig, ctx, {}, utils, efn, blocks);
          });
        }
      };

      childTpl(mockSwig, {}, {}, utils, efn).then(function (result) {
        expect(result.output).to.be('GP-output');
        // Grandparent's macro is NOT in child's exports (sync parity)
        expect(result.exports.grandparentMacro).to.be(undefined);
        done();
      }).catch(done);
    });

    it('child preludes share _ctx with parent body (set propagates)', function (done) {
      // Child sets _ctx.label, then extends parent. Parent's body reads
      // _ctx.label — should see the child's value.
      var grandparentTpl = engine.buildTemplateFunction({
        tokens: [
          ir.text('label='),
          ir.output(ir.varRef(['label']))
        ]
      }, [], { codegenMode: 'async' });

      var childTpl = engine.buildTemplateFunction({
        tokens: [
          ir.extendsDeferred(
            ir.literal('string', 'grandparent.html'),
            {},
            [ir.set(ir.varRef(['label']), '=', ir.literal('string', 'fromChild'))],
            ''
          )
        ]
      }, [], { codegenMode: 'async' });

      var mockSwig = {
        extensions: {},
        getTemplate: function () {
          return Promise.resolve(function (ctx, blocks) {
            return grandparentTpl(mockSwig, ctx, {}, utils, efn, blocks);
          });
        }
      };

      childTpl(mockSwig, {}, {}, utils, efn).then(function (result) {
        expect(result.output).to.be('label=fromChild');
        done();
      }).catch(done);
    });
  });
});
