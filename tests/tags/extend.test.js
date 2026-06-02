var fs = require('fs'),
  swig = require('../../lib/swig'),
  expect = require('expect.js');

describe('Tag: extends', function () {
  it('throws if template has no filename', function () {
    expect(function () {
      swig.render('{% extends "foobar" %}');
    }).to.throwError(/Cannot extend "foobar" because current template has no filename\./);
  });

  it('throws a helpful error on a dynamic parent path rendered synchronously', function () {
    expect(function () {
      swig.render('{% extends layoutVar %}');
    }).to.throwError(/requires the async render path/);
  });
});
