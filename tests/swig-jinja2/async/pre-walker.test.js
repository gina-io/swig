var expect = require('../../lib/expect.js'),
  preWalker = require('../../../packages/swig-jinja2/lib/async/pre-walker');

var SCAN_OPTS = {
  varControls: ['{{', '}}'],
  tagControls: ['{%', '%}'],
  cmtControls: ['{#', '#}'],
  rawTag: 'raw',
  keywords: ['extends', 'include', 'import', 'from']
};

describe('@rhinostone/swig-jinja2 — pre-walker.scan', function () {

  it('extracts each static-path keyword', function () {
    expect(preWalker.scan('{% extends "base.html" %}', SCAN_OPTS)).to.eql([{ kind: 'extends', path: 'base.html' }]);
    expect(preWalker.scan('{% include "p.html" %}', SCAN_OPTS)).to.eql([{ kind: 'include', path: 'p.html' }]);
    expect(preWalker.scan('{% import "f.html" as f %}', SCAN_OPTS)).to.eql([{ kind: 'import', path: 'f.html' }]);
    expect(preWalker.scan('{% from "m.html" import g %}', SCAN_OPTS)).to.eql([{ kind: 'from', path: 'm.html' }]);
  });

  it('collects multiple targets in source order', function () {
    var src = '{% extends "base.html" %}{% include "p.html" %}{% from "m.html" import g %}';
    expect(preWalker.scan(src, SCAN_OPTS)).to.eql([
      { kind: 'extends', path: 'base.html' },
      { kind: 'include', path: 'p.html' },
      { kind: 'from', path: 'm.html' }
    ]);
  });

  it('skips dynamic (non-string-literal) paths', function () {
    expect(preWalker.scan('{% extends parent_var %}', SCAN_OPTS)).to.eql([]);
    expect(preWalker.scan('{% include some.expr %}', SCAN_OPTS)).to.eql([]);
  });

  it('ignores keyword-looking content inside a raw region', function () {
    var src = '{% raw %}{% include "should-not-scan.html" %}{% endraw %}{% include "real.html" %}';
    expect(preWalker.scan(src, SCAN_OPTS)).to.eql([{ kind: 'include', path: 'real.html' }]);
  });

  it('handles whitespace-control markers on the tag', function () {
    expect(preWalker.scan('{%- include "p.html" -%}', SCAN_OPTS)).to.eql([{ kind: 'include', path: 'p.html' }]);
  });

  it('returns an empty list for source with no dependencies', function () {
    expect(preWalker.scan('plain {{ x }} text', SCAN_OPTS)).to.eql([]);
  });

});
