var django = require('@rhinostone/swig-django'),
  expect = require('../lib/expect.js');

describe('swig-django register', function () {
  it('exposes register and registerBundle at module level', function () {
    expect(typeof django.register).to.equal('function');
    expect(typeof django.registerBundle).to.equal('function');
  });

  it('serves registered pre-compiled templates to include', function () {
    var s = new django.Django({ loader: django.loaders.memory({}, '/') });
    s.register('partials/nav.html', django.precompile('NAV {{ name }}', { filename: '/partials/nav.html' }).tpl);
    expect(s.render('[{% include "partials/nav.html" %}]', { filename: '/page.html', locals: { name: 'w' } }))
      .to.equal('[NAV w]');
  });

  it('include of an unregistered path still fails', function () {
    var s = new django.Django({ loader: django.loaders.memory({}, '/') });
    expect(function () {
      s.render('{% include "partials/missing.html" %}', { filename: '/page.html' });
    }).to.throwError(/Unable to find template/);
  });
});
