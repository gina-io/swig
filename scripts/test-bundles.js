'use strict';
/*
 * Checks the four browser bundles in dist/. Run `make build` first, or run
 * `make test-bundles`, which builds and then runs this script.
 *
 * Each bundle is loaded into its own vm context, must report the version in
 * package.json, and must render one template set (extends and block,
 * include, filters, a loop, autoescape) exactly as the Node library does.
 * The runtime-only bundles render templates precompiled by
 * `swig compile --recursive --register`, must refuse to compile template
 * source, and must contain no `new Function` and no AsyncFunction
 * constructor, so that they run under a Content-Security-Policy without
 * 'unsafe-eval'. The full bundles compile in the browser and contain both,
 * which shows that the search can find them. Exits 1 if any check fails.
 */
var childProcess = require('child_process'),
  fs = require('fs'),
  os = require('os'),
  path = require('path'),
  vm = require('vm');

var repo = path.resolve(__dirname, '..'),
  dist = path.join(repo, 'dist'),
  version = require(path.join(repo, 'package.json')).version,
  templates = {
    'layout.html': 'L[{% block body %}{% endblock %}]',
    'a.html': '{% extends "layout.html" %}{% block body %}A[{% include "b.html" %}]{% for x in xs %}{{ x|upper }}{% endfor %}{% endblock %}',
    'b.html': '{{ v|default("d") }}|{{ "<b>"|e }}'
  },
  locals = { v: 'x', xs: ['a', 'b'] },
  pinned = 'L[A[x|&lt;b&gt;]AB]',
  compilerConstructors = [
    ['new Function', /new Function/g],
    ['AsyncFunction constructor', /getPrototypeOf\(async/g]
  ],
  failures = 0;

function check(label, ok, detail) {
  if (!ok) {
    failures += 1;
  }
  console.log((ok ? 'PASS ' : 'FAIL ') + label + (detail === undefined ? '' : ': ' + detail));
}

function memoryMap() {
  var map = {};
  Object.keys(templates).forEach(function (name) {
    map['/' + name] = templates[name];
  });
  return map;
}

function load(file, precompiled) {
  var context = vm.createContext({ console: console });
  context.window = context;
  vm.runInContext(fs.readFileSync(path.join(dist, file), 'utf8'), context, { filename: file });
  if (precompiled) {
    vm.runInContext(precompiled, context, { filename: 'precompiled.js' });
  }
  return context.swig;
}

function occurrences(file, pattern) {
  var found = fs.readFileSync(path.join(dist, file), 'utf8').match(pattern);
  return found ? found.length : 0;
}

function precompile() {
  var work = fs.mkdtempSync(path.join(os.tmpdir(), 'swig-test-bundles-'));
  try {
    Object.keys(templates).forEach(function (name) {
      fs.writeFileSync(path.join(work, name), templates[name]);
    });
    return childProcess.execFileSync(process.execPath, [path.join(repo, 'bin', 'swig.js'), 'compile', '--recursive', '.', '--register'], { cwd: work, encoding: 'utf8' });
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

function run() {
  var lib = require(repo),
    expected = new lib.Swig({ loader: lib.loaders.memory(memoryMap()), cache: false }).renderFile('/a.html', locals),
    precompiled = precompile();

  check('the Node library renders the pinned output', expected === pinned, JSON.stringify(expected));

  ['swig.js', 'swig.min.js'].forEach(function (file) {
    var swig, got;
    try {
      swig = load(file);
      check(file + ' reports version ' + version, swig.version === version, swig.version);
      swig.setDefaults({ loader: swig.loaders.memory(memoryMap()), cache: false });
      got = swig.renderFile('/a.html', locals);
      check(file + ' renders like the Node library', got === expected, JSON.stringify(got));
    } catch (e) {
      check(file + ' loads and renders', false, e.message);
    }
    compilerConstructors.forEach(function (c) {
      var n = occurrences(file, c[1]);
      check(file + ' contains ' + c[0] + ' (control)', n > 0, n);
    });
  });

  ['swig.runtime.js', 'swig.runtime.min.js'].forEach(function (file) {
    var swig, got, refusal = 'no error thrown';
    try {
      swig = load(file, precompiled);
      check(file + ' reports version ' + version, swig.version === version, swig.version);
      got = swig.renderFile('a.html', locals);
      check(file + ' renders the precompiled templates like the Node library', got === expected, JSON.stringify(got));
      try {
        swig.render('{{ 1 }}');
      } catch (e) {
        refusal = e.message;
      }
      check(file + ' refuses to compile template source', /has no compiler/.test(refusal), refusal.slice(0, 80));
    } catch (e) {
      check(file + ' loads and renders', false, e.message);
    }
    compilerConstructors.forEach(function (c) {
      var n = occurrences(file, c[1]);
      check(file + ' contains no ' + c[0], n === 0, n);
    });
  });
}

try {
  run();
} catch (e) {
  check('the bundle checks ran', false, e.stack || e.message);
}
console.log(failures ? failures + ' bundle check(s) failed' : 'All bundle checks passed');
process.exit(failures ? 1 : 0);
