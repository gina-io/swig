var swig = require('../../lib/swig'),
  expect = require('expect.js'),
  _ = require('lodash'),
  Swig = swig.Swig;

describe('Tag: import', function () {
  it('throws on bad arguments', function () {
    expect(function () {
      swig.render('{% import bar %}');
    }).to.throwError(/Unexpected variable "bar" on line 1\./);
    expect(function () {
      swig.render('{% import "' + __dirname + '/../cases/import.test.html' + '" "bar" %}');
    }).to.throwError(/Unexpected string "bar" on line 1\./);
  });

  it('makes a file\'s own imports visible inside its macros', function () {
    // import-nested-sub.html imports import-nested-base.html and defines a
    // macro that calls a macro from it. Before the fix the file-level import
    // was invisible inside the macro body, so the call rendered empty.
    var out = swig.render(
      '{% import "' + __dirname + '/../cases/import-nested-sub.html" as sub %}{{ sub.greet() }}'
    );
    expect(out.replace(/\s+/g, '')).to.equal('<p>HELLO</p>');
  });
});
