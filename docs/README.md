# Swig documentation

The user-facing documentation for `@rhinostone/swig` lives in the Gina
Docusaurus site, under `/swig/`:

- Source: [gina-io/docs](https://github.com/gina-io/docs) → `docs/swig/`
- Published: the `Swig Template Engine` section of the Gina documentation site

Historical context: this directory previously held a hand-written HTML site
built by `make gh-pages` (using `still`, `lessc`, `jsdoc@3.2.0`). That pipeline
was retired in favor of the Docusaurus section, which is actively maintained
alongside the Gina docs, supports search + versioning + Mermaid, and removes
unmaintained dependencies (`still`, `less`, `jsdoc@3.2.0`, `file`).

The JSDoc blocks in `lib/*.js` remain the canonical source-of-truth for the
public API and are mirrored (by hand) into the Docusaurus pages.

## Updating the docs

1. Clone `gina-io/docs`.
2. Edit the relevant MDX under `docs/swig/`.
3. Submit a PR against `develop` in that repo.

## Reporting doc issues

Open an issue at [gina-io/swig/issues](https://github.com/gina-io/swig/issues)
tagged `documentation`. The maintainer will decide whether the fix belongs in
this repo (source JSDoc, README) or in the Docusaurus site.
