var twig = require('@rhinostone/swig-twig'),
  expect = require('../lib/expect.js');

/*!
 * In Twig, parent() renders the parent block's content. swig-twig does not
 * support it, so a call of the bare name is a compile error that names the
 * line and the file, wherever the call stands and whatever the name is bound
 * to (a macro, an imported macro, a function in the data), on both render
 * paths. Before, the call rendered the child's content without the parent's,
 * and a macro or a data function named parent was called.
 */
describe('swig-twig: a parent() call is a compile error', function () {
  var PARENT = '<{% block b %}P{% endblock %}>';

  function none() { return {}; }

  function asyncLoader(files) {
    var mem = twig.loaders.memory(files, '/');
    return {
      async: true,
      resolve: mem.resolve,
      load: function (id, cb) {
        if (!cb) {
          return mem.load(id);
        }
        setImmediate(function () {
          var src;
          try { src = mem.load(id); } catch (e) { cb(e); return; }
          cb(null, src);
        });
      }
    };
  }

  function message(file) {
    return new RegExp('^"parent\\(\\)" is not supported \\(swig-twig does not render parent blocks\\) on line 1 in file ' +
      file.replace(/\./g, '\\.') + '\\.$');
  }

  var refused = [
    { label: 'in an overriding block', file: '/t.html',
      files: { '/p.html': PARENT, '/t.html': '{% extends "p.html" %}{% block b %}C{{ parent() }}{% endblock %}' } },
    { label: 'at the top level of an extending template, outside its blocks', file: '/t.html',
      files: { '/p.html': PARENT, '/t.html': '{% extends "p.html" %}{{ parent() }}{% block b %}C{% endblock %}' } },
    { label: 'in a block the parent does not define', file: '/t.html',
      files: { '/p.html': PARENT, '/t.html': '{% extends "p.html" %}{% block b %}C{% endblock %}{% block z %}{{ parent() }}{% endblock %}' } },
    { label: 'at the top level of an imported file', file: '/m.html',
      files: { '/m.html': '{{ parent() }}{% macro hi() %}H{% endmacro %}', '/t.html': '{% import "m.html" as m %}[{{ m.hi() }}]' } },
    { label: 'in a template that extends nothing', file: '/t.html', files: { '/t.html': '[{{ parent() }}]' } },
    { label: 'in a set value', file: '/t.html', files: { '/t.html': '{% set v = parent() %}[{{ v }}]' } },
    { label: 'in an if test', file: '/t.html', files: { '/t.html': '[{% if parent() %}Y{% endif %}]' } },
    { label: 'with a space before the parenthesis', file: '/t.html', files: { '/t.html': '[{{ parent () }}]' } },
    { label: 'in parentheses', file: '/t.html', files: { '/t.html': '[{{ (parent)() }}]' } },
    { label: 'with an argument', file: '/t.html', files: { '/t.html': '[{{ parent(1) }}]' } },
    { label: 'in a filter argument', file: '/t.html', files: { '/t.html': '[{{ "a"|default(parent()) }}]' } },
    { label: 'when a macro of that name is defined', file: '/t.html',
      files: { '/t.html': '{% macro parent() %}M{% endmacro %}[{{ parent() }}]' } },
    { label: 'when an imported macro has that name', file: '/t.html',
      files: { '/m.html': '{% macro parent() %}M{% endmacro %}', '/t.html': '{% from "m.html" import parent %}[{{ parent() }}]' } },
    { label: 'when the data holds a function of that name', file: '/t.html', files: { '/t.html': '[{{ parent() }}]' },
      locals: function () { return { parent: function () { return 'F'; } }; } }
  ];

  refused.forEach(function (c) {
    describe(c.label, function () {
      it('on the sync render path', function () {
        var inst = new twig.Twig({ cache: false, loader: twig.loaders.memory(c.files, '/') });
        expect(function () {
          inst.renderFile('/t.html', (c.locals || none)());
        }).to.throwError(message(c.file));
      });

      it('on the async render path', function (done) {
        var inst = new twig.Twig({ cache: false, loader: asyncLoader(c.files) });
        inst.renderFile('/t.html', (c.locals || none)(), function (err) {
          try {
            expect(String(err && err.message)).to.match(message(c.file));
            done();
          } catch (e) {
            done(e);
          }
        });
      });
    });
  });

  var kept = [
    { label: 'a read of the name', files: { '/t.html': '[{{ parent }}]' }, want: '[v]',
      locals: function () { return { parent: 'v' }; } },
    { label: 'a member of the name', files: { '/t.html': '[{{ parent.y }}]' }, want: '[Y]',
      locals: function () { return { parent: { y: 'Y' } }; } },
    { label: 'a call of a member named parent', files: { '/t.html': '[{{ o.parent() }}]' }, want: '[O]',
      locals: function () { return { o: { parent: function () { return 'O'; } } }; } },
    { label: 'a call of another name', files: { '/t.html': '[{{ g() }}]' }, want: '[G]',
      locals: function () { return { g: function () { return 'G'; } }; } },
    { label: 'an overriding block without the call', want: '<C>',
      files: { '/p.html': PARENT, '/t.html': '{% extends "p.html" %}{% block b %}C{% endblock %}' } }
  ];

  kept.forEach(function (c) {
    describe(c.label + ' still renders', function () {
      it('on the sync render path', function () {
        var inst = new twig.Twig({ cache: false, loader: twig.loaders.memory(c.files, '/') });
        expect(inst.renderFile('/t.html', (c.locals || none)())).to.equal(c.want);
      });

      it('on the async render path', function (done) {
        var inst = new twig.Twig({ cache: false, loader: asyncLoader(c.files) });
        inst.renderFile('/t.html', (c.locals || none)(), function (err, out) {
          try {
            expect(err).to.equal(null);
            expect(out).to.equal(c.want);
            done();
          } catch (e) {
            done(e);
          }
        });
      });
    });
  });
});
