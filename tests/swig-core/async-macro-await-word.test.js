var swig = require('../../lib/swig'),
  twig = require('../../packages/swig-twig'),
  jinja2 = require('../../packages/swig-jinja2'),
  django = require('../../packages/swig-django'),
  loaders = require('../../packages/swig-core/lib/loaders'),
  expect = require('../lib/expect.js');

/*!
 * On the async render path a macro that holds an include, an import, a from
 * import or a block throws an error when it is called. The word await in a
 * macro's text, in a string it writes or as a name it reads, sets or loops
 * over does not make it throw; a real await in a macro (a deferred include,
 * import or block, or a custom tag that awaits) still does. A custom tag that
 * writes its await between two quotes outside string literals on one line is
 * not seen as awaiting: in a loop or a macro the template then fails to
 * compile. Templates outside macros, plain names and the word wait are the
 * controls.
 * Each case runs on the sync and the async render paths; the expectations
 * are generated and were checked against recorded renders of the same shapes.
 */
var CTORS = { native: swig.Swig, twig: twig.Twig, jinja2: jinja2.Jinja2, django: django.Django };

function fnT() { return 'T'; }
function fnTrue() { return true; }
function fnList() { return [1, 2]; }

// A native tag that writes the argument fragments it receives into the output.
function showParse(str, line, parser) { return parser && true; }
function showCompile(compiler, args) { return '_output += String(' + args.join('') + ');\n'; }

// Native tags whose compiled code awaits a value on the async render path: later, on a line between two
// comment lines that each hold a lone quote; quoted, on a line holding a quote in a regular expression
// before the await and one in a comment after it.
function laterParse(str, line, parser) { return parser && true; }
function laterCompile(compiler, args, content, parents, options) {
  return options && options.codegenMode === 'async' ? '// it\'s\n_output += await Promise.resolve("A");\n// it\'s\n' : '_output += "A";\n';
}
function quotedParse(str, line, parser) { return parser && true; }
function quotedCompile(compiler, args, content, parents, options) {
  return options && options.codegenMode === 'async' ? '_output += /\'/.source && await Promise.resolve("Q"); // it\'s\n' : '_output += "Q";\n';
}

function make(f, src, files, isAsync) {
  var map = { '/page.html': src }, mem, loader, s;
  Object.keys(files || {}).forEach(function (k) { map[k] = files[k]; });
  mem = loaders.memory(map, '/');
  loader = mem;
  if (isAsync) {
    loader = {
      async: true,
      resolve: mem.resolve,
      load: function (id, cb) {
        if (!cb) { return mem.load(id); }
        setImmediate(function () {
          var text;
          try { text = mem.load(id); } catch (e) { cb(e); return; }
          cb(null, text);
        });
      }
    };
  }
  s = new CTORS[f]({ loader: loader, cache: false });
  if (f === 'native') {
    s.setTag('show', showParse, showCompile, false, false);
    s.setTag('later', laterParse, laterCompile, false, false);
    s.setTag('quoted', quotedParse, quotedCompile, false, false);
  }
  return s;
}

function renderSync(c) {
  try { return make(c.flavor, c.src, c.files, false).renderFile('/page.html', c.loc()); } catch (e) { return 'THROW ' + e.message; }
}

function renderAsync(c) {
  return new Promise(function (resolve) {
    try {
      make(c.flavor, c.src, c.files, true).renderFile('/page.html', c.loc(), function (err, out) {
        resolve(err ? 'THROW ' + err.message : out);
      });
    } catch (e) { resolve('THROW ' + e.message); }
  });
}

