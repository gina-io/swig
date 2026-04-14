# Roadmap

Planned work for `@rhinostone/swig`. Updated each release.

For bug reports and feature requests, file an issue at [gina-io/swig](https://github.com/gina-io/swig/issues).

---

## Next

| Status | Item |
| --- | --- |
| Planned | Port the native Swig frontend to emit IR instead of JS directly. Test gate: byte-identical compiled output for existing suites. Target: `2.0.0-alpha.2`. |

## Future (post-2.0)

Multi-flavor architecture — a single backend with swappable frontends so Twig / Jinja2 / Django templates can run on the same compile pipeline. Design: `multi-flavor-ir.md`.

| Status | Item |
| --- | --- |
| Planned | Ship `@rhinostone/swig-twig` frontend — expression sugar (`~`, `??`, `?:`, `..`, `is X`, `not in`, `#{}`), Twig tag rewrites (`apply`, `verbatim`, `set/endset`, `with/endwith`, `from import`), ~20 filter parity. |
| Planned | Ship Jinja2 and Django frontends. On demand — when there's concrete user demand. |
| Planned | Engine bump + test framework migration. Move to Node ≥ 18, `node:test` + `node:assert/strict`, swap mocha-phantomjs for a modern browser-test harness, swap blanket for `c8`. Bundled with `2.0.0`. |

---

## Completed

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
