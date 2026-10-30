@rhinostone/swig-twig
=====================

[![NPM version](https://img.shields.io/npm/v/@rhinostone/swig-twig.svg?style=flat)](https://www.npmjs.com/package/@rhinostone/swig-twig) [![Socket Badge](https://socket.dev/api/badge/npm/package/@rhinostone/swig-twig)](https://socket.dev/npm/package/@rhinostone/swig-twig) [![OpenSSF Scorecard](https://img.shields.io/ossf-scorecard/github.com/gina-io/swig?label=openssf%20scorecard&style=flat)](https://scorecard.dev/viewer/?uri=github.com/gina-io/swig)

Twig-syntax frontend for the [@rhinostone/swig-core](https://www.npmjs.com/package/@rhinostone/swig-core) template engine. Part of the multi-flavor architecture introduced in `2.0.0` — see [ROADMAP.md](https://github.com/gina-io/swig/blob/develop/ROADMAP.md) for the release narrative.

Installation
------------

    npm install @rhinostone/swig-twig

This pulls in `@rhinostone/swig-core` as a peer dependency, pinned to the matching version. Frontends and the core release in lockstep — do not mix versions.

Basic example
-------------

```js
var swig = require('@rhinostone/swig-twig');

var out = swig.render('Hello, {{ name|upper }}!', {
  locals: { name: 'world' }
});
// => Hello, WORLD!
```

Supported surface (as of 2.0.0)
-------------------------------

* **Tags** — `apply`, `block`, `extends`, `for`, `from`, `if`, `import`, `include`, `macro`, `set`, `verbatim`, `with`.
* **Operators** — `..` range, `??` null-coalescing, `~` string concat, `is <test>` / `is not <test>`.
* **Built-in `is` tests** — `defined`, `null`, `empty`, `iterable`, `odd`, `even`, `divisibleby`.
* **Unknown names** — a filter or test name the instance does not hold is a compile error wherever it stands, as in Twig. Register custom filters and tests before the compile that uses them.
* **Filters** — the Twig core overlaps (length, lower, upper, first, last, join, reverse, sort, striptags, url_encode, json_encode, raw, escape / e, slice, split, batch, trim, number_format, replace, keys, format, merge, date). See `lib/filters.js` for the full list.

Explicitly unsupported (parse-time throw)
-----------------------------------------

* `{% sandbox %}` — security-sandbox tag, out of scope.
* The Twig tests `none`, `sequence`, `mapping`, `constant`, `true`, `same as` and `divisible by` — not provided (`divisibleby` is).
* Macro kwargs — use positional args.
* `{% use %}` — not implemented.
* `{% deprecated %}` — not implemented; use comment pragmas.

Repository
----------

Source: [gina-io/swig/packages/swig-twig](https://github.com/gina-io/swig/tree/develop/packages/swig-twig). File issues and PRs at [gina-io/swig](https://github.com/gina-io/swig).

License
-------

MIT. See [LICENSE](https://github.com/gina-io/swig/blob/develop/LICENSE) in the monorepo root.
