var swig = require('../lib/swig'),
  runtime = require('../lib/runtime'),
  expect = require('./lib/expect.js');

function tpl(source, filename) {
  return swig.precompile(source, { filename: filename }).tpl;
}

describe('swig runtime-only module', function () {
  it('registers and renders pre-compiled templates through include', function () {
    var rt = new runtime.Swig();
    rt.register('partials/nav.html', tpl('NAV {{ name|upper }}', '/partials/nav.html'));
    rt.register('page.html', tpl('[{% include "partials/nav.html" %}]', '/page.html'));
    expect(rt.renderFile('page.html', { name: 'w' })).to.equal('[NAV W]');
  });

  it('flattens include lookups to the memory-loader root by default', function () {
    var rt = new runtime.Swig();
    rt.register('partials/nav.html', tpl('NAV', '/partials/nav.html'));
    rt.register('deep/page.html', tpl('[{% include "partials/nav.html" %}]', '/deep/page.html'));
    expect(rt.renderFile('deep/page.html')).to.equal('[NAV]');
  });

  it('run matches engine semantics', function () {
    var rt = new runtime.Swig(),
      pageT = tpl('[{% include "partials/nav.html" %}]', '/page.html');
    rt.register('partials/nav.html', tpl('NAV {{ name }}', '/partials/nav.html'));
    expect(rt.run(pageT, { name: 'x' })).to.equal('[NAV x]');
  });

  it('compileFile returns the locals-binding wrapper on a hit', function () {
    var rt = new runtime.Swig();
    rt.register('x.html', tpl('X {{ name }}', '/x.html'));
    expect(rt.compileFile('x.html')({ name: 'a' })).to.equal('X a');
  });

  it('compileFile cb arm delivers hits and misses', function (done) {
    var rt = new runtime.Swig();
    rt.register('x.html', tpl('X', '/x.html'));
    rt.compileFile('x.html', {}, function (err, fn) {
      expect(err).to.equal(null);
      expect(fn()).to.equal('X');
      rt.compileFile('missing.html', {}, function (err2) {
        expect(/runtime-only build has no compiler/.test(err2.message)).to.equal(true);
        done();
      });
    });
  });

  it('a sync miss throws the no-compiler error', function () {
    var rt = new runtime.Swig();
    expect(function () {
      rt.compileFile('missing.html');
    }).to.throwError(/runtime-only build has no compiler/);
  });

  it('renderFile cb arm delivers output and errors', function (done) {
    var rt = new runtime.Swig();
    rt.register('x.html', tpl('X {{ name }}', '/x.html'));
    rt.renderFile('x.html', { name: 'b' }, function (err, out) {
      expect(err).to.equal(null);
      expect(out).to.equal('X b');
      rt.renderFile('missing.html', {}, function (err2) {
        expect(/runtime-only build has no compiler/.test(err2.message)).to.equal(true);
        done();
      });
    });
  });

  it('compiling entry points throw clear errors', function () {
    var rt = new runtime.Swig();
    ['parse', 'parseFile', 'precompile', 'compile', 'render', 'setTag'].forEach(function (method) {
      expect(function () {
        rt[method]('anything');
      }).to.throwError(/runtime-only build has no compiler/);
    });
  });

  it('getTemplate rejects with the no-compiler error', function (done) {
    var rt = new runtime.Swig();
    rt.getTemplate('x.html').then(null, function (e) {
      expect(/runtime-only build has no compiler/.test(e.message)).to.equal(true);
      done();
    });
  });

  it('setFilter participates in rendering registered templates', function () {
    var full = new swig.Swig(),
      rt = new runtime.Swig();
    function shout(input) {
      return String(input).toUpperCase() + '!';
    }
    full.setFilter('shout', shout);
    rt.setFilter('shout', shout);
    rt.register('x.html', full.precompile('{{ name|shout }}', { filename: '/x.html' }).tpl);
    expect(rt.renderFile('x.html', { name: 'a' })).to.equal('A!');
  });

  it('setExtension stores extensions on the instance', function () {
    var rt = new runtime.Swig(),
      ext = { hello: 'world' };
    rt.setExtension('myExt', ext);
    expect(rt.extensions.myExt).to.equal(ext);
  });

  it('setFilter and setDefaults validate their inputs', function () {
    var rt = new runtime.Swig();
    expect(function () {
      rt.setFilter('bad', 'not a function');
    }).to.throwError(/is not a valid function/);
    expect(function () {
      rt.setDefaults({ loader: { load: function () {} } });
    }).to.throwError(/Invalid loader option/);
    expect(function () {
      rt.setDefaults({ cache: {} });
    }).to.throwError(/Invalid cache option/);
    rt.setDefaults({ loader: runtime.loaders.memory({}, '/base') });
  });

  it('register validates arguments and the cache-disabled case', function () {
    var rt = new runtime.Swig(),
      disabled = new runtime.Swig({ cache: false });
    expect(function () {
      rt.register('', tpl('X', '/x.html'));
    }).to.throwError(/must be a non-empty string/);
    expect(function () {
      rt.register('x.html', 'nope');
    }).to.throwError(/is not a function/);
    expect(function () {
      disabled.register('x.html', tpl('X', '/x.html'));
    }).to.throwError(/caching is disabled/);
  });

  it('binds instance default locals like compile does', function () {
    var rt = new runtime.Swig({ locals: { greet: 'hi' } });
    rt.register('x.html', tpl('{{ greet }} {{ name }}', '/x.html'));
    expect(rt.compileFile('x.html')({ name: 'x' })).to.equal('hi x');
    expect(rt.compileFile('x.html')()).to.equal('hi ');
    var plain = new runtime.Swig();
    plain.register('y.html', tpl('[{{ name }}]', '/y.html'));
    expect(plain.compileFile('y.html')()).to.equal('[]');
  });

  it('module-level default instance registers, renders, and invalidates', function () {
    runtime.register('module-level.html', tpl('ML {{ name }}', '/module-level.html'));
    expect(runtime.renderFile('module-level.html', { name: 'ok' })).to.equal('ML ok');
    runtime.invalidateCache();
    expect(function () {
      runtime.renderFile('module-level.html', {});
    }).to.throwError(/runtime-only build has no compiler/);
  });
});
