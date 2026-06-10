# Roadmap

Planned work for `@rhinostone/swig`. Updated each release.

For bug reports and feature requests, file an issue at [gina-io/swig](https://github.com/gina-io/swig/issues).

---

## Next

_No near-term scheduled items. See [Future (post-2.0)](#future-post-20) for upcoming work._

## Future (post-2.0)

| Status | Item |
| --- | --- |
| Planned | Async parse path for the remaining dynamic targets — runtime-resolved `{% import %}` / `{% from %}` paths on the async-codegen branch. Static-target async dispatch shipped in 2.2.0; dynamic `{% extends %}` shipped in 2.5.2 (native + Twig + Jinja2) and dynamic `{% include %}` paths already resolve (the include path has always been an expression). Dynamic `import` / `from` are on hold pending consumer demand. |
| Planned | Modern browser-test harness. The legacy phantomjs runner was removed; a replacement (e.g. Playwright or JSDOM) has not yet landed, so browser parity is verified in the interim via the production build plus a symbol grep. (The `mocha` → `node:test` runner migration, the `expect.js` → in-repo assertion-shim swap, and the `blanket` → `node:test` built-in coverage migration have all shipped.) |

---

## Completed

### v2.7.3 (June 2026)

- Fixed a filter-chain argument leak in the expression parsers: the per-filter argument accumulator was function-scoped and never reset between iterations, so an arg-bearing filter earlier in a chain leaked its arguments onto a later no-arg filter (e.g. `x|default("y")|upper` lowered `upper` with the leaked `["y"]`). Affected nested and parenthesized chains in the shared core parser and all filter chains in the Twig and Jinja2 frontends; the Django frontend already shipped the per-iteration reset. Runtime impact ranged from harmless (filters that ignore extra positional arguments) to wrong output (a no-arg filter consuming a leaked positional argument).
- All five packages (`@rhinostone/swig`, `@rhinostone/swig-core`, `@rhinostone/swig-twig`, `@rhinostone/swig-jinja2`, `@rhinostone/swig-django`) released in lockstep at `2.7.3`.

### v2.7.2 (June 2026)

- Fixed a regression in the v2.7.1 CVE-2023-25345 hardening: a **relative** `basepath` (e.g. `swig.loaders.fs('templates')`) wrongly rejected *every* in-root `include` / `extends` / `import` path. The root check compared each resolved template path (always absolute) against a `basepath` that had only been normalized, so a relative root matched nothing and threw `resolves outside the loader root` for legitimate templates. The `basepath` is now resolved to an absolute path before the check; absolute basepaths, the no-`basepath` default, and the directory-traversal rejections are all unchanged. The fix lives in `@rhinostone/swig-core`, so the native, Twig, Jinja2, and Django frontends all inherit it.
- All five packages (`@rhinostone/swig`, `@rhinostone/swig-core`, `@rhinostone/swig-twig`, `@rhinostone/swig-jinja2`, `@rhinostone/swig-django`) released in lockstep at `2.7.2`.

### v2.7.1 (June 2026)

- Hardened the filesystem loader against directory traversal / arbitrary local file read (CVE-2023-25345). When a `basepath` is configured, `include` / `extends` / `import` paths that resolve outside that root are now rejected — including paths supplied by an untrusted runtime variable such as `{% include userVar %}`, which could otherwise be steered to read files anywhere on disk (`{% include "../../../etc/passwd" %}`). A new third argument, `swig.loaders.fs(basepath, encoding, allowOutsideRoot)`, opts out for templates that intentionally read files from outside the root. In-root paths — including relative paths that stay within the configured root — are unaffected; only paths that escape the root are rejected, and the no-`basepath` default is unchanged. The fix lives in `@rhinostone/swig-core`, so the native, Twig, Jinja2, and Django frontends all inherit it.
- All five packages (`@rhinostone/swig`, `@rhinostone/swig-core`, `@rhinostone/swig-twig`, `@rhinostone/swig-jinja2`, `@rhinostone/swig-django`) released in lockstep at `2.7.1`. The functional change is confined to the `@rhinostone/swig-core` filesystem loader.

### v2.7.0 (June 2026)

- Added `@rhinostone/swig-django`, a Django Template Language frontend on the shared `@rhinostone/swig-core` engine — the fourth dialect in the multi-flavor family alongside native swig, `@rhinostone/swig-twig`, and `@rhinostone/swig-jinja2`. It renders real Django templates: 15 tags (`if` / `elif` / `else`, `for` / `empty` with `forloop`, `block`, `extends`, `include`, `with`, `autoescape`, `spaceless`, `comment`, `verbatim`, `cycle`, `firstof`), 42 built-in filters with Django's colon-argument syntax (`{{ value|date:"Y-m-d" }}`), and a Django-faithful variable resolver — callable attributes are auto-called (honoring `alters_data` / `do_not_call_in_templates`), numeric indexing works (`{{ list.0 }}`), and dicts iterate via `.keys` / `.values` / `.items`. Async loader support via `renderFileAsync` / `compileFileAsync` and `renderFile(path, locals, cb)` against an async loader. Autoescape and the CVE-2023-25345 guards are inherited from `@rhinostone/swig-core`. Every tag and filter was cross-checked against Django 5.2; the behavioural differences and explicit non-goals (no `{% load %}` / custom tag libraries, no `{% url %}` / `{% static %}` / `{% csrf_token %}` / `{% trans %}` / `{% blocktrans %}` framework infrastructure, no whitespace-control, no `is` tests) are documented in the Django templating guide.
- All five packages (`@rhinostone/swig`, `@rhinostone/swig-core`, `@rhinostone/swig-twig`, `@rhinostone/swig-jinja2`, `@rhinostone/swig-django`) released in lockstep at `2.7.0`. `@rhinostone/swig-core` gained an additive opt-in loop-context flag and a variable-resolver primitive (`_utils.resolve`) consumed by the Django frontend; native swig, Twig, and Jinja2 are functionally unchanged (proven byte-identical compiled output).
- Documentation housekeeping: de-linked the dead `paularmstrong/swig` issue and pull-request references in `HISTORY.md` (the upstream issue tracker is disabled), preserving every reference as plain text.

### v2.6.0 (June 2026)

- The native `json` / `json_encode` filters now HTML-escape their output (`<`, `>`, `&`, and `'` are emitted as `\u00XX` escapes) and are marked safe, so `{{ data|json }}` renders valid JSON that can be embedded directly inside a `<script>` block instead of `&quot;`-escaped text. `url_encode` is now marked safe as well — its output never contains HTML-significant characters. `url_decode` is deliberately unchanged: its output stays autoescaped, since decoded content can contain HTML. Only the native `@rhinostone/swig` flavor changes here — `@rhinostone/swig-twig` keeps `json_encode` / `url_encode` unescaped (Twig-faithful), and `@rhinostone/swig-jinja2` keeps its `tojson` (safe) / `urlencode` (not safe) split (Jinja2-faithful).
- Replaced the `expect.js` test-assertion dev dependency with a small in-repo shim, with verified behavioral parity. Dev-only — the published packages are unaffected (their only runtime dependency remains `@rhinostone/swig-core`), and the full test suite plus the CVE-2023-25345 regressions pass unchanged.
- All four packages (`@rhinostone/swig`, `@rhinostone/swig-core`, `@rhinostone/swig-twig`, `@rhinostone/swig-jinja2`) released in lockstep at `2.6.0`. The functional change is confined to native `@rhinostone/swig`'s filters; the `@rhinostone/swig-core`, `@rhinostone/swig-twig`, and `@rhinostone/swig-jinja2` runtimes are functionally identical to `2.5.3`.

### v2.5.3 (June 2026)

- Dynamic `{% extends %}` on the synchronous render path now throws a clear error pointing to the async render path (`renderFile` with `loader.async === true`), instead of a generic "template not found" / "no filename" error. Dynamic extends has always required the async render path; this only improves the diagnostic. Applies to all flavors via the shared engine.
- All four packages (`@rhinostone/swig`, `@rhinostone/swig-core`, `@rhinostone/swig-twig`, `@rhinostone/swig-jinja2`) released in lockstep at `2.5.3`.

### v2.5.2 (June 2026)

- Dynamic `{% extends %}` paths now resolve on the async render path (`renderFile(path, locals, cb)` against a loader with `loader.async === true`) across all three frontends — native `@rhinostone/swig`, `@rhinostone/swig-twig`, and `@rhinostone/swig-jinja2`. A dynamic parent (e.g. `{% extends layout_var %}`) is lowered to a deferred IR expression and resolved at render time, matching real Twig and Jinja2; previously a dynamic parent path was rejected at parse time (Twig / Jinja2) or produced a garbage template lookup (native). Static string-literal `{% extends %}` and the synchronous render path are unchanged — on the sync path a dynamic parent still requires a string literal (dispatch the chosen parent in the caller).
- All four packages (`@rhinostone/swig`, `@rhinostone/swig-core`, `@rhinostone/swig-twig`, `@rhinostone/swig-jinja2`) released in lockstep at `2.5.2`.

### v2.5.1 (May 2026)

- Restored JSDoc on the top-level `@rhinostone/swig` public API methods (`setFilter`, `setTag`, `setExtension`, `precompile`, `compile`, `compileFile`, `render`, `renderFile`, `run`, `invalidateCache`). The blocks were inadvertently stripped from `lib/swig.js` when the Swig constructor body was carved into `@rhinostone/swig-core` during the `2.0.0-alpha.1` cycle; `make build-docs` and IDE hover tooling read from `lib/swig.js`, so the documented surface for all ten methods had been missing since the carve. Doc-only restoration; `renderFile`'s block also documents the `v2.2.0` async-codegen dispatch (set `loader.async === true` on the loader to opt in).
- Cleaned two stale internal-process tracker references from `lib/tags/set.js` source comments; the explanatory content is preserved and only the dead reference tokens were dropped.
- Dev-tooling modernization riding the same release: retired the unmaintained `phantomjs` browser-test toolchain (also dropped the vulnerable `form-data` from the dev tree); bumped the example/development `express` dependency from `~3` to `^4` (also dropped the vulnerable `morgan` and `minimist` from the dev tree); bumped the test-utility `lodash` dependency from `~1.3.1` to `^4` (cleared five `lodash` advisories from the dev tree); migrated the test toolchain from `mocha` 1.12.0 to the Node built-in `node:test` runner with built-in line coverage (cleared the six remaining dev-tree audit findings, taking `npm audit` to zero); migrated the ESLint dev dependency from 8.x to 9.x with the new flat-config (`.eslintrc.json` → `eslint.config.js`), clearing the six "deprecated by maintainer" Socket Low alerts on the repo scan. None of this affects the published runtime — only the dev/CI toolchain.
- All four packages (`@rhinostone/swig`, `@rhinostone/swig-core`, `@rhinostone/swig-twig`, `@rhinostone/swig-jinja2`) released in lockstep at `2.5.1`. The runtime in `@rhinostone/swig-core` / `@rhinostone/swig-twig` / `@rhinostone/swig-jinja2` is functionally identical to `2.5.0`; only `@rhinostone/swig`'s `lib/swig.js` and `lib/tags/set.js` carry source-comment changes.

### v2.5.0 (May 2026)

- Added `@rhinostone/swig-jinja2`, a Python Jinja2-syntax frontend on the shared `@rhinostone/swig-core` engine — the third dialect in the multi-flavor family alongside native swig and `@rhinostone/swig-twig`. Ships 13 tags (`set`, `if` / `elif` / `else`, `for` with `else`, `block`, `extends`, `include`, `macro`, `import`, `from`, `raw`, `filter`, `with`, `autoescape`), 39 filters, and 16 `is` tests, plus the `**` / `//` / `~` operators, inline-if, Python slicing, and `{{- … -}}` whitespace control. Async loader support via `renderFileAsync` / `compileFileAsync`. Autoescape and the CVE-2023-25345 guards are inherited from `@rhinostone/swig-core`. Every filter and is-test was cross-checked against Python Jinja2 3.x; the behavioural differences (where the JavaScript runtime diverges from CPython) and the explicit non-goals (no sandboxed rendering, `{% call %}` / `{% do %}` / `{% trans %}`, the `map` / `select` filter family, macro kwargs) are documented in the Jinja2 templating guide.
- All four packages (`@rhinostone/swig`, `@rhinostone/swig-core`, `@rhinostone/swig-twig`, `@rhinostone/swig-jinja2`) released in lockstep at `2.5.0`. `@rhinostone/swig-core` gained additive `slice` and `coerceOutput` runtime helpers consumed by the Jinja2 frontend; native swig and Twig are functionally unchanged.

### v2.4.3 (May 2026)

- Fixed native `import` leaking an imported file's own import aliases into the importing template's scope. The `{% import %}` carry-through added in `2.4.1` emitted those nested imports bare into the caller's context, where the leaked alias could clobber a same-named caller variable, corrupt a macro when the caller later reassigned that name (macros read the live context at call time), or cascade across import depth. The nested imports are now re-homed under the importing alias and kept local to the file that declares them — matching `@rhinostone/swig-twig`'s scoping and the Jinja2/Twig import contract. Macros still resolve their own file's imports at call time.

### v2.4.2 (May 2026)

- Fixed the same empty-render bug in `@rhinostone/swig-twig`: a macro that calls a macro imported at the top of its own defining file — via either `{% import %}` or `{% from %}` — now resolves at call time instead of rendering empty. The imported file's own imports stay local to the template that declares them (they are not leaked bare into the importing template's scope), matching Twig's macro/import scoping rule. Resolves recursively across import depth.

### v2.4.1 (May 2026)

- Fixed macros rendering empty when they call a macro that was imported at the top of their own defining file. The `import` tag now carries the imported file's own `{% import %}` statements through, so those macros resolve at call time. Resolves recursively across import depth.

### v2.4.0 (May 2026)

- Native ternary (`a ? b : c`) and Elvis (`a ?: b`) operator support across `@rhinostone/swig` template expressions. Usable in `{{ }}` output and in tag arguments such as `{% if %}`, `{% set %}`, and `{% for %}`. The ternary's `else` branch is required — `{{ x ? "a" }}` throws `Expected colon in ternary expression`. Backend support already existed via `IRConditional` (exercised by `@rhinostone/swig-twig`); this release wires the native parser to produce it.
- Fixed `swig compile -o <dir>` re-throwing `EEXIST` when the output directory already exists. The mkdir guard matched the legacy numeric `errno 47`, which no longer identifies `EEXIST` on modern Node; the guard now matches `e.code === 'EEXIST'`, the stable cross-version identifier.
- Fixed `make coverage cov-reporter=travis-cov` silently no-opping the 95% line-coverage gate on Node >= 18. The `coverage:` target invoked the broken `node_modules/.bin/mocha` shim (which exits 0 with no output regardless of pass/fail); it now invokes mocha directly via `node node_modules/mocha/bin/_mocha`, matching the `test:` target.

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
