var swig = require('../../lib/swig'),
  twig = require('@rhinostone/swig-twig'),
  expect = require('expect.js');


/*!
 * Acceptance tests for the Phase 2 frontend wiring of #T22 (full async
 * parse path). The dormant deferred-IR backend emit branches shipped in
 * v2.1.0 are wired up here by per-tag compile() async branches that emit
 * the deferred IR shape when `options.codegenMode === 'async'`.
 *
 * Verification approach: drive `precompile(src, { codegenMode: 'async',
 * filename })` against representative templates and assert the emitted
 * JS body shape (presence of `_swig.getTemplate`, absence of
 * `_swig.compileFile`, AsyncFunction wrapper). Real-runtime execution is
 * covered by the backend-only tests at tests/swig-core/async-emit.test.js
 * — this suite asserts the frontend produces the IR the backend already
 * knows how to emit.
 *
 * Sync-mode behavior (codegenMode omitted or 'sync') is verified
 * untouched: a regular Function is produced and the sync IR emit path
 * (`_swig.compileFile`) is used.
 */

describe('Phase 2 frontend wiring — Include tag (codegenMode: "async")', function () {

  describe('native @rhinostone/swig', function () {

    it('emits IncludeDeferred shape when codegenMode is "async"', function () {
      var src = '{% include "partial.html" %}';
      var result = swig.precompile(src, {
        codegenMode: 'async',
        filename: '/tmp/parent.html'
      });
      var body = result.tpl.toString();

      expect(result.tpl.constructor.name).to.be('AsyncFunction');
      expect(body).to.contain('_swig.getTemplate');
      expect(body).to.contain('await');
      expect(body).to.contain('"partial.html"');
      expect(body).to.contain(').output');
      expect(body).to.not.contain('_swig.compileFile');
    });

    it('emits sync Include shape when codegenMode is omitted', function () {
      var src = '{% include "partial.html" %}';
      var result = swig.precompile(src, { filename: '/tmp/parent.html' });
      var body = result.tpl.toString();

      expect(result.tpl.constructor.name).to.be('Function');
      expect(body).to.contain('_swig.compileFile');
      expect(body).to.not.contain('_swig.getTemplate');
    });

    it('emits sync Include shape when codegenMode is explicitly "sync"', function () {
      var src = '{% include "partial.html" %}';
      var result = swig.precompile(src, {
        codegenMode: 'sync',
        filename: '/tmp/parent.html'
      });
      var body = result.tpl.toString();

      expect(result.tpl.constructor.name).to.be('Function');
      expect(body).to.contain('_swig.compileFile');
      expect(body).to.not.contain('_swig.getTemplate');
    });

    it('preserves with-context selector in async mode', function () {
      var src = '{% include "partial.html" with my_ctx %}';
      var result = swig.precompile(src, {
        codegenMode: 'async',
        filename: '/tmp/parent.html'
      });
      var body = result.tpl.toString();

      expect(body).to.contain('_swig.getTemplate');
      expect(body).to.contain('_utils.extend({}, _ctx,');
    });

    it('preserves ignore-missing try/catch in async mode', function () {
      var src = '{% include "partial.html" ignore missing %}';
      var result = swig.precompile(src, {
        codegenMode: 'async',
        filename: '/tmp/parent.html'
      });
      var body = result.tpl.toString();

      expect(body).to.contain('_swig.getTemplate');
      expect(body).to.contain('try {');
      expect(body).to.contain('} catch (e) {}');
    });
  });

  describe('Twig @rhinostone/swig-twig', function () {

    it('emits IncludeDeferred shape when codegenMode is "async"', function () {
      var src = '{% include "partial.twig" %}';
      var result = twig.precompile(src, {
        codegenMode: 'async',
        filename: '/tmp/parent.twig'
      });
      var body = result.tpl.toString();

      expect(result.tpl.constructor.name).to.be('AsyncFunction');
      expect(body).to.contain('_swig.getTemplate');
      expect(body).to.contain('await');
      expect(body).to.contain('"partial.twig"');
      expect(body).to.contain(').output');
      expect(body).to.not.contain('_swig.compileFile');
    });

    it('emits sync Include shape when codegenMode is omitted', function () {
      var src = '{% include "partial.twig" %}';
      var result = twig.precompile(src, { filename: '/tmp/parent.twig' });
      var body = result.tpl.toString();

      expect(result.tpl.constructor.name).to.be('Function');
      expect(body).to.contain('_swig.compileFile');
      expect(body).to.not.contain('_swig.getTemplate');
    });

    it('preserves with-context selector in async mode', function () {
      var src = '{% include "partial.twig" with my_ctx %}';
      var result = twig.precompile(src, {
        codegenMode: 'async',
        filename: '/tmp/parent.twig'
      });
      var body = result.tpl.toString();

      expect(body).to.contain('_swig.getTemplate');
      expect(body).to.contain('_utils.extend({}, _ctx,');
    });

    it('preserves "only" isolation in async mode (no _utils.extend wrap)', function () {
      var src = '{% include "partial.twig" with my_ctx only %}';
      var result = twig.precompile(src, {
        codegenMode: 'async',
        filename: '/tmp/parent.twig'
      });
      var body = result.tpl.toString();

      expect(body).to.contain('_swig.getTemplate');
      expect(body).to.not.contain('_utils.extend({}, _ctx,');
    });

    it('preserves ignore-missing try/catch in async mode', function () {
      var src = '{% include "partial.twig" ignore missing %}';
      var result = twig.precompile(src, {
        codegenMode: 'async',
        filename: '/tmp/parent.twig'
      });
      var body = result.tpl.toString();

      expect(body).to.contain('_swig.getTemplate');
      expect(body).to.contain('try {');
      expect(body).to.contain('} catch (e) {}');
    });
  });
});
