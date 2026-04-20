@rhinostone/swig-core
=====================

[![NPM version](http://img.shields.io/npm/v/@rhinostone/swig-core.svg?style=flat)](https://www.npmjs.org/package/@rhinostone/swig-core) [![Socket Badge](https://socket.dev/api/badge/npm/package/@rhinostone/swig-core)](https://socket.dev/npm/package/@rhinostone/swig-core)

> **Experimental alpha — IR ABI is unstable across alpha minors.** This package is the shared runtime for the `@rhinostone/swig` family of template engines. It is not intended for direct consumption unless you are building a custom frontend. Install [@rhinostone/swig](https://www.npmjs.com/package/@rhinostone/swig) for the default Swig (Jinja2/Django-inspired) flavor, or [@rhinostone/swig-twig](https://www.npmjs.com/package/@rhinostone/swig-twig) for the Twig flavor — both pull this package in as a peer dependency pinned to the exact alpha version.

Extracted from `@rhinostone/swig@1.6.0` during the Phase 1 carve (see #T14 in [ROADMAP.md](https://github.com/gina-io/swig/blob/develop/ROADMAP.md)).

What lives here
---------------

* **IR types and helpers** (`lib/ir.js`) — the intermediate representation emitted by frontend parsers and consumed by the backend.
* **Backend** (`lib/backend.js`) — lowers IR to compiled JavaScript source via `new Function(...)`.
* **Engine wiring** (`lib/engine.js`) — `engine.install(self, frontend)` glues a frontend (tags, filters, parser, lexer) onto the shared runtime.
* **Expression-level TokenParser** (`lib/tokenparser.js`) — IR emission for inline expressions, shared across frontends.
* **Runtime primitives** (`lib/utils.js`, `lib/security.js`, `lib/cache.js`, `lib/loaders/`, `lib/filters.js`, `lib/dateformatter.js`, `lib/tokentypes.js`).

Consumers
---------

* [@rhinostone/swig](https://www.npmjs.com/package/@rhinostone/swig) — default Swig flavor.
* [@rhinostone/swig-twig](https://www.npmjs.com/package/@rhinostone/swig-twig) — Twig parity frontend.

Versioning
----------

During the alpha cycle, every frontend that depends on `@rhinostone/swig-core` pins the **exact** alpha version (no caret, no tilde). The IR ABI is not stable until `2.0.0` stable ships. Do not upgrade `swig-core` independently of the frontend that consumes it.

Repository
----------

Source lives in the `@rhinostone/swig` monorepo: [gina-io/swig/packages/swig-core](https://github.com/gina-io/swig/tree/develop/packages/swig-core). File issues and PRs at [gina-io/swig](https://github.com/gina-io/swig).

License
-------

MIT. See [LICENSE](https://github.com/gina-io/swig/blob/develop/LICENSE) in the monorepo root.
