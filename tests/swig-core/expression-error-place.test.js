var swig = require('../../lib/swig'),
  twig = require('@rhinostone/swig-twig'),
  jinja2 = require('@rhinostone/swig-jinja2'),
  django = require('@rhinostone/swig-django'),
  expect = require('../lib/expect.js');

var flavors = {
  twig: { mod: twig, Ctor: twig.Twig, label: 'Twig' },
  jinja2: { mod: jinja2, Ctor: jinja2.Jinja2, label: 'Jinja2' },
  django: { mod: django, Ctor: django.Django, label: 'Django' }
};

function regex(text) {
  return new RegExp('^' + text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$');
}

function message(flavor, src, filename) {
  var inst = new flavors[flavor].Ctor({ cache: false });
  try {
    inst.compile(src, filename === undefined ? { filename: 'page.tpl' } : { filename: filename });
  } catch (e) {
    return e.message;
  }
  return 'no error';
}

function memoryLoader(mod, files) {
  return mod.loaders.memory(files, '/');
}

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

/*!
 * An error raised while the flavor frontends parse an expression names the
 * line and the file, as native swig's errors and their own tag errors do.
 */
describe('flavor expression errors name their line and file', function () {

  var everywhere = [
    ['{{ ) }}', 'Unexpected token ")" on line 1 in file page.tpl.'],
    ['a\nb\n{{ a b }}', 'Unexpected token "b" on line 3 in file page.tpl.'],
    ['a\n{% if ) %}Y{% endif %}', 'Unexpected token ")" on line 2 in file page.tpl.'],
    ['{# c\n d #}\n{{ ) }}', 'Unexpected token ")" on line 3 in file page.tpl.'],
    ['{% if a %}x{% endif %}\n\n{{ ) }}', 'Unexpected token ")" on line 3 in file page.tpl.'],
    ['{{ a }}\n{% if ) %}Y{% endif %}', 'Unexpected token ")" on line 2 in file page.tpl.'],
    ['x\n{% for i in ) %}{% endfor %}', 'Unexpected token ")" on line 2 in file page.tpl.'],
    ['x\n{% include ) %}', 'Unexpected token ")" on line 2 in file page.tpl.'],
    ['x\n{% extends ) %}', 'Unexpected token ")" on line 2 in file page.tpl.'],
    ['x\n{{ __proto__ }}', 'Unsafe access to "__proto__" is not allowed in templates (prototype-chain guard) on line 2 in file page.tpl.'],
    ['x\n{{ a.constructor }}', 'Unsafe access to "constructor" is not allowed in templates (prototype-chain guard) on line 2 in file page.tpl.']
  ];

  Object.keys(flavors).forEach(function (flavor) {
    describe(flavor, function () {
      everywhere.forEach(function (c) {
        it(JSON.stringify(c[0]), function () {
          expect(message(flavor, c[0])).to.equal(c[1]);
        });
      });

      it('names the line and the file of a lexer error in an output', function () {
        expect(message(flavor, 'x\n{{ " }}')).to.equal('Unexpected token """ in ' + flavors[flavor].label + ' expression on line 2 in file page.tpl.');
      });

      it('names the line and the file of a lexer error in a tag argument', function () {
        expect(message(flavor, 'x\n\n{% if " %}Y{% endif %}')).to.equal('Unexpected token """ in ' + flavors[flavor].label + ' expression on line 3 in file page.tpl.');
      });

      it('names only the line when the template has no filename', function () {
        var inst = new flavors[flavor].Ctor({ cache: false });
        expect(function () {
          inst.compile('x\n{{ ) }}');
        }).to.throwError(regex('Unexpected token ")" on line 2.'));
        expect(function () {
          inst.compile('x\n{{ " }}');
        }).to.throwError(regex('Unexpected token """ in ' + flavors[flavor].label + ' expression on line 2.'));
      });

      it('takes a numeric filename', function () {
        expect(message(flavor, '{{ ) }}', 5)).to.equal('Unexpected token ")" on line 1 in file 5.');
      });

      it('names the included file, not the including one, on both render paths', function (done) {
        var files = { '/t': 'a\n{% include "inc" %}', '/inc': 'b\nc\n{{ ) }}' },
          want = regex('Unexpected token ")" on line 3 in file /inc.'),
          sync = new flavors[flavor].Ctor({ cache: false, loader: memoryLoader(flavors[flavor].mod, files) });
        expect(function () {
          sync.renderFile('/t', {});
        }).to.throwError(want);
        new flavors[flavor].Ctor({ cache: false, loader: asyncLoader(files) }).renderFile('/t', {}, function (err) {
          expect(err.message).to.match(want);
          done();
        });
      });

      it('names the extended file', function () {
        var files = { '/t': '{% extends "p" %}\n{% block b %}c{% endblock %}', '/p': 'p\n{{ ) }}{% block b %}{% endblock %}' },
          inst = new flavors[flavor].Ctor({ cache: false, loader: memoryLoader(flavors[flavor].mod, files) });
        expect(function () {
          inst.renderFile('/t', {});
        }).to.throwError(regex('Unexpected token ")" on line 2 in file /p.'));
      });

      it('names the lexer error of an extended file once', function () {
        var files = { '/t': '{% extends "p" %}\n{% block b %}c{% endblock %}', '/p': 'p\n{{ " }}' },
          inst = new flavors[flavor].Ctor({ cache: false, loader: memoryLoader(flavors[flavor].mod, files) });
        expect(function () {
          inst.renderFile('/t', {});
        }).to.throwError(regex('Unexpected token """ in ' + flavors[flavor].label + ' expression on line 2 in file /p.'));
      });
    });
  });

  [
    ['twig', 'x\n{% set a = ) %}'],
    ['jinja2', 'x\n{% set a = ) %}'],
    ['jinja2', 'x\n{% with a = ) %}{% endwith %}'],
    ['jinja2', 'x\n{% macro m(a=)) %}{% endmacro %}'],
    ['jinja2', 'x\n{% if a %}{% elif ) %}{% endif %}'],
    ['django', 'x\n{% with a = ) %}{% endwith %}'],
    ['django', 'x\n{% firstof ) %}'],
    ['django', 'x\n{% cycle ) %}'],
    ['django', 'x\n{% if a %}{% elif ) %}{% endif %}']
  ].forEach(function (c) {
    it(c[0] + ' tag argument ' + JSON.stringify(c[1]), function () {
      expect(message(c[0], c[1])).to.equal('Unexpected token ")" on line 2 in file page.tpl.');
    });
  });

  it('names the line of a tag on a later line of an if branch', function () {
    expect(message('jinja2', '{% if a %}\n{% elif ) %}{% endif %}')).to.equal('Unexpected token ")" on line 2 in file page.tpl.');
    expect(message('django', '{% if a %}\n{% elif ) %}{% endif %}')).to.equal('Unexpected token ")" on line 2 in file page.tpl.');
  });

  it('names the imported file of a lexer error once, in the importing flavors', function () {
    ['twig', 'jinja2'].forEach(function (flavor) {
      var files = { '/t': 'a\n{% import "m" as m %}', '/m': 'b\n{% macro f() %}{{ " }}{% endmacro %}' },
        inst = new flavors[flavor].Ctor({ cache: false, loader: memoryLoader(flavors[flavor].mod, files) });
      expect(function () {
        inst.renderFile('/t', {});
      }).to.throwError(regex('Unexpected token """ in ' + flavors[flavor].label + ' expression on line 2 in file /m.'));
    });
  });

  it('leaves the message of a direct parseExpr or lexer call without a place', function () {
    Object.keys(flavors).forEach(function (flavor) {
      var parser = require('@rhinostone/swig-' + flavor + '/lib/parser'),
        lexer = require('@rhinostone/swig-' + flavor + '/lib/lexer');
      expect(function () {
        parser.parseExpr(lexer.read(')'), {});
      }).to.throwError(regex('Unexpected token ")".'));
      expect(function () {
        lexer.read('"');
      }).to.throwError(regex('Unexpected token """ in ' + flavors[flavor].label + ' expression.'));
    });
  });

  it('native swig keeps naming its line and file (the control)', function () {
    var inst = new swig.Swig({ cache: false });
    expect(function () {
      inst.compile('x\n{{ a|nosuch }}', { filename: 'page.tpl' });
    }).to.throwError(regex('Invalid filter "nosuch" on line 2 in file page.tpl.'));
  });
});
