# Roadmap

Planned work for `@rhinostone/swig`. Updated each release.

For bug reports and feature requests, file an issue at [gina-io/swig](https://github.com/gina-io/swig/issues).

---

## v1.4.5 (next)

| Status | Item |
| --- | --- |
| Done | Clean up `paularmstrong` references in `docs/*.html` |
| Done | Investigate `bin` field warning during npm 11 publish (not a bug) |
| Planned | Replace `optimist` with `yargs` in CLI |
| Planned | Fix `bin` field for npm 11 publish (if needed after `optimist` removal) |
| Planned | Add CI badge to README when GH Actions workflow exists |
| Planned | Add public `ROADMAP.md` to the repo root |

## v1.5.0 (later)

| Status | Item |
| --- | --- |
| Planned | Investigate replacing external deps with internal modules |
| Planned | Full security audit of dependency tree, template pipeline, and CLI argv flow |

---

## Completed

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
