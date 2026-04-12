Contributing
============

Contributions are awesome! However, Swig is held to very high coding standards, so to ensure that your pull request is easy to understand and will be more successful, please follow this checklist:

Checklist
---------

1. **Setup:** Before you begin, run `make` from your command line to ensure all dependencies are met.
2. **Test:** Always write new test cases. `make test` and `make test-browser`.
3. **Lint:** Ensure coding-standards are followed. `make lint`.
4. **Explain:** In your pull request, very clearly explain the use-case or problem that you are solving.

_Pull requests that fail to add test coverage, break tests, or fail linting standards will not be accepted._

The swig codebase is highly tested (95% line coverage is a hard gate in `make coverage cov-reporter=travis-cov`) and linted, as a way to guarantee functionality and keep all code written in a particular style for readability. No contributions will be accepted that do not pass all tests or throw any linter errors.

Here's an example of a great pull request that followed the above checklist: [Pull Request 273 - Added patch and test case for object prototypal inheritance](https://github.com/paularmstrong/swig/pull/273) (from the original upstream repo, kept as a historical reference).

Documentation
-------------

User-facing documentation lives in the [Gina Docusaurus site](https://gina.io/docs/swig), maintained in [gina-io/docs](https://github.com/gina-io/docs) at `docs/swig/`. The [JSDoc](https://jsdoc.app) blocks in `lib/swig.js`, `lib/filters.js`, `lib/tags/`, and `lib/loaders/` remain the canonical source-of-truth for the public API and are mirrored by hand into the Docusaurus pages.

To update the documentation:

1. Open a PR against `develop` in this repo for any changes to JSDoc in `lib/*.js`.
2. Open a separate PR against `develop` in [gina-io/docs](https://github.com/gina-io/docs) for user-facing changes under `docs/swig/`.
3. Reference the paired PR in both descriptions so reviewers can follow the round-trip.

See [docs/README.md](./docs/README.md) for more detail on the docs workflow.

Build Tasks
-----------

### make

Installs all dependencies and sets up sanity-check git hooks.

### make build

Builds the browser-ified version of Swig to `./dist`.

### make test

Runs all test files matching `./test/*.test.js` within node.js.

### make test-browser

Builds for browser and runs a large subset of tests from the `make test` task within a browser environment using Phantom.js.

### make coverage

Builds a test coverage report.

### make version

Updates the package version number throughout the source files from the `version` key found in `package.json`.
