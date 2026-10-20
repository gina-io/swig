var swigModule = require('../../lib/swig'),
  twigModule = require('@rhinostone/swig-twig'),
  jinja2Module = require('@rhinostone/swig-jinja2'),
  djangoModule = require('@rhinostone/swig-django'),
  expect = require('../lib/expect.js');

/*!
 * Sync and async-mode compiles of the same file are cached under separate
 * keys, so neither mode is handed a function compiled for the other: a sync
 * render or include gets a function that returns a string, and an async-mode
 * compile gets one that returns a Promise of { output, exports }.
 */

var flavors = [
  ['native', swigModule.Swig],
  ['twig', twigModule.Twig],
  ['jinja2', jinja2Module.Jinja2],
  ['django', djangoModule.Django]
];

var templates = { '/a.html': 'Hi {{ n }}', '/p.html': '[{% include "a.html" %}]' };

function memoryLoader() {
  return {
    resolve: function (to) {
      return to.charAt(0) === '/' ? to : '/' + to;
    },
    load: function (id, cb) {
      var err;
      if (!templates.hasOwnProperty(id)) {
        err = new Error('Template not found: ' + id);
        if (cb) {
          cb(err);
          return;
        }
        throw err;
      }
      if (cb) {
        cb(null, templates[id]);
        return;
      }
      return templates[id];
    }
  };
}

flavors.forEach(function (flavor) {
  var Ctor = flavor[1];

  describe(flavor[0] + ' — compile cache across codegen modes', function () {
    it('an async-mode compileFile after a sync one returns an async function', function () {
      var s = new Ctor({ loader: memoryLoader() }),
        syncFn = s.compileFile('/a.html'),
        asyncFn = s.compileFile('/a.html', { codegenMode: 'async' });
      expect(asyncFn).to.not.be(syncFn);
      expect(syncFn({ n: 1 })).to.equal('Hi 1');
      return asyncFn({ n: 1 }).then(function (result) {
        expect(result.output).to.equal('Hi 1');
      });
    });

    it('a sync renderFile after an async-mode compileFile returns a string', function () {
      var s = new Ctor({ loader: memoryLoader() });
      s.compileFile('/a.html', { codegenMode: 'async' });
      expect(s.renderFile('/a.html', { n: 1 })).to.equal('Hi 1');
    });

    it('a sync include of a file compiled in async mode renders its output', function () {
      var s = new Ctor({ loader: memoryLoader() });
      s.compileFile('/a.html', { codegenMode: 'async' });
      expect(s.renderFile('/p.html', { n: 1 })).to.equal('[Hi 1]');
    });

    it('keeps both modes cached, the sync entry under the resolved path', function () {
      var keys = [],
        store = {},
        s = new Ctor({
          loader: memoryLoader(),
          cache: {
            get: function (key) { return store[key]; },
            set: function (key, val) { keys.push(key); store[key] = val; }
          }
        });
      s.compileFile('/a.html');
      s.compileFile('/a.html', { codegenMode: 'async' });
      expect(keys.length).to.equal(2);
      expect(keys[0]).to.equal('/a.html');
      expect(keys[1]).to.not.equal('/a.html');
      expect(s.compileFile('/a.html')).to.be(store['/a.html']);
      expect(s.compileFile('/a.html', { codegenMode: 'async' })).to.be(store[keys[1]]);
    });
  });
});
