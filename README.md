Swig
====

[![CI](https://github.com/gina-io/swig/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/gina-io/swig/actions/workflows/ci.yml) [![NPM version](https://img.shields.io/npm/v/@rhinostone/swig.svg?style=flat)](https://www.npmjs.com/package/@rhinostone/swig) [![NPM Downloads](https://img.shields.io/npm/dm/@rhinostone/swig.svg?style=flat)](https://www.npmjs.com/package/@rhinostone/swig) [![Socket Badge](https://socket.dev/api/badge/npm/package/@rhinostone/swig)](https://socket.dev/npm/package/@rhinostone/swig)

> **Multi-flavor template engine** for Node.js and browsers — native Swig syntax (Jinja2/Django-inspired), Twig syntax, Python Jinja2 syntax, and Django Template Language syntax via dedicated frontends sharing one IR backend. [gina-io/swig](https://github.com/gina-io/swig) started as a maintained continuation of the abandoned `paularmstrong/swig` (last released 2014) and is now a standalone project. Security and bug fixes ship here.

> **Part of the [Gina](https://github.com/gina-io/gina) ecosystem.** This is the built-in template engine for [Gina](https://gina.io) ([npm](https://www.npmjs.com/package/gina)), a Node.js MVC framework with HTTP/2, multi-bundle architecture, and scope-based data isolation.

Swig is a **Jinja2/Django-inspired** template engine for node.js and browsers. The syntax will feel familiar to Jinja2 and Django users, but Swig is **not drop-in compatible** with either — porting templates from an existing project requires a handful of changes. See the [Migration Guide](https://gina.io/docs/templating/swig/migration) for the full parity list and workaround patterns.

> **Coming from Twig?** Install [@rhinostone/swig-twig](https://www.npmjs.com/package/@rhinostone/swig-twig) instead — a dedicated Twig-syntax frontend with closer parity than working around incompatibilities here.

> **Coming from Python Jinja2?** Install [@rhinostone/swig-jinja2](https://www.npmjs.com/package/@rhinostone/swig-jinja2) — a dedicated Jinja2-syntax frontend (near-subset) with closer parity than porting to native Swig syntax here.

> **Coming from Django?** Install [@rhinostone/swig-django](https://www.npmjs.com/package/@rhinostone/swig-django) — a dedicated Django Template Language frontend that renders real Django templates, with far closer parity than native Swig syntax here.

Workspace packages
------------------

| Package | Description | When to use |
| --- | --- | --- |
| [`@rhinostone/swig`](https://www.npmjs.com/package/@rhinostone/swig) | Native Swig syntax (Jinja2/Django-inspired). Drop-in for `@rhinostone/swig@1.x` consumers. | Upgrading from `@rhinostone/swig@1.x`, or starting fresh with Swig syntax. |
| [`@rhinostone/swig-twig`](https://www.npmjs.com/package/@rhinostone/swig-twig) | Twig-syntax frontend with closer Twig parity. | Migrating from PHP Twig, or writing new templates in Twig syntax. |
| [`@rhinostone/swig-jinja2`](https://www.npmjs.com/package/@rhinostone/swig-jinja2) | Python Jinja2-syntax frontend (near-subset). | Migrating from Python Jinja2, or writing new templates in Jinja2 syntax. |
| [`@rhinostone/swig-django`](https://www.npmjs.com/package/@rhinostone/swig-django) | Django Template Language frontend (real DTL). | Migrating from Django, or writing new templates in Django syntax. |
| [`@rhinostone/swig-core`](https://www.npmjs.com/package/@rhinostone/swig-core) | Shared IR, backend, and runtime primitives. | Building a custom flavor frontend. Otherwise pulled in transitively. |

Each frontend pins the matching `@rhinostone/swig-core` version exactly (no caret, no tilde) — frontends and the core release in lockstep on every cut.

Features
--------

* Available for node.js **and** major web browsers.
* **Strict-CSP browser runtime** — AOT-compile templates ahead of time (`swig compile --recursive --register`) and render them with the runtime-only bundle (`dist/swig.runtime.min.js`, ~21 KB) — no parser, no `new Function`, no `unsafe-eval` required.
* [Express](https://expressjs.com/) compatible.
* Object-Oriented template inheritance.
* Apply filters and transformations to output in your templates.
* **Security-hardened** — prototype-pollution vectors (`__proto__` / `constructor` / `prototype`) blocked at parser, tag-side, and IR-emission layers; template-driven file reads outside the loader root rejected (CVE-2023-25345 directory traversal, patched in 2.7.1). Dedicated CVE regression suite in [`tests/regressions.test.js`](./tests/regressions.test.js).
* Automatically escapes all variable output (HTML by default; configurable per-call).
* Lots of iteration and conditionals supported.
* Robust without the bloat.
* Extendable and customizable — register custom filters, tags, and loaders per-instance.

What's new in v2.8.0
--------------------

* **Added — AOT template registration on every flavor.** `swig.register(path, fn)` and `swig.registerBundle(map)` store pre-compiled templates in the template cache under loader-normalized keys, wrapped in the call shape `include` expects. `swig compile --recursive --register <dir>` emits a self-registering browser bundle.
* **Added — runtime-only browser build.** `dist/swig.runtime.js` / `dist/swig.runtime.min.js` (~21 KB minified) execute pre-compiled template bundles — `register`, `registerBundle`, `run`, `compileFile`, `renderFile`, the native filter catalog, and a root-based memory loader — and ship **no parser and no `new Function`**, so pages under a strict Content-Security-Policy (no `unsafe-eval`) can render AOT-compiled templates. Also available to Node as `require('@rhinostone/swig/runtime')`.
* **Fixed — silent template-cache failures now report.** The memory loader rejects a climbing path when a basepath is set (mirroring the confinement the filesystem loader already enforces) instead of resolving to a different template than the one requested; priming via `swig.run(tpl, locals, filepath)` stores a cache entry a later `include` can actually use instead of crashing on the raw function shape; the memory cache no longer reads inherited object members (an identifier-style loader cannot resolve a name such as `constructor` to a cache hit); and both minified bundles now point at the source-map filename that is actually written.
* **Fixed — documentation link refresh.** Canonical `/docs/templating/swig` URLs, HTTPS `expressjs.com` link, updated DateZ `@license` URL, and de-linked references to the archived `paularmstrong/swig` repository (kept as plain text for traceability).

See the full [HISTORY.md](./HISTORY.md) and [ROADMAP.md](./ROADMAP.md).

Benchmarks
----------

[`benchmarks/render.js`](./benchmarks/render.js) measures sync-render throughput across five workload shapes against [Nunjucks](https://www.npmjs.com/package/nunjucks).

```bash
cd benchmarks && npm install && node render.js
```

In production-typical settings (autoescape on), `@rhinostone/swig` leads Nunjucks on all five workload shapes — from ~1.8× on simple variable output to 3.5–5.5× on iteration-heavy templates (median of 3 runs, 2026-08). See [`benchmarks/README.md`](./benchmarks/README.md) for the methodology, the full result table, and how to reproduce on your own hardware.

Need Help? Have Questions? Comments?
------------------------------------

* File an issue at [gina-io/swig/issues](https://github.com/gina-io/swig/issues).
* Swig v0.x → v1.x migration notes — the original upstream wiki has been deleted; see `HISTORY.md` entries around v1.0.0 for the individual breaking changes. For porting *from Jinja2 or Django* into Swig, see the [Migration Guide](https://gina.io/docs/templating/swig/migration).

Installation
------------

    npm install @rhinostone/swig

For Twig syntax:

    npm install @rhinostone/swig-twig

For Python Jinja2 syntax:

    npm install @rhinostone/swig-jinja2

For Django syntax:

    npm install @rhinostone/swig-django

Documentation
-------------

User-facing documentation lives in the Gina Docusaurus site under the [Swig Template Engine](https://gina.io/docs/templating/swig) section, maintained in [gina-io/docs](https://github.com/gina-io/docs) at `docs/templating/swig/`. The JSDoc blocks in `lib/swig.js`, `lib/filters.js`, `lib/tags/`, and `lib/loaders/` remain the canonical source-of-truth for the public API and are mirrored into the Docusaurus pages.

Basic Example
-------------

### Template code

```html
<h1>{{ pagename|title }}</h1>
<ul>
{% for author in authors %}
    <li{% if loop.first %} class="first"{% endif %}>{{ author }}</li>
{% endfor %}
</ul>
```

### node.js code

```js
var swig  = require('@rhinostone/swig');
var template = swig.compileFile('/absolute/path/to/template.html');
var output = template({
    pagename: 'awesome people',
    authors: ['Paul', 'Jim', 'Jane']
});
```

### Output

```html
<h1>Awesome People</h1>
<ul>
    <li class="first">Paul</li>
    <li>Jim</li>
    <li>Jane</li>
</ul>
```

For working example see [examples/basic](https://github.com/gina-io/swig/tree/master/examples/basic).

Migrating from `@rhinostone/swig@1.x`
-------------------------------------

`@rhinostone/swig@2.x` is **drop-in for `1.x` consumers** — `swig.compileFile`, `swig.renderFile`, `swig.setFilter`, `swig.setTag`, and the rest of the public API are unchanged. The internal carve into [@rhinostone/swig-core](https://www.npmjs.com/package/@rhinostone/swig-core) is transparent (test gate during the alpha cycle: byte-identical compiled output against the `1.x` test suite).

`2.0.0` also ships [@rhinostone/swig-twig](https://www.npmjs.com/package/@rhinostone/swig-twig), a sibling Twig-syntax frontend; `2.5.0` adds [@rhinostone/swig-jinja2](https://www.npmjs.com/package/@rhinostone/swig-jinja2) for Python Jinja2 syntax; and `2.7.0` adds [@rhinostone/swig-django](https://www.npmjs.com/package/@rhinostone/swig-django) for Django Template Language syntax. Switching is opt-in — your existing `@rhinostone/swig` install keeps working.

Migrating from Jinja2 or Django
-------------------------------

Swig is *inspired by* Jinja2 and Django, not a drop-in replacement. Common pitfalls when porting existing templates:

* **No `is` / `is not` / `not in` operators** — rewrite `{% if x is defined %}` as `{% if x !== undefined %}`, `{% if x not in xs %}` as `{% if not (x in xs) %}`.
* **Django `forloop.counter` → Swig `loop.index`** (Swig follows Jinja2 loop-variable naming).
* **`{{ super() }}` / `{{ block.super }}` → `{% parent %}`** — Swig uses a dedicated tag inside the overriding block.
* **Django filter args use a colon (`|date:"Y-m-d"`) — Swig uses parens (`|date("Y-m-d")`)**.
* **`{% with x=1 %}` → `{% set x = 1 %}`**, and no block-form `{% set %}…{% endset %}`.
* **No `{% from "f" import x %}` — use `{% import "f" as ns %}` + `ns.x` instead**.
* **Method calls require parens** — Django auto-invokes `x.get_absolute_url`; Swig needs `x.get_absolute_url()`.
* **~25 Jinja2 filters are absent** — `default`, `truncate`, `tojson`, `round`, `int`, `float`, `map`, `select`, `batch`, `trim`, etc. Register them via `swig.setFilter(name, fn)`.

Full parity tables and workaround patterns: **[Migration Guide](https://gina.io/docs/templating/swig/migration)**.

How it works
------------

Swig reads template files and translates them into cached JavaScript functions. The pipeline is: parse → emit IR → lower IR to JS source → `new Function(...)`. At render time, the compiled function runs against a context object to produce the output string.

In `2.x`, frontend parsers (native Swig syntax in [@rhinostone/swig](https://www.npmjs.com/package/@rhinostone/swig), Twig syntax in [@rhinostone/swig-twig](https://www.npmjs.com/package/@rhinostone/swig-twig), Python Jinja2 syntax in [@rhinostone/swig-jinja2](https://www.npmjs.com/package/@rhinostone/swig-jinja2), Django Template Language syntax in [@rhinostone/swig-django](https://www.npmjs.com/package/@rhinostone/swig-django)) emit a shared intermediate representation. The backend in [@rhinostone/swig-core](https://www.npmjs.com/package/@rhinostone/swig-core) lowers IR to JS. New flavors plug in at the frontend without touching the runtime.

License
-------

MIT. Copyright (c) 2010-2016 Paul Armstrong and contributors, (c) 2026 Rhinostone. See [LICENSE](./LICENSE) for the full text and [AUTHORS](./AUTHORS) for the contributor roster.
