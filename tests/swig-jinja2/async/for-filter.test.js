var expect = require('../../lib/expect.js'),
  jinja2Module = require('../../../packages/swig-jinja2');


/*!
 * A loop filter ({% for x in xs if cond %}) on the async render path,
 * renderFile(path, locals, cb) with an async loader, renders as on the sync
 * path, in the rendered template and in an included one.
 */
describe('jinja2 loop filters — async render path', function () {

  var templates = {
    '/main.html': '{% for i in lst if i > 1 %}[{{ i }}/{{ loop.length }}]{% else %}E{% endfor %}|{% include "part.html" %}',
    '/part.html': '{% for k, v in d|dictsort if v > 1 %}{{ k }}{% endfor %}'
  };
  var locals = { lst: [1, 2, 3], d: { a: 1, b: 2, c: 3 } };

  it('renders as the sync path does', function (done) {
    var syncLoader = jinja2Module.loaders.memory(templates, '/'),
      asyncLoader = {
        async: true,
        resolve: syncLoader.resolve,
        load: function (id, cb) {
          Promise.resolve().then(function () {
            if (templates.hasOwnProperty(id)) {
              cb(null, templates[id]);
            } else {
              cb(new Error('Template not found: ' + id));
            }
          });
        }
      },
      sync = new jinja2Module.Jinja2({ loader: syncLoader, cache: false }).renderFile('/main.html', locals);
    expect(sync).to.equal('[2/2][3/2]|bc');
    new jinja2Module.Jinja2({ loader: asyncLoader, cache: false }).renderFile('/main.html', locals, function (err, out) {
      if (err) {
        return done(err);
      }
      expect(out).to.equal(sync);
      done();
    });
  });
});
