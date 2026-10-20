var django = require('@rhinostone/swig-django'),
  dateformatter = require('@rhinostone/swig-core/lib/dateformatter'),
  expect = require('../lib/expect.js');


/*!
 * Engine-level edge cases of the Django frontend: option validation, the
 * module-level defaults, and the error paths of renderFileAsync and
 * compileFileAsync (deprecated, still shipped) and of the pre-walker behind
 * them. The loaders keep their templates in memory and answer asynchronously.
 */
describe('@rhinostone/swig-django — engine edge cases', function () {

  // An async loader over an in-memory map. A value that is an Error is
  // delivered as a load error; `log`, when given, records each id loaded.
  function memoryLoader(map, log) {
    return {
      async: true,
      resolve: function (to) {
        return to.charAt(0) === '/' ? to : '/' + to;
      },
      load: function (id, cb) {
        if (log) { log.push(id); }
        setImmediate(function () {
          var v = map[id];
          if (v instanceof Error) {
            cb(v);
          } else {
            cb(null, v);
          }
        });
      }
    };
  }

  // A loader whose resolve always throws; `loads` records each id loaded.
  function failingResolveLoader(loads) {
    return {
      async: true,
      resolve: function () { throw new Error('entry resolve failed'); },
      load: function (id, cb) {
        loads.push(id);
        cb(null, '');
      }
    };
  }

  describe('option validation', function () {
    it('names the control option that is malformed', function () {
      expect(function () { new django.Django({ varControls: 'x' }); }).to.throwException(/Option "varControls" must be an array containing 2 different control strings/);
      expect(function () { new django.Django({ tagControls: ['<%', '<%'] }); }).to.throwException(/Option "tagControls" open and close controls must not be the same/);
      expect(function () { new django.Django({ cmtControls: ['<', '#>'] }); }).to.throwException(/Option "cmtControls" (open|close) control must be at least 2 characters/);
    });
  });

  describe('module-level defaults', function () {
    it('setDefaults adds locals to every render', function () {
      expect(django.render('[{{ zz }}]')).to.equal('[]');
      try {
        django.setDefaults({ locals: { zz: 'DEF' } });
        expect(django.render('[{{ zz }}]')).to.equal('[DEF]');
      } finally {
        django.setDefaults({ locals: {} });
      }
      expect(django.render('[{{ zz }}]')).to.equal('[]');
    });
    it('setDefaultTZOffset shifts the date filter', function () {
      var t = new Date(Date.UTC(2020, 0, 1, 12, 0, 0)),
        saved = dateformatter.tzOffset;
      expect(django.render('{{ t|date:"H:i" }}', { locals: { t: t } })).to.equal('12:00');
      try {
        django.setDefaultTZOffset(-120);
        expect(django.render('{{ t|date:"H:i" }}', { locals: { t: t } })).to.equal('14:00');
      } finally {
        dateformatter.tzOffset = saved;
      }
    });
  });

  describe('renderFileAsync', function () {
    it('passes an error from resolving the entry path to the callback and loads nothing', function (done) {
      var loads = [],
        swig = new django.Django({ loader: failingResolveLoader(loads) });
      swig.renderFileAsync('a.html', {}, function (err) {
        expect(err.message).to.equal('entry resolve failed');
        expect(loads).to.eql([]);
        done();
      });
    });
    it('passes a parse error to the callback', function (done) {
      var swig = new django.Django({ loader: memoryLoader({ '/a.html': '{% bogus %}' }) });
      swig.renderFileAsync('a.html', {}, function (err) {
        expect(err.message).to.equal('Unexpected tag "bogus" on line 1 in file /a.html.');
        done();
      });
    });
  });

  describe('compileFileAsync', function () {
    it('accepts (path, cb) without options', function (done) {
      var swig = new django.Django({ loader: memoryLoader({ '/a.html': 'Hi {{ n }}' }) });
      swig.compileFileAsync('a.html', function (err, fn) {
        expect(err).to.be(null);
        expect(fn({ n: 'N' })).to.equal('Hi N');
        done();
      });
    });
    it('passes an error from resolving the entry path to the callback and loads nothing', function (done) {
      var loads = [],
        swig = new django.Django({ loader: failingResolveLoader(loads) });
      swig.compileFileAsync('a.html', {}, function (err) {
        expect(err.message).to.equal('entry resolve failed');
        expect(loads).to.eql([]);
        done();
      });
    });
    it('passes a parse error to the callback', function (done) {
      var swig = new django.Django({ loader: memoryLoader({ '/a.html': '{% bogus %}' }) });
      swig.compileFileAsync('a.html', {}, function (err) {
        expect(err.message).to.equal('Unexpected tag "bogus" on line 1 in file /a.html.');
        done();
      });
    });
    it('passes a load error to the callback', function (done) {
      var swig = new django.Django({ loader: memoryLoader({ '/a.html': new Error('cannot load /a.html') }) });
      swig.compileFileAsync('a.html', {}, function (err) {
        expect(err.message).to.equal('cannot load /a.html');
        done();
      });
    });
    it('restores the loader when the compiled function throws', function (done) {
      var loader = memoryLoader({ '/a.html': '{% include name %}' }),
        swig = new django.Django({ loader: loader });
      swig.compileFileAsync('a.html', {}, function (err, fn) {
        expect(err).to.be(null);
        expect(function () { fn({ name: 'missing.html' }); }).to.throwException(/Pre-walked map missing path: "\/missing\.html"/);
        expect(swig.options.loader).to.be(loader);
        done();
      });
    });
  });

  describe('pre-walker', function () {
    it('loads a template included twice only once', function (done) {
      var log = [],
        swig = new django.Django({ loader: memoryLoader({ '/a.html': '{% include "b.html" %}{% include "b.html" %}', '/b.html': 'B' }, log) });
      swig.renderFileAsync('a.html', {}, function (err, out) {
        expect(err).to.be(null);
        expect(out).to.equal('BB');
        expect(log).to.eql(['/a.html', '/b.html']);
        done();
      });
    });
    it('refuses a source that is not a string', function (done) {
      var swig = new django.Django({ loader: memoryLoader({ '/a.html': 42 }) });
      swig.renderFileAsync('a.html', {}, function (err) {
        expect(err.message).to.equal('Async loader returned non-string source for "/a.html"');
        done();
      });
    });
    it('passes an error from resolving an included path to the callback', function (done) {
      var swig = new django.Django({ loader: {
        async: true,
        resolve: function (to, from) {
          if (from) { throw new Error('cannot resolve ' + to + ' from ' + from); }
          return '/' + to;
        },
        load: function (id, cb) {
          setImmediate(function () { cb(null, '{% include "b.html" %}'); });
        }
      } });
      swig.renderFileAsync('a.html', {}, function (err) {
        expect(err.message).to.equal('cannot resolve b.html from /a.html');
        done();
      });
    });
    it('stops walking a template that arrives after a sibling failed to load', function (done) {
      var log = [],
        map = {
          '/a.html': '{% include "b.html" %}{% include "c.html" %}',
          '/b.html': new Error('b failed'),
          '/c.html': '{% include "d.html" %}',
          '/d.html': 'D'
        },
        delay = { '/b.html': 5, '/c.html': 40 },
        pending = 2,
        swig;

      function finish() {
        pending -= 1;
        if (pending) { return; }
        expect(log).to.eql(['resolve a.html', 'deliver /a.html', 'resolve b.html', 'resolve c.html', 'deliver /b.html', 'callback b failed', 'deliver /c.html']);
        done();
      }

      swig = new django.Django({ loader: {
        async: true,
        resolve: function (to) {
          log.push('resolve ' + to);
          return '/' + to;
        },
        load: function (id, cb) {
          setTimeout(function () {
            var v = map[id];
            log.push('deliver ' + id);
            if (v instanceof Error) {
              cb(v);
            } else {
              cb(null, v);
            }
            if (id === '/c.html') { setImmediate(finish); }
          }, delay[id] || 0);
        }
      } });
      swig.renderFileAsync('a.html', {}, function (err) {
        log.push('callback ' + err.message);
        finish();
      });
    });
    it('rejects an include path it did not see on the async codegen path', function () {
      var swig = new django.Django({ loader: memoryLoader({ '/a.html': '{% include name %}' }) });
      return new Promise(function (resolve, reject) {
        swig.compileFileAsync('a.html', { codegenMode: 'async' }, function (err, fn) {
          if (err) { return reject(err); }
          resolve(fn);
        });
      }).then(function (fn) {
        return fn({ name: 'missing.html' }).then(function () {
          throw new Error('expected the render to reject');
        }, function (err) {
          expect(err.message).to.equal('Pre-walked map missing path: "/missing.html"');
        });
      });
    });
    it('serves an include from the walked templates on the async codegen path', function () {
      var log = [],
        swig = new django.Django({ loader: memoryLoader({ '/a.html': '{% include "b.html" %}', '/b.html': 'B' }, log) });
      return new Promise(function (resolve, reject) {
        swig.compileFileAsync('a.html', { codegenMode: 'async' }, function (err, fn) {
          if (err) { return reject(err); }
          resolve(fn);
        });
      }).then(function (fn) {
        return fn({});
      }).then(function (res) {
        expect(res.output).to.equal('B');
        expect(log).to.eql(['/a.html', '/b.html']);
      });
    });
  });
});
