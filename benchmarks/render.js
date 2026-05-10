// Render-throughput benchmark — @rhinostone/swig vs nunjucks across five
// workload shapes (simple var output, filter chains, for loops, if/else
// branches, nested control flow).
//
// Run from benchmarks/:
//   npm install && node render.js                # autoescape ON (production-typical, default)
//   AUTOESCAPE=off node render.js                # raw render perf, no escape filter

var swig = require('..');
var nunjucks = require('nunjucks');

var autoescape = process.env.AUTOESCAPE !== 'off';

nunjucks.configure({ autoescape: autoescape });
var swigOpts = { autoescape: autoescape };

var SRC_SIMPLE = 'Hello, {{ name }}! Welcome to {{ site }}. Today is {{ today }}.';
var SRC_FILTER = '{{ name|upper }} has {{ items|length }} items.';
var SRC_FOR = '<ul>{% for item in items %}<li>{{ item }}</li>{% endfor %}</ul>';
var SRC_IF = '{% if user %}Hi {{ user.name }}{% else %}Anon{% endif %}';
var SRC_NESTED = '{% for u in users %}{% if u.active %}{{ u.name|upper }}({{ loop.index }}){% endif %}{% endfor %}';

var swigSimple = swig.compile(SRC_SIMPLE, swigOpts);
var swigFilter = swig.compile(SRC_FILTER, swigOpts);
var swigFor = swig.compile(SRC_FOR, swigOpts);
var swigIf = swig.compile(SRC_IF, swigOpts);
var swigNested = swig.compile(SRC_NESTED, swigOpts);

var njSimple = nunjucks.compile(SRC_SIMPLE);
var njFilter = nunjucks.compile(SRC_FILTER);
var njFor = nunjucks.compile(SRC_FOR);
var njIf = nunjucks.compile(SRC_IF);
var njNested = nunjucks.compile(SRC_NESTED);

var ctxSimple = { name: 'World', site: 'example', today: '2026-05-10' };
var ctxFilter = { name: 'martin', items: [1, 2, 3, 4, 5] };
var ctxFor = { items: ['a', 'b', 'c', 'd', 'e'] };
var ctxIf = { user: { name: 'martin' } };
var ctxNested = {
  users: [
    { name: 'a', active: true }, { name: 'b', active: false }, { name: 'c', active: true },
    { name: 'd', active: true }, { name: 'e', active: false }, { name: 'f', active: true }
  ]
};

function diffMs(start) {
  var d = process.hrtime(start);
  return d[0] * 1000 + d[1] / 1e6;
}

function bench(label, swigFn, njFn, ctx, N) {
  var i;
  // Warmup — JIT, V8 optimization, both libs' internal caches.
  for (i = 0; i < 5000; i += 1) { swigFn(ctx); njFn.render(ctx); }

  var t1 = process.hrtime();
  for (i = 0; i < N; i += 1) swigFn(ctx);
  var swigMs = diffMs(t1);

  var t2 = process.hrtime();
  for (i = 0; i < N; i += 1) njFn.render(ctx);
  var njMs = diffMs(t2);

  var swigOps = Math.round(N / swigMs * 1000);
  var njOps = Math.round(N / njMs * 1000);

  var ratio = njMs / swigMs;
  var verdict = ratio > 1 ? 'swig ' + ratio.toFixed(2) + 'x faster'
              : ratio < 1 ? 'nunjucks ' + (1 / ratio).toFixed(2) + 'x faster'
              : 'tied';

  console.log(label + ':');
  console.log('  swig:     ' + swigMs.toFixed(1) + ' ms  (' + swigOps.toLocaleString() + ' ops/s)');
  console.log('  nunjucks: ' + njMs.toFixed(1) + ' ms  (' + njOps.toLocaleString() + ' ops/s)');
  console.log('  -> ' + verdict);
  console.log('');
}

function verify(label, swigFn, njFn, ctx) {
  var s = swigFn(ctx);
  var n = njFn.render(ctx);
  if (s !== n) {
    console.log('OUTPUT DIVERGENCE in ' + label + ':');
    console.log('  swig:     ' + JSON.stringify(s));
    console.log('  nunjucks: ' + JSON.stringify(n));
  }
}

var N = 200000;
console.log('node ' + process.version + ', N=' + N.toLocaleString() + ' renders per measurement');
console.log('autoescape ' + (autoescape ? 'ON' : 'off') + ' on both engines\n');

verify('simple', swigSimple, njSimple, ctxSimple);
verify('filter', swigFilter, njFilter, ctxFilter);
verify('for', swigFor, njFor, ctxFor);
verify('if', swigIf, njIf, ctxIf);

bench('simple var output', swigSimple, njSimple, ctxSimple, N);
bench('filter chain', swigFilter, njFilter, ctxFilter, N);
bench('for loop (5 items)', swigFor, njFor, ctxFor, N);
bench('if/else branch', swigIf, njIf, ctxIf, N);
bench('nested for+if+filter', swigNested, njNested, ctxNested, N);
