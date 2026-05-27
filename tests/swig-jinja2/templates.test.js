/*
 * End-to-end render-fixture suite for @rhinostone/swig-jinja2.
 *
 * Mirrors the native tests/templates.test.js walker — readdirSync the
 * cases/ directory, group by basename, and render every *.test.jinja2
 * against its paired *.expectation.html. Supporting templates (layouts,
 * includes, imports) use bare *.jinja2 and group under their own basename
 * with no .test. file; the walker skips those groups.
 *
 * Every expectation was cross-checked against the Jinja2 3.1.6 reference
 * implementation; the one deliberate divergence is for-keyvalue, where
 * {% for k, v in mapping %} iterates a mapping directly (the swig-family
 * behaviour) rather than requiring .items() as Jinja2 does.
 */
var fs = require('fs'),
  path = require('path'),
  expect = require('expect.js'),
  _ = require('lodash'),
  jinja2 = require('../../packages/swig-jinja2');

var locals = {
  name: 'Tacos',
  greeting: 'hello world',
  flag: true,
  done: false,
  items: ['a', 'b', 'c'],
  nums: [3, 1, 2],
  obj: { a: 1, b: 2 },
  user: { name: 'Alice' },
  empty: [],
  num: 4,
  html: '<b>x</b>',
  people: [{ city: 'NY', n: 'Bob' }, { city: 'LA', n: 'Amy' }, { city: 'NY', n: 'Cy' }]
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

function isTest(f) { return f.indexOf('.test.jinja2') !== -1; }
function isExpectation(f) { return f.indexOf('.expectation.html') !== -1; }

walkSync(__dirname + '/cases', casefiles);
cases = _.groupBy(casefiles, function (f) {
  return f.split('.')[0];
});

describe('swig-jinja2 template render fixtures', function () {
  _.each(cases, function (files, c) {
    var testFile = _.find(files, isTest);
    if (!testFile) { return; }
    var expectationFile = _.find(files, isExpectation);
    if (!expectationFile) { return; }
    var expectation = fs.readFileSync(expectationFile, 'utf8');
    it(path.basename(c), function () {
      expect(jinja2.compileFile(testFile)(locals)).to.equal(expectation);
    });
  });
});
