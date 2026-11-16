var jinja2 = require('@rhinostone/swig-jinja2'),
  expect = require('../lib/expect.js');

/*!
 * In Jinja2, super() renders the parent block's content (Jinja2 3.1.6 renders
 * <CP> for the first shape below). swig-jinja2 does not support it, so a call
 * of the bare name is a compile error that names the line and the file,
 * wherever the call stands, on both render paths. Before, it failed with a raw
 * JavaScript syntax error where the template was compiled, and rendered
 * nothing in the parts the compile skips (the top level of an extending
 * template outside its blocks, and on the sync path a block the parent does
 * not define and an imported file's top level).
 */
describe('swig-jinja2: a super() call is a compile error', function () {
  var PARENT = '<{% block b %}P{% endblock %}>';

  function none() { return {}; }

  function asyncLoader(files) {
    var mem = jinja2.loaders.memory(files, '/');
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
    return new RegExp('^"super\\(\\)" is not supported \\(swig-jinja2 does not render parent blocks\\) on line 1 in file ' +
      file.replace(/\./g, '\\.') + '\\.$');
  }

  var refused = [
    { label: 'in an overriding block', file: '/t.html',
      files: { '/p.html': PARENT, '/t.html': '{% extends "p.html" %}{% block b %}C{{ super() }}{% endblock %}' } },
    { label: 'at the top level of an extending template, outside its blocks', file: '/t.html',
      files: { '/p.html': PARENT, '/t.html': '{% extends "p.html" %}{{ super() }}{% block b %}C{% endblock %}' } },
    { label: 'in a block the parent does not define', file: '/t.html',
      files: { '/p.html': PARENT, '/t.html': '{% extends "p.html" %}{% block b %}C{% endblock %}{% block z %}{{ super() }}{% endblock %}' } },
    { label: 'at the top level of an imported file', file: '/m.html',
      files: { '/m.html': '{{ super() }}{% macro hi() %}H{% endmacro %}', '/t.html': '{% import "m.html" as m %}[{{ m.hi() }}]' } },
    { label: 'in a template that extends nothing', file: '/t.html', files: { '/t.html': '[{{ super() }}]' } },
    { label: 'in a set value', file: '/t.html', files: { '/t.html': '{% set v = super() %}[{{ v }}]' } },
    { label: 'in an if test', file: '/t.html', files: { '/t.html': '[{% if super() %}Y{% endif %}]' } },
    { label: 'with a space before the parenthesis', file: '/t.html', files: { '/t.html': '[{{ super () }}]' } },
    { label: 'in parentheses', file: '/t.html', files: { '/t.html': '[{{ (super)() }}]' } },
    { label: 'with an argument', file: '/t.html', files: { '/t.html': '[{{ super(1) }}]' } },
    { label: 'in a filter argument', file: '/t.html', files: { '/t.html': '[{{ "a"|default(super()) }}]' } },
    { label: 'when the data holds a function of that name', file: '/t.html', files: { '/t.html': '[{{ super() }}]' },
      locals: function () { return { super: function () { return 'F'; } }; } }
  ];

  refused.forEach(function (c) {
    describe(c.label, function () {
      it('on the sync render path', function () {
        var inst = new jinja2.Jinja2({ cache: false, loader: jinja2.loaders.memory(c.files, '/') });
        expect(function () {
          inst.renderFile('/t.html', (c.locals || none)());
        }).to.throwError(message(c.file));
      });

      it('on the async render path', function (done) {
        var inst = new jinja2.Jinja2({ cache: false, loader: asyncLoader(c.files) });
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
    { label: 'a call of a member named super', files: { '/t.html': '[{{ o.super() }}]' }, want: '[O]',
      locals: function () { return { o: { super: function () { return 'O'; } } }; } },
    { label: 'a call of another name', files: { '/t.html': '[{{ g() }}]' }, want: '[G]',
      locals: function () { return { g: function () { return 'G'; } }; } },
    { label: 'an overriding block without the call', want: '<C>',
      files: { '/p.html': PARENT, '/t.html': '{% extends "p.html" %}{% block b %}C{% endblock %}' } }
  ];

  kept.forEach(function (c) {
    describe(c.label + ' still renders', function () {
      it('on the sync render path', function () {
        var inst = new jinja2.Jinja2({ cache: false, loader: jinja2.loaders.memory(c.files, '/') });
        expect(inst.renderFile('/t.html', (c.locals || none)())).to.equal(c.want);
      });

      it('on the async render path', function (done) {
        var inst = new jinja2.Jinja2({ cache: false, loader: asyncLoader(c.files) });
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
