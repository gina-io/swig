@rhinostone/swig-twig
=====================

[![NPM version](http://img.shields.io/npm/v/@rhinostone/swig-twig.svg?style=flat)](https://www.npmjs.com/package/@rhinostone/swig-twig) [![Socket Badge](https://socket.dev/api/badge/npm/package/@rhinostone/swig-twig)](https://socket.dev/npm/package/@rhinostone/swig-twig)

> **Experimental alpha.** The render pipeline is wired end-to-end and the Twig render corpus passes, but the IR ABI is not stable across alpha minors. `2.0.0` stable is the target for production use.

Twig frontend for the [@rhinostone/swig-core](https://www.npmjs.com/package/@rhinostone/swig-core) template engine. See #T16 in [ROADMAP.md](https://github.com/gina-io/swig/blob/develop/ROADMAP.md) for the multi-flavor roadmap.

Installation
------------

    npm install @rhinostone/swig-twig@alpha

This pulls in `@rhinostone/swig-core` as a peer dependency, pinned to the matching alpha version. Do not mix alpha minors — lockstep only.

Basic example
-------------

```js
var swig = require('@rhinostone/swig-twig');

var out = swig.render('Hello, {{ name|upper }}!', {
  locals: { name: 'world' }
});
// => Hello, WORLD!
```

Supported surface (as of 2.0.0-alpha.5)
---------------------------------------

* **Tags** — `apply`, `block`, `extends`, `for`, `from`, `if`, `import`, `include`, `macro`, `set`, `verbatim`, `with`.
* **Operators** — `..` range, `??` null-coalescing, `~` string concat, `is <test>` / `is not <test>`.
* **Built-in `is` tests** — `defined`, `null`, `empty`, `iterable`, `odd`, `even`, `divisibleby`.
* **Filters** — the Twig core overlaps (length, lower, upper, first, last, join, reverse, sort, striptags, url_encode, json_encode, raw, escape / e, slice, split, batch, trim, number_format, replace, keys, format, merge, date). See `lib/filters.js` for the full list.

Explicitly unsupported (parse-time throw)
-----------------------------------------

* `{% sandbox %}` — security-sandbox tag, out of scope.
* Macro kwargs — use positional args.
* `{% use %}` — not implemented.
* `{% deprecated %}` — not implemented; use comment pragmas.

Repository
----------

Source: [gina-io/swig/packages/swig-twig](https://github.com/gina-io/swig/tree/develop/packages/swig-twig). File issues and PRs at [gina-io/swig](https://github.com/gina-io/swig).

License
-------

MIT. See [LICENSE](https://github.com/gina-io/swig/blob/develop/LICENSE) in the monorepo root.
