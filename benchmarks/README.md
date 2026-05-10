swig benchmarks
===============

`render.js` measures sync-render throughput of `@rhinostone/swig` against [Nunjucks](https://www.npmjs.com/package/nunjucks) across five workload shapes.

Run
---

```bash
cd benchmarks
npm install
node render.js                  # autoescape ON (default, production-typical)
AUTOESCAPE=off node render.js   # raw render perf, no escape filter
```

Methodology
-----------

For each workload shape, the bench:

1. Pre-compiles the template through both engines.
2. Warms up V8 and the engines' internal caches with 5,000 iterations.
3. Measures 200,000 iterations of `compiled(ctx)` / `compiled.render(ctx)` via `process.hrtime()`.
4. Reports ops/sec for each engine plus the relative ratio.

Outputs are verified identical between engines before timing. Divergence prints `OUTPUT DIVERGENCE in <label>:` to stdout — re-run with `AUTOESCAPE=off` if autoescape encoding differences look like the cause.

Sample results
--------------

Node v25.3.0 on Apple Silicon, autoescape ON (production-typical):

| Workload | swig | nunjucks | Ratio |
| --- | --- | --- | --- |
| simple var output | 2.2M ops/s | 2.7M ops/s | nunjucks 1.21× |
| filter chain | 3.7M ops/s | 2.7M ops/s | swig 1.40× |
| for loop (5 items) | 1.2M ops/s | 0.4M ops/s | swig 2.68× |
| if/else branch | 3.8M ops/s | 3.8M ops/s | tied |
| nested for+if+filter | 0.9M ops/s | 0.2M ops/s | swig 3.53× |

With `AUTOESCAPE=off` the gap widens substantially (swig 12-20× faster) — the autoescape filter applies to every variable output and is the dominant cost in the autoescape-on case. Most production deployments run with autoescape on, so the autoescape-on table is the realistic comparison.

Caveats
-------

- Numbers are environment-specific (CPU, Node version, system load). Re-run on your own hardware before quoting.
- Templates are small (5-item arrays). Larger fixtures may shift ratios — particularly for the iteration-heavy shapes where the per-iteration cost dominates.
- swig has an autoescape-overhead optimization opportunity (the `e` filter dispatches through a function call per output; inlining it would close the simple-var-output gap).
- Compile-time performance is not measured. The benchmark assumes the compile-once / render-many production pattern; if your workload hot-compiles new templates per request, run a separate compile-time bench.
- This benchmark covers sync render only. Async paths (`renderFileAsync` in `@rhinostone/swig`, `nunjucks` callback API) are not measured here.
