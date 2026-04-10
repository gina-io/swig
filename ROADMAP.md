# Roadmap

Planned work for `@rhinostone/swig`. Updated each release.

For bug reports and feature requests, file an issue at [gina-io/swig](https://github.com/gina-io/swig/issues).

---

## v1.5.0 (next)

| Status | Item |
| --- | --- |
| Planned | Full security audit of dependency tree, template pipeline, and CLI argv flow |

---

## Completed

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
