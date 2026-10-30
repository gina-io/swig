var runCapped = require('../lib/run-capped.js'),
  expect = require('../lib/expect.js');

var FLAVORS = [
  { name: 'swig', mod: require.resolve('../../lib/swig'), ctor: 'Swig' },
  { name: 'swig-twig', mod: require.resolve('@rhinostone/swig-twig'), ctor: 'Twig' },
  { name: 'swig-jinja2', mod: require.resolve('@rhinostone/swig-jinja2'), ctor: 'Jinja2' },
  { name: 'swig-django', mod: require.resolve('@rhinostone/swig-django'), ctor: 'Django' }
];

// Runs in a child: an exception a callback throws surfaces there as an unhandled rejection, which
// the test runner of this process would report as a failure of the running test.
function throwing(L, ctor, entry) {
  var calls = [],
    loader = { async: true, resolve: function (to) { return to; }, load: function (id, cb) {
      setImmediate(function () {
        if (id === '/page.html') { cb(null, '[{{ x }}]'); } else { cb(new Error('Missing ' + id)); }
      });
    } };
  process.on('unhandledRejection', function (e) {
    setImmediate(function () {
      console.log(JSON.stringify({ calls: calls, unhandled: e.message }));
    });
  });
  new L[ctor]({ loader: loader }).renderFile(entry, { x: 'a' }, function (err, out) {
    calls.push(err ? err.message : out);
    throw new Error('from the callback');
  });
}

function run(flavor, entry) {
  var code = 'var L = require(' + JSON.stringify(flavor.mod) + ');(' + throwing.toString() + ')(L, ' + JSON.stringify(flavor.ctor) + ', ' + JSON.stringify(entry) + ');',
    parts = runCapped(code).split(' ');
  expect(parts.slice(0, 2).join(' ')).to.equal('null 0');
  return JSON.parse(parts.slice(2).join(' '));
}

FLAVORS.forEach(function (flavor) {
  describe(flavor.name + ' renderFile on the async render path', function () {
    it('calls the callback once when it throws after a render', function () {
      expect(run(flavor, '/page.html')).to.eql({ calls: ['[a]'], unhandled: 'from the callback' });
    });

    it('calls the callback once when it throws after a failure', function () {
      expect(run(flavor, '/missing.html')).to.eql({ calls: ['Missing /missing.html'], unhandled: 'from the callback' });
    });
  });
});
