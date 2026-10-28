var django = require('@rhinostone/swig-django'),
  expect = require('../lib/expect.js');


/*!
 * A variable that fails to resolve (a missing name, key or index, or a None
 * value that a later segment reads), read by filters and by the values of
 * with, cycle and include-with, checked against Django 5.2: Django gives it
 * string_if_invalid ("") before any filter runs, while if, for and firstof
 * read it as None. Each expectation is the output Django gives for the same
 * template, on the sync and on the async render path.
 */
describe('@rhinostone/swig-django — a variable that fails to resolve', function () {

  function render(src, locals) {
    return django.render(src, { locals: locals || {} });
  }

  function renderFiles(files, locals) {
    return new django.Django({ loader: django.loaders.memory(files, '/'), cache: false }).renderFile('/e.html', locals || {});
  }

  function renderAsync(files, locals, cb) {
    var mem = django.loaders.memory(files, '/'),
      loader = {
        async: true,
        resolve: mem.resolve,
        load: function (id, done) {
          if (!done) {
            return mem.load(id);
          }
          setImmediate(function () {
            var out;
            try {
              out = mem.load(id);
            } catch (e) {
              return done(e);
            }
            done(null, out);
          });
        }
      };
    new django.Django({ loader: loader, cache: false }).renderFile('/e.html', locals, cb);
  }

  describe('a missing variable reaches its filters as "", as in Django', function () {
    it('string filters', function () {
      expect(render('[{{ x|upper }}]')).to.equal('[]');
      expect(render('[{{ x|lower }}]')).to.equal('[]');
      expect(render('[{{ x|title }}]')).to.equal('[]');
      expect(render('[{{ x|capfirst }}]')).to.equal('[]');
      expect(render('[{{ x|slugify }}]')).to.equal('[]');
      expect(render('[{{ x|striptags }}]')).to.equal('[]');
      expect(render('[{{ x|linebreaksbr }}]')).to.equal('[]');
      expect(render('[{{ x|urlencode }}]')).to.equal('[]');
      expect(render('[{{ x|cut:"a" }}]')).to.equal('[]');
      expect(render('[{{ x|escape }}]')).to.equal('[]');
      expect(render('[{{ x|safe }}]')).to.equal('[]');
      expect(render('[{{ x|addslashes }}]')).to.equal('[]');
      expect(render('[{{ x|linenumbers }}]')).to.equal('[1. ]');
      expect(render('[{{ x|center:5 }}]')).to.equal('[     ]');
      expect(render('[{{ x|ljust:3 }}]')).to.equal('[   ]');
    });
    it('defaults, tests and counts', function () {
      expect(render('[{{ x|default_if_none:"d" }}]')).to.equal('[]');
      expect(render('[{{ x|default:"d" }}]')).to.equal('[d]');
      expect(render('[{{ x|yesno }}]')).to.equal('[no]');
      expect(render('[{{ x|length }}]')).to.equal('[0]');
      expect(render('[{{ x|wordcount }}]')).to.equal('[0]');
      expect(render('[{{ x|first }}]')).to.equal('[]');
      expect(render('[{{ x|last }}]')).to.equal('[]');
      expect(render('[{{ x|join:"," }}]')).to.equal('[]');
      expect(render('[{{ x|pluralize }}]')).to.equal('[]');
      expect(render('[{{ x|floatformat }}]')).to.equal('[]');
      expect(render('[{{ x|date:"Y" }}]')).to.equal('[]');
    });
    it('truncation and chains', function () {
      expect(render('[{{ x|truncatechars:3 }}]')).to.equal('[]');
      expect(render('[{{ x|truncatewords:2 }}]')).to.equal('[]');
      expect(render('[{{ x|lower|upper }}]')).to.equal('[]');
      expect(render('[{{ x|first|upper }}]')).to.equal('[]');
      expect(render('[{{ x|title|length }}]')).to.equal('[0]');
    });
  });

  describe('a failed lookup inside a path is a missing variable', function () {
    it('a None value that a later segment reads', function () {
      expect(render('[{{ x.y|upper }}]', { x: null })).to.equal('[]');
      expect(render('[{{ x.y|default_if_none:"d" }}]', { x: null })).to.equal('[]');
      expect(render('[{{ x.y.z|default_if_none:"d" }}]', { x: { y: null } })).to.equal('[]');
    });
    it('a missing key or index', function () {
      expect(render('[{{ x.0|upper }}]', { x: [] })).to.equal('[]');
      expect(render('[{{ x.y.z|upper }}]', { x: {} })).to.equal('[]');
      expect(render('[{{ x.y|default_if_none:"d" }}]', { x: {} })).to.equal('[]');
    });
  });

  describe('the values of with, cycle and include-with', function () {
    it('with', function () {
      expect(render('{% with y=x|upper %}[{{ y }}]{% endwith %}')).to.equal('[]');
      expect(render('{% with y=x|default_if_none:"d" %}[{{ y }}]{% endwith %}')).to.equal('[]');
      expect(render('{% with y=x|length %}[{{ y }}]{% endwith %}')).to.equal('[0]');
      expect(render('{% with y=x %}[{{ y|default_if_none:"d" }}]{% endwith %}')).to.equal('[]');
      expect(render('{% with x|upper as y %}[{{ y }}]{% endwith %}')).to.equal('[]');
    });
    it('cycle', function () {
      expect(render('{% for i in "ab" %}[{% cycle x|upper "z" %}]{% endfor %}')).to.equal('[][z]');
      expect(render('{% for i in "ab" %}[{% cycle x|default_if_none:"d" "z" %}]{% endfor %}')).to.equal('[][z]');
      expect(render('{% for i in "ab" %}[{% cycle x "z" %}]{% endfor %}')).to.equal('[][z]');
    });
    it('include with', function () {
      expect(renderFiles({ '/p.html': '[{{ y }}][{{ y|default_if_none:"d" }}]', '/e.html': '{% include "p.html" with y=x|upper %}' })).to.equal('[][]');
      expect(renderFiles({ '/p.html': '[{{ y }}][{{ y|default_if_none:"d" }}]', '/e.html': '{% include "p.html" with y=x %}' })).to.equal('[][]');
      expect(renderFiles({ '/p.html': '[{{ y }}][{{ y|default_if_none:"d" }}]', '/e.html': '{% include "p.html" with y=x.z %}' }, { x: null })).to.equal('[][]');
    });
  });

  describe('if, for and firstof read a failed lookup as None, as in Django', function () {
    it('if', function () {
      expect(render('{% if x|default_if_none:"d" %}Y{% else %}N{% endif %}')).to.equal('Y');
      expect(render('{% if x|yesno == "maybe" %}Y{% else %}N{% endif %}')).to.equal('Y');
      expect(render('{% if x|length == 0 %}Y{% else %}N{% endif %}')).to.equal('Y');
      expect(render('{% if x.y|default_if_none:"d" %}Y{% else %}N{% endif %}', { x: null })).to.equal('Y');
      expect(render('{% if not x %}Y{% else %}N{% endif %}')).to.equal('Y');
      expect(render('{% if x|default:"" %}Y{% else %}N{% endif %}')).to.equal('N');
    });
    it('for and firstof', function () {
      expect(render('{% for i in x %}[{{ i }}]{% empty %}E{% endfor %}')).to.equal('E');
      expect(render('{% for i in x|default_if_none:"ab" %}[{{ i }}]{% empty %}E{% endfor %}')).to.equal('[a][b]');
      expect(render('[{% firstof x|default_if_none:"d" "z" %}]')).to.equal('[d]');
      expect(render('[{% firstof x "z" %}]')).to.equal('[z]');
    });
  });

  describe('a None value is not a failed lookup', function () {
    it('None reaches its filters as None', function () {
      expect(render('[{{ x|default_if_none:"d" }}]', { x: null })).to.equal('[d]');
      expect(render('[{{ x.y|default_if_none:"d" }}]', { x: { y: null } })).to.equal('[d]');
      expect(render('[{{ x|yesno }}]', { x: null })).to.equal('[maybe]');
      expect(render('[{{ x|length }}]', { x: null })).to.equal('[0]');
      expect(render('{% with y=x %}[{{ y|default_if_none:"d" }}]{% endwith %}', { x: null })).to.equal('[d]');
    });
  });

  var cases = [
    { files: { '/e.html': '[{{ x|upper }}]' }, locals: {}, want: '[]' },
    { files: { '/e.html': '[{{ x|lower }}]' }, locals: {}, want: '[]' },
    { files: { '/e.html': '[{{ x|title }}]' }, locals: {}, want: '[]' },
    { files: { '/e.html': '[{{ x|capfirst }}]' }, locals: {}, want: '[]' },
    { files: { '/e.html': '[{{ x|slugify }}]' }, locals: {}, want: '[]' },
    { files: { '/e.html': '[{{ x|striptags }}]' }, locals: {}, want: '[]' },
    { files: { '/e.html': '[{{ x|linebreaksbr }}]' }, locals: {}, want: '[]' },
    { files: { '/e.html': '[{{ x|urlencode }}]' }, locals: {}, want: '[]' },
    { files: { '/e.html': '[{{ x|cut:"a" }}]' }, locals: {}, want: '[]' },
    { files: { '/e.html': '[{{ x|escape }}]' }, locals: {}, want: '[]' },
    { files: { '/e.html': '[{{ x|safe }}]' }, locals: {}, want: '[]' },
    { files: { '/e.html': '[{{ x|addslashes }}]' }, locals: {}, want: '[]' },
    { files: { '/e.html': '[{{ x|linenumbers }}]' }, locals: {}, want: '[1. ]' },
    { files: { '/e.html': '[{{ x|center:5 }}]' }, locals: {}, want: '[     ]' },
    { files: { '/e.html': '[{{ x|ljust:3 }}]' }, locals: {}, want: '[   ]' },
    { files: { '/e.html': '[{{ x|default_if_none:"d" }}]' }, locals: {}, want: '[]' },
    { files: { '/e.html': '[{{ x|default:"d" }}]' }, locals: {}, want: '[d]' },
    { files: { '/e.html': '[{{ x|yesno }}]' }, locals: {}, want: '[no]' },
    { files: { '/e.html': '[{{ x|length }}]' }, locals: {}, want: '[0]' },
    { files: { '/e.html': '[{{ x|wordcount }}]' }, locals: {}, want: '[0]' },
    { files: { '/e.html': '[{{ x|first }}]' }, locals: {}, want: '[]' },
    { files: { '/e.html': '[{{ x|last }}]' }, locals: {}, want: '[]' },
    { files: { '/e.html': '[{{ x|join:"," }}]' }, locals: {}, want: '[]' },
    { files: { '/e.html': '[{{ x|pluralize }}]' }, locals: {}, want: '[]' },
    { files: { '/e.html': '[{{ x|floatformat }}]' }, locals: {}, want: '[]' },
    { files: { '/e.html': '[{{ x|date:"Y" }}]' }, locals: {}, want: '[]' },
    { files: { '/e.html': '[{{ x|truncatechars:3 }}]' }, locals: {}, want: '[]' },
    { files: { '/e.html': '[{{ x|truncatewords:2 }}]' }, locals: {}, want: '[]' },
    { files: { '/e.html': '[{{ x|lower|upper }}]' }, locals: {}, want: '[]' },
    { files: { '/e.html': '[{{ x|first|upper }}]' }, locals: {}, want: '[]' },
    { files: { '/e.html': '[{{ x|title|length }}]' }, locals: {}, want: '[0]' },
    { files: { '/e.html': '[{{ x.y|upper }}]' }, locals: { x: null }, want: '[]' },
    { files: { '/e.html': '[{{ x.y|default_if_none:"d" }}]' }, locals: { x: null }, want: '[]' },
    { files: { '/e.html': '[{{ x.y.z|default_if_none:"d" }}]' }, locals: { x: { y: null } }, want: '[]' },
    { files: { '/e.html': '[{{ x.0|upper }}]' }, locals: { x: [] }, want: '[]' },
    { files: { '/e.html': '[{{ x.y.z|upper }}]' }, locals: { x: {} }, want: '[]' },
    { files: { '/e.html': '[{{ x.y|default_if_none:"d" }}]' }, locals: { x: {} }, want: '[]' },
    { files: { '/e.html': '{% with y=x|upper %}[{{ y }}]{% endwith %}' }, locals: {}, want: '[]' },
    { files: { '/e.html': '{% with y=x|default_if_none:"d" %}[{{ y }}]{% endwith %}' }, locals: {}, want: '[]' },
    { files: { '/e.html': '{% with y=x|length %}[{{ y }}]{% endwith %}' }, locals: {}, want: '[0]' },
    { files: { '/e.html': '{% with y=x %}[{{ y|default_if_none:"d" }}]{% endwith %}' }, locals: {}, want: '[]' },
    { files: { '/e.html': '{% with x|upper as y %}[{{ y }}]{% endwith %}' }, locals: {}, want: '[]' },
    { files: { '/e.html': '{% for i in "ab" %}[{% cycle x|upper "z" %}]{% endfor %}' }, locals: {}, want: '[][z]' },
    { files: { '/e.html': '{% for i in "ab" %}[{% cycle x|default_if_none:"d" "z" %}]{% endfor %}' }, locals: {}, want: '[][z]' },
    { files: { '/e.html': '{% for i in "ab" %}[{% cycle x "z" %}]{% endfor %}' }, locals: {}, want: '[][z]' },
    { files: { '/p.html': '[{{ y }}][{{ y|default_if_none:"d" }}]', '/e.html': '{% include "p.html" with y=x|upper %}' }, locals: {}, want: '[][]' },
    { files: { '/p.html': '[{{ y }}][{{ y|default_if_none:"d" }}]', '/e.html': '{% include "p.html" with y=x %}' }, locals: {}, want: '[][]' },
    { files: { '/p.html': '[{{ y }}][{{ y|default_if_none:"d" }}]', '/e.html': '{% include "p.html" with y=x.z %}' }, locals: { x: null }, want: '[][]' },
    { files: { '/e.html': '{% if x|default_if_none:"d" %}Y{% else %}N{% endif %}' }, locals: {}, want: 'Y' },
    { files: { '/e.html': '{% if x|yesno == "maybe" %}Y{% else %}N{% endif %}' }, locals: {}, want: 'Y' },
    { files: { '/e.html': '{% if x|length == 0 %}Y{% else %}N{% endif %}' }, locals: {}, want: 'Y' },
    { files: { '/e.html': '{% if x.y|default_if_none:"d" %}Y{% else %}N{% endif %}' }, locals: { x: null }, want: 'Y' },
    { files: { '/e.html': '{% if not x %}Y{% else %}N{% endif %}' }, locals: {}, want: 'Y' },
    { files: { '/e.html': '{% if x|default:"" %}Y{% else %}N{% endif %}' }, locals: {}, want: 'N' },
    { files: { '/e.html': '{% for i in x %}[{{ i }}]{% empty %}E{% endfor %}' }, locals: {}, want: 'E' },
    { files: { '/e.html': '{% for i in x|default_if_none:"ab" %}[{{ i }}]{% empty %}E{% endfor %}' }, locals: {}, want: '[a][b]' },
    { files: { '/e.html': '[{% firstof x|default_if_none:"d" "z" %}]' }, locals: {}, want: '[d]' },
    { files: { '/e.html': '[{% firstof x "z" %}]' }, locals: {}, want: '[z]' },
    { files: { '/e.html': '[{{ x|default_if_none:"d" }}]' }, locals: { x: null }, want: '[d]' },
    { files: { '/e.html': '[{{ x.y|default_if_none:"d" }}]' }, locals: { x: { y: null } }, want: '[d]' },
    { files: { '/e.html': '[{{ x|yesno }}]' }, locals: { x: null }, want: '[maybe]' },
    { files: { '/e.html': '[{{ x|length }}]' }, locals: { x: null }, want: '[0]' },
    { files: { '/e.html': '{% with y=x %}[{{ y|default_if_none:"d" }}]{% endwith %}' }, locals: { x: null }, want: '[d]' }
  ];

  it('renders the same on the async render path', function (done) {
    var pending = cases.length, failed = null;
    cases.forEach(function (c) {
      renderAsync(c.files, c.locals, function (err, out) {
        if (!failed) {
          try {
            expect(err).to.be(null);
            expect(out).to.equal(c.want);
          } catch (e) {
            failed = e;
          }
        }
        pending -= 1;
        if (!pending) {
          done(failed);
        }
      });
    });
  });
});
