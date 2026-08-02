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

Node v25.3.0 on Apple Silicon, autoescape ON (production-typical), median of 3 runs (2026-08-02, `@rhinostone/swig@2.8.0`):

| Workload | swig | nunjucks | Ratio |
| --- | --- | --- | --- |
| simple var output | 2.2M ops/s | 1.2M ops/s | swig 1.77× |
| filter chain | 2.9M ops/s | 1.4M ops/s | swig 2.00× |
| for loop (5 items) | 0.7M ops/s | 0.2M ops/s | swig 3.65× |
| if/else branch | 7.6M ops/s | 3.3M ops/s | swig 2.30× |
| nested for+if+filter | 0.8M ops/s | 0.1M ops/s | swig 5.51× |

Each row shows the run whose ratio is the median of the three; run-to-run spread is real (see Caveats), so treat the ratios as directional, not exact.

With `AUTOESCAPE=off` the gap widens substantially (swig 12-20× faster) — the autoescape filter applies to every variable output and is the dominant cost in the autoescape-on case. Most production deployments run with autoescape on, so the autoescape-on table is the realistic comparison.

Caveats
-------

- Numbers are environment-specific (CPU, Node version, system load). Re-run on your own hardware before quoting.
- Templates are small (5-item arrays). Larger fixtures may shift ratios — particularly for the iteration-heavy shapes where the per-iteration cost dominates.
- Historical runs predating `@rhinostone/swig@2.2.0` showed nunjucks ahead on simple var output; the escape filter was rewritten in 2.2.0 (entity-preserving two-pass form) and swig has led on all five workloads since.
- Compile-time performance is not measured. The benchmark assumes the compile-once / render-many production pattern; if your workload hot-compiles new templates per request, run a separate compile-time bench.
- This benchmark covers sync render only. Async paths (`renderFileAsync` in `@rhinostone/swig`, `nunjucks` callback API) are not measured here.
