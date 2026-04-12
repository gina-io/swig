var fs = require('fs'),
  path = require('path'),
  swig = require('../lib/swig'),
  expect = require('expect.js'),
  _ = require('lodash'),
  Swig = swig.Swig;

function isTest(f) {
  return (/\.test\.html$/).test(f);
}

function isExpectation(f) {
  return (/\.expectation\.html$/).test(f);
}

function walkSync(dir, cb) {
  var entries = fs.readdirSync(dir),
    dirs = [],
    files = [];
  _.each(entries, function (name) {
    if (fs.statSync(path.join(dir, name)).isDirectory()) {
      dirs.push(name);
    } else {
      files.push(name);
    }
  });
  cb(dir, dirs, files);
  _.each(dirs, function (sub) {
    walkSync(path.join(dir, sub), cb);
  });
}

describe('Templates', function () {
  var casefiles = [],
    locals = {
      alpha: 'Nachos',
      first: 'Tacos',
      second: 'Burritos',
      includefile: "./includes.html",
      bar: ["a", "b", "c"]
    },
    tests,
    expectations,
    cases;

  walkSync(__dirname + '/cases/', function (start, dirs, files) {
    _.each(files, function (f) {
      return casefiles.push(path.normalize(start + '/' + f));
    });
  });

  tests = _.filter(casefiles, isTest);
  expectations = _.filter(casefiles, isExpectation);
  cases = _.groupBy(tests.concat(expectations), function (f) {
    return f.split('.')[0];
  });

  _.each(cases, function (files, c) {
    var test = _.find(files, isTest),
      expectation = fs.readFileSync(_.find(files, isExpectation), 'utf8');

    it(c, function () {
      expect(swig.compileFile(test)(locals)).to.equal(expectation);
    });
  });

  it('throw if circular extends are found', function () {
    expect(function () {
      swig.compileFile(__dirname + '/cases-error/circular.test.html')();
    }).to.throwError(/Illegal circular extends of ".*/);
  });

  it('throw with filename reporting', function () {
    expect(function () {
      swig.compileFile(__dirname + '/cases-error/report-filename.test.html')();
    }).to.throwError(/in file .*swig\/tests\/cases-error\/report-filename-partial\.html/);
  });
});
