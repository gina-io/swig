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

Node v25.3.0 on Apple Silicon, autoescape ON (production-typical), median of 5 runs (2026-10-29, `@rhinostone/swig@2.9.11`):

| Workload | swig | nunjucks | Ratio |
| --- | --- | --- | --- |
| simple var output | 4.2M ops/s | 4.0M ops/s | swig 1.06× |
| filter chain | 6.4M ops/s | 3.9M ops/s | swig 1.63× |
| for loop (5 items) | 2.1M ops/s | 0.6M ops/s | swig 3.68× |
| if/else branch | 10.6M ops/s | 7.4M ops/s | swig 1.43× |
| nested for+if+filter | 1.9M ops/s | 0.4M ops/s | swig 4.96× |

Each row shows the run whose ratio is the median of the five; run-to-run spread is real (see Caveats), so treat the ratios as directional, not exact.

With `AUTOESCAPE=off` the gap widens substantially (swig 3.0-16× faster, median of 5 runs, 2026-10-29) — the autoescape filter applies to every variable output and is the dominant cost in the autoescape-on case. Most production deployments run with autoescape on, so the autoescape-on table is the realistic comparison.

Caveats
-------

- Numbers are environment-specific (CPU, Node version, system load). Re-run on your own hardware before quoting.
- Templates are small (5-item arrays). Larger fixtures may shift ratios — particularly for the iteration-heavy shapes where the per-iteration cost dominates.
- Historical runs predating `@rhinostone/swig@2.2.0` showed nunjucks ahead on simple var output; the escape filter was rewritten in 2.2.0 (entity-preserving two-pass form) and swig has led on all five workloads since.
- Since `2.9.6`, a render works on a copy of the locals object it is given, so that data passed to one render cannot reach another (a security fix). On these small templates that copy adds 11–46% to a render (2.9.6 against 2.9.5, measured in one process), which is why the ratios above are lower than in releases before 2.9.6.
- In one process, `2.9.11` renders the filter-chain shape in 0.88 of the time `2.9.10` takes (two runs; a second copy of `2.9.10` within 2% of the first). The ratios above move more than that between sessions, so the table does not show it.
- Compile-time performance is not measured. The benchmark assumes the compile-once / render-many production pattern; if your workload hot-compiles new templates per request, run a separate compile-time bench.
- This benchmark covers sync render only. Async paths (`renderFile` with an async loader in `@rhinostone/swig`, the `nunjucks` callback API) are not measured here.
