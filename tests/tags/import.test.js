var swig = require('../../lib/swig'),
  expect = require('../lib/expect.js'),
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

  it('does not leak a nested-import alias into the parent scope', function () {
    // import-nested-sub.html imports import-nested-base.html "as base". After a
    // parent imports sub, `base` belongs to sub's scope and must NOT be visible
    // as a bare name in the parent. Before the fix the alias leaked into _ctx
    // and `base` resolved to the leaked namespace object.
    var out = swig.render(
      '{% import "' + __dirname + '/../cases/import-nested-sub.html" as sub %}' +
      '[{% if base %}LEAKED{% else %}clean{% endif %}][{{ sub.greet() }}]'
    );
    expect(out.replace(/\s+/g, '')).to.equal('[clean][<p>HELLO</p>]');
  });

  it('does not clobber a same-named parent variable', function () {
    // A parent variable named `base` must survive an import whose own nested
    // import is aliased `base` — the leaked alias used to overwrite it.
    var out = swig.render(
      '{% set base = "PARENT" %}' +
      '{% import "' + __dirname + '/../cases/import-nested-sub.html" as sub %}' +
      '[{{ base }}][{{ sub.greet() }}]'
    );
    expect(out.replace(/\s+/g, '')).to.equal('[PARENT][<p>HELLO</p>]');
  });

  it('does not corrupt an imported macro when the parent later sets the leaked name', function () {
    // The macro reads its own file's import at call time. A parent {% set %} of
    // the (formerly leaked) name must not break a later call.
    var out = swig.render(
      '{% import "' + __dirname + '/../cases/import-nested-sub.html" as sub %}' +
      '[{{ sub.greet() }}]{% set base = "X" %}[{{ sub.greet() }}]'
    );
    expect(out.replace(/\s+/g, '')).to.equal('[<p>HELLO</p>][<p>HELLO</p>]');
  });

  it('does not leak transitively-imported aliases across import depth', function () {
    // a imports b (as bb), b imports c (as cc); a.top() -> bb.mid() -> cc.deep().
    // The whole chain must resolve AND neither bb nor cc may appear bare in the
    // parent that imports a (cascade).
    var out = swig.render(
      '{% import "' + __dirname + '/../cases/import-cascade-a.html" as a %}' +
      '[{{ a.top() }}][{% if bb %}bb{% endif %}{% if cc %}cc{% endif %}clean]'
    );
    expect(out.replace(/\s+/g, '')).to.equal('[[DEEP]][clean]');
  });
});
