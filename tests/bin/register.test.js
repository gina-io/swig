var fs = require('fs'),
  exec = require('child_process').exec,
  path = require('path'),
  expect = require('../lib/expect.js'),
  swig = require('../../lib/swig'),
  bin = path.normalize(__dirname + '/../../bin/swig.js'),
  fixtures = path.normalize(__dirname + '/register-fixtures'),
  tmpdir = path.normalize(__dirname + '/../tmp'),
  outfile = path.join(tmpdir, 'register-bundle.js');

describe('bin/swig compile --recursive --register', function () {
  it('emits a self-registering bundle whose templates render through include', function (done) {
    if (!fs.existsSync(tmpdir)) {
      fs.mkdirSync(tmpdir);
    }
    exec('node ' + bin + ' compile -r . --register -o ' + outfile, { cwd: fixtures }, function (err) {
      expect(err).to.equal(null);

      var source = fs.readFileSync(outfile, 'utf8'),
        map = require(outfile),
        s = new swig.Swig({ loader: swig.loaders.memory({}, '/') });

      // Self-clean immediately: a lingering .js artifact under tests/tmp
      // is picked up by make lint and fails the pre-commit hook.
      fs.unlinkSync(outfile);

      expect(source.indexOf('__swigEngine.registerBundle(__swigTemplates)') !== -1).to.equal(true);
      // The engine may only exist as a property of the global object — under
      // AMD there is no bare `swig` binding — and a bundle that finds no
      // engine must say so rather than register nothing quietly.
      expect(source.indexOf('window.swig') !== -1).to.equal(true);
      expect(source.indexOf('console.warn') !== -1).to.equal(true);
      expect(typeof map['page.html']).to.equal('function');
      expect(typeof map['partials/nav.html']).to.equal('function');

      s.registerBundle(map);
      expect(s.run(map['page.html'], { name: 'w' }, '/page.html').replace(/\n$/, '')).to.equal('[NAV w]');
      done();
    });
  });

  it('rejects --register without --recursive', function (done) {
    exec('node ' + bin + ' compile ' + path.join(fixtures, 'page.html') + ' --register', function (err, stdout, stderr) {
      expect(!!err).to.equal(true);
      expect(/--register requires --recursive/.test(stderr)).to.equal(true);
      done();
    });
  });
});
