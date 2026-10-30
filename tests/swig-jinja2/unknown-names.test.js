var jinja2 = require('@rhinostone/swig-jinja2'),
  parser = require('@rhinostone/swig-jinja2/lib/parser'),
  tags = require('@rhinostone/swig-jinja2/lib/tags'),
  lexer = require('@rhinostone/swig-jinja2/lib/lexer'),
  runtime = require('../../lib/runtime'),
  expect = require('../lib/expect.js');

/*!
 * A filter or test name the instance does not hold follows Jinja2's rule: a
 * compile error, except directly inside an if or an inline-if, where the
 * template compiles and the same error is thrown when the expression is
 * reached. The expectations are Jinja2 3.1's outcome for each shape.
 */
describe('swig-jinja2: an unknown filter or test name', function () {

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

  var locals = {"x": "v", "t": true, "f": false, "l": [1]};

  var cases = [
    { label: '{{ x|nosuch }}', files: { '/t': '{{ x|nosuch }}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{{ x|upper|nosuch }}', files: { '/t': '{{ x|upper|nosuch }}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{{ x|nosuch|upper }}', files: { '/t': '{{ x|nosuch|upper }}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{{ x|nosuch("a") }}', files: { '/t': '{{ x|nosuch("a") }}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{{ "a"|nosuch }}', files: { '/t': '{{ "a"|nosuch }}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: 'a\nb\n{{ x|nosuch }}', files: { '/t': 'a\nb\n{{ x|nosuch }}' }, error: 'Invalid filter "nosuch" on line 3 in file /t.', atCompile: true },
    { label: '{% if x|nosuch %}Y{% endif %}', files: { '/t': '{% if x|nosuch %}Y{% endif %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', compiles: true },
    { label: '{% if t %}{{ x|nosuch }}{% endif %}', files: { '/t': '{% if t %}{{ x|nosuch }}{% endif %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', compiles: true },
    { label: '{% if f %}{{ x|nosuch }}{% endif %}A', files: { '/t': '{% if f %}{{ x|nosuch }}{% endif %}A' }, want: 'A' },
    { label: 'a\n{% if t %}\nb{{ x|nosuch }}{% endif %}', files: { '/t': 'a\n{% if t %}\nb{{ x|nosuch }}{% endif %}' }, error: 'Invalid filter "nosuch" on line 3 in file /t.', compiles: true },
    { label: '{% if t %}A{% elif x|nosuch %}B{% endif %}', files: { '/t': '{% if t %}A{% elif x|nosuch %}B{% endif %}' }, want: 'A' },
    { label: '{% if f %}A{% elif x|nosuch %}B{% endif %}', files: { '/t': '{% if f %}A{% elif x|nosuch %}B{% endif %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', compiles: true },
    { label: '{% if t %}A{% elif f %}{{ x|nosuch }}{% endif %}', files: { '/t': '{% if t %}A{% elif f %}{{ x|nosuch }}{% endif %}' }, want: 'A' },
    { label: '{% if t %}A{% else %}{{ x|nosuch }}{% endif %}', files: { '/t': '{% if t %}A{% else %}{{ x|nosuch }}{% endif %}' }, want: 'A' },
    { label: '{% if f %}A{% else %}{{ x|nosuch }}{% endif %}', files: { '/t': '{% if f %}A{% else %}{{ x|nosuch }}{% endif %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', compiles: true },
    { label: '{% if f %}{% if t %}{{ x|nosuch }}{% endif %}{% endif %}A', files: { '/t': '{% if f %}{% if t %}{{ x|nosuch }}{% endif %}{% endif %}A' }, want: 'A' },
    { label: '{% if f %}{% for i in l %}{{ i|nosuch }}{% endfor %}{% endif %}', files: { '/t': '{% if f %}{% for i in l %}{{ i|nosuch }}{% endfor %}{% endif %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% if f %}{% for i in l|nosuch %}{{ i }}{% endfor %}{% endif %}A', files: { '/t': '{% if f %}{% for i in l|nosuch %}{{ i }}{% endfor %}{% endif %}A' }, want: 'A' },
    { label: '{% for i in l %}{% if f %}{{ i|nosuch }}{% endif %}{% endfor %}A', files: { '/t': '{% for i in l %}{% if f %}{{ i|nosuch }}{% endif %}{% endfor %}A' }, want: 'A' },
    { label: '{% if f %}{% with a = 1 %}{{ a|nosuch }}{% endwith %}{% endif %}', files: { '/t': '{% if f %}{% with a = 1 %}{{ a|nosuch }}{% endwith %}{% endif %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% if f %}{% with a = x|nosuch %}{{ a }}{% endwith %}{% endif %}A', files: { '/t': '{% if f %}{% with a = x|nosuch %}{{ a }}{% endwith %}{% endif %}A' }, want: 'A' },
    { label: '{% if f %}{% set a = x|nosuch %}{% endif %}A', files: { '/t': '{% if f %}{% set a = x|nosuch %}{% endif %}A' }, want: 'A' },
    { label: '{% if f %}{% set a %}{{ x|nosuch }}{% endset %}{% endif %}', files: { '/t': '{% if f %}{% set a %}{{ x|nosuch }}{% endset %}{% endif %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% if f %}{% macro m() %}{{ x|nosuch }}{% endmacro %}{% endif %}', files: { '/t': '{% if f %}{% macro m() %}{{ x|nosuch }}{% endmacro %}{% endif %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% if f %}{% block b %}{{ x|nosuch }}{% endblock %}{% endif %}', files: { '/t': '{% if f %}{% block b %}{{ x|nosuch }}{% endblock %}{% endif %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% if f %}{% filter nosuch %}a{% endfilter %}{% endif %}', files: { '/t': '{% if f %}{% filter nosuch %}a{% endfilter %}{% endif %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% filter nosuch %}a{% endfilter %}', files: { '/t': '{% filter nosuch %}a{% endfilter %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: 'a\n{% filter upper|nosuch %}a{% endfilter %}', files: { '/t': 'a\n{% filter upper|nosuch %}a{% endfilter %}' }, error: 'Invalid filter "nosuch" on line 2 in file /t.', atCompile: true },
    { label: '{% filter replace("a", x|nosuch) %}a{% endfilter %}', files: { '/t': '{% filter replace("a", x|nosuch) %}a{% endfilter %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% if f %}{% filter replace("a", x|nosuch) %}a{% endfilter %}{% endif %}', files: { '/t': '{% if f %}{% filter replace("a", x|nosuch) %}a{% endfilter %}{% endif %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% filter upper %}{{ x|nosuch }}{% endfilter %}', files: { '/t': '{% filter upper %}{{ x|nosuch }}{% endfilter %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% if f %}{% include x|nosuch %}{% endif %}A', files: { '/t': '{% if f %}{% include x|nosuch %}{% endif %}A' }, want: 'A' },
    { label: '{% if f %}{% for i in l %}a{% else %}{{ x|nosuch }}{% endfor %}{% endif %}', files: { '/t': '{% if f %}{% for i in l %}a{% else %}{{ x|nosuch }}{% endfor %}{% endif %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% macro m() %}{% if f %}{{ x|nosuch }}{% endif %}{% endmacro %}A', files: { '/t': '{% macro m() %}{% if f %}{{ x|nosuch }}{% endif %}{% endmacro %}A' }, want: 'A' },
    { label: '{% block b %}{% if f %}{{ x|nosuch }}{% endif %}{% endblock %}A', files: { '/t': '{% block b %}{% if f %}{{ x|nosuch }}{% endif %}{% endblock %}A' }, want: 'A' },
    { label: '{% if f %}{{ x|upper(y|nosuch) }}{% endif %}A', files: { '/t': '{% if f %}{{ x|upper(y|nosuch) }}{% endif %}A' }, want: 'A' },
    { label: '{% macro m(a=x|nosuch) %}{{ a }}{% endmacro %}', files: { '/t': '{% macro m(a=x|nosuch) %}{{ a }}{% endmacro %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% if f %}{% macro m(a=x|nosuch) %}{{ a }}{% endmacro %}{% endif %}', files: { '/t': '{% if f %}{% macro m(a=x|nosuch) %}{{ a }}{% endmacro %}{% endif %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% autoescape true %}{{ x|nosuch }}{% endautoescape %}', files: { '/t': '{% autoescape true %}{{ x|nosuch }}{% endautoescape %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% if f %}{% autoescape true %}{{ x|nosuch }}{% endautoescape %}{% endif %}', files: { '/t': '{% if f %}{% autoescape true %}{{ x|nosuch }}{% endautoescape %}{% endif %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% set a %}{{ x|nosuch }}{% endset %}', files: { '/t': '{% set a %}{{ x|nosuch }}{% endset %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% if f %}{% endif %}{{ x|nosuch }}', files: { '/t': '{% if f %}{% endif %}{{ x|nosuch }}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% if f %}{% endif %}{% for i in l|nosuch %}{% endfor %}', files: { '/t': '{% if f %}{% endif %}{% for i in l|nosuch %}{% endfor %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{{ (x|nosuch) if f else "E" }}', files: { '/t': '{{ (x|nosuch) if f else "E" }}' }, want: 'E' },
    { label: '{{ "T" if t else (x|nosuch) }}', files: { '/t': '{{ "T" if t else (x|nosuch) }}' }, want: 'T' },
    { label: '{{ "T" if x|nosuch else "E" }}', files: { '/t': '{{ "T" if x|nosuch else "E" }}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', compiles: true },
    { label: '{{ "T" if(t) else x|nosuch }}', files: { '/t': '{{ "T" if(t) else x|nosuch }}' }, want: 'T' },
    { label: '{{ "T" if f else x|nosuch }}', files: { '/t': '{{ "T" if f else x|nosuch }}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', compiles: true },
    { label: '{% if f %}{{ "T" if t else x|nosuch }}{% endif %}A', files: { '/t': '{% if f %}{{ "T" if t else x|nosuch }}{% endif %}A' }, want: 'A' },
    { label: '{% for i in l %}{{ "T" if t else i|nosuch }}{% endfor %}', files: { '/t': '{% for i in l %}{{ "T" if t else i|nosuch }}{% endfor %}' }, want: 'T' },
    { label: '{% set y = "T" if t else x|nosuch %}{{ y }}', files: { '/t': '{% set y = "T" if t else x|nosuch %}{{ y }}' }, want: 'T' },
    { label: '{{ f and x|nosuch }}', files: { '/t': '{{ f and x|nosuch }}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{% for i in l if i|nosuch %}{{ i }}{% endfor %}', files: { '/t': '{% for i in l if i|nosuch %}{{ i }}{% endfor %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', atCompile: true },
    { label: '{{ x is frob }}', files: { '/t': '{{ x is frob }}' }, error: 'Invalid test "frob" on line 1 in file /t.', atCompile: true },
    { label: '{{ x is not frob }}', files: { '/t': '{{ x is not frob }}' }, error: 'Invalid test "frob" on line 1 in file /t.', atCompile: true },
    { label: 'a\n{{ x is frob }}', files: { '/t': 'a\n{{ x is frob }}' }, error: 'Invalid test "frob" on line 2 in file /t.', atCompile: true },
    { label: '{% if x is frob %}Y{% endif %}', files: { '/t': '{% if x is frob %}Y{% endif %}' }, error: 'Invalid test "frob" on line 1 in file /t.', compiles: true },
    { label: '{% if x is not frob %}Y{% else %}N{% endif %}', files: { '/t': '{% if x is not frob %}Y{% else %}N{% endif %}' }, error: 'Invalid test "frob" on line 1 in file /t.', compiles: true },
    { label: '{% if f %}{{ x is frob }}{% endif %}A', files: { '/t': '{% if f %}{{ x is frob }}{% endif %}A' }, want: 'A' },
    { label: '{% if t %}{{ x is not frob }}{% endif %}', files: { '/t': '{% if t %}{{ x is not frob }}{% endif %}' }, error: 'Invalid test "frob" on line 1 in file /t.', compiles: true },
    { label: '{% if t %}A{% elif x is frob %}B{% endif %}', files: { '/t': '{% if t %}A{% elif x is frob %}B{% endif %}' }, want: 'A' },
    { label: '{{ "T" if x is frob else "E" }}', files: { '/t': '{{ "T" if x is frob else "E" }}' }, error: 'Invalid test "frob" on line 1 in file /t.', compiles: true },
    { label: '{% if f %}{% for i in l %}{{ i is frob }}{% endfor %}{% endif %}', files: { '/t': '{% if f %}{% for i in l %}{{ i is frob }}{% endfor %}{% endif %}' }, error: 'Invalid test "frob" on line 1 in file /t.', atCompile: true },
    { label: '{% for i in l if i is frob %}{{ i }}{% endfor %}', files: { '/t': '{% for i in l if i is frob %}{{ i }}{% endfor %}' }, error: 'Invalid test "frob" on line 1 in file /t.', atCompile: true },
    { label: '{% if x is frob(1) %}Y{% endif %}', files: { '/t': '{% if x is frob(1) %}Y{% endif %}' }, error: 'Invalid test "frob" on line 1 in file /t.', compiles: true },
    { label: '{% if x is frob 1 %}Y{% endif %}', files: { '/t': '{% if x is frob 1 %}Y{% endif %}' }, error: 'Invalid test "frob" on line 1 in file /t.', compiles: true },
    { label: '{{ x|toString }}', files: { '/t': '{{ x|toString }}' }, error: 'Invalid filter "toString" on line 1 in file /t.', atCompile: true },
    { label: '{{ x|hasOwnProperty }}', files: { '/t': '{{ x|hasOwnProperty }}' }, error: 'Invalid filter "hasOwnProperty" on line 1 in file /t.', atCompile: true },
    { label: '{{ x|constructor }}', files: { '/t': '{{ x|constructor }}' }, error: 'Invalid filter "constructor" on line 1 in file /t.', atCompile: true },
    { label: '{{ x|valueOf }}', files: { '/t': '{{ x|valueOf }}' }, error: 'Invalid filter "valueOf" on line 1 in file /t.', atCompile: true },
    { label: '{{ x|__proto__ }}', files: { '/t': '{{ x|__proto__ }}' }, error: 'Invalid filter "__proto__" on line 1 in file /t.', atCompile: true },
    { label: '{% filter toString %}a{% endfilter %}', files: { '/t': '{% filter toString %}a{% endfilter %}' }, error: 'Invalid filter "toString" on line 1 in file /t.', atCompile: true },
    { label: '{% if t %}{{ x|toString }}{% endif %}', files: { '/t': '{% if t %}{{ x|toString }}{% endif %}' }, error: 'Invalid filter "toString" on line 1 in file /t.', compiles: true },
    { label: '{{ x is toString }}', files: { '/t': '{{ x is toString }}' }, error: 'Invalid test "toString" on line 1 in file /t.', atCompile: true },
    { label: '{{ x is hasOwnProperty }}', files: { '/t': '{{ x is hasOwnProperty }}' }, error: 'Invalid test "hasOwnProperty" on line 1 in file /t.', atCompile: true },
    { label: '{% if "nosuch" is filter %}{{ x|nosuch }}{% else %}G{% endif %}', files: { '/t': '{% if "nosuch" is filter %}{{ x|nosuch }}{% else %}G{% endif %}' }, want: 'G' },
    { label: '{% if "upper" is filter %}{{ x|upper }}{% else %}G{% endif %}', files: { '/t': '{% if "upper" is filter %}{{ x|upper }}{% else %}G{% endif %}' }, want: 'V' },
    { label: '{% if "frob" is test %}{{ x is frob }}{% else %}G{% endif %}', files: { '/t': '{% if "frob" is test %}{{ x is frob }}{% else %}G{% endif %}' }, want: 'G' },
    { label: '{% if "string" is test %}Y{% else %}N{% endif %}', files: { '/t': '{% if "string" is test %}Y{% else %}N{% endif %}' }, want: 'Y' },
    { label: '{% if "nosuch" is not filter %}Y{% else %}N{% endif %}', files: { '/t': '{% if "nosuch" is not filter %}Y{% else %}N{% endif %}' }, want: 'Y' },
    { label: '{% if "upper" is not filter %}Y{% else %}N{% endif %}', files: { '/t': '{% if "upper" is not filter %}Y{% else %}N{% endif %}' }, want: 'N' },
    { label: '{% if "frob" is not test %}Y{% else %}N{% endif %}', files: { '/t': '{% if "frob" is not test %}Y{% else %}N{% endif %}' }, want: 'Y' },
    { label: '{% if "toString" is filter %}Y{% else %}N{% endif %}', files: { '/t': '{% if "toString" is filter %}Y{% else %}N{% endif %}' }, want: 'N' },
    { label: '{% if "hasOwnProperty" is test %}Y{% else %}N{% endif %}', files: { '/t': '{% if "hasOwnProperty" is test %}Y{% else %}N{% endif %}' }, want: 'N' },
    { label: '{{ "U" if "upper" is filter else "N" }}', files: { '/t': '{{ "U" if "upper" is filter else "N" }}' }, want: 'U' },
    { label: '{{ x|upper if "upper" is filter else x }}', files: { '/t': '{{ x|upper if "upper" is filter else x }}' }, want: 'V' },
    { label: '{{ x|nosuch if "nosuch" is filter else x }}', files: { '/t': '{{ x|nosuch if "nosuch" is filter else x }}' }, want: 'v' },
    { label: 'in an included file', files: { '/t': 'A{% include "i" %}', '/i': 'b\n{{ x|nosuch }}' }, error: 'Invalid filter "nosuch" on line 2 in file /i.' },
    { label: 'in an included file, inside an if, reached', files: { '/t': 'A{% include "i" %}', '/i': '{% if t %}{{ x|nosuch }}{% endif %}' }, error: 'Invalid filter "nosuch" on line 1 in file /i.' },
    { label: 'in an included file, inside an if, not reached', files: { '/t': 'A{% include "i" %}', '/i': '{% if f %}{{ x|nosuch }}{% endif %}' }, want: 'A' },
    { label: 'an included file in a branch not taken', files: { '/t': '{% if f %}{% include "i" %}{% endif %}A', '/i': '{{ x|nosuch }}' }, want: 'A' },
    { label: 'in an imported file', files: { '/t': '{% import "m" as m %}A', '/m': '{% macro g() %}{{ x|nosuch }}{% endmacro %}' }, error: 'Invalid filter "nosuch" on line 1 in file /m.' },
    { label: 'in a from-imported file', files: { '/t': '{% from "m" import g %}A', '/m': '{% macro g() %}{{ x|nosuch }}{% endmacro %}' }, error: 'Invalid filter "nosuch" on line 1 in file /m.' },
    { label: 'in a macro of an imported file, inside an if, called', files: { '/t': '{% import "m" as m %}A{{ m.g() }}', '/m': '{% macro g() %}{% if true %}{{ x|nosuch }}{% endif %}{% endmacro %}' }, error: 'Invalid filter "nosuch" on line 1 in file /m.' },
    { label: 'in an extended file, its body', files: { '/t': '{% extends "p" %}{% block b %}C{% endblock %}', '/p': 'p\n{{ x|nosuch }}{% block b %}{% endblock %}' }, error: 'Invalid filter "nosuch" on line 2 in file /p.' },
    { label: 'in an extended file, a block the child overrides', files: { '/t': '{% extends "p" %}{% block b %}C{% endblock %}', '/p': '[{% block b %}{{ x|nosuch }}{% endblock %}]' }, error: 'Invalid filter "nosuch" on line 1 in file /p.' },
    { label: 'in an extended file, inside an if, reached', files: { '/t': '{% extends "p" %}{% block b %}C{% endblock %}', '/p': '{% if t %}{{ x|nosuch }}{% endif %}{% block b %}{% endblock %}' }, error: 'Invalid filter "nosuch" on line 1 in file /p.' },
    { label: 'in a block of the extending file', files: { '/t': '{% extends "p" %}\n{% block b %}{{ x|nosuch }}{% endblock %}', '/p': '[{% block b %}P{% endblock %}]' }, error: 'Invalid filter "nosuch" on line 2 in file /t.', atCompile: true },
    { label: 'in a block of the extending file, inside an if, reached', files: { '/t': '{% extends "p" %}{% block b %}{% if t %}{{ x|nosuch }}{% endif %}{% endblock %}', '/p': '[{% block b %}P{% endblock %}]' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', compiles: true },
    { label: '{{ x|upper }}', files: { '/t': '{{ x|upper }}' }, want: 'V' },
    { label: '{% if x|upper %}Y{% endif %}', files: { '/t': '{% if x|upper %}Y{% endif %}' }, want: 'Y' },
    { label: '{% filter upper %}a{% endfilter %}', files: { '/t': '{% filter upper %}a{% endfilter %}' }, want: 'A' },
    { label: '{% if x is string %}Y{% endif %}', files: { '/t': '{% if x is string %}Y{% endif %}' }, want: 'Y' },
    { label: '{% if x is not string %}Y{% else %}N{% endif %}', files: { '/t': '{% if x is not string %}Y{% else %}N{% endif %}' }, want: 'N' },
    { label: '{{ "T" if t else x|upper }}', files: { '/t': '{{ "T" if t else x|upper }}' }, want: 'T' }
  ];

  var accepted = [
    { label: 'a loop filter inside an if: Jinja2 fails at compile, swig when reached', files: { '/t': '{% if f %}{% for i in l if i|nosuch %}{{ i }}{% endfor %}{% endif %}A' }, want: 'A' },
    { label: 'another value of a with holding an inline-if: Jinja2 fails at compile, swig when reached', files: { '/t': '{% with a = x|nosuch, b = "T" if t else "E" %}{{ a }}{% endwith %}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', compiles: true },
    { label: 'an operand beside an inline-if: Jinja2 fails at compile, swig when reached', files: { '/t': '{{ (x|nosuch) ~ ("T" if t else "E") }}' }, error: 'Invalid filter "nosuch" on line 1 in file /t.', compiles: true }
  ];

  var numberTests = [
    { src: '{% if v is integer %}Y{% else %}N{% endif %}', values: [[1, "Y"], [-3, "Y"], [0, "Y"], [1.5, "N"], [-0.5, "N"], [true, "N"], [false, "N"], ["a", "N"], ["1", "N"], [null, "N"], [[1], "N"], [{"a": 1}, "N"]], missing: 'N' },
    { src: '{% if v is not integer %}Y{% else %}N{% endif %}', values: [[1, "N"], [-3, "N"], [0, "N"], [1.5, "Y"], [-0.5, "Y"], [true, "Y"], [false, "Y"], ["a", "Y"], ["1", "Y"], [null, "Y"], [[1], "Y"], [{"a": 1}, "Y"]], missing: 'Y' },
    { src: '{% if v is float %}Y{% else %}N{% endif %}', values: [[1, "N"], [-3, "N"], [0, "N"], [1.5, "Y"], [-0.5, "Y"], [true, "N"], [false, "N"], ["a", "N"], ["1", "N"], [null, "N"], [[1], "N"], [{"a": 1}, "N"]], missing: 'N' },
    { src: '{% if v is not float %}Y{% else %}N{% endif %}', values: [[1, "Y"], [-3, "Y"], [0, "Y"], [1.5, "N"], [-0.5, "N"], [true, "Y"], [false, "Y"], ["a", "Y"], ["1", "Y"], [null, "Y"], [[1], "Y"], [{"a": 1}, "Y"]], missing: 'Y' }
  ];

  function checkCase(c) {
    it('on the sync render path', function () {
      var inst = new jinja2.Jinja2({ cache: false, loader: jinja2.loaders.memory(c.files, '/') });
      if (c.error) {
        expect(function () {
          inst.renderFile('/t', JSON.parse(JSON.stringify(locals)));
        }).to.throwError(regex(c.error));
        if (c.atCompile) {
          expect(function () {
            inst.compileFile('/t');
          }).to.throwError(regex(c.error));
        }
        if (c.compiles) {
          expect(inst.compileFile('/t')).to.be.a('function');
        }
      } else {
        expect(inst.renderFile('/t', JSON.parse(JSON.stringify(locals)))).to.equal(c.want);
      }
    });

    it('on the async render path', function (done) {
      new jinja2.Jinja2({ cache: false, loader: asyncLoader(c.files) }).renderFile('/t', JSON.parse(JSON.stringify(locals)), function (err, out) {
        if (c.error) {
          expect(err && err.message).to.match(regex(c.error));
        } else {
          expect(err).to.be(null);
          expect(out).to.equal(c.want);
        }
        done();
      });
    });
  }

  cases.forEach(function (c) {
    describe(c.label, function () {
      checkCase(c);
    });
  });

  describe('where it differs from Jinja2', function () {
    accepted.forEach(function (c) {
      describe(c.label, function () {
        checkCase(c);
      });
    });

    it('the sync path reads an imported file at compile, in a branch not taken too, as it does for a missing file', function (done) {
      var files = { '/t': '{% if f %}{% import "m" as m %}{% endif %}A', '/m': '{% macro g() %}{{ x|nosuch }}{% endmacro %}' },
        inst = new jinja2.Jinja2({ cache: false, loader: jinja2.loaders.memory(files, '/') });
      expect(function () {
        inst.renderFile('/t', { f: false });
      }).to.throwError(regex('Invalid filter "nosuch" on line 1 in file /m.'));
      new jinja2.Jinja2({ cache: false, loader: asyncLoader(files) }).renderFile('/t', { f: false }, function (err, out) {
        expect(err).to.be(null);
        expect(out).to.equal('A');
        done();
      });
    });

    it('`is filter` and `is test` take a string literal; another subject is an unknown test', function () {
      expect(function () {
        jinja2.render('{% if x is filter %}Y{% endif %}', { locals: { x: 'upper' } });
      }).to.throwError(regex('Invalid test "filter" on line 1.'));
      expect(function () {
        jinja2.render('{{ x is test }}', { locals: { x: 'upper' } });
      }).to.throwError(regex('Invalid test "test" on line 1.'));
    });
  });

  describe('the error a compiled template carries', function () {
    it('holds a filename as text, whatever the filename', function () {
      var names = ['a"b', 'a\\b', 'a\nb', 'a\u2028b', 'x");globalThis.__swigFilename = 1;("', 5];
      names.forEach(function (name) {
        var compiled = new jinja2.Jinja2({ cache: false }).compile('{% if t %}{{ x|nosuch }}{% endif %}', { filename: name }), message = null;
        try {
          compiled({ t: true });
        } catch (e) {
          message = e.message;
        }
        expect(message).to.equal('Invalid filter "nosuch" on line 1 in file ' + name + '.');
        expect(typeof global.__swigFilename).to.equal('undefined');
      });
    });

    it('names only the line when the template has no filename', function () {
      expect(function () {
        new jinja2.Jinja2({ cache: false }).compile('\n{% if t %}{{ x|nosuch }}{% endif %}')({ t: true });
      }).to.throwError(regex('Invalid filter "nosuch" on line 2.'));
    });

    it('runs on the runtime-only build', function () {
      var body = new jinja2.Jinja2({ cache: false }).precompile('{% if t %}{{ x|nosuch }}{% endif %}{% if f %}{{ x is frob }}{% endif %}Z', { filename: 'a.tpl' }).tpl.toString(),
        inst = new runtime.Swig();
      inst.register('/x', new Function('return ' + body)());
      expect(inst.renderFile('/x', { t: false, f: false })).to.equal('Z');
      expect(function () {
        inst.renderFile('/x', { t: true, f: false, x: 'v' });
      }).to.throwError(regex('Invalid filter "nosuch" on line 1 in file a.tpl.'));
      expect(function () {
        inst.renderFile('/x', { t: false, f: true, x: 'v' });
      }).to.throwError(regex('Invalid test "frob" on line 1 in file a.tpl.'));
    });
  });

  describe('a filter the instance registers', function () {
    function upperBang(v) {
      return String(v).toUpperCase() + '!';
    }

    it('counts when it is registered before the compile, in an output, the filter tag and a guard', function () {
      var inst = new jinja2.Jinja2({ cache: false });
      inst.setFilter('mine', upperBang);
      expect(inst.render('{{ x|mine }}', { locals: { x: 'a' } })).to.equal('A!');
      expect(inst.render('{% filter mine %}a{% endfilter %}')).to.equal('A!');
      expect(inst.render('{% if "mine" is filter %}Y{% else %}N{% endif %}')).to.equal('Y');
    });

    it('does not count when it is registered after the compile', function () {
      var inst = new jinja2.Jinja2({ cache: false }), soft;
      expect(function () {
        inst.compile('{{ x|mine }}');
      }).to.throwError(regex('Invalid filter "mine" on line 1.'));
      expect(function () {
        inst.compile('{% filter mine %}a{% endfilter %}');
      }).to.throwError(regex('Invalid filter "mine" on line 1.'));
      soft = inst.compile('{% if x %}{{ x|mine }}{% endif %}');
      inst.setFilter('mine', upperBang);
      expect(function () {
        soft({ x: 'a' });
      }).to.throwError(regex('Invalid filter "mine" on line 1.'));
      expect(inst.compile('{{ x|mine }}')({ x: 'a' })).to.equal('A!');
    });

    it('counts only on the instance that registers it', function () {
      var one = new jinja2.Jinja2({ cache: false }), other = new jinja2.Jinja2({ cache: false });
      one.setFilter('mine', upperBang);
      expect(function () {
        other.compile('{{ x|mine }}');
      }).to.throwError(regex('Invalid filter "mine" on line 1.'));
      expect(other.render('{% if "mine" is filter %}Y{% else %}N{% endif %}')).to.equal('N');
    });

    it('can have the name hasOwnProperty, and unknown names still fail', function () {
      var inst = new jinja2.Jinja2({ cache: false });
      inst.setFilter('hasOwnProperty', function (v) {
        return 'H:' + v;
      });
      expect(inst.render('{{ x|hasOwnProperty }}', { locals: { x: 'a' } })).to.equal('H:a');
      expect(inst.render('{{ x|upper }}', { locals: { x: 'a' } })).to.equal('A');
      expect(inst.render('{% filter hasOwnProperty %}a{% endfilter %}')).to.equal('H:a');
      expect(inst.render('{% if "nosuch" is filter %}Y{% else %}N{% endif %}')).to.equal('N');
      expect(function () {
        inst.compile('{{ x|nosuch }}');
      }).to.throwError(regex('Invalid filter "nosuch" on line 1.'));
      expect(function () {
        inst.compile('{% filter nosuch %}a{% endfilter %}');
      }).to.throwError(regex('Invalid filter "nosuch" on line 1.'));
    });

    it('reaches a custom tag through the parser it is handed', function () {
      var inst = new jinja2.Jinja2({ cache: false });
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

    it('counts when it is registered before the compile, in a test and a guard', function () {
      var inst = new jinja2.Jinja2({ cache: false });
      inst.setExtension('_test_mine', isOne);
      expect(inst.render('{% if x is mine %}Y{% else %}N{% endif %}', { locals: { x: 1 } })).to.equal('Y');
      expect(inst.render('{% if "mine" is test %}Y{% else %}N{% endif %}')).to.equal('Y');
    });

    it('does not count when it is registered after the compile', function () {
      var inst = new jinja2.Jinja2({ cache: false }), soft = inst.compile('{% if x is mine %}Y{% else %}N{% endif %}');
      expect(function () {
        inst.compile('{{ x is mine }}');
      }).to.throwError(regex('Invalid test "mine" on line 1.'));
      inst.setExtension('_test_mine', isOne);
      expect(function () {
        soft({ x: 1 });
      }).to.throwError(regex('Invalid test "mine" on line 1.'));
      expect(inst.compile('{% if x is mine %}Y{% else %}N{% endif %}')({ x: 1 })).to.equal('Y');
    });

    it('counts only on the instance that registers it', function () {
      var one = new jinja2.Jinja2({ cache: false }), other = new jinja2.Jinja2({ cache: false });
      one.setExtension('_test_mine', isOne);
      expect(function () {
        other.compile('{{ x is mine }}');
      }).to.throwError(regex('Invalid test "mine" on line 1.'));
    });

    it('is read as an own entry when an extension has the name hasOwnProperty', function () {
      var inst = new jinja2.Jinja2({ cache: false });
      inst.setExtension('hasOwnProperty', function () {
        return true;
      });
      expect(inst.render('{% if 1 is odd %}Y{% endif %}')).to.equal('Y');
      expect(inst.render('{% if "frob" is test %}Y{% else %}N{% endif %}')).to.equal('N');
      expect(function () {
        inst.compile('{{ x is frob }}');
      }).to.throwError(regex('Invalid test "frob" on line 1.'));
    });
  });

  it('checks no name when the parse has no engine instance', function () {
    expect(parser.parse(undefined, '{{ x|nosuch }}', {}, tags, {}).tokens.length).to.equal(1);
    expect(parser.parse({}, '{% if x is frob %}Y{% endif %}', {}, tags, {}).tokens.length).to.equal(1);
    expect(parser.parse({}, '{% filter nosuch %}a{% endfilter %}', {}, tags, {}).tokens.length).to.equal(1);
    expect(parser.parseExpr(lexer.read('x|nosuch'), {}).type).to.equal('FilterCall');
    expect(parser.parseExpr(lexer.read('x is frob'), {}).type).to.equal('FnCall');
    expect(parser.parseExpr(lexer.read('"a" is filter'), {}).type).to.equal('FnCall');
  });

  describe('is integer and is float', function () {
    numberTests.forEach(function (row) {
      describe(row.src, function () {
        row.values.forEach(function (pair) {
          it(JSON.stringify(pair[0]), function () {
            expect(jinja2.render(row.src, { locals: { v: pair[0] } })).to.equal(pair[1]);
          });
        });
        it('a variable that is not set', function () {
          expect(jinja2.render(row.src, { locals: {} })).to.equal(row.missing);
        });
      });
    });

    it('read a number with no fractional part as an integer, however it is written: JavaScript has one number type', function () {
      expect(jinja2.render('{% if v is integer %}Y{% else %}N{% endif %}', { locals: { v: 1.0 } })).to.equal('Y');
      expect(jinja2.render('{% if v is float %}Y{% else %}N{% endif %}', { locals: { v: 1e300 } })).to.equal('N');
    });

    it('read NaN and the infinities as floats, as Python does', function () {
      [NaN, Infinity, -Infinity].forEach(function (v) {
        expect(jinja2.render('{% if v is float %}Y{% else %}N{% endif %}', { locals: { v: v } })).to.equal('Y');
        expect(jinja2.render('{% if v is integer %}Y{% else %}N{% endif %}', { locals: { v: v } })).to.equal('N');
      });
    });

    it('apply to a literal and to a filter result', function () {
      expect(jinja2.render('{% if 1 is integer %}Y{% else %}N{% endif %}')).to.equal('Y');
      expect(jinja2.render('{% if 1.5 is float %}Y{% else %}N{% endif %}')).to.equal('Y');
      expect(jinja2.render('{% if "3"|int is integer %}Y{% else %}N{% endif %}')).to.equal('Y');
    });
  });
});