var GROUPS = [
  {
    name: "The word in a macro's text or in a string it writes",
    cases: [
      {
        label: "the word in a macro's text: await",
        flavor: "native",
        src: "{% macro m() %}<i>await</i>{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[<i>await</i>]", "[<i>await</i>]"]
      },
      {
        label: "the word in a macro's text: await",
        flavor: "twig",
        src: "{% macro m() %}<i>await</i>{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[&lt;i&gt;await&lt;/i&gt;]", "[&lt;i&gt;await&lt;/i&gt;]"]
      },
      {
        label: "the word in a macro's text: await",
        flavor: "jinja2",
        src: "{% macro m() %}<i>await</i>{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[&lt;i&gt;await&lt;/i&gt;]", "[&lt;i&gt;await&lt;/i&gt;]"]
      },
      {
        label: "the word in a macro's text: awaited",
        flavor: "native",
        src: "{% macro m() %}<i>awaited</i>{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[<i>awaited</i>]", "[<i>awaited</i>]"]
      },
      {
        label: "the word in a macro's text: awaited",
        flavor: "twig",
        src: "{% macro m() %}<i>awaited</i>{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[&lt;i&gt;awaited&lt;/i&gt;]", "[&lt;i&gt;awaited&lt;/i&gt;]"]
      },
      {
        label: "the word in a macro's text: awaited",
        flavor: "jinja2",
        src: "{% macro m() %}<i>awaited</i>{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[&lt;i&gt;awaited&lt;/i&gt;]", "[&lt;i&gt;awaited&lt;/i&gt;]"]
      },
      {
        label: "the word in a macro's text: wait",
        flavor: "native",
        src: "{% macro m() %}<i>wait</i>{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[<i>wait</i>]", "[<i>wait</i>]"]
      },
      {
        label: "the word in a macro's text: wait",
        flavor: "twig",
        src: "{% macro m() %}<i>wait</i>{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[&lt;i&gt;wait&lt;/i&gt;]", "[&lt;i&gt;wait&lt;/i&gt;]"]
      },
      {
        label: "the word in a macro's text: wait",
        flavor: "jinja2",
        src: "{% macro m() %}<i>wait</i>{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[&lt;i&gt;wait&lt;/i&gt;]", "[&lt;i&gt;wait&lt;/i&gt;]"]
      },
      {
        label: "the word in a string a macro writes: await",
        flavor: "native",
        src: "{% macro m() %}{{ \"await\" }}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[await]", "[await]"]
      },
      {
        label: "the word in a string a macro writes: await",
        flavor: "twig",
        src: "{% macro m() %}{{ \"await\" }}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[await]", "[await]"]
      },
      {
        label: "the word in a string a macro writes: await",
        flavor: "jinja2",
        src: "{% macro m() %}{{ \"await\" }}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[await]", "[await]"]
      },
      {
        label: "the word in an imported macro's text: await",
        flavor: "native",
        src: "{% import \"m.html\" as s %}[{{ s.m() }}]",
        files: {"/m.html":"{% macro m() %}<i>await</i>{% endmacro %}"},
        loc: function () { return {}; },
        expect: ["[<i>await</i>]", "[<i>await</i>]"]
      },
      {
        label: "the word in an imported macro's text: await",
        flavor: "twig",
        src: "{% import \"m.html\" as s %}[{{ s.m() }}]",
        files: {"/m.html":"{% macro m() %}<i>await</i>{% endmacro %}"},
        loc: function () { return {}; },
        expect: ["[&lt;i&gt;await&lt;/i&gt;]", "[&lt;i&gt;await&lt;/i&gt;]"]
      },
      {
        label: "the word in an imported macro's text: await",
        flavor: "jinja2",
        src: "{% import \"m.html\" as s %}[{{ s.m() }}]",
        files: {"/m.html":"{% macro m() %}<i>await</i>{% endmacro %}"},
        loc: function () { return {}; },
        expect: ["[&lt;i&gt;await&lt;/i&gt;]", "[&lt;i&gt;await&lt;/i&gt;]"]
      },
      {
        label: "the word in a for loop's text outside any macro: await",
        flavor: "native",
        src: "{% for x in xs %}<i>await</i>[{{ x }}]{% endfor %}",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["<i>await</i>[A]<i>await</i>[B]", "<i>await</i>[A]<i>await</i>[B]"]
      },
      {
        label: "the word in a for loop's text outside any macro: await",
        flavor: "twig",
        src: "{% for x in xs %}<i>await</i>[{{ x }}]{% endfor %}",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["<i>await</i>[A]<i>await</i>[B]", "<i>await</i>[A]<i>await</i>[B]"]
      },
      {
        label: "the word in a for loop's text outside any macro: await",
        flavor: "jinja2",
        src: "{% for x in xs %}<i>await</i>[{{ x }}]{% endfor %}",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["<i>await</i>[A]<i>await</i>[B]", "<i>await</i>[A]<i>await</i>[B]"]
      },
      {
        label: "the word in a for loop's text outside any macro: await",
        flavor: "django",
        src: "{% for x in xs %}<i>await</i>[{{ x }}]{% endfor %}",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["<i>await</i>[A]<i>await</i>[B]", "<i>await</i>[A]<i>await</i>[B]"]
      },
      {
        label: "the word in a for loop's text inside a macro: await",
        flavor: "native",
        src: "{% macro m() %}{% for x in xs %}<i>await</i>[{{ x }}]{% endfor %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[<i>await</i>[A]<i>await</i>[B]]", "[<i>await</i>[A]<i>await</i>[B]]"]
      },
      {
        label: "the word in a for loop's text inside a macro: await",
        flavor: "twig",
        src: "{% macro m() %}{% for x in xs %}<i>await</i>[{{ x }}]{% endfor %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[&lt;i&gt;await&lt;/i&gt;[A]&lt;i&gt;await&lt;/i&gt;[B]]", "[&lt;i&gt;await&lt;/i&gt;[A]&lt;i&gt;await&lt;/i&gt;[B]]"]
      },
      {
        label: "the word in a for loop's text inside a macro: await",
        flavor: "jinja2",
        src: "{% macro m() %}{% for x in xs %}<i>await</i>[{{ x }}]{% endfor %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[&lt;i&gt;await&lt;/i&gt;[A]&lt;i&gt;await&lt;/i&gt;[B]]", "[&lt;i&gt;await&lt;/i&gt;[A]&lt;i&gt;await&lt;/i&gt;[B]]"]
      },
      {
        label: "the word in a nested for loop's text inside a macro: await",
        flavor: "native",
        src: "{% macro m() %}{% for x in xs %}{% for y in xs %}<i>await</i>{% endfor %}[{{ x }}]{% endfor %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[<i>await</i><i>await</i>[A]<i>await</i><i>await</i>[B]]", "[<i>await</i><i>await</i>[A]<i>await</i><i>await</i>[B]]"]
      },
      {
        label: "the word in a nested for loop's text inside a macro: await",
        flavor: "twig",
        src: "{% macro m() %}{% for x in xs %}{% for y in xs %}<i>await</i>{% endfor %}[{{ x }}]{% endfor %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[&lt;i&gt;await&lt;/i&gt;&lt;i&gt;await&lt;/i&gt;[A]&lt;i&gt;await&lt;/i&gt;&lt;i&gt;await&lt;/i&gt;[B]]", "[&lt;i&gt;await&lt;/i&gt;&lt;i&gt;await&lt;/i&gt;[A]&lt;i&gt;await&lt;/i&gt;&lt;i&gt;await&lt;/i&gt;[B]]"]
      },
      {
        label: "the word in a nested for loop's text inside a macro: await",
        flavor: "jinja2",
        src: "{% macro m() %}{% for x in xs %}{% for y in xs %}<i>await</i>{% endfor %}[{{ x }}]{% endfor %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[&lt;i&gt;await&lt;/i&gt;&lt;i&gt;await&lt;/i&gt;[A]&lt;i&gt;await&lt;/i&gt;&lt;i&gt;await&lt;/i&gt;[B]]", "[&lt;i&gt;await&lt;/i&gt;&lt;i&gt;await&lt;/i&gt;[A]&lt;i&gt;await&lt;/i&gt;&lt;i&gt;await&lt;/i&gt;[B]]"]
      },
      {
        label: "the word in a with block inside a macro: await",
        flavor: "twig",
        src: "{% macro m() %}{% with { a: 1 } %}<i>await</i>{{ a }}{% endwith %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[&lt;i&gt;await&lt;/i&gt;1]", "[&lt;i&gt;await&lt;/i&gt;1]"]
      },
      {
        label: "the word in a with block inside a macro: await",
        flavor: "jinja2",
        src: "{% macro m() %}{% with a = 1 %}<i>await</i>{{ a }}{% endwith %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[&lt;i&gt;await&lt;/i&gt;1]", "[&lt;i&gt;await&lt;/i&gt;1]"]
      },
      {
        label: "the word in a filter block inside a macro: await",
        flavor: "native",
        src: "{% macro m() %}{% filter upper %}<i>await</i>{% endfilter %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[<I>AWAIT</I>]", "[<I>AWAIT</I>]"]
      },
      {
        label: "the word in a filter block inside a macro: await",
        flavor: "jinja2",
        src: "{% macro m() %}{% filter upper %}<i>await</i>{% endfilter %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[&lt;I&gt;AWAIT&lt;/I&gt;]", "[&lt;I&gt;AWAIT&lt;/I&gt;]"]
      },
      {
        label: "the word in a filter block inside a macro: await",
        flavor: "twig",
        src: "{% macro m() %}{% apply upper %}<i>await</i>{% endapply %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[&lt;I&gt;AWAIT&lt;/I&gt;]", "[&lt;I&gt;AWAIT&lt;/I&gt;]"]
      },
      {
        label: "the word in a set block inside a macro: await",
        flavor: "twig",
        src: "{% macro m() %}{% set v %}<i>await</i>{% endset %}{{ v }}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[&lt;i&gt;await&lt;/i&gt;]", "[&lt;i&gt;await&lt;/i&gt;]"]
      },
      {
        label: "the word in a set block inside a macro: await",
        flavor: "jinja2",
        src: "{% macro m() %}{% set v %}<i>await</i>{% endset %}{{ v }}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[&lt;i&gt;await&lt;/i&gt;]", "[&lt;i&gt;await&lt;/i&gt;]"]
      },
      {
        label: "the word in a spaceless block: await",
        flavor: "django",
        src: "{% spaceless %}<p>await</p> <b>x</b>{% endspaceless %}",
        loc: function () { return {}; },
        expect: ["<p>await</p><b>x</b>", "<p>await</p><b>x</b>"]
      },
      {
        label: "the word in a string a macro writes: wait",
        flavor: "native",
        src: "{% macro m() %}{{ \"wait\" }}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[wait]", "[wait]"]
      },
      {
        label: "the word in a string a macro writes: wait",
        flavor: "twig",
        src: "{% macro m() %}{{ \"wait\" }}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[wait]", "[wait]"]
      },
      {
        label: "the word in a string a macro writes: wait",
        flavor: "jinja2",
        src: "{% macro m() %}{{ \"wait\" }}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[wait]", "[wait]"]
      },
      {
        label: "the word in an imported macro's text: wait",
        flavor: "native",
        src: "{% import \"m.html\" as s %}[{{ s.m() }}]",
        files: {"/m.html":"{% macro m() %}<i>wait</i>{% endmacro %}"},
        loc: function () { return {}; },
        expect: ["[<i>wait</i>]", "[<i>wait</i>]"]
      },
      {
        label: "the word in an imported macro's text: wait",
        flavor: "twig",
        src: "{% import \"m.html\" as s %}[{{ s.m() }}]",
        files: {"/m.html":"{% macro m() %}<i>wait</i>{% endmacro %}"},
        loc: function () { return {}; },
        expect: ["[&lt;i&gt;wait&lt;/i&gt;]", "[&lt;i&gt;wait&lt;/i&gt;]"]
      },
      {
        label: "the word in an imported macro's text: wait",
        flavor: "jinja2",
        src: "{% import \"m.html\" as s %}[{{ s.m() }}]",
        files: {"/m.html":"{% macro m() %}<i>wait</i>{% endmacro %}"},
        loc: function () { return {}; },
        expect: ["[&lt;i&gt;wait&lt;/i&gt;]", "[&lt;i&gt;wait&lt;/i&gt;]"]
      },
      {
        label: "the word in a for loop's text outside any macro: wait",
        flavor: "native",
        src: "{% for x in xs %}<i>wait</i>[{{ x }}]{% endfor %}",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["<i>wait</i>[A]<i>wait</i>[B]", "<i>wait</i>[A]<i>wait</i>[B]"]
      },
      {
        label: "the word in a for loop's text outside any macro: wait",
        flavor: "twig",
        src: "{% for x in xs %}<i>wait</i>[{{ x }}]{% endfor %}",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["<i>wait</i>[A]<i>wait</i>[B]", "<i>wait</i>[A]<i>wait</i>[B]"]
      },
      {
        label: "the word in a for loop's text outside any macro: wait",
        flavor: "jinja2",
        src: "{% for x in xs %}<i>wait</i>[{{ x }}]{% endfor %}",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["<i>wait</i>[A]<i>wait</i>[B]", "<i>wait</i>[A]<i>wait</i>[B]"]
      },
      {
        label: "the word in a for loop's text outside any macro: wait",
        flavor: "django",
        src: "{% for x in xs %}<i>wait</i>[{{ x }}]{% endfor %}",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["<i>wait</i>[A]<i>wait</i>[B]", "<i>wait</i>[A]<i>wait</i>[B]"]
      },
      {
        label: "the word in a for loop's text inside a macro: wait",
        flavor: "native",
        src: "{% macro m() %}{% for x in xs %}<i>wait</i>[{{ x }}]{% endfor %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[<i>wait</i>[A]<i>wait</i>[B]]", "[<i>wait</i>[A]<i>wait</i>[B]]"]
      },
      {
        label: "the word in a for loop's text inside a macro: wait",
        flavor: "twig",
        src: "{% macro m() %}{% for x in xs %}<i>wait</i>[{{ x }}]{% endfor %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[&lt;i&gt;wait&lt;/i&gt;[A]&lt;i&gt;wait&lt;/i&gt;[B]]", "[&lt;i&gt;wait&lt;/i&gt;[A]&lt;i&gt;wait&lt;/i&gt;[B]]"]
      },
      {
        label: "the word in a for loop's text inside a macro: wait",
        flavor: "jinja2",
        src: "{% macro m() %}{% for x in xs %}<i>wait</i>[{{ x }}]{% endfor %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[&lt;i&gt;wait&lt;/i&gt;[A]&lt;i&gt;wait&lt;/i&gt;[B]]", "[&lt;i&gt;wait&lt;/i&gt;[A]&lt;i&gt;wait&lt;/i&gt;[B]]"]
      },
      {
        label: "the word in a nested for loop's text inside a macro: wait",
        flavor: "native",
        src: "{% macro m() %}{% for x in xs %}{% for y in xs %}<i>wait</i>{% endfor %}[{{ x }}]{% endfor %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[<i>wait</i><i>wait</i>[A]<i>wait</i><i>wait</i>[B]]", "[<i>wait</i><i>wait</i>[A]<i>wait</i><i>wait</i>[B]]"]
      },
      {
        label: "the word in a nested for loop's text inside a macro: wait",
        flavor: "twig",
        src: "{% macro m() %}{% for x in xs %}{% for y in xs %}<i>wait</i>{% endfor %}[{{ x }}]{% endfor %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[&lt;i&gt;wait&lt;/i&gt;&lt;i&gt;wait&lt;/i&gt;[A]&lt;i&gt;wait&lt;/i&gt;&lt;i&gt;wait&lt;/i&gt;[B]]", "[&lt;i&gt;wait&lt;/i&gt;&lt;i&gt;wait&lt;/i&gt;[A]&lt;i&gt;wait&lt;/i&gt;&lt;i&gt;wait&lt;/i&gt;[B]]"]
      },
      {
        label: "the word in a nested for loop's text inside a macro: wait",
        flavor: "jinja2",
        src: "{% macro m() %}{% for x in xs %}{% for y in xs %}<i>wait</i>{% endfor %}[{{ x }}]{% endfor %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[&lt;i&gt;wait&lt;/i&gt;&lt;i&gt;wait&lt;/i&gt;[A]&lt;i&gt;wait&lt;/i&gt;&lt;i&gt;wait&lt;/i&gt;[B]]", "[&lt;i&gt;wait&lt;/i&gt;&lt;i&gt;wait&lt;/i&gt;[A]&lt;i&gt;wait&lt;/i&gt;&lt;i&gt;wait&lt;/i&gt;[B]]"]
      },
      {
        label: "the word in a with block inside a macro: wait",
        flavor: "twig",
        src: "{% macro m() %}{% with { a: 1 } %}<i>wait</i>{{ a }}{% endwith %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[&lt;i&gt;wait&lt;/i&gt;1]", "[&lt;i&gt;wait&lt;/i&gt;1]"]
      },
      {
        label: "the word in a with block inside a macro: wait",
        flavor: "jinja2",
        src: "{% macro m() %}{% with a = 1 %}<i>wait</i>{{ a }}{% endwith %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[&lt;i&gt;wait&lt;/i&gt;1]", "[&lt;i&gt;wait&lt;/i&gt;1]"]
      },
      {
        label: "the word in a filter block inside a macro: wait",
        flavor: "native",
        src: "{% macro m() %}{% filter upper %}<i>wait</i>{% endfilter %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[<I>WAIT</I>]", "[<I>WAIT</I>]"]
      },
      {
        label: "the word in a filter block inside a macro: wait",
        flavor: "jinja2",
        src: "{% macro m() %}{% filter upper %}<i>wait</i>{% endfilter %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[&lt;I&gt;WAIT&lt;/I&gt;]", "[&lt;I&gt;WAIT&lt;/I&gt;]"]
      },
      {
        label: "the word in a filter block inside a macro: wait",
        flavor: "twig",
        src: "{% macro m() %}{% apply upper %}<i>wait</i>{% endapply %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[&lt;I&gt;WAIT&lt;/I&gt;]", "[&lt;I&gt;WAIT&lt;/I&gt;]"]
      },
      {
        label: "the word in a set block inside a macro: wait",
        flavor: "twig",
        src: "{% macro m() %}{% set v %}<i>wait</i>{% endset %}{{ v }}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[&lt;i&gt;wait&lt;/i&gt;]", "[&lt;i&gt;wait&lt;/i&gt;]"]
      },
      {
        label: "the word in a set block inside a macro: wait",
        flavor: "jinja2",
        src: "{% macro m() %}{% set v %}<i>wait</i>{% endset %}{{ v }}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[&lt;i&gt;wait&lt;/i&gt;]", "[&lt;i&gt;wait&lt;/i&gt;]"]
      },
      {
        label: "the word in a spaceless block: wait",
        flavor: "django",
        src: "{% spaceless %}<p>wait</p> <b>x</b>{% endspaceless %}",
        loc: function () { return {}; },
        expect: ["<p>wait</p><b>x</b>", "<p>wait</p><b>x</b>"]
      },
      {
        label: "the word between double quotes in a macro's text: await",
        flavor: "native",
        src: "{% macro m() %}<i>\"await\"</i>{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[<i>\"await\"</i>]", "[<i>\"await\"</i>]"]
      },
      {
        label: "the word between double quotes in a macro's text: await",
        flavor: "twig",
        src: "{% macro m() %}<i>\"await\"</i>{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[&lt;i&gt;&quot;await&quot;&lt;/i&gt;]", "[&lt;i&gt;&quot;await&quot;&lt;/i&gt;]"]
      },
      {
        label: "the word between double quotes in a macro's text: await",
        flavor: "jinja2",
        src: "{% macro m() %}<i>\"await\"</i>{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[&lt;i&gt;&quot;await&quot;&lt;/i&gt;]", "[&lt;i&gt;&quot;await&quot;&lt;/i&gt;]"]
      },
      {
        label: "the word in a single-quoted string a custom tag writes in a macro: await",
        flavor: "native",
        src: "{% macro m() %}{% show 'await' %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[await]", "[await]"]
      },
      {
        label: "the word between double quotes in a macro's text: wait",
        flavor: "native",
        src: "{% macro m() %}<i>\"wait\"</i>{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[<i>\"wait\"</i>]", "[<i>\"wait\"</i>]"]
      },
      {
        label: "the word between double quotes in a macro's text: wait",
        flavor: "twig",
        src: "{% macro m() %}<i>\"wait\"</i>{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[&lt;i&gt;&quot;wait&quot;&lt;/i&gt;]", "[&lt;i&gt;&quot;wait&quot;&lt;/i&gt;]"]
      },
      {
        label: "the word between double quotes in a macro's text: wait",
        flavor: "jinja2",
        src: "{% macro m() %}<i>\"wait\"</i>{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[&lt;i&gt;&quot;wait&quot;&lt;/i&gt;]", "[&lt;i&gt;&quot;wait&quot;&lt;/i&gt;]"]
      },
      {
        label: "the word in a single-quoted string a custom tag writes in a macro: wait",
        flavor: "native",
        src: "{% macro m() %}{% show 'wait' %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[wait]", "[wait]"]
      }
    ]
  },
  {
    name: "The word as a name a macro reads, sets or loops over",
    cases: [
      {
        label: "a macro parameter: await",
        flavor: "native",
        src: "{% macro m(await) %}[{{ await }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "a macro parameter: await",
        flavor: "twig",
        src: "{% macro m(await) %}[{{ await }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "a macro parameter: await",
        flavor: "jinja2",
        src: "{% macro m(await) %}[{{ await }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "a context variable read in a macro: await",
        flavor: "native",
        src: "{% macro m() %}[{{ await }}]{% endmacro %}{{ m() }}",
        loc: function () { return {"await":"X"}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "a context variable read in a macro: await",
        flavor: "twig",
        src: "{% macro m() %}[{{ await }}]{% endmacro %}{{ m() }}",
        loc: function () { return {"await":"X"}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "a context variable read in a macro: await",
        flavor: "jinja2",
        src: "{% macro m() %}[{{ await }}]{% endmacro %}{{ m() }}",
        loc: function () { return {"await":"X"}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "a loop variable inside a macro: await",
        flavor: "native",
        src: "{% macro m() %}{% for await in xs %}[{{ await }}]{% endfor %}{% endmacro %}{{ m() }}",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[A][B]", "[A][B]"]
      },
      {
        label: "a loop variable inside a macro: await",
        flavor: "twig",
        src: "{% macro m() %}{% for await in xs %}[{{ await }}]{% endfor %}{% endmacro %}{{ m() }}",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[A][B]", "[A][B]"]
      },
      {
        label: "a loop variable inside a macro: await",
        flavor: "jinja2",
        src: "{% macro m() %}{% for await in xs %}[{{ await }}]{% endfor %}{% endmacro %}{{ m() }}",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[A][B]", "[A][B]"]
      },
      {
        label: "a set inside a macro: await",
        flavor: "native",
        src: "{% macro m() %}{% set await = \"S\" %}[{{ await }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[S]", "[S]"]
      },
      {
        label: "a set inside a macro: await",
        flavor: "twig",
        src: "{% macro m() %}{% set await = \"S\" %}[{{ await }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[S]", "[S]"]
      },
      {
        label: "a set inside a macro: await",
        flavor: "jinja2",
        src: "{% macro m() %}{% set await = \"S\" %}[{{ await }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[S]", "[S]"]
      },
      {
        label: "a macro parameter: zz",
        flavor: "native",
        src: "{% macro m(zz) %}[{{ zz }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "a macro parameter: zz",
        flavor: "twig",
        src: "{% macro m(zz) %}[{{ zz }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "a macro parameter: zz",
        flavor: "jinja2",
        src: "{% macro m(zz) %}[{{ zz }}]{% endmacro %}{{ m(\"X\") }}",
        loc: function () { return {}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "a context variable read in a macro: zz",
        flavor: "native",
        src: "{% macro m() %}[{{ zz }}]{% endmacro %}{{ m() }}",
        loc: function () { return {"zz":"X"}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "a context variable read in a macro: zz",
        flavor: "twig",
        src: "{% macro m() %}[{{ zz }}]{% endmacro %}{{ m() }}",
        loc: function () { return {"zz":"X"}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "a context variable read in a macro: zz",
        flavor: "jinja2",
        src: "{% macro m() %}[{{ zz }}]{% endmacro %}{{ m() }}",
        loc: function () { return {"zz":"X"}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "a loop variable inside a macro: zz",
        flavor: "native",
        src: "{% macro m() %}{% for zz in xs %}[{{ zz }}]{% endfor %}{% endmacro %}{{ m() }}",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[A][B]", "[A][B]"]
      },
      {
        label: "a loop variable inside a macro: zz",
        flavor: "twig",
        src: "{% macro m() %}{% for zz in xs %}[{{ zz }}]{% endfor %}{% endmacro %}{{ m() }}",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[A][B]", "[A][B]"]
      },
      {
        label: "a loop variable inside a macro: zz",
        flavor: "jinja2",
        src: "{% macro m() %}{% for zz in xs %}[{{ zz }}]{% endfor %}{% endmacro %}{{ m() }}",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[A][B]", "[A][B]"]
      },
      {
        label: "a set inside a macro: zz",
        flavor: "native",
        src: "{% macro m() %}{% set zz = \"S\" %}[{{ zz }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[S]", "[S]"]
      },
      {
        label: "a set inside a macro: zz",
        flavor: "twig",
        src: "{% macro m() %}{% set zz = \"S\" %}[{{ zz }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[S]", "[S]"]
      },
      {
        label: "a set inside a macro: zz",
        flavor: "jinja2",
        src: "{% macro m() %}{% set zz = \"S\" %}[{{ zz }}]{% endmacro %}{{ m() }}",
        loc: function () { return {}; },
        expect: ["[S]", "[S]"]
      },
      {
        label: "a plain name read in a macro: awaited",
        flavor: "native",
        src: "{% macro m() %}[{{ awaited }}]{% endmacro %}{{ m() }}",
        loc: function () { return {"awaited":"X"}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "a plain name read in a macro: awaited",
        flavor: "twig",
        src: "{% macro m() %}[{{ awaited }}]{% endmacro %}{{ m() }}",
        loc: function () { return {"awaited":"X"}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "a plain name read in a macro: awaited",
        flavor: "jinja2",
        src: "{% macro m() %}[{{ awaited }}]{% endmacro %}{{ m() }}",
        loc: function () { return {"awaited":"X"}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "a plain name read in a macro: zz",
        flavor: "native",
        src: "{% macro m() %}[{{ zz }}]{% endmacro %}{{ m() }}",
        loc: function () { return {"zz":"X"}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "a plain name read in a macro: zz",
        flavor: "twig",
        src: "{% macro m() %}[{{ zz }}]{% endmacro %}{{ m() }}",
        loc: function () { return {"zz":"X"}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "a plain name read in a macro: zz",
        flavor: "jinja2",
        src: "{% macro m() %}[{{ zz }}]{% endmacro %}{{ m() }}",
        loc: function () { return {"zz":"X"}; },
        expect: ["[X]", "[X]"]
      }
    ]
  },
  {
    name: "A real await in a macro, and outside one",
    cases: [
      {
        label: "an include in a macro",
        flavor: "native",
        src: "{% macro m() %}{% include \"p.html\" %}{% endmacro %}[{{ m() }}]",
        files: {"/p.html":"P"},
        loc: function () { return {}; },
        expect: ["[P]", "THROW The macro \"m\" in /page.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."]
      },
      {
        label: "an include in a macro",
        flavor: "twig",
        src: "{% macro m() %}{% include \"p.html\" %}{% endmacro %}[{{ m() }}]",
        files: {"/p.html":"P"},
        loc: function () { return {}; },
        expect: ["[P]", "THROW The macro \"m\" in /page.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."]
      },
      {
        label: "an include in a macro",
        flavor: "jinja2",
        src: "{% macro m() %}{% include \"p.html\" %}{% endmacro %}[{{ m() }}]",
        files: {"/p.html":"P"},
        loc: function () { return {}; },
        expect: ["[P]", "THROW The macro \"m\" in /page.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."]
      },
      {
        label: "an import in a macro",
        flavor: "native",
        src: "{% macro m() %}{% import \"q.html\" as s %}{{ s.n() }}{% endmacro %}[{{ m() }}]",
        files: {"/q.html":"{% macro n() %}N{% endmacro %}"},
        loc: function () { return {}; },
        expect: ["[N]", "THROW The macro \"m\" in /page.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."]
      },
      {
        label: "an import in a macro",
        flavor: "twig",
        src: "{% macro m() %}{% import \"q.html\" as s %}{{ s.n() }}{% endmacro %}[{{ m() }}]",
        files: {"/q.html":"{% macro n() %}N{% endmacro %}"},
        loc: function () { return {}; },
        expect: ["[N]", "THROW The macro \"m\" in /page.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."]
      },
      {
        label: "an import in a macro",
        flavor: "jinja2",
        src: "{% macro m() %}{% import \"q.html\" as s %}{{ s.n() }}{% endmacro %}[{{ m() }}]",
        files: {"/q.html":"{% macro n() %}N{% endmacro %}"},
        loc: function () { return {}; },
        expect: ["[N]", "THROW The macro \"m\" in /page.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."]
      },
      {
        label: "a block in a macro",
        flavor: "native",
        src: "{% macro m() %}{% block b %}B{% endblock %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[B]", "THROW The macro \"m\" in /page.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."]
      },
      {
        label: "a block in a macro",
        flavor: "twig",
        src: "{% macro m() %}{% block b %}B{% endblock %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[B]", "THROW The macro \"m\" in /page.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."]
      },
      {
        label: "a block in a macro",
        flavor: "jinja2",
        src: "{% macro m() %}{% block b %}B{% endblock %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[B]", "THROW The macro \"m\" in /page.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."]
      },
      {
        label: "an include in a for loop in a macro",
        flavor: "native",
        src: "{% macro m() %}{% for x in xs %}{% include \"p.html\" %}{% endfor %}{% endmacro %}[{{ m() }}]",
        files: {"/p.html":"P"},
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[PP]", "THROW The macro \"m\" in /page.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."]
      },
      {
        label: "an include in a for loop in a macro",
        flavor: "twig",
        src: "{% macro m() %}{% for x in xs %}{% include \"p.html\" %}{% endfor %}{% endmacro %}[{{ m() }}]",
        files: {"/p.html":"P"},
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[PP]", "THROW The macro \"m\" in /page.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."]
      },
      {
        label: "an include in a for loop in a macro",
        flavor: "jinja2",
        src: "{% macro m() %}{% for x in xs %}{% include \"p.html\" %}{% endfor %}{% endmacro %}[{{ m() }}]",
        files: {"/p.html":"P"},
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[PP]", "THROW The macro \"m\" in /page.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."]
      },
      {
        label: "a from import in a macro",
        flavor: "twig",
        src: "{% macro m() %}{% from \"q.html\" import n %}{{ n() }}{% endmacro %}[{{ m() }}]",
        files: {"/q.html":"{% macro n() %}N{% endmacro %}"},
        loc: function () { return {}; },
        expect: ["[N]", "THROW The macro \"m\" in /page.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."]
      },
      {
        label: "a from import in a macro",
        flavor: "jinja2",
        src: "{% macro m() %}{% from \"q.html\" import n %}{{ n() }}{% endmacro %}[{{ m() }}]",
        files: {"/q.html":"{% macro n() %}N{% endmacro %}"},
        loc: function () { return {}; },
        expect: ["[N]", "THROW The macro \"m\" in /page.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."]
      },
      {
        label: "an include in a for loop whose text holds the word",
        flavor: "native",
        src: "{% for x in xs %}<i>await</i>{% include \"p.html\" %}{% endfor %}",
        files: {"/p.html":"P"},
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["<i>await</i>P<i>await</i>P", "<i>await</i>P<i>await</i>P"]
      },
      {
        label: "an include in a for loop whose text holds the word",
        flavor: "twig",
        src: "{% for x in xs %}<i>await</i>{% include \"p.html\" %}{% endfor %}",
        files: {"/p.html":"P"},
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["<i>await</i>P<i>await</i>P", "<i>await</i>P<i>await</i>P"]
      },
      {
        label: "an include in a for loop whose text holds the word",
        flavor: "jinja2",
        src: "{% for x in xs %}<i>await</i>{% include \"p.html\" %}{% endfor %}",
        files: {"/p.html":"P"},
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["<i>await</i>P<i>await</i>P", "<i>await</i>P<i>await</i>P"]
      },
      {
        label: "an include in a for loop whose text holds the word",
        flavor: "django",
        src: "{% for x in xs %}<i>await</i>{% include \"p.html\" %}{% endfor %}",
        files: {"/p.html":"P"},
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["<i>await</i>P<i>await</i>P", "<i>await</i>P<i>await</i>P"]
      },
      {
        label: "a template that only defines a macro holding an include",
        flavor: "native",
        src: "{% macro m() %}{% include \"p.html\" %}{% endmacro %}[ok]",
        files: {"/p.html":"P"},
        loc: function () { return {}; },
        expect: ["[ok]", "[ok]"]
      },
      {
        label: "a template that only defines a macro holding an include",
        flavor: "twig",
        src: "{% macro m() %}{% include \"p.html\" %}{% endmacro %}[ok]",
        files: {"/p.html":"P"},
        loc: function () { return {}; },
        expect: ["[ok]", "[ok]"]
      },
      {
        label: "a template that only defines a macro holding an include",
        flavor: "jinja2",
        src: "{% macro m() %}{% include \"p.html\" %}{% endmacro %}[ok]",
        files: {"/p.html":"P"},
        loc: function () { return {}; },
        expect: ["[ok]", "[ok]"]
      },
      {
        label: "an awaiting custom tag outside any macro",
        flavor: "native",
        src: "[{% later %}]",
        loc: function () { return {}; },
        expect: ["[A]", "[A]"]
      },
      {
        label: "an awaiting custom tag in a macro",
        flavor: "native",
        src: "{% macro m() %}{% later %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[A]", "THROW The macro \"m\" in /page.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."]
      },
      {
        label: "an awaiting custom tag in a for loop",
        flavor: "native",
        src: "{% for x in xs %}[{% later %}]{% endfor %}",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[A][A]", "[A][A]"]
      },
      {
        label: "an awaiting custom tag in a for loop in a macro",
        flavor: "native",
        src: "{% macro m() %}{% for x in xs %}[{% later %}]{% endfor %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[[A][A]]", "THROW The macro \"m\" in /page.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."]
      }
    ]
  },
  {
    name: "A custom tag that writes an await between two quotes on one line",
    cases: [
      {
        label: "the tag outside any macro",
        flavor: "native",
        src: "[{% quoted %}]",
        loc: function () { return {}; },
        expect: ["[Q]", "[Q]"]
      },
      {
        label: "the tag in a macro",
        flavor: "native",
        src: "{% macro m() %}{% quoted %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[Q]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "the tag in a for loop",
        flavor: "native",
        src: "{% for x in xs %}[{% quoted %}]{% endfor %}",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[Q][Q]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      }
    ]
  }
];

describe('A macro whose compiled code holds the word await, on the async render path', function () {
  GROUPS.forEach(function (g) {
    describe(g.name, function () {
      g.cases.forEach(function (c) {
        it(c.label + ' (' + c.flavor + ', sync)', function () {
          expect(renderSync(c)).to.equal(c.expect[0]);
        });
        it(c.label + ' (' + c.flavor + ', async)', function () {
          return renderAsync(c).then(function (out) { expect(out).to.equal(c.expect[1]); });
        });
      });
    });
  });
});
