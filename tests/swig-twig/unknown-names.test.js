var twig = require('@rhinostone/swig-twig'),
  parser = require('@rhinostone/swig-twig/lib/parser'),
  tags = require('@rhinostone/swig-twig/lib/tags'),
  lexer = require('@rhinostone/swig-twig/lib/lexer'),
  expect = require('../lib/expect.js');

/*!
 * A filter or test name the instance does not hold is a compile error, wherever
 * the name stands. Twig's Parser::getFilter and Parser::getTest raise a
 * SyntaxError while the template parses (read from Twig's 3.x source: no
 * PHP engine runs these shapes here).
 */
describe('swig-twig: an unknown filter or test name is a compile error', function () {

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
    { label: '{{ x|nosuch("a") }}', files: { '/t': '{{ x|nosuch("a") }}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{{ x|default("y")|nosuch }}', files: { '/t': '{{ x|default("y")|nosuch }}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{{ "a"|nosuch }}', files: { '/t': '{{ "a"|nosuch }}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{{ x|upper(y|nosuch) }}', files: { '/t': '{{ x|upper(y|nosuch) }}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: 'a\nb\n{{ x|nosuch }}', files: { '/t': 'a\nb\n{{ x|nosuch }}' }, error: 'Invalid filter "nosuch" on line 3 in file /t.', atCompile: true },
    { label: '{% if x|nosuch %}Y{% endif %}', files: { '/t': '{% if x|nosuch %}Y{% endif %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% if f %}{{ x|nosuch }}{% endif %}A', files: { '/t': '{% if f %}{{ x|nosuch }}{% endif %}A' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% for i in l|nosuch %}{{ i }}{% endfor %}', files: { '/t': '{% for i in l|nosuch %}{{ i }}{% endfor %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% for i in l %}{{ i|nosuch }}{% endfor %}', files: { '/t': '{% for i in l %}{{ i|nosuch }}{% endfor %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% if f %}{% for i in l|nosuch %}{{ i }}{% endfor %}{% endif %}', files: { '/t': '{% if f %}{% for i in l|nosuch %}{{ i }}{% endfor %}{% endif %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% set a = x|nosuch %}', files: { '/t': '{% set a = x|nosuch %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% set a %}{{ x|nosuch }}{% endset %}', files: { '/t': '{% set a %}{{ x|nosuch }}{% endset %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{{ t ? x|nosuch : "E" }}', files: { '/t': '{{ t ? x|nosuch : "E" }}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{{ f ? "T" : x|nosuch }}', files: { '/t': '{{ f ? "T" : x|nosuch }}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{{ f and x|nosuch }}', files: { '/t': '{{ f and x|nosuch }}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{{ y ?? x|nosuch }}', files: { '/t': '{{ y ?? x|nosuch }}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% with {a: x|nosuch} %}{{ a }}{% endwith %}', files: { '/t': '{% with {a: x|nosuch} %}{{ a }}{% endwith %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% macro m() %}{{ x|nosuch }}{% endmacro %}', files: { '/t': '{% macro m() %}{{ x|nosuch }}{% endmacro %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% block b %}{{ x|nosuch }}{% endblock %}', files: { '/t': '{% block b %}{{ x|nosuch }}{% endblock %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% include x|nosuch %}', files: { '/t': '{% include x|nosuch %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% apply nosuch %}a{% endapply %}', files: { '/t': '{% apply nosuch %}a{% endapply %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% apply nosuch() %}a{% endapply %}', files: { '/t': '{% apply nosuch() %}a{% endapply %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% apply nosuch("a") %}a{% endapply %}', files: { '/t': '{% apply nosuch("a") %}a{% endapply %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% apply upper|nosuch %}a{% endapply %}', files: { '/t': '{% apply upper|nosuch %}a{% endapply %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% apply replace({"a": x|nosuch}) %}a{% endapply %}', files: { '/t': '{% apply replace({"a": x|nosuch}) %}a{% endapply %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% if f %}{% apply nosuch %}a{% endapply %}{% endif %}A', files: { '/t': '{% if f %}{% apply nosuch %}a{% endapply %}{% endif %}A' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: 'a\n{% apply nosuch %}a{% endapply %}', files: { '/t': 'a\n{% apply nosuch %}a{% endapply %}' }, error: 'Invalid filter "nosuch" on line 2 in file /t.', atCompile: true },
    { label: '{{ x|toString }}', files: { '/t': '{{ x|toString }}' }, error: 'Invalid filter "toString" on line 1 in file /t.', atCompile: true },
    { label: '{{ x|hasOwnProperty }}', files: { '/t': '{{ x|hasOwnProperty }}' }, error: 'Invalid filter "hasOwnProperty" on line 1 in file /t.', atCompile: true },
    { label: '{{ x|constructor }}', files: { '/t': '{{ x|constructor }}' }, error: 'Invalid filter "constructor" on line 1 in file /t.', atCompile: true },
    { label: '{{ x|valueOf }}', files: { '/t': '{{ x|valueOf }}' }, error: 'Invalid filter "valueOf" on line 1 in file /t.', atCompile: true },
    { label: '{{ x|__proto__ }}', files: { '/t': '{{ x|__proto__ }}' }, error: 'Invalid filter "__proto__" on line 1 in file /t.', atCompile: true },
    { label: '{% apply toString %}a{% endapply %}', files: { '/t': '{% apply toString %}a{% endapply %}' }, error: 'Invalid filter "toString" on line 1 in file /t.', atCompile: true },
    { label: '{{ x is frob }}', files: { '/t': '{{ x is frob }}' }, error: 'Invalid test "frob" on line 1 in file /t.', atCompile: true },
    { label: '{{ x is not frob }}', files: { '/t': '{{ x is not frob }}' }, error: 'Invalid test "frob" on line 1 in file /t.', atCompile: true },
    { label: 'a\n{{ x is frob }}', files: { '/t': 'a\n{{ x is frob }}' }, error: 'Invalid test "frob" on line 2 in file /t.', atCompile: true },
    { label: '{% if x is frob %}Y{% endif %}', files: { '/t': '{% if x is frob %}Y{% endif %}' }, error: 'Invalid test "frob" on line 1 in file /t.', atCompile: true },
    { label: '{% if x is not frob %}Y{% endif %}', files: { '/t': '{% if x is not frob %}Y{% endif %}' }, error: 'Invalid test "frob" on line 1 in file /t.', atCompile: true },
    { label: '{% if x is frob("a") %}Y{% endif %}', files: { '/t': '{% if x is frob("a") %}Y{% endif %}' }, error: 'Invalid test "frob" on line 1 in file /t.', atCompile: true },
    { label: '{% if x is frob() %}Y{% endif %}', files: { '/t': '{% if x is frob() %}Y{% endif %}' }, error: 'Invalid test "frob" on line 1 in file /t.', atCompile: true },
    { label: '{% if f %}{{ x is frob }}{% endif %}A', files: { '/t': '{% if f %}{{ x is frob }}{% endif %}A' }, error: 'Invalid test "frob" on line 1 in file /t.', atCompile: true },
    { label: '{{ t ? x is frob : "E" }}', files: { '/t': '{{ t ? x is frob : "E" }}' }, error: 'Invalid test "frob" on line 1 in file /t.', atCompile: true },
    { label: '{% for i in l %}{{ i is frob }}{% endfor %}', files: { '/t': '{% for i in l %}{{ i is frob }}{% endfor %}' }, error: 'Invalid test "frob" on line 1 in file /t.', atCompile: true },
    { label: '{{ x is toString }}', files: { '/t': '{{ x is toString }}' }, error: 'Invalid test "toString" on line 1 in file /t.', atCompile: true },
    { label: '{{ x is hasOwnProperty }}', files: { '/t': '{{ x is hasOwnProperty }}' }, error: 'Invalid test "hasOwnProperty" on line 1 in file /t.', atCompile: true },
    { label: 'a filter name in an included file', files: { '/t': 'A{% include "i" %}', '/i': 'b\n{{ x|nosuch }}' }, error: 'Invalid filter "nosuch" on line 2 in file /i.' },
    { label: 'a test name in an included file', files: { '/t': 'A{% include "i" %}', '/i': '{{ x is frob }}' }, error: 'Invalid test "frob" on line 1 in file /i.' },
    { label: 'a name in an imported file', files: { '/t': '{% import "m" as m %}A', '/m': '{% macro g() %}{{ x|nosuch }}{% endmacro %}' }, error: 'Invalid filter "nosuch" on line 1 in file /m.' },
    { label: 'a name in a from-imported file', files: { '/t': '{% from "m" import g %}A', '/m': '{% macro g() %}{{ x|nosuch }}{% endmacro %}' }, error: 'Invalid filter "nosuch" on line 1 in file /m.' },
    { label: 'a name in an extended file, its body', files: { '/t': '{% extends "p" %}{% block b %}C{% endblock %}', '/p': 'p\n{{ x|nosuch }}{% block b %}{% endblock %}' }, error: 'Invalid filter "nosuch" on line 2 in file /p.' },
    { label: 'a name in an extended file, a block the child overrides', files: { '/t': '{% extends "p" %}{% block b %}C{% endblock %}', '/p': '[{% block b %}{{ x|nosuch }}{% endblock %}]' }, error: 'Invalid filter "nosuch" on line 1 in file /p.' },
    { label: 'a name in a block of the extending file', files: { '/t': '{% extends "p" %}\n{% block b %}{{ x|nosuch }}{% endblock %}', '/p': '[{% block b %}P{% endblock %}]' }, error: 'Invalid filter "nosuch" on line 2 in file /t.' },
    { label: '{{ x|upper }}', files: { '/t': '{{ x|upper }}' }, want: 'V' },
    { label: '{{ x|default("a")|upper }}', files: { '/t': '{{ x|default("a")|upper }}' }, want: 'V' },
    { label: '{% if x|upper %}Y{% endif %}', files: { '/t': '{% if x|upper %}Y{% endif %}' }, want: 'Y' },
    { label: '{% apply upper %}a{% endapply %}', files: { '/t': '{% apply upper %}a{% endapply %}' }, want: 'A' },
    { label: '{% apply upper|lower %}a{% endapply %}', files: { '/t': '{% apply upper|lower %}a{% endapply %}' }, want: 'a' },
    { label: '{% if x is defined %}Y{% endif %}', files: { '/t': '{% if x is defined %}Y{% endif %}' }, want: 'Y' },
    { label: '{% if y is not defined %}Y{% endif %}', files: { '/t': '{% if y is not defined %}Y{% endif %}' }, want: 'Y' },
    { label: '{% if y is null %}Y{% endif %}', files: { '/t': '{% if y is null %}Y{% endif %}' }, want: 'Y' },
    { label: '{% if "" is empty %}Y{% endif %}', files: { '/t': '{% if "" is empty %}Y{% endif %}' }, want: 'Y' },
    { label: '{% if l is iterable %}Y{% endif %}', files: { '/t': '{% if l is iterable %}Y{% endif %}' }, want: 'Y' },
    { label: '{% if 1 is odd %}Y{% endif %}', files: { '/t': '{% if 1 is odd %}Y{% endif %}' }, want: 'Y' },
    { label: '{% if 2 is even %}Y{% endif %}', files: { '/t': '{% if 2 is even %}Y{% endif %}' }, want: 'Y' },
    { label: '{% if 4 is divisibleby(2) %}Y{% endif %}', files: { '/t': '{% if 4 is divisibleby(2) %}Y{% endif %}' }, want: 'Y' },
    { label: 'an included file in a branch not taken', files: { '/t': '{% if f %}{% include "i" %}{% endif %}A', '/i': '{{ x|nosuch }}' }, want: 'A' }
  ];

  cases.forEach(function (c) {
    describe(c.label, function () {
      it('on the sync render path', function () {
        var inst = new twig.Twig({ cache: false, loader: twig.loaders.memory(c.files, '/') });
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
        new twig.Twig({ cache: false, loader: asyncLoader(c.files) }).renderFile('/t', JSON.parse(JSON.stringify(locals)), function (err, out) {
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

    it('counts when it is registered before the compile, in an output and in apply', function () {
      var inst = new twig.Twig({ cache: false });
      inst.setFilter('mine', upperBang);
      expect(inst.render('{{ x|mine }}', { locals: { x: 'a' } })).to.equal('A!');
      expect(inst.render('{% apply mine %}a{% endapply %}')).to.equal('A!');
    });

    it('does not count when it is registered after the compile', function () {
      var inst = new twig.Twig({ cache: false });
      expect(function () {
        inst.compile('{{ x|mine }}');
      }).to.throwError(regex('Invalid filter "mine" on line 1.'));
      expect(function () {
        inst.compile('{% apply mine %}a{% endapply %}');
      }).to.throwError(regex('Invalid filter "mine" on line 1.'));
      inst.setFilter('mine', upperBang);
      expect(inst.compile('{{ x|mine }}')({ x: 'a' })).to.equal('A!');
    });

    it('counts only on the instance that registers it', function () {
      var one = new twig.Twig({ cache: false }), other = new twig.Twig({ cache: false });
      one.setFilter('mine', upperBang);
      expect(function () {
        other.compile('{{ x|mine }}');
      }).to.throwError(regex('Invalid filter "mine" on line 1.'));
    });

    it('can have the name hasOwnProperty, and unknown names still fail', function () {
      var inst = new twig.Twig({ cache: false });
      inst.setFilter('hasOwnProperty', function (v) {
        return 'H:' + v;
      });
      expect(inst.render('{{ x|hasOwnProperty }}', { locals: { x: 'a' } })).to.equal('H:a');
      expect(inst.render('{{ x|upper }}', { locals: { x: 'a' } })).to.equal('A');
      expect(inst.render('{% apply hasOwnProperty %}a{% endapply %}')).to.equal('H:a');
      expect(function () {
        inst.compile('{{ x|nosuch }}');
      }).to.throwError(regex('Invalid filter "nosuch" on line 1.'));
      expect(function () {
        inst.compile('{% if x|nosuch %}Y{% endif %}');
      }).to.throwError(regex('Invalid filter "nosuch" on line 1.'));
      expect(function () {
        inst.compile('{% apply nosuch %}a{% endapply %}');
      }).to.throwError(regex('Invalid filter "nosuch" on line 1.'));
    });

    it('reaches a custom tag through the parser it is handed', function () {
      var inst = new twig.Twig({ cache: false });
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

  describe('a test the instance registers', function () {
    function isOne(v) {
      return v === 1;
    }

    it('counts when it is registered before the compile', function () {
      var inst = new twig.Twig({ cache: false });
      inst.setExtension('_test_mine', isOne);
      expect(inst.render('{% if x is mine %}Y{% endif %}', { locals: { x: 1 } })).to.equal('Y');
    });

    it('does not count when it is registered after the compile', function () {
      var inst = new twig.Twig({ cache: false });
      expect(function () {
        inst.compile('{% if x is mine %}Y{% endif %}');
      }).to.throwError(regex('Invalid test "mine" on line 1.'));
      inst.setExtension('_test_mine', isOne);
      expect(inst.compile('{% if x is mine %}Y{% endif %}')({ x: 1 })).to.equal('Y');
    });

    it('counts only on the instance that registers it', function () {
      var one = new twig.Twig({ cache: false }), other = new twig.Twig({ cache: false });
      one.setExtension('_test_mine', isOne);
      expect(function () {
        other.compile('{% if x is mine %}Y{% endif %}');
      }).to.throwError(regex('Invalid test "mine" on line 1.'));
    });

    it('is read as an own entry when an extension has the name hasOwnProperty', function () {
      var inst = new twig.Twig({ cache: false });
      inst.setExtension('hasOwnProperty', function () {
        return true;
      });
      expect(inst.render('{% if 1 is odd %}Y{% endif %}')).to.equal('Y');
      expect(function () {
        inst.compile('{% if x is frob %}Y{% endif %}');
      }).to.throwError(regex('Invalid test "frob" on line 1.'));
    });
  });

  it('does not run a function the locals carry under an unknown test name', function () {
    var called = false, locals = { x: 1, _ext: { _test_frob: function () { called = true; return true; } } };
    expect(function () {
      twig.render('{% if x is frob %}Y{% endif %}', { locals: locals });
    }).to.throwError(regex('Invalid test "frob" on line 1.'));
    expect(called).to.be(false);
  });

  it('checks no name when the parse has no engine instance', function () {
    expect(parser.parse(undefined, '{{ x|nosuch }}', {}, tags, {}).tokens.length).to.equal(1);
    expect(parser.parse({}, '{% if x is frob %}Y{% endif %}', {}, tags, {}).tokens.length).to.equal(1);
    expect(parser.parse({}, '{% apply nosuch %}a{% endapply %}', {}, tags, {}).tokens.length).to.equal(1);
    expect(parser.parseExpr(lexer.read('x|nosuch'), {}).type).to.equal('FilterCall');
  });
});
