var twig = require('@rhinostone/swig-twig'),
  expect = require('../lib/expect.js');

describe('swig-twig register', function () {
  it('exposes register and registerBundle at module level', function () {
    expect(typeof twig.register).to.equal('function');
    expect(typeof twig.registerBundle).to.equal('function');
  });

  it('serves registered pre-compiled templates to include', function () {
    var s = new twig.Twig({ loader: twig.loaders.memory({}, '/') });
    s.register('partials/nav.html', twig.precompile('NAV {{ name }}', { filename: '/partials/nav.html' }).tpl);
    expect(s.render('[{% include "partials/nav.html" %}]', { filename: '/page.html', locals: { name: 'w' } }))
      .to.equal('[NAV w]');
  });

  it('include of an unregistered path still fails', function () {
    var s = new twig.Twig({ loader: twig.loaders.memory({}, '/') });
    expect(function () {
      s.render('{% include "partials/missing.html" %}', { filename: '/page.html' });
    }).to.throwError(/Unable to find template/);
  });
});
