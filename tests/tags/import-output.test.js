var swig = require('../../lib/swig'),
  expect = require('../lib/expect.js');


/*!
 * Output around an {% import %} on the sync render path: the template keeps
 * what it renders before the tag, at the top level, in a block of an extends
 * child, in a for loop and in a macro body. Jinja2 3.1.6 renders the same
 * output for each of these templates.
 */

var templates = {
  '/m.html': '{% macro hi() %}H{% endmacro %}',
  '/base.html': '<head>{% block b %}{% endblock %}</tail>'
};

function render(src) {
  var files = {}, k;
  for (k in templates) {
    if (templates.hasOwnProperty(k)) {
      files[k] = templates[k];
    }
  }
  files['/t.html'] = src;
  return new swig.Swig({ loader: swig.loaders.memory(files, '/'), cache: false })
    .renderFile('/t.html', { xs: [1, 2] });
}

describe('Tag: import — output around the tag', function () {
  it('keeps the text rendered before it', function () {
    expect(render('A{% import "m.html" as mm %}B{{ mm.hi() }}C')).to.equal('ABHC');
  });

  it('keeps a doctype line rendered before it', function () {
    expect(render('<!DOCTYPE html>\n{% import "m.html" as mm %}<p>{{ mm.hi() }}</p>'))
      .to.equal('<!DOCTYPE html>\n<p>H</p>');
  });

  it('keeps the parent\'s output when it sits in a block of an extends child', function () {
    expect(render('{% extends "base.html" %}{% block b %}<h1>T</h1>{% import "m.html" as mm %}{{ mm.hi() }}{% endblock %}'))
      .to.equal('<head><h1>T</h1>H</tail>');
  });

  it('keeps the output of a for loop that holds it', function () {
    expect(render('{% for x in xs %}{% import "m.html" as mm %}{{ mm.hi() }}{% endfor %}')).to.equal('HH');
  });

  it('keeps the output of a macro body that holds it', function () {
    expect(render('{% macro w() %}({% import "m.html" as mm %}{{ mm.hi() }}){% endmacro %}[{{ w() }}]'))
      .to.equal('[(H)]');
  });
});
