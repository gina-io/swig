# Roadmap

Planned work for `@rhinostone/swig`. Updated each release.

For bug reports and feature requests, file an issue at [gina-io/swig](https://github.com/gina-io/swig/issues).

---

## Next

_No near-term scheduled items. See [Future (post-2.0)](#future-post-20) for upcoming work._

## Future (post-2.0)

| Status | Item |
| --- | --- |
| Planned | Async parse path for dynamic targets — full support for `{% extends parent_var %}`, `{% include user_template %}`, and runtime-resolved `import` / `from` paths on the async-codegen branch. Static-target async dispatch shipped in 2.2.0; dynamic-target support is on hold pending consumer demand. |
| Planned | Ship Jinja2 and Django frontends as additional `@rhinostone/swig-*` packages. On demand — when there's concrete user demand. |
| Planned | Test framework migration. Replace mocha 1.x + expect.js with `node:test` + `node:assert/strict`, swap mocha-phantomjs for a modern browser-test harness, swap blanket for `c8`. (The Node engines bump is upstream-driven by gina and is being treated as done.) |

---

## Completed

### v2.3.0 (May 2026)

- Reduced `@rhinostone/swig`'s production dependency footprint to a single package. `yargs` and `terser` were CLI-only — the library entry point never loaded them — but sat in production `dependencies`, so every library install pulled in their full dependency trees. The CLI's argument parsing is now handled by a small built-in zero-dependency parser; `terser` (used only by `swig compile --minify`) is loaded lazily and ships as a `devDependency`, with `--minify` printing an install hint instead of crashing if it is absent. A library install of `@rhinostone/swig` now pulls in only `@rhinostone/swig-core`. No change to the CLI surface or rendering behavior.

### v2.2.0 (May 2026)

- `renderFile(path, locals, cb)` and `compileFile(path, options, cb)` now automatically route to the async-codegen path when the configured loader signals async support via `loader.async === true`. The async path defers template resolution from parse time to render time via a new `_swig.getTemplate(path, options)` runtime helper that returns `Promise<TemplateFn>`; `extends`, `include`, `import`, and `from` emit deferred IR shapes and the shared backend wraps the compiled body in an `AsyncFunction`. Block overrides thread through the inheritance chain via a sixth `_blocks` positional argument; macro imports pick up exports via a `Promise<{output, exports}>` template-fn return shape. Both `@rhinostone/swig` and `@rhinostone/swig-twig` flavors — parity across the two surfaces. Static template targets (string literals in `extends` / `include` / `import` / `from`) work end-to-end against async loaders; dynamic targets surface a clear runtime error and are tracked as a follow-up. The sync render path is unchanged — loaders without `loader.async === true` continue to use the established sync `_swig.compileFile(...)` resolution, including the built-in `loaders.fs` and `loaders.memory` which remain dual-mode.
- `renderFileAsync(path, locals, cb)` and `compileFileAsync(path, options, cb)` on both `@rhinostone/swig` and `@rhinostone/swig-twig` are soft-deprecated via JSDoc only — no runtime warning. Use `renderFile` / `compileFile` with an async loader (`loader.async === true`) instead; the dispatch is automatic. The legacy pre-walker entry points remain fully functional in 2.x and will be removed in 3.0.
- Performance improvement to the `escape` / `e` filter in both flavors. The HTML default branch switched from a five-replace chain to an entity-preserving two-pass form (entity-aware first pass that preserves already-escaped sequences, followed by a single character-class regex with a lookup function). A scalar fast-path skips the array/object iteration when input is null, undefined, or a non-object. Output is byte-identical to the previous behavior on every input. Measured against `benchmarks/render.js` (medians of 5 runs, autoescape on, Node 25): simple-var-output `+57%` (flipping the bench verdict from `nunjucks 1.32x faster` to `swig 1.18x faster`); filter chain `+37%`; for-loop (5 items) `+54%`; if/else branch `+71%`; nested for+if+filter `+56%`.

### v2.1.0 (May 2026)

- Async loader support via `renderFileAsync(path, locals, cb)` and `compileFileAsync(path, options, cb)` on `@rhinostone/swig` and `@rhinostone/swig-twig`. The implementation pre-walks the template dependency graph through the user loader's cb-shape arm, builds an in-memory map keyed by resolved path, then runs the existing sync render against an in-memory wrapper for the duration of the call. Supports `extends`, `include`, `import`, and Twig `from import` with string-literal paths; dynamic paths surface a `Pre-walked map missing path` error at render time. Existing sync `renderFile` / `compileFile` consumers are unaffected.
- Internal scaffolding for a future async parse path: new deferred-resolution IR shapes (`IRExtendsDeferred`, `IRIncludeDeferred`, `IRImportDeferred`, `IRFromImportDeferred`) and matching `AsyncFunction`-wrapped backend emit branches land on `@rhinostone/swig-core`, all gated behind `options.codegenMode === 'async'` (default sync, no behavior change for existing consumers). The frontend tag wiring and public API dispatch that would activate this path are not yet shipped.
- Internal cleanup: simplified `IRVarRef` emit shape into a single-evaluation ternary (smaller compiled bodies, same runtime semantics); added a runnable render-throughput benchmark suite at `benchmarks/render.js` (excluded from the published tarball); README clarifications surfaced the prototype-pollution hardening across CVE-2023-25345 and CVE-2021-44906.

### v2.0.1 (May 2026)

- Fixed bracket-access expressions failing on unspaced binary arithmetic in `@rhinostone/swig` and `@rhinostone/swig-twig`. The lexer's NUMBER rule was greedy-eating leading `+` / `-` operators inside bracket expressions like `arr[arr.length-1]` and `arr[idx-1]`, causing the parser to bail with "Unexpected closing square bracket". Dropped the optional sign prefix from the NUMBER rule; signed-literal paths continue to work via the existing unary-operator wrapping.
- Fixed `varStrip` / `tagStrip` regexes in `lib/parser.js` greedy-eating the leading `-` of negative-number expressions. `{{ -5 }}` and `{{ -1.5 }}` were rendering as `"5"` / `"1.5"` because the strip patterns matched the sign before the lexer saw it. Whitespace-control markers (`{{-`, `-}}`, `{%-`, `-%}`) now fire only when `-` is immediately adjacent to the open / close marker, matching the standard Twig/Jinja2 contract.
- Fixed missing whitespace-control parity in `@rhinostone/swig-twig`. `{{- … -}}` and `{%- … -%}` markers now strip surrounding whitespace at chunk boundaries, matching the native swig surface and the upstream Twig spec. Same one-level-deep limitation as native — a `{%- endif %}` strips the trailing whitespace of the immediately enclosing tag's last child only, not deeper.

### v2.0.0 (May 2026)

- Multi-flavor template-engine workspace shipped: `@rhinostone/swig` (native syntax, drop-in for `1.x`), `@rhinostone/swig-twig` (Twig syntax), `@rhinostone/swig-core` (shared IR backend). Production-ready cut of the changeset introduced across `2.0.0-alpha.1` through `2.0.0-alpha.5`. No functional or API changes since `2.0.0-alpha.5`. IR ABI is stable from this release onward; cross-package dependencies pin exact versions and frontends + core release in lockstep.
- README messaging refreshed across all three packages to reflect production-ready status; package descriptions cleaned of historical internal-tracking references; stale documentation URLs refreshed.
- Repository unforked from `paularmstrong/swig` on GitHub once the multi-flavor track stabilised — gina-io/swig is now a standalone project rather than a fork. Attribution preserved via `LICENSE` and `package.json.author`.

### v2.0.0-alpha.8 (April 2026)

- Remove the soft-deprecated `exports.parse(source, options)` wrapper (Path B) from `@rhinostone/swig-twig`. Soft-deprecated since `2.0.0-alpha.4`; removed now so any remaining consumer surfaces during the alpha.8 bake window before `2.0.0` stable. Migrate to the per-instance API installed by `engine.install`: `new twig.Twig(opts)` (or the default instance `exports.precompile` / `exports.compile` / `exports.render` / `exports.renderFile`). Internal plumbing (`exports.parser.parse`, `exports.parseFile`) is unaffected.

### v2.0.0-alpha.5 (April 2026)

- Twig render-path polish — fix `~` string-concat SyntaxError in the shared backend; route literal LHS (STRING/NUMBER/BOOL) through `parsePostfix` so `{{ "hi"|upper }}` works; land a 19-fixture render corpus under `tests/swig-twig/cases/`.
- Scope-closing Twig expression sugar: `..` range via `_utils.range`; `??` undefined-fallback via new `IRVarRefExists` IR node; `is <test>` routed through `_ext._test_<name>` with seven built-in tests (`defined`, `null`, `empty`, `iterable`, `odd`, `even`, `divisibleby`).

### v2.0.0-alpha.4 (April 2026)

- Wire `@rhinostone/swig-twig` for Path A render via `engine.install(self, frontend)`; isolate per-instance tags and filters; soft-deprecate the Path B `exports.parse` wrapper with a one-shot `console.warn`.

### v2.0.0-alpha.3 (April 2026)

- Ship `@rhinostone/swig-twig` parser surface — Twig lexer, Pratt parser, 8 built-in tags (`apply`, `verbatim`, `set/endset`, `with/endwith`, `from import`, plus native parity), 5 Twig-specific tags, 24 filter parity. Lockstep cut of `swig-core` + `swig` + `swig-twig` fixes the broken `alpha.2` missing-dep regression.

### v2.0.0-alpha.2 (April 2026)

- Port the native Swig frontend to emit IR instead of JS directly. All built-in tags and TokenParser expression codegen now route through `@rhinostone/swig-core`'s IR → backend pipeline. Test gate: byte-identical compiled output for existing suites.

### v2.0.0-alpha.1 (April 2026)

- Carve `@rhinostone/swig-core` — extract IR stubs, backend (JS codegen), runtime (cache, loader, filter infra, `_dangerousProps` guards), lexer token-type enum, and TokenParser into a standalone workspace package. `@rhinostone/swig` becomes the native-syntax frontend plus a core re-export. Phase 1 of the multi-flavor architecture.
- Replace `browserify@~2` with `esbuild@^0.28` in the browser build. Resolves the long-standing inability of browserify@2 (2013) to resolve scoped packages through `node_modules`, and unblocks the Phase 2 port of the native frontend to IR emission. `lib/**/*.js` shims now require `@rhinostone/swig-core` by scoped name.

### v1.6.0 (April 2026)

- AOT compile target: `swig compile --recursive <dir>` walks a directory and emits a single CommonJS module mapping relative template paths to compiled functions. New `--ext` filter flag. Conflicts with `--method-name` / `--wrap-start` / `--wrap-end` / positional file arguments.

### v1.5.0 (April 2026)

- Full security audit — template compilation pipeline, `bin/swig.js` argv flow, and all `eval` / `new Function` usage paths
- Fix five CVE-2023-25345 coverage gaps: bracket-notation access in `parser.js`, bracket-notation assignment in `set.js`, loop variable names in `for.js`, macro names in `macro.js`, import aliases in `import.js`
- Document the security model (template source trusted, context untrusted), runtime bracket-access limitation, and complete `eval` / `new Function` inventory
- Fold user-facing documentation into the Gina Docusaurus site at `/swig/`; retire the legacy `make docs` / `make build-docs` / `make gh-pages` pipeline

### v1.4.7 (April 2026)

- Upgrade `yargs` from 3.x to 17.x, replacing unmaintained transitive dependencies with actively maintained equivalents
- Update `engines` field to `node >= 12` (reflects actual minimum required by runtime dependencies)
- Fix private IP address in JSDoc example for template loaders

### v1.4.6 (April 2026)

- Replace `uglify-js` with `terser` in CLI (`--minify` flag), removing the last Snyk-flagged runtime dependency
- Exclude `.github/` from npm tarball

### v1.4.5 (April 2026)

- Replace `optimist` with `yargs` in CLI, removing `minimist` from the production dependency tree entirely (CVE-2021-44906 fully resolved)
- Clean up legacy `paularmstrong` references in documentation
- GitHub Actions CI workflow (lint + test on PRs and pushes)
- Public roadmap (`ROADMAP.md`)

### v1.4.4 (April 2026)

- Block `__proto__`/`constructor`/`prototype` in templates (CVE-2023-25345)
- Replace `nodelint` with ESLint v8
- Fix pre-commit hook (exit-code gates, mocha failure detection)
- Fix mocha `.bin` shim (silent on Node >= 18)
- Loosen `tests/bin/bin.test.js` fixtures for modern V8
- Replace `uglify-js` with `terser` in the Makefile build target
- Update install/require references to `@rhinostone/swig`

### v1.4.3 (April 2026)

- Pin `minimist` to `^1.2.8` via npm `overrides` (CVE-2021-44906)
