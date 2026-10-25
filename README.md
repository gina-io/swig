Swig
====

[![CI](https://github.com/gina-io/swig/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/gina-io/swig/actions/workflows/ci.yml) [![NPM version](https://img.shields.io/npm/v/@rhinostone/swig.svg?style=flat)](https://www.npmjs.com/package/@rhinostone/swig) [![NPM Downloads](https://img.shields.io/npm/dm/@rhinostone/swig.svg?style=flat)](https://www.npmjs.com/package/@rhinostone/swig) [![Socket Badge](https://socket.dev/api/badge/npm/package/@rhinostone/swig)](https://socket.dev/npm/package/@rhinostone/swig) [![OpenSSF Scorecard](https://img.shields.io/ossf-scorecard/github.com/gina-io/swig?label=openssf%20scorecard&style=flat)](https://scorecard.dev/viewer/?uri=github.com/gina-io/swig)

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
* **Strict-CSP browser runtime** — AOT-compile templates ahead of time (`swig compile --recursive --register`) and render them with the runtime-only bundle (`dist/swig.runtime.min.js`, ~24 KB) — no parser, no `new Function`, no `unsafe-eval` required.
* [Express](https://expressjs.com/) compatible.
* **Async template loading** — back the loader with S3 / Redis / HTTP / any callback API: set `loader.async = true` and pass a callback to `renderFile`, or to `compileFile` with `codegenMode: 'async'` in its options, whose compiled function returns a promise of `{ output, exports }`; `extends` / `include` / `import` resolve at render time, dynamic `{% extends %}` paths included.
* Object-Oriented template inheritance.
* Apply filters and transformations to output in your templates.
* **Security-hardened** — prototype-pollution vectors (`__proto__` / `constructor` / `prototype`) blocked at parser, tag-side, and IR-emission layers; template-driven file reads outside the loader root rejected (CVE-2023-25345 directory traversal, patched in 2.7.1). Dedicated CVE regression suite in [`tests/regressions.test.js`](./tests/regressions.test.js).
* Automatically escapes all variable output (HTML by default; configurable per-call).
* Lots of iteration and conditionals supported.
* Robust without the bloat — a single runtime dependency ([`@rhinostone/swig-core`](https://www.npmjs.com/package/@rhinostone/swig-core)).
* Extendable and customizable — register custom filters, tags, and loaders per-instance.

What's new in v2.9.6
--------------------

> **Security release: upgrade all five packages to 2.9.6.** Data passed to one render could reach other renders: through the locals of a compile cached under a filename, through an instance's default locals, and through a locals object passed to more than one render. The fixes are in `@rhinostone/swig-core`, and every frontend requires the same `@rhinostone/swig-core` version, so upgrade the packages together.

* **Security — locals given in the options of a cached compile stay with that call.** With the default memory cache, or a custom cache object, `compile` cached one function per filename that kept the locals of the call that created it: `render(source, { filename, locals })` rendered the first call's locals on every later call with that filename, and a later `renderFile` or include of the file got them under its own. The cache now keeps a function without those locals, and each call binds its own. Every release has it, back to the original swig 1.4.2.
* **Security — renders no longer write into the default locals.** A render without call-time locals on an instance with default locals, and `run` without locals, used the defaults object itself as the template's context, so the names a template set stayed in it for every later render on that instance; with a request-scoped helper in the default locals, one of two concurrent renders on the async render path showed the other's data. They now work on a copy.
* **Security — renders no longer write into the locals object you pass.** On an instance without default locals a render used the caller's object as its context, so the names a template set landed in it: a later render given the same object read them, and two concurrent renders on the async render path given one object read each other's, so with a request-scoped helper in it one user's page showed another user's data. A render now works on a copy made at its top, and an include still shares its includer's context, so an include's sets still reach the page. A template rendered from inside another render of the same instance, an include given an object with `with … only`, and a dotted set such as `{% set site.user = who %}` still write into the object they are given.
* **Fixed — `{% parent %}` on the async render path.** In a template that extends another, `{% parent %}` rendered nothing on the async render path, in every release since 2.2.0; it now renders the version of the block in the template above, through each level of an extends chain and under a dynamic `{% extends %}`. A macro that calls `{% parent %}` throws a clear error there when it is called.
* **Fixed — async imports keep the imported template's bindings to itself.** On the async render path an imported template's macros, top-level sets and the aliases of its own imports no longer land in the template that imports it, as on the sync path, and the same holds for `{% from %}` in Twig and Jinja2; the imported macros still see them while they run.

See the full [HISTORY.md](./HISTORY.md) and [ROADMAP.md](./ROADMAP.md).

Benchmarks
----------

[`benchmarks/render.js`](./benchmarks/render.js) measures sync-render throughput across five workload shapes against [Nunjucks](https://www.npmjs.com/package/nunjucks).

```bash
cd benchmarks && npm install && node render.js
```

In production-typical settings (autoescape on), `@rhinostone/swig` leads Nunjucks on all five workload shapes — from ~1.3× on simple variable output to 5.3–5.9× on iteration-heavy templates (median of 5 runs, 2026-10). See [`benchmarks/README.md`](./benchmarks/README.md) for the methodology, the full result table, and how to reproduce on your own hardware.

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

User-facing documentation lives in the Gina Docusaurus site under the [Swig Template Engine](https://gina.io/docs/templating/swig) section, maintained in [gina-io/docs](https://github.com/gina-io/docs) at `docs/templating/swig/`. The JSDoc blocks in `lib/swig.js`, `lib/filters.js`, `lib/tags/`, and `packages/swig-core/lib/loaders/` remain the canonical source-of-truth for the public API and are mirrored into the Docusaurus pages.

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

* **No `is` / `is not` / `not in` operators** — rewrite `{% if x is defined %}` as `{% if x !== undefined %}`, and `{% if x not in xs %}` for a list as `{% if xs.indexOf(x) === -1 %}` (`in` tests an object's keys or an array's indices, not membership).
* **Django `forloop.counter` → Swig `loop.index`** (Swig follows Jinja2 loop-variable naming).
* **`{{ super() }}` / `{{ block.super }}` → `{% parent %}`** — Swig uses a dedicated tag inside the overriding block.
* **Django filter args use a colon (`|date:"Y-m-d"`) — Swig uses parens (`|date("Y-m-d")`)**.
* **`{% with x=1 %}` → `{% set x = 1 %}`**, and no block-form `{% set %}…{% endset %}`.
* **No `{% from "f" import x %}` — use `{% import "f" as ns %}` + `ns.x` instead**.
* **Method calls require parens** — Django auto-invokes `x.get_absolute_url`; Swig needs `x.get_absolute_url()`.
* **Many Jinja2 filters are absent** — `truncate`, `tojson`, `round`, `int`, `float`, `map`, `select`, `batch`, `trim`, etc. (`default` **is** built in). Register missing ones via `swig.setFilter(name, fn)` — or use [@rhinostone/swig-jinja2](https://www.npmjs.com/package/@rhinostone/swig-jinja2), which ships 39 of them natively.

Full parity tables and workaround patterns: **[Migration Guide](https://gina.io/docs/templating/swig/migration)**.

How it works
------------

Swig reads template files and translates them into cached JavaScript functions. The pipeline is: parse → emit IR → lower IR to JS source → `new Function(...)`. At render time, the compiled function runs against a context object to produce the output string.

In `2.x`, frontend parsers (native Swig syntax in [@rhinostone/swig](https://www.npmjs.com/package/@rhinostone/swig), Twig syntax in [@rhinostone/swig-twig](https://www.npmjs.com/package/@rhinostone/swig-twig), Python Jinja2 syntax in [@rhinostone/swig-jinja2](https://www.npmjs.com/package/@rhinostone/swig-jinja2), Django Template Language syntax in [@rhinostone/swig-django](https://www.npmjs.com/package/@rhinostone/swig-django)) emit a shared intermediate representation. The backend in [@rhinostone/swig-core](https://www.npmjs.com/package/@rhinostone/swig-core) lowers IR to JS. New flavors plug in at the frontend without touching the runtime.

For strict-CSP targets the compile pipeline can be skipped entirely: AOT-compile templates with the CLI (`swig compile --recursive --register`) and execute the resulting bundle with the runtime-only build (`dist/swig.runtime.min.js`), which contains no parser and no `new Function`.

License
-------

MIT. Copyright (c) 2010-2016 Paul Armstrong and contributors, (c) 2026 Rhinostone. See [LICENSE](./LICENSE) for the full text and [AUTHORS](./AUTHORS) for the contributor roster.
