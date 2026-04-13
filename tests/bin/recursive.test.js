var fs = require('fs'),
  exec = require('child_process').exec,
  expect = require('expect.js'),
  path = require('path'),
  swig = require('../../lib/swig'),
  filters = require('../../lib/filters'),
  utils = require('../../lib/utils'),
  bin = __dirname + '/../../bin/swig.js',
  fixtureDir = __dirname + '/../cases/recursive';

function fixPath(p) {
  p = path.normalize(p);
  return (/[A-Z]\:\\/).test(p) ? '"' + p + '"' : p;
}

function efn() { return ''; }

function loadBundle(source) {
  var moduleObj = { exports: {} };
  /*eslint-disable no-new-func*/
  (new Function('module', 'exports', source))(moduleObj, moduleObj.exports);
  /*eslint-enable no-new-func*/
  return moduleObj.exports;
}

bin = fixPath(bin);

describe('bin/swig compile --recursive', function () {
  var dir = fixPath(fixtureDir);

  it('emits a single module exporting every template under <dir>', function (done) {
    exec('node ' + bin + ' compile --recursive ' + dir, function (err, stdout, stderr) {
      expect(err).to.equal(null);
      expect(stdout).to.match(/^module\.exports = \{/);
      var bundle = loadBundle(stdout);
      expect(bundle).to.have.property('home.html');
      expect(bundle).to.have.property('partials/nav.html');
      expect(bundle).to.have.property('notes.txt');
      expect(typeof bundle['home.html']).to.equal('function');
      done();
    });
  });

  it('renders bundled templates against locals', function (done) {
    exec('node ' + bin + ' compile -r ' + dir, function (err, stdout, stderr) {
      var bundle = loadBundle(stdout);
      expect(bundle['home.html'](swig, { name: 'World' }, filters, utils, efn))
        .to.equal('Hi World\n');
      expect(bundle['partials/nav.html'](swig, {}, filters, utils, efn))
        .to.equal('[nav]\n');
      done();
    });
  });

  it('honours --ext to filter by extension', function (done) {
    exec('node ' + bin + ' compile -r ' + dir + ' --ext .html', function (err, stdout, stderr) {
      var bundle = loadBundle(stdout);
      expect(bundle).to.have.property('home.html');
      expect(bundle).to.have.property('partials/nav.html');
      expect(bundle).to.not.have.property('notes.txt');
      done();
    });
  });

  it('rejects --recursive combined with --method-name', function (done) {
    exec('node ' + bin + ' compile -r ' + dir + ' --method-name=foo', function (err, stdout, stderr) {
      expect(err).to.not.equal(null);
      expect(stderr).to.contain('--recursive cannot be combined with --method-name');
      done();
    });
  });

  it('rejects --recursive combined with positional files', function (done) {
    exec('node ' + bin + ' compile -r ' + dir + ' some-file.html', function (err, stdout, stderr) {
      expect(err).to.not.equal(null);
      expect(stderr).to.contain('--recursive does not accept positional file arguments');
      done();
    });
  });

  it('rejects --ext without --recursive', function (done) {
    exec('node ' + bin + ' compile ' + fixPath(__dirname + '/../cases/extends_1.test.html') + ' --ext .html', function (err, stdout, stderr) {
      expect(err).to.not.equal(null);
      expect(stderr).to.contain('--ext is only meaningful with --recursive');
      done();
    });
  });

  it('minifies the bundle when -m is passed', function (done) {
    exec('node ' + bin + ' compile -r ' + dir + ' -m --ext .html', function (err, stdout, stderr) {
      expect(err).to.equal(null);
      expect(stdout).to.contain('module.exports=');
      var bundle = loadBundle(stdout);
      expect(bundle['home.html'](swig, { name: 'X' }, filters, utils, efn))
        .to.equal('Hi X\n');
      done();
    });
  });

  it('writes the bundle to -o when not stdout', function (done) {
    var outFile = fixPath(__dirname + '/../tmp/bundle.js');
    try { fs.mkdirSync(path.dirname(outFile)); } catch (e) { /* ignore */ }
    try { fs.unlinkSync(outFile); } catch (e) { /* ignore */ }

    exec('node ' + bin + ' compile -r ' + dir + ' --ext .html -o ' + outFile, function (err, stdout, stderr) {
      expect(err).to.equal(null);
      expect(fs.existsSync(outFile)).to.equal(true);
      var written = fs.readFileSync(outFile, 'utf8');
      var bundle = loadBundle(written);
      expect(bundle).to.have.property('home.html');
      expect(bundle).to.have.property('partials/nav.html');
      try { fs.unlinkSync(outFile); } catch (e) { /* ignore */ }
      done();
    });
  });
});
