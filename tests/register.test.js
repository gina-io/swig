var swig = require('../lib/swig'),
  expect = require('./lib/expect.js'),
  fs = require('fs'),
  path = require('path'),
  os = require('os');

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

  it('does not let a registration shadow a loadable extends parent', function () {
    var root = fs.mkdtempSync(path.join(os.tmpdir(), 'swig-extends-')),
      s;
    fs.writeFileSync(path.join(root, 'layout.html'), 'L[{% block b %}base{% endblock %}]');
    fs.writeFileSync(path.join(root, 'child.html'), '{% extends "layout.html" %}{% block b %}child{% endblock %}');

    s = new swig.Swig({ loader: swig.loaders.fs(root) });
    s.register('layout.html', precompiled('L[{% block b %}base{% endblock %}]', path.join(root, 'layout.html')));

    expect(s.renderFile('child.html')).to.equal('L[child]');

    fs.unlinkSync(path.join(root, 'layout.html'));
    fs.unlinkSync(path.join(root, 'child.html'));
    fs.rmdirSync(root);
  });

  it('reports a clear error when an extends parent is only registered', function () {
    var root = fs.mkdtempSync(path.join(os.tmpdir(), 'swig-extends-')),
      s;
    fs.writeFileSync(path.join(root, 'child.html'), '{% extends "layout.html" %}{% block b %}child{% endblock %}');

    s = new swig.Swig({ loader: swig.loaders.fs(root) });
    s.register('layout.html', precompiled('L[{% block b %}base{% endblock %}]', path.join(root, 'layout.html')));

    expect(function () {
      s.renderFile('child.html');
    }).to.throwError();

    fs.unlinkSync(path.join(root, 'child.html'));
    fs.rmdirSync(root);
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

  it('throws for every disabled-cache spelling, not just false', function () {
    [null, 0, ''].forEach(function (value) {
      var s = new swig.Swig({ cache: value, loader: swig.loaders.memory({}, '/') });
      expect(function () {
        s.register('x.html', precompiled('X', '/x.html'));
      }).to.throwError(/caching is disabled/);
    });
  });

  it('registers a bundle atomically', function () {
    var s = new swig.Swig({ loader: swig.loaders.memory({}, '/') });

    expect(function () {
      s.registerBundle({
        'a.html': precompiled('A', '/a.html'),
        'b.html': 'not a function',
        'z.html': precompiled('Z', '/z.html')
      });
    }).to.throwError(/is not a function/);

    expect(Object.keys(s.cache).length).to.equal(0);
  });

  it('rejects a bundle that is not an object', function () {
    var s = new swig.Swig({ loader: swig.loaders.memory({}, '/') });
    [null, undefined, 42, 'templates'].forEach(function (value) {
      expect(function () {
        s.registerBundle(value);
      }).to.throwError(/must be an object/);
    });
  });

  it('primes a usable cache entry when run is given a filepath', function () {
    var s = new swig.Swig({ loader: swig.loaders.memory({}, '/') });
    // run's priming used to store the raw template function, whose argument
    // shape include-emitted code cannot call.
    s.run(precompiled('NAV {{ name|upper }}', '/partials/nav.html'), { name: 'a' }, 'partials/nav.html');
    expect(s.render('[{% include "partials/nav.html" %}]', { filename: '/page.html', locals: { name: 'b' } }))
      .to.equal('[NAV B]');
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
