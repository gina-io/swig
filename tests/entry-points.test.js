var expect = require('./lib/expect.js');

// No other test requires these files, so without this suite `make coverage`
// could not see them.
describe('Entry points that only consumers require', function () {
  it('lib/loaders/filesystem.js and memory.js re-export the swig-core loaders', function () {
    expect(require('../lib/loaders/filesystem')).to.equal(require('@rhinostone/swig-core/lib/loaders/filesystem'));
    expect(require('../lib/loaders/memory')).to.equal(require('@rhinostone/swig-core/lib/loaders/memory'));
  });

  it('the @rhinostone/swig-core package main exposes its modules', function () {
    var core = require('@rhinostone/swig-core');
    ['utils', 'security', 'ir', 'tokentypes', 'tokenparser', 'loaders', 'filters', 'dateformatter', 'backend', 'cache', 'engine'].forEach(function (name) {
      expect(core[name]).to.equal(require('@rhinostone/swig-core/lib/' + name));
    });
  });
});
