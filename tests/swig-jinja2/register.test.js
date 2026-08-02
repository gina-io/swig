var jinja2 = require('@rhinostone/swig-jinja2'),
  expect = require('../lib/expect.js');

describe('swig-jinja2 register', function () {
  it('exposes register and registerBundle at module level', function () {
    expect(typeof jinja2.register).to.equal('function');
    expect(typeof jinja2.registerBundle).to.equal('function');
  });

  it('serves registered pre-compiled templates to include', function () {
    var s = new jinja2.Jinja2({ loader: jinja2.loaders.memory({}, '/') });
    s.register('partials/nav.html', jinja2.precompile('NAV {{ name }}', { filename: '/partials/nav.html' }).tpl);
    expect(s.render('[{% include "partials/nav.html" %}]', { filename: '/page.html', locals: { name: 'w' } }))
      .to.equal('[NAV w]');
  });

  it('include of an unregistered path still fails', function () {
    var s = new jinja2.Jinja2({ loader: jinja2.loaders.memory({}, '/') });
    expect(function () {
      s.render('{% include "partials/missing.html" %}', { filename: '/page.html' });
    }).to.throwError(/Unable to find template/);
  });
});
