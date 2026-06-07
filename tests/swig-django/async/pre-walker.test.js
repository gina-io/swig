var expect = require('../../lib/expect.js'),
  preWalker = require('../../../packages/swig-django/lib/async/pre-walker');

var SCAN_OPTS = {
  varControls: ['{{', '}}'],
  tagControls: ['{%', '%}'],
  cmtControls: ['{#', '#}'],
  rawTag: 'verbatim',
  keywords: ['extends', 'include']
};

describe('@rhinostone/swig-django — pre-walker.scan', function () {

  it('extracts each static-path keyword', function () {
    expect(preWalker.scan('{% extends "base.html" %}', SCAN_OPTS)).to.eql([{ kind: 'extends', path: 'base.html' }]);
    expect(preWalker.scan('{% include "p.html" %}', SCAN_OPTS)).to.eql([{ kind: 'include', path: 'p.html' }]);
  });

  it('collects multiple targets in source order', function () {
    var src = '{% extends "base.html" %}{% include "p.html" %}{% include "q.html" %}';
    expect(preWalker.scan(src, SCAN_OPTS)).to.eql([
      { kind: 'extends', path: 'base.html' },
      { kind: 'include', path: 'p.html' },
      { kind: 'include', path: 'q.html' }
    ]);
  });

  it('extracts only the leading quoted path from an include with-context args', function () {
    expect(preWalker.scan('{% include "p.html" with a=1 b=2 %}', SCAN_OPTS))
      .to.eql([{ kind: 'include', path: 'p.html' }]);
  });

  it('skips dynamic (non-string-literal) paths', function () {
    expect(preWalker.scan('{% extends parent_var %}', SCAN_OPTS)).to.eql([]);
    expect(preWalker.scan('{% include some.expr %}', SCAN_OPTS)).to.eql([]);
  });

  it('ignores keyword-looking content inside a verbatim region', function () {
    var src = '{% verbatim %}{% include "should-not-scan.html" %}{% endverbatim %}{% include "real.html" %}';
    expect(preWalker.scan(src, SCAN_OPTS)).to.eql([{ kind: 'include', path: 'real.html' }]);
  });

  it('returns an empty list for source with no dependencies', function () {
    expect(preWalker.scan('plain {{ x }} text', SCAN_OPTS)).to.eql([]);
  });

});
