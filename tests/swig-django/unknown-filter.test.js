var django = require('@rhinostone/swig-django'),
  parser = require('@rhinostone/swig-django/lib/parser'),
  tags = require('@rhinostone/swig-django/lib/tags'),
  lexer = require('@rhinostone/swig-django/lib/lexer'),
  expect = require('../lib/expect.js');

/*!
 * A filter name the instance does not hold is a compile error, wherever the
 * name stands, as in Django, whose expectations these are: Django 5.2 rejects
 * every shape below that has `error`, naming the same filter, and renders
 * every other shape to `want`. Generated from Django's own runs.
 */
describe('swig-django: an unknown filter name is a compile error', function () {

  function asyncLoader(files) {
    return {
      async: true,
      resolve: function (to) {
        return to.charAt(0) === '/' ? to : '/' + to;
      },
      load: function (id, cb) {
        if (!cb) {
          return files[id];
        }
        setImmediate(function () {
          cb(null, files[id]);
        });
      }
    };
  }

  function regex(text) {
    return new RegExp('^' + text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$');
  }

  var locals = {"x": "v", "t": true, "f": false, "l": ["a"]};

  var cases = [
    { label: '{{ x|nosuch }}', files: { '/t': '{{ x|nosuch }}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{{ x|upper|nosuch }}', files: { '/t': '{{ x|upper|nosuch }}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{{ x|nosuch|upper }}', files: { '/t': '{{ x|nosuch|upper }}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{{ x|nosuch:"a" }}', files: { '/t': '{{ x|nosuch:"a" }}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{{ x|default:"y"|nosuch }}', files: { '/t': '{{ x|default:"y"|nosuch }}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{{ "a"|nosuch }}', files: { '/t': '{{ "a"|nosuch }}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: 'a\nb\n{{ x|nosuch }}', files: { '/t': 'a\nb\n{{ x|nosuch }}' }, error: 'Invalid filter "nosuch" on line 3 in file /t.', atCompile: true },
    { label: '{% if x|nosuch %}Y{% endif %}', files: { '/t': '{% if x|nosuch %}Y{% endif %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% if f %}{{ x|nosuch }}{% endif %}A', files: { '/t': '{% if f %}{{ x|nosuch }}{% endif %}A' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% if t %}A{% elif x|nosuch %}B{% endif %}', files: { '/t': '{% if t %}A{% elif x|nosuch %}B{% endif %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% if t %}A{% elif f %}{{ x|nosuch }}{% endif %}', files: { '/t': '{% if t %}A{% elif f %}{{ x|nosuch }}{% endif %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% if t %}A{% else %}{{ x|nosuch }}{% endif %}', files: { '/t': '{% if t %}A{% else %}{{ x|nosuch }}{% endif %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% for i in l|nosuch %}{{ i }}{% endfor %}', files: { '/t': '{% for i in l|nosuch %}{{ i }}{% endfor %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% for i in l %}{{ i|nosuch }}{% endfor %}', files: { '/t': '{% for i in l %}{{ i|nosuch }}{% endfor %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% for i in l %}a{% empty %}{{ x|nosuch }}{% endfor %}', files: { '/t': '{% for i in l %}a{% empty %}{{ x|nosuch }}{% endfor %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% if f %}{% for i in l|nosuch %}{{ i }}{% endfor %}{% endif %}', files: { '/t': '{% if f %}{% for i in l|nosuch %}{{ i }}{% endfor %}{% endif %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% with a=x|nosuch %}{{ a }}{% endwith %}', files: { '/t': '{% with a=x|nosuch %}{{ a }}{% endwith %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% with a=x %}{{ a|nosuch }}{% endwith %}', files: { '/t': '{% with a=x %}{{ a|nosuch }}{% endwith %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% firstof x|nosuch "z" %}', files: { '/t': '{% firstof x|nosuch "z" %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% cycle x|nosuch "z" %}', files: { '/t': '{% cycle x|nosuch "z" %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% block b %}{{ x|nosuch }}{% endblock %}', files: { '/t': '{% block b %}{{ x|nosuch }}{% endblock %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% autoescape off %}{{ x|nosuch }}{% endautoescape %}', files: { '/t': '{% autoescape off %}{{ x|nosuch }}{% endautoescape %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% spaceless %}{{ x|nosuch }}{% endspaceless %}', files: { '/t': '{% spaceless %}{{ x|nosuch }}{% endspaceless %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% include x|nosuch %}', files: { '/t': '{% include x|nosuch %}', '/v': 'I' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: 'include with', files: { '/t': '{% include "i" with a=x|nosuch %}', '/i': 'I' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{{ x|toString }}', files: { '/t': '{{ x|toString }}' }, error: 'Invalid filter "toString" on line 1 in file /t.', atCompile: true },
    { label: '{{ x|hasOwnProperty }}', files: { '/t': '{{ x|hasOwnProperty }}' }, error: 'Invalid filter "hasOwnProperty" on line 1 in file /t.', atCompile: true },
    { label: '{{ x|constructor }}', files: { '/t': '{{ x|constructor }}' }, error: 'Invalid filter "constructor" on line 1 in file /t.', atCompile: true },
    { label: '{{ x|valueOf }}', files: { '/t': '{{ x|valueOf }}' }, error: 'Invalid filter "valueOf" on line 1 in file /t.', atCompile: true },
    { label: '{{ x|__proto__ }}', files: { '/t': '{{ x|__proto__ }}' }, error: 'Invalid filter "__proto__" on line 1 in file /t.', atCompile: true },
    { label: 'in an included file', files: { '/t': 'A{% include "i" %}', '/i': 'b\n{{ x|nosuch }}' }, error: 'Invalid filter "nosuch" on line 2 in file /i.' },
    { label: 'in an extended file, its body', files: { '/t': '{% extends "p" %}{% block b %}C{% endblock %}', '/p': 'p\n{{ x|nosuch }}{% block b %}{% endblock %}' }, error: 'Invalid filter "nosuch" on line 2 in file /p.' },
    { label: 'in an extended file, a block the child overrides', files: { '/t': '{% extends "p" %}{% block b %}C{% endblock %}', '/p': '[{% block b %}{{ x|nosuch }}{% endblock %}]' }, error: 'Invalid filter "nosuch" on line 1 in file /p.' },
    { label: 'in a block of the extending file', files: { '/t': '{% extends "p" %}\n{% block b %}{{ x|nosuch }}{% endblock %}', '/p': '[{% block b %}P{% endblock %}]' }, error: 'Invalid filter "nosuch" on line 2 in file /t.', atCompile: true },
    { label: '{{ x|upper }}', files: { '/t': '{{ x|upper }}' }, want: 'V' },
    { label: '{{ x|default:"a"|upper }}', files: { '/t': '{{ x|default:"a"|upper }}' }, want: 'V' },
    { label: '{% if x|upper %}Y{% endif %}', files: { '/t': '{% if x|upper %}Y{% endif %}' }, want: 'Y' },
    { label: '{% for i in l %}{{ i|upper }}{% endfor %}', files: { '/t': '{% for i in l %}{{ i|upper }}{% endfor %}' }, want: 'A' },
    { label: '{% with a=x|upper %}{{ a }}{% endwith %}', files: { '/t': '{% with a=x|upper %}{{ a }}{% endwith %}' }, want: 'V' },
    { label: '{% firstof x|upper "z" %}', files: { '/t': '{% firstof x|upper "z" %}' }, want: 'V' },
    { label: '{% cycle x|upper "z" %}', files: { '/t': '{% cycle x|upper "z" %}' }, want: 'V' },
    { label: 'an included file in a branch not taken', files: { '/t': '{% if f %}{% include "i" %}{% endif %}A', '/i': '{{ x|nosuch }}' }, want: 'A' }
  ];

  cases.forEach(function (c) {
    describe(c.label, function () {
      it('on the sync render path', function () {
        var inst = new django.Django({ cache: false, loader: django.loaders.memory(c.files, '/') });
        if (c.error) {
          expect(function () {
            inst.renderFile('/t', JSON.parse(JSON.stringify(locals)));
          }).to.throwError(regex(c.error));
          if (c.atCompile) {
            expect(function () {
              inst.compileFile('/t');
            }).to.throwError(regex(c.error));
          }
        } else {
          expect(inst.renderFile('/t', JSON.parse(JSON.stringify(locals)))).to.equal(c.want);
        }
      });

      it('on the async render path', function (done) {
        new django.Django({ cache: false, loader: asyncLoader(c.files) }).renderFile('/t', JSON.parse(JSON.stringify(locals)), function (err, out) {
          if (c.error) {
            expect(err && err.message).to.match(regex(c.error));
          } else {
            expect(err).to.be(null);
            expect(out).to.equal(c.want);
          }
          done();
        });
      });
    });
  });

  describe('a filter the instance registers', function () {
    function upperBang(v) {
      return String(v).toUpperCase() + '!';
    }

    it('counts when it is registered before the compile', function () {
      var inst = new django.Django({ cache: false });
      inst.setFilter('mine', upperBang);
      expect(inst.render('{{ x|mine }}', { locals: { x: 'a' } })).to.equal('A!');
    });

    it('does not count when it is registered after the compile', function () {
      var inst = new django.Django({ cache: false });
      expect(function () {
        inst.compile('{{ x|mine }}');
      }).to.throwError(regex('Invalid filter "mine" on line 1.'));
      inst.setFilter('mine', upperBang);
      expect(inst.compile('{{ x|mine }}')({ x: 'a' })).to.equal('A!');
    });

    it('counts only on the instance that registers it', function () {
      var one = new django.Django({ cache: false }), other = new django.Django({ cache: false });
      one.setFilter('mine', upperBang);
      expect(function () {
        other.compile('{{ x|mine }}');
      }).to.throwError(regex('Invalid filter "mine" on line 1.'));
    });

    it('can have the name hasOwnProperty, and unknown names still fail', function () {
      var inst = new django.Django({ cache: false });
      inst.setFilter('hasOwnProperty', function (v) {
        return 'H:' + v;
      });
      expect(inst.render('{{ x|hasOwnProperty }}', { locals: { x: 'a' } })).to.equal('H:a');
      expect(inst.render('{{ x|upper }}', { locals: { x: 'a' } })).to.equal('A');
      expect(function () {
        inst.compile('{{ x|nosuch }}');
      }).to.throwError(regex('Invalid filter "nosuch" on line 1.'));
      expect(function () {
        inst.compile('{% if x|nosuch %}Y{% endif %}');
      }).to.throwError(regex('Invalid filter "nosuch" on line 1.'));
    });

    it('reaches a custom tag through the parser it is handed', function () {
      var inst = new django.Django({ cache: false });
      inst.setTag('mine', function (str, line, p, types, stack, opts, swig, token) {
        token.irExpr = p.parseExpr(lexer.read(str));
        return true;
      }, function () {
        return '';
      }, false, false);
      inst.setFilter('known', upperBang);
      expect(inst.compile('{% mine x|known %}')({})).to.equal('');
      expect(function () {
        inst.compile('a\n{% mine x|nosuch %}', { filename: 'page.tpl' });
      }).to.throwError(regex('Invalid filter "nosuch" on line 2 in file page.tpl.'));
    });
  });

  it('checks no name when the parse has no engine instance', function () {
    expect(parser.parse(undefined, '{{ x|nosuch }}', {}, tags, {}).tokens.length).to.equal(1);
    expect(parser.parse({}, '{% if x|nosuch %}Y{% endif %}', {}, tags, {}).tokens.length).to.equal(1);
    expect(parser.parseExpr(lexer.read('x|nosuch'), {}).type).to.equal('FilterCall');
  });
});
