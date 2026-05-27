@rhinostone/swig-jinja2
=======================

[![NPM version](http://img.shields.io/npm/v/@rhinostone/swig-jinja2.svg?style=flat)](https://www.npmjs.com/package/@rhinostone/swig-jinja2) [![Socket Badge](https://socket.dev/api/badge/npm/package/@rhinostone/swig-jinja2)](https://socket.dev/npm/package/@rhinostone/swig-jinja2)

Jinja2-syntax frontend for the [@rhinostone/swig-core](https://www.npmjs.com/package/@rhinostone/swig-core) template engine. Part of the multi-flavor architecture introduced in `2.0.0` — see [ROADMAP.md](https://github.com/gina-io/swig/blob/develop/ROADMAP.md) for the release narrative.

Installation
------------

    npm install @rhinostone/swig-jinja2

This pulls in `@rhinostone/swig-core` as a peer dependency, pinned to the matching version. Frontends and the core release in lockstep — do not mix versions.

Basic example
-------------

```js
var swig = require('@rhinostone/swig-jinja2');

var out = swig.render('Hello, {{ name|upper }}!', {
  locals: { name: 'world' }
});
// => Hello, WORLD!
```

Supported surface (as of 2.5.0)
-------------------------------

A near-subset of Python Jinja2 — everything below was cross-checked against Jinja2 3.x.

* **Tags** — `set`, `if` / `elif` / `else`, `for` (with `else`), `block`, `extends`, `include`, `macro`, `import`, `from`, `raw`, `filter`, `with`, `autoescape`.
* **Operators** — `**` power, `//` floor-division, `~` string concat, inline-if (`a if c else b`), Python slicing (`seq[start:stop:step]`), `is <test>` / `is not <test>`, plus `{{- … -}}` / `{%- … -%}` whitespace control.
* **Built-in `is` tests** — `defined`, `undefined`, `none`, `even`, `odd`, `divisibleby`, `iterable`, `mapping`, `sequence`, `string`, `number`, `boolean`, `callable`, `lower`, `upper`, `sameas`.
* **Filters** — 39 built-ins (`upper`, `lower`, `capitalize`, `title`, `trim`, `truncate`, `replace`, `striptags`, `format`, `wordcount`, `wordwrap`, `indent`, `center`, `urlencode`, `escape` / `e`, `safe`, `first`, `last`, `join`, `reverse`, `sort`, `length` / `count`, `list`, `unique`, `batch`, `slice`, `dictsort`, `groupby`, `min`, `max`, `sum`, `random`, `abs`, `round`, `int`, `float`, `default` / `d`, `tojson`, `date`). See `lib/filters.js` for the full list.
* **Async** — `renderFileAsync` / `compileFileAsync` for async loaders.

Explicitly unsupported (parse-time throw or absent)
---------------------------------------------------

* No sandboxed-rendering mode — template source is trusted.
* `{% call %}`, `{% do %}`, `{% trans %}` — deferred / Jinja2 extensions.
* `map` / `select` / `reject` / `selectattr` / `rejectattr` filters — deferred.
* Macro kwargs — use positional args or an object literal.
* Dynamic `{% extends %}` / `{% import %}` / `{% from %}` — string-literal paths only.
* Bracket-notation `{% set foo["x"] = … %}` — use dot-path notation.

Repository
----------

Source: [gina-io/swig/packages/swig-jinja2](https://github.com/gina-io/swig/tree/develop/packages/swig-jinja2). File issues and PRs at [gina-io/swig](https://github.com/gina-io/swig).

License
-------

MIT. See [LICENSE](https://github.com/gina-io/swig/blob/develop/LICENSE) in the monorepo root.
