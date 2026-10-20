var expect = require('./lib/expect.js');

/*!
 * Every package of the family exports its version as a string. The five are
 * released together, so they share one version; `make version` stamps each
 * export from package.json.
 */
describe('package versions', function () {
  var packages = [
    ['@rhinostone/swig', '../index.js', '../package.json'],
    ['@rhinostone/swig-core', '@rhinostone/swig-core', '../packages/swig-core/package.json'],
    ['@rhinostone/swig-twig', '@rhinostone/swig-twig', '../packages/swig-twig/package.json'],
    ['@rhinostone/swig-jinja2', '@rhinostone/swig-jinja2', '../packages/swig-jinja2/package.json'],
    ['@rhinostone/swig-django', '@rhinostone/swig-django', '../packages/swig-django/package.json']
  ];

  packages.forEach(function (p) {
    it(p[0] + ' exports the version in its package.json', function () {
      expect(require(p[1]).version).to.equal(require(p[2]).version);
    });
  });

  it('the five packages share one version', function () {
    var first = require(packages[0][2]).version;
    packages.forEach(function (p) {
      expect(require(p[2]).version).to.equal(first);
    });
  });
});
