/*
 * End-to-end render-fixture suite for @rhinostone/swig-twig.
 *
 * Mirrors the native tests/templates.test.js walker — readdirSync the
 * cases/ directory, group by basename, and render every *.test.twig
 * against its paired *.expectation.html. Supporting templates (layouts,
 * includes, imports) use bare *.twig and group under their own basename
 * with no .test. file; the walker skips those groups.
 *
 * Known gaps — fixtures intentionally omitted, not just untested:
 *
 * - `..` range and `is X` tests lower to _ctx._range / _ctx._test_<name>
 *   calls. Those runtime helpers are not registered on the swig-twig
 *   engine — the compiled template's _fn fallback silently swallows the
 *   call (returns ''). Surface as Phase 4 follow-up.
 *
 * - emitVarRef coerces undefined/null _ctx lookups to "". That breaks
 *   the undefined-fallback path of `??` (yields "" instead of the
 *   right-hand fallback). Null-coalesce fixture below tests the
 *   defined-value pass-through path only.
 */
var fs = require('fs'),
  path = require('path'),
  expect = require('expect.js'),
  _ = require('lodash'),
  twig = require('../../packages/swig-twig');

var locals = {
  alpha: 'Nachos',
  first: 'Tacos',
  second: 'Burritos',
  flag: true,
  defined: 'present',
  bar: ['a', 'b', 'c']
};

var casefiles = [],
  cases;

function walkSync(dir, files) {
  fs.readdirSync(dir).forEach(function (file) {
    var statPath = path.join(dir, file),
      stat = fs.statSync(statPath);
    if (stat.isFile()) {
      files.push(statPath);
    } else if (stat.isDirectory()) {
      walkSync(statPath, files);
    }
  });
}

function isTest(f) { return f.indexOf('.test.twig') !== -1; }
function isExpectation(f) { return f.indexOf('.expectation.html') !== -1; }

walkSync(__dirname + '/cases', casefiles);
cases = _.groupBy(casefiles, function (f) {
  return f.split('.')[0];
});

describe('swig-twig template render fixtures', function () {
  _.each(cases, function (files, c) {
    var testFile = _.find(files, isTest);
    if (!testFile) { return; }
    var expectationFile = _.find(files, isExpectation);
    if (!expectationFile) { return; }
    var expectation = fs.readFileSync(expectationFile, 'utf8');
    it(path.basename(c), function () {
      expect(twig.compileFile(testFile)(locals)).to.equal(expectation);
    });
  });
});
