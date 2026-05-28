'use strict';

/**
 * Mocha-compatible globals over the Node built-in test runner (node:test).
 *
 * Preloaded via `node --require tests/lib/mocha-compat.js --test ...` so the
 * existing suites keep using the bare `describe` / `it` / `before` / `after` /
 * `beforeEach` / `afterEach` globals they were written against, without a
 * per-file import. The only behavioural gap to bridge is the test-function
 * signature: mocha passes the async `done` callback as the FIRST argument
 * (`function (done) {}`), whereas node:test passes its TestContext first and
 * the callback second (`function (t, done) {}`). `wrap` adapts the former to
 * the latter so callback-style async tests run unchanged.
 *
 * Assertions are unaffected: the suites use expect.js, which throws on failure
 * and is runner-agnostic, so node:test reports those throws as failures.
 */

var nodeTest = require('node:test');

/**
 * Adapt a mocha-style test/hook body to node:test's calling convention.
 * A zero-arity body is synchronous; a body that declares an argument is a
 * mocha done-callback, so produce an arity-2 `(t, done)` body (which node:test
 * runs in callback mode) and forward node:test's `done` as the body's first arg.
 *
 * @param  {Function} fn  Mocha-style test or hook body.
 * @return {Function}     A node:test-compatible body.
 * @private
 */
function wrap(fn) {
  if (typeof fn !== 'function') {
    return fn;
  }
  if (fn.length === 0) {
    return function () { return fn(); };
  }
  return function (t, done) { return fn(done); };
}

function describeFor(target) {
  return function (name, fn) { return target(name, fn); };
}

function itFor(target) {
  return function (name, fn) { return target(name, wrap(fn)); };
}

function hookFor(target) {
  return function (fn) { return target(wrap(fn)); };
}

global.describe = describeFor(nodeTest.describe);
global.describe.skip = describeFor(nodeTest.describe.skip);
global.describe.only = describeFor(nodeTest.describe.only);

global.it = itFor(nodeTest.it);
global.it.skip = itFor(nodeTest.it.skip);
global.it.only = itFor(nodeTest.it.only);

global.before = hookFor(nodeTest.before);
global.after = hookFor(nodeTest.after);
global.beforeEach = hookFor(nodeTest.beforeEach);
global.afterEach = hookFor(nodeTest.afterEach);
