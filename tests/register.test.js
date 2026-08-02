var swig = require('../lib/swig'),
  expect = require('./lib/expect.js');

function precompiled(source, filename) {
  return swig.precompile(source, { filename: filename }).tpl;
}

describe('swig.register', function () {
  it('serves a registered template to include with no source in the loader', function () {
    var s = new swig.Swig({ loader: swig.loaders.memory({}, '/') });
    s.register('partials/nav.html', precompiled('NAV-STATIC', '/partials/nav.html'));
    expect(s.render('[{% include "partials/nav.html" %}]', { filename: '/page.html' }))
      .to.equal('[NAV-STATIC]');
  });

  it('binds locals and filters for registered dynamic partials', function () {
    var s = new swig.Swig({ loader: swig.loaders.memory({}, '/') });
    s.register('partials/nav.html', precompiled('NAV {{ name|upper }}', '/partials/nav.html'));
    expect(s.render('{% include "partials/nav.html" %}', { filename: '/page.html', locals: { name: 'world' } }))
      .to.equal('NAV WORLD');
  });

  it('normalizes the registration path through the loader', function () {
    var s = new swig.Swig({ loader: swig.loaders.memory({}, '/') });
    s.register('/partials/x.html', precompiled('X', '/partials/x.html'));
    expect(s.render('{% include "partials/x.html" %}', { filename: '/page.html' }))
      .to.equal('X');
  });

  it('include of an unregistered path still fails', function () {
    var s = new swig.Swig({ loader: swig.loaders.memory({}, '/') });
    s.register('partials/here.html', precompiled('HERE', '/partials/here.html'));
    expect(function () {
      s.render('{% include "partials/missing.html" %}', { filename: '/page.html' });
    }).to.throwError(/Unable to find template/);
  });

  it('supports direct compileFile and renderFile lookups', function () {
    var s = new swig.Swig({ loader: swig.loaders.memory({}, '/') });
    s.register('partials/nav.html', precompiled('NAV {{ name }}', '/partials/nav.html'));
    expect(s.compileFile('partials/nav.html')({ name: 'a' })).to.equal('NAV a');
    expect(s.renderFile('partials/nav.html', { name: 'b' })).to.equal('NAV b');
  });

  it('registerBundle registers every entry and chains', function () {
    var s = new swig.Swig({ loader: swig.loaders.memory({}, '/') });
    var ret = s.registerBundle({
      'a.html': precompiled('A', '/a.html'),
      'partials/b.html': precompiled('B', '/partials/b.html')
    });
    expect(ret).to.equal(s);
    expect(s.render('{% include "a.html" %}{% include "partials/b.html" %}', { filename: '/page.html' }))
      .to.equal('AB');
  });

  it('binds instance default locals like compile does', function () {
    var s = new swig.Swig({ locals: { greet: 'hi' }, loader: swig.loaders.memory({}, '/') });
    s.register('partials/greet.html', precompiled('{{ greet }} {{ name }}', '/partials/greet.html'));
    expect(s.compileFile('partials/greet.html')({ name: 'x' })).to.equal('hi x');
    expect(s.compileFile('partials/greet.html')()).to.equal('hi ');
  });

  it('renders an empty context when no locals are bound or given', function () {
    var s = new swig.Swig({ loader: swig.loaders.memory({}, '/') });
    s.register('partials/plain.html', precompiled('[{{ name }}]', '/partials/plain.html'));
    expect(s.compileFile('partials/plain.html')()).to.equal('[]');
  });

  it('validates path and function arguments', function () {
    var s = new swig.Swig({ loader: swig.loaders.memory({}, '/') });
    expect(function () {
      s.register('', precompiled('X', '/x.html'));
    }).to.throwError(/must be a non-empty string/);
    expect(function () {
      s.register('x.html', 'not a function');
    }).to.throwError(/is not a function/);
  });

  it('throws when caching is disabled', function () {
    var s = new swig.Swig({ cache: false, loader: swig.loaders.memory({}, '/') });
    expect(function () {
      s.register('x.html', precompiled('X', '/x.html'));
    }).to.throwError(/caching is disabled/);
  });

  it('is isolated per instance', function () {
    var s1 = new swig.Swig({ loader: swig.loaders.memory({}, '/') }),
      s2 = new swig.Swig({ loader: swig.loaders.memory({}, '/') });
    s1.register('partials/only1.html', precompiled('ONE', '/partials/only1.html'));
    expect(s1.render('{% include "partials/only1.html" %}', { filename: '/page.html' })).to.equal('ONE');
    expect(function () {
      s2.render('{% include "partials/only1.html" %}', { filename: '/page.html' });
    }).to.throwError(/Unable to find template/);
  });
});
