var swig = require('../../lib/swig'),
  twig = require('../../packages/swig-twig'),
  jinja2 = require('../../packages/swig-jinja2'),
  django = require('../../packages/swig-django'),
  loaders = require('../../packages/swig-core/lib/loaders'),
  expect = require('../lib/expect.js');

/*!
 * On the async render path a for loop, a block that wraps its content and a
 * macro become async when the compiled code of their content awaits, and a
 * macro that awaits throws an error when it is called. A tag registered with
 * setTag whose code awaits right after the three dots of a spread is seen as
 * awaiting. A tag whose code writes its await on a line after a quote that is
 * not part of a single- or double-quoted string literal (in a regular
 * expression, a comment or a template literal), with another quote of the same
 * kind later on that line, is not seen as awaiting: in a for loop or its else
 * or empty branch, a with, filter, apply or set block, a swig-django spaceless
 * block or a macro, also one that is never called, the template then fails to
 * compile. A tag whose quotes stand on other lines than its await, and the top
 * of a template, are the controls. A name that ends in the word await
 * (myawait, $await) read in a macro does not make it throw; zz is the control.
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

// Tags whose compiled code awaits a value on the async render path, registered on every instance (each
// writes the same letter without codegenMode async): spread, right after the three dots of a spread;
// quoted, cmt and tick, on a line holding a quote that is not part of a single- or double-quoted string
// literal before the await (in a regular expression, a comment or a template literal) and another quote
// of the same kind after it; later, on a line between two comment lines that each hold a lone quote.
function tagParse(str, line, parser) { return parser && true; }
function tagOf(asyncJS, syncJS) {
  return function (compiler, args, content, parents, options) {
    return options && options.codegenMode === 'async' ? asyncJS : syncJS;
  };
}
var AWAIT_TAGS = {
  spread: tagOf("_output += [...await Promise.resolve([\"s\"])].join(\"\");\n", "_output += \"s\";\n"),
  tick: tagOf("_output += `it's` && await Promise.resolve(\"k\") || `it's`;\n", "_output += \"k\";\n"),
  cmt: tagOf("/* it's */ _output += await Promise.resolve('c');\n", "_output += \"c\";\n"),
  quoted: tagOf("_output += /'/.source && await Promise.resolve(\"q\"); // it's\n", "_output += \"q\";\n"),
  later: tagOf("// it's\n_output += await Promise.resolve(\"a\");\n// it's\n", "_output += \"a\";\n")
};

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
  if (f === 'native') { s.setTag('show', showParse, showCompile, false, false); }
  Object.keys(AWAIT_TAGS).forEach(function (t) { s.setTag(t, tagParse, AWAIT_TAGS[t], false, false); });
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
    name: "A custom tag whose code awaits right after a spread",
    cases: [
      {
        label: "spread outside any block",
        flavor: "native",
        src: "[{% spread %}]",
        loc: function () { return {}; },
        expect: ["[s]", "[s]"]
      },
      {
        label: "spread in a macro",
        flavor: "native",
        src: "{% macro m() %}{% spread %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[s]", "THROW The macro \"m\" in /page.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."]
      },
      {
        label: "spread in a for loop",
        flavor: "native",
        src: "{% for x in xs %}[{% spread %}]{% endfor %}",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[s][s]", "[s][s]"]
      },
      {
        label: "spread in a filter block",
        flavor: "native",
        src: "{% filter upper %}[{% spread %}]{% endfilter %}",
        loc: function () { return {}; },
        expect: ["[S]", "[S]"]
      },
      {
        label: "spread in a macro that is only defined",
        flavor: "native",
        src: "{% macro m() %}{% spread %}{% endmacro %}[ok]",
        loc: function () { return {}; },
        expect: ["[ok]", "[ok]"]
      },
      {
        label: "spread in a macro",
        flavor: "twig",
        src: "{% macro m() %}{% spread %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[s]", "THROW The macro \"m\" in /page.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."]
      },
      {
        label: "spread in a macro",
        flavor: "jinja2",
        src: "{% macro m() %}{% spread %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[s]", "THROW The macro \"m\" in /page.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."]
      },
      {
        label: "spread in a macro that is only defined",
        flavor: "twig",
        src: "{% macro m() %}{% spread %}{% endmacro %}[ok]",
        loc: function () { return {}; },
        expect: ["[ok]", "[ok]"]
      },
      {
        label: "spread in a macro that is only defined",
        flavor: "jinja2",
        src: "{% macro m() %}{% spread %}{% endmacro %}[ok]",
        loc: function () { return {}; },
        expect: ["[ok]", "[ok]"]
      },
      {
        label: "spread in an apply block",
        flavor: "twig",
        src: "{% apply upper %}[{% spread %}]{% endapply %}",
        loc: function () { return {}; },
        expect: ["[S]", "[S]"]
      },
      {
        label: "spread in a filter block",
        flavor: "jinja2",
        src: "{% filter upper %}[{% spread %}]{% endfilter %}",
        loc: function () { return {}; },
        expect: ["[S]", "[S]"]
      },
      {
        label: "spread in a with block",
        flavor: "twig",
        src: "{% with { a: 1 } %}[{% spread %}]{% endwith %}",
        loc: function () { return {}; },
        expect: ["[s]", "[s]"]
      },
      {
        label: "spread in a with block",
        flavor: "jinja2",
        src: "{% with a = 1 %}[{% spread %}]{% endwith %}",
        loc: function () { return {}; },
        expect: ["[s]", "[s]"]
      },
      {
        label: "spread in a with block",
        flavor: "django",
        src: "{% with a=1 %}[{% spread %}]{% endwith %}",
        loc: function () { return {}; },
        expect: ["[s]", "[s]"]
      },
      {
        label: "spread in the branch a for loop renders for an empty list",
        flavor: "jinja2",
        src: "{% for x in xs %}[{{ x }}]{% else %}[{% spread %}]{% endfor %}",
        loc: function () { return {"xs":[]}; },
        expect: ["[s]", "[s]"]
      },
      {
        label: "spread in the branch a for loop renders for an empty list",
        flavor: "django",
        src: "{% for x in xs %}[{{ x }}]{% empty %}[{% spread %}]{% endfor %}",
        loc: function () { return {"xs":[]}; },
        expect: ["[s]", "[s]"]
      },
      {
        label: "spread in a for loop",
        flavor: "django",
        src: "{% for x in xs %}[{% spread %}]{% endfor %}",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[s][s]", "[s][s]"]
      },
      {
        label: "spread in a spaceless block",
        flavor: "native",
        src: "{% spaceless %}<p>[{% spread %}]</p> <b>x</b>{% endspaceless %}",
        loc: function () { return {}; },
        expect: ["<p>[s]</p><b>x</b>", "<p>[s]</p><b>x</b>"]
      },
      {
        label: "spread in a spaceless block",
        flavor: "django",
        src: "{% spaceless %}<p>[{% spread %}]</p> <b>x</b>{% endspaceless %}",
        loc: function () { return {}; },
        expect: ["<p>[s]</p><b>x</b>", "<p>[s]</p><b>x</b>"]
      }
    ]
  },
  {
    name: "A custom tag whose code holds a quote that is not part of a single- or double-quoted string literal before its await",
    cases: [
      {
        label: "tick outside any block",
        flavor: "native",
        src: "[{% tick %}]",
        loc: function () { return {}; },
        expect: ["[k]", "[k]"]
      },
      {
        label: "tick in a macro",
        flavor: "native",
        src: "{% macro m() %}{% tick %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[k]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "tick in a for loop",
        flavor: "native",
        src: "{% for x in xs %}[{% tick %}]{% endfor %}",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[k][k]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "tick in a filter block",
        flavor: "native",
        src: "{% filter upper %}[{% tick %}]{% endfilter %}",
        loc: function () { return {}; },
        expect: ["[K]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "tick in a macro that is only defined",
        flavor: "native",
        src: "{% macro m() %}{% tick %}{% endmacro %}[ok]",
        loc: function () { return {}; },
        expect: ["[ok]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "cmt outside any block",
        flavor: "native",
        src: "[{% cmt %}]",
        loc: function () { return {}; },
        expect: ["[c]", "[c]"]
      },
      {
        label: "cmt in a macro",
        flavor: "native",
        src: "{% macro m() %}{% cmt %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[c]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "cmt in a for loop",
        flavor: "native",
        src: "{% for x in xs %}[{% cmt %}]{% endfor %}",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[c][c]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "cmt in a filter block",
        flavor: "native",
        src: "{% filter upper %}[{% cmt %}]{% endfilter %}",
        loc: function () { return {}; },
        expect: ["[C]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "cmt in a macro that is only defined",
        flavor: "native",
        src: "{% macro m() %}{% cmt %}{% endmacro %}[ok]",
        loc: function () { return {}; },
        expect: ["[ok]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "quoted outside any block",
        flavor: "native",
        src: "[{% quoted %}]",
        loc: function () { return {}; },
        expect: ["[q]", "[q]"]
      },
      {
        label: "quoted in a macro",
        flavor: "native",
        src: "{% macro m() %}{% quoted %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[q]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "quoted in a for loop",
        flavor: "native",
        src: "{% for x in xs %}[{% quoted %}]{% endfor %}",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[q][q]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "quoted in a filter block",
        flavor: "native",
        src: "{% filter upper %}[{% quoted %}]{% endfilter %}",
        loc: function () { return {}; },
        expect: ["[Q]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "quoted in a macro that is only defined",
        flavor: "native",
        src: "{% macro m() %}{% quoted %}{% endmacro %}[ok]",
        loc: function () { return {}; },
        expect: ["[ok]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "quoted in a for loop",
        flavor: "twig",
        src: "{% for x in xs %}[{% quoted %}]{% endfor %}",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[q][q]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "quoted in a for loop",
        flavor: "jinja2",
        src: "{% for x in xs %}[{% quoted %}]{% endfor %}",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[q][q]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "quoted in a set block",
        flavor: "twig",
        src: "{% set v %}[{% quoted %}]{% endset %}{{ v }}",
        loc: function () { return {}; },
        expect: ["[q]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "quoted in a set block",
        flavor: "jinja2",
        src: "{% set v %}[{% quoted %}]{% endset %}{{ v }}",
        loc: function () { return {}; },
        expect: ["[q]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "quoted in a macro",
        flavor: "twig",
        src: "{% macro m() %}{% quoted %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[q]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "quoted in a macro",
        flavor: "jinja2",
        src: "{% macro m() %}{% quoted %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[q]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "quoted in a macro that is only defined",
        flavor: "twig",
        src: "{% macro m() %}{% quoted %}{% endmacro %}[ok]",
        loc: function () { return {}; },
        expect: ["[ok]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "quoted in a macro that is only defined",
        flavor: "jinja2",
        src: "{% macro m() %}{% quoted %}{% endmacro %}[ok]",
        loc: function () { return {}; },
        expect: ["[ok]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "quoted in an apply block",
        flavor: "twig",
        src: "{% apply upper %}[{% quoted %}]{% endapply %}",
        loc: function () { return {}; },
        expect: ["[Q]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "quoted in a filter block",
        flavor: "jinja2",
        src: "{% filter upper %}[{% quoted %}]{% endfilter %}",
        loc: function () { return {}; },
        expect: ["[Q]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "quoted in a with block",
        flavor: "twig",
        src: "{% with { a: 1 } %}[{% quoted %}]{% endwith %}",
        loc: function () { return {}; },
        expect: ["[q]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "quoted in a with block",
        flavor: "jinja2",
        src: "{% with a = 1 %}[{% quoted %}]{% endwith %}",
        loc: function () { return {}; },
        expect: ["[q]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "quoted in a with block",
        flavor: "django",
        src: "{% with a=1 %}[{% quoted %}]{% endwith %}",
        loc: function () { return {}; },
        expect: ["[q]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "quoted in the branch a for loop renders for an empty list",
        flavor: "jinja2",
        src: "{% for x in xs %}[{{ x }}]{% else %}[{% quoted %}]{% endfor %}",
        loc: function () { return {"xs":[]}; },
        expect: ["[q]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "quoted in the branch a for loop renders for an empty list",
        flavor: "django",
        src: "{% for x in xs %}[{{ x }}]{% empty %}[{% quoted %}]{% endfor %}",
        loc: function () { return {"xs":[]}; },
        expect: ["[q]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "quoted in a for loop",
        flavor: "django",
        src: "{% for x in xs %}[{% quoted %}]{% endfor %}",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[q][q]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "quoted in a spaceless block",
        flavor: "native",
        src: "{% spaceless %}<p>[{% quoted %}]</p> <b>x</b>{% endspaceless %}",
        loc: function () { return {}; },
        expect: ["<p>[q]</p><b>x</b>", "<p>[q]</p><b>x</b>"]
      },
      {
        label: "quoted in a spaceless block",
        flavor: "django",
        src: "{% spaceless %}<p>[{% quoted %}]</p> <b>x</b>{% endspaceless %}",
        loc: function () { return {}; },
        expect: ["<p>[q]</p><b>x</b>", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "cmt in a macro",
        flavor: "twig",
        src: "{% macro m() %}{% cmt %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[c]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "cmt in a macro",
        flavor: "jinja2",
        src: "{% macro m() %}{% cmt %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[c]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "cmt in a macro that is only defined",
        flavor: "twig",
        src: "{% macro m() %}{% cmt %}{% endmacro %}[ok]",
        loc: function () { return {}; },
        expect: ["[ok]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "cmt in a macro that is only defined",
        flavor: "jinja2",
        src: "{% macro m() %}{% cmt %}{% endmacro %}[ok]",
        loc: function () { return {}; },
        expect: ["[ok]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "cmt in an apply block",
        flavor: "twig",
        src: "{% apply upper %}[{% cmt %}]{% endapply %}",
        loc: function () { return {}; },
        expect: ["[C]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "cmt in a filter block",
        flavor: "jinja2",
        src: "{% filter upper %}[{% cmt %}]{% endfilter %}",
        loc: function () { return {}; },
        expect: ["[C]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "cmt in a with block",
        flavor: "twig",
        src: "{% with { a: 1 } %}[{% cmt %}]{% endwith %}",
        loc: function () { return {}; },
        expect: ["[c]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "cmt in a with block",
        flavor: "jinja2",
        src: "{% with a = 1 %}[{% cmt %}]{% endwith %}",
        loc: function () { return {}; },
        expect: ["[c]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "cmt in a with block",
        flavor: "django",
        src: "{% with a=1 %}[{% cmt %}]{% endwith %}",
        loc: function () { return {}; },
        expect: ["[c]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "cmt in the branch a for loop renders for an empty list",
        flavor: "jinja2",
        src: "{% for x in xs %}[{{ x }}]{% else %}[{% cmt %}]{% endfor %}",
        loc: function () { return {"xs":[]}; },
        expect: ["[c]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "cmt in the branch a for loop renders for an empty list",
        flavor: "django",
        src: "{% for x in xs %}[{{ x }}]{% empty %}[{% cmt %}]{% endfor %}",
        loc: function () { return {"xs":[]}; },
        expect: ["[c]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "cmt in a for loop",
        flavor: "django",
        src: "{% for x in xs %}[{% cmt %}]{% endfor %}",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[c][c]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "cmt in a spaceless block",
        flavor: "native",
        src: "{% spaceless %}<p>[{% cmt %}]</p> <b>x</b>{% endspaceless %}",
        loc: function () { return {}; },
        expect: ["<p>[c]</p><b>x</b>", "<p>[c]</p><b>x</b>"]
      },
      {
        label: "cmt in a spaceless block",
        flavor: "django",
        src: "{% spaceless %}<p>[{% cmt %}]</p> <b>x</b>{% endspaceless %}",
        loc: function () { return {}; },
        expect: ["<p>[c]</p><b>x</b>", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "tick in a macro",
        flavor: "twig",
        src: "{% macro m() %}{% tick %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[k]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "tick in a macro",
        flavor: "jinja2",
        src: "{% macro m() %}{% tick %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[k]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "tick in a macro that is only defined",
        flavor: "twig",
        src: "{% macro m() %}{% tick %}{% endmacro %}[ok]",
        loc: function () { return {}; },
        expect: ["[ok]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "tick in a macro that is only defined",
        flavor: "jinja2",
        src: "{% macro m() %}{% tick %}{% endmacro %}[ok]",
        loc: function () { return {}; },
        expect: ["[ok]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "tick in an apply block",
        flavor: "twig",
        src: "{% apply upper %}[{% tick %}]{% endapply %}",
        loc: function () { return {}; },
        expect: ["[K]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "tick in a filter block",
        flavor: "jinja2",
        src: "{% filter upper %}[{% tick %}]{% endfilter %}",
        loc: function () { return {}; },
        expect: ["[K]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "tick in a with block",
        flavor: "twig",
        src: "{% with { a: 1 } %}[{% tick %}]{% endwith %}",
        loc: function () { return {}; },
        expect: ["[k]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "tick in a with block",
        flavor: "jinja2",
        src: "{% with a = 1 %}[{% tick %}]{% endwith %}",
        loc: function () { return {}; },
        expect: ["[k]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "tick in a with block",
        flavor: "django",
        src: "{% with a=1 %}[{% tick %}]{% endwith %}",
        loc: function () { return {}; },
        expect: ["[k]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "tick in the branch a for loop renders for an empty list",
        flavor: "jinja2",
        src: "{% for x in xs %}[{{ x }}]{% else %}[{% tick %}]{% endfor %}",
        loc: function () { return {"xs":[]}; },
        expect: ["[k]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "tick in the branch a for loop renders for an empty list",
        flavor: "django",
        src: "{% for x in xs %}[{{ x }}]{% empty %}[{% tick %}]{% endfor %}",
        loc: function () { return {"xs":[]}; },
        expect: ["[k]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "tick in a for loop",
        flavor: "django",
        src: "{% for x in xs %}[{% tick %}]{% endfor %}",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[k][k]", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      },
      {
        label: "tick in a spaceless block",
        flavor: "native",
        src: "{% spaceless %}<p>[{% tick %}]</p> <b>x</b>{% endspaceless %}",
        loc: function () { return {}; },
        expect: ["<p>[k]</p><b>x</b>", "<p>[k]</p><b>x</b>"]
      },
      {
        label: "tick in a spaceless block",
        flavor: "django",
        src: "{% spaceless %}<p>[{% tick %}]</p> <b>x</b>{% endspaceless %}",
        loc: function () { return {}; },
        expect: ["<p>[k]</p><b>x</b>", "THROW SyntaxError: await is only valid in async functions and the top level bodies of modules in file /page.html."]
      }
    ]
  },
  {
    name: "A custom tag whose quotes stand on other lines than its await",
    cases: [
      {
        label: "later outside any block",
        flavor: "native",
        src: "[{% later %}]",
        loc: function () { return {}; },
        expect: ["[a]", "[a]"]
      },
      {
        label: "later in a macro",
        flavor: "native",
        src: "{% macro m() %}{% later %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[a]", "THROW The macro \"m\" in /page.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."]
      },
      {
        label: "later in a for loop",
        flavor: "native",
        src: "{% for x in xs %}[{% later %}]{% endfor %}",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[a][a]", "[a][a]"]
      },
      {
        label: "later in a filter block",
        flavor: "native",
        src: "{% filter upper %}[{% later %}]{% endfilter %}",
        loc: function () { return {}; },
        expect: ["[A]", "[A]"]
      },
      {
        label: "later in a macro that is only defined",
        flavor: "native",
        src: "{% macro m() %}{% later %}{% endmacro %}[ok]",
        loc: function () { return {}; },
        expect: ["[ok]", "[ok]"]
      },
      {
        label: "later in a for loop",
        flavor: "twig",
        src: "{% for x in xs %}[{% later %}]{% endfor %}",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[a][a]", "[a][a]"]
      },
      {
        label: "later in a for loop",
        flavor: "jinja2",
        src: "{% for x in xs %}[{% later %}]{% endfor %}",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[a][a]", "[a][a]"]
      },
      {
        label: "later in a set block",
        flavor: "twig",
        src: "{% set v %}[{% later %}]{% endset %}{{ v }}",
        loc: function () { return {}; },
        expect: ["[a]", "[a]"]
      },
      {
        label: "later in a set block",
        flavor: "jinja2",
        src: "{% set v %}[{% later %}]{% endset %}{{ v }}",
        loc: function () { return {}; },
        expect: ["[a]", "[a]"]
      },
      {
        label: "later in a macro",
        flavor: "twig",
        src: "{% macro m() %}{% later %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[a]", "THROW The macro \"m\" in /page.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."]
      },
      {
        label: "later in a macro",
        flavor: "jinja2",
        src: "{% macro m() %}{% later %}{% endmacro %}[{{ m() }}]",
        loc: function () { return {}; },
        expect: ["[a]", "THROW The macro \"m\" in /page.html holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro."]
      },
      {
        label: "later in a macro that is only defined",
        flavor: "twig",
        src: "{% macro m() %}{% later %}{% endmacro %}[ok]",
        loc: function () { return {}; },
        expect: ["[ok]", "[ok]"]
      },
      {
        label: "later in a macro that is only defined",
        flavor: "jinja2",
        src: "{% macro m() %}{% later %}{% endmacro %}[ok]",
        loc: function () { return {}; },
        expect: ["[ok]", "[ok]"]
      },
      {
        label: "later in an apply block",
        flavor: "twig",
        src: "{% apply upper %}[{% later %}]{% endapply %}",
        loc: function () { return {}; },
        expect: ["[A]", "[A]"]
      },
      {
        label: "later in a filter block",
        flavor: "jinja2",
        src: "{% filter upper %}[{% later %}]{% endfilter %}",
        loc: function () { return {}; },
        expect: ["[A]", "[A]"]
      },
      {
        label: "later in a with block",
        flavor: "twig",
        src: "{% with { a: 1 } %}[{% later %}]{% endwith %}",
        loc: function () { return {}; },
        expect: ["[a]", "[a]"]
      },
      {
        label: "later in a with block",
        flavor: "jinja2",
        src: "{% with a = 1 %}[{% later %}]{% endwith %}",
        loc: function () { return {}; },
        expect: ["[a]", "[a]"]
      },
      {
        label: "later in a with block",
        flavor: "django",
        src: "{% with a=1 %}[{% later %}]{% endwith %}",
        loc: function () { return {}; },
        expect: ["[a]", "[a]"]
      },
      {
        label: "later in the branch a for loop renders for an empty list",
        flavor: "jinja2",
        src: "{% for x in xs %}[{{ x }}]{% else %}[{% later %}]{% endfor %}",
        loc: function () { return {"xs":[]}; },
        expect: ["[a]", "[a]"]
      },
      {
        label: "later in the branch a for loop renders for an empty list",
        flavor: "django",
        src: "{% for x in xs %}[{{ x }}]{% empty %}[{% later %}]{% endfor %}",
        loc: function () { return {"xs":[]}; },
        expect: ["[a]", "[a]"]
      },
      {
        label: "later in a for loop",
        flavor: "django",
        src: "{% for x in xs %}[{% later %}]{% endfor %}",
        loc: function () { return {"xs":["A","B"]}; },
        expect: ["[a][a]", "[a][a]"]
      },
      {
        label: "later in a spaceless block",
        flavor: "native",
        src: "{% spaceless %}<p>[{% later %}]</p> <b>x</b>{% endspaceless %}",
        loc: function () { return {}; },
        expect: ["<p>[a]</p><b>x</b>", "<p>[a]</p><b>x</b>"]
      },
      {
        label: "later in a spaceless block",
        flavor: "django",
        src: "{% spaceless %}<p>[{% later %}]</p> <b>x</b>{% endspaceless %}",
        loc: function () { return {}; },
        expect: ["<p>[a]</p><b>x</b>", "<p>[a]</p><b>x</b>"]
      }
    ]
  },
  {
    name: "Names that end in the word await, read in a macro",
    cases: [
      {
        label: "myawait read in a macro",
        flavor: "native",
        src: "{% macro m() %}[{{ myawait }}]{% endmacro %}{{ m() }}",
        loc: function () { return {"myawait":"X"}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "myawait read in a macro",
        flavor: "twig",
        src: "{% macro m() %}[{{ myawait }}]{% endmacro %}{{ m() }}",
        loc: function () { return {"myawait":"X"}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "myawait read in a macro",
        flavor: "jinja2",
        src: "{% macro m() %}[{{ myawait }}]{% endmacro %}{{ m() }}",
        loc: function () { return {"myawait":"X"}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "$await read in a macro",
        flavor: "native",
        src: "{% macro m() %}[{{ $await }}]{% endmacro %}{{ m() }}",
        loc: function () { return {"$await":"X"}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "$await read in a macro",
        flavor: "twig",
        src: "{% macro m() %}[{{ $await }}]{% endmacro %}{{ m() }}",
        loc: function () { return {"$await":"X"}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "$await read in a macro",
        flavor: "jinja2",
        src: "{% macro m() %}[{{ $await }}]{% endmacro %}{{ m() }}",
        loc: function () { return {"$await":"X"}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "zz read in a macro",
        flavor: "native",
        src: "{% macro m() %}[{{ zz }}]{% endmacro %}{{ m() }}",
        loc: function () { return {"zz":"X"}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "zz read in a macro",
        flavor: "twig",
        src: "{% macro m() %}[{{ zz }}]{% endmacro %}{{ m() }}",
        loc: function () { return {"zz":"X"}; },
        expect: ["[X]", "[X]"]
      },
      {
        label: "zz read in a macro",
        flavor: "jinja2",
        src: "{% macro m() %}[{{ zz }}]{% endmacro %}{{ m() }}",
        loc: function () { return {"zz":"X"}; },
        expect: ["[X]", "[X]"]
      }
    ]
  }
];

describe('Custom tags that await, and names that end in await, on the async render path', function () {
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
