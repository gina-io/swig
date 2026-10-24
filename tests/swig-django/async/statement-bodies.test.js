var expect = require('../../lib/expect.js'),
  djangoModule = require('../../../packages/swig-django');


/*!
 * Statement bodies on the async render path (renderFile(path, locals, cb)
 * with a loader that sets loader.async): an include or a block inside a for
 * loop (its empty branch too), a with or a spaceless block renders as on the
 * sync path.
 */

var templates = {
  '/p.html': '{{ x }}'
};

function render(src, cb) {
  var files = {}, k, mem, sync, asyncLoader;
  for (k in templates) {
    if (templates.hasOwnProperty(k)) {
      files[k] = templates[k];
    }
  }
  files['/t.html'] = src;
  mem = djangoModule.loaders.memory(files, '/');
  try {
    sync = new djangoModule.Django({ loader: mem, cache: false }).renderFile('/t.html', locals());
  } catch (e) {
    sync = e;
  }
  asyncLoader = {
    async: true,
    resolve: mem.resolve,
    load: function (id, done) {
      setTimeout(function () {
        var out;
        try {
          out = mem.load(id);
        } catch (e) {
          return done(e);
        }
        done(null, out);
      }, 1);
    }
  };
  new djangoModule.Django({ loader: asyncLoader, cache: false }).renderFile('/t.html', locals(), function (err, out) {
    cb(sync, err, out);
  });
}

function locals() {
  return { xs: [1, 2], ys: ['p', 'q'], x: 'T', empty: [] };
}

describe('django async render path — statement bodies', function () {

  var cases = [
    ['an include in a for loop', '{% for x in xs %}[{% include "p.html" %}]{% endfor %}', '[1][2]'],
    ['an include in the empty branch of a loop', '{% for x in empty %}-{% empty %}[{% include "p.html" %}]{% endfor %}', '[T]'],
    ['the forloop names, seen by the include and restored after the loop', '{% for x in xs %}{{ forloop.counter }}:{% include "p.html" %}{% if forloop.last %}!{% endif %} {% endfor %}{{ x }}', '1:1 2:2! T'],
    ['an include in a with', '{% with y=1 %}[{% include "p.html" %}]{% endwith %}', '[T]'],
    ['an include in a spaceless block', '{% spaceless %}<i> {% include "p.html" %} </i>{% endspaceless %}', '<i> T </i>'],
    ['a spaceless block in a loop', '{% for x in xs %}{% spaceless %}<i> {% include "p.html" %} </i>{% endspaceless %}{% endfor %}', '<i> 1 </i><i> 2 </i>'],
    ['a block in a loop', '{% for x in xs %}{% block c %}[{{ x }}]{% endblock %}{% endfor %}', '[1][2]']
  ];

  cases.forEach(function (c) {
    it('renders ' + c[0] + ' as the sync path does', function (done) {
      render(c[1], function (sync, err, out) {
        expect(sync).to.equal(c[2]);
        if (err) {
          return done(err);
        }
        expect(out).to.equal(c[2]);
        done();
      });
    });
  });
});
