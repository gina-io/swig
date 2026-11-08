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
* **Security-hardened** — prototype-pollution vectors (`__proto__` / `constructor` / `prototype`) blocked at parser, tag-side, and IR-emission layers, and checked at run time for keys taken from the template data (2.12.1), including keys an object gets only from `Object.prototype` (2.12.2); template-driven file reads outside the loader root rejected (CVE-2023-25345 directory traversal, patched in 2.7.1). Dedicated CVE regression suite in [`tests/regressions.test.js`](./tests/regressions.test.js).
* Automatically escapes all variable output (HTML by default; configurable per-call).
* Lots of iteration and conditionals supported.
* Robust without the bloat — a single runtime dependency ([`@rhinostone/swig-core`](https://www.npmjs.com/package/@rhinostone/swig-core)).
* Extendable and customizable — register custom filters, tags, and loaders per-instance.

What's new in v2.12.2
---------------------

> **Upgrade the five packages together (the 2.12.2 frontends require `@rhinostone/swig-core` 2.12.2) and recompile precompiled templates with 2.12.2: a template compiled by 2.12.2 needs the 2.12.2 runtime.**

* **Fixed — keys an object gets only from `Object.prototype`.** A key from the data that an object gets only from Object.prototype reads as missing in a subscript, in a call on a subscript and in the swig-jinja2 attribute reader of groupby, sum and attr: with foo {}, `{{ foo[k] }}` printed the source of the function for k = __defineGetter__ (native) or __lookupGetter__ (swig-jinja2), and now renders as a key foo does not hold. A key written in brackets in the template reads the same way: `{{ foo["hasOwnProperty"]("b") }}` printed true and now renders nothing, while the dotted form `{{ foo.hasOwnProperty("b") }}` reads as before. Own keys, the members of a class and the methods that String, Number and Array define still read; a method a string gets only from Object.prototype now reads as missing (`{{ s[k]() }}` with s "abc" printed abc for k = toLocaleString and now renders nothing), and a Proxy whose get trap answers every key now gives nothing for such a name, as a plain object does. For these names the check looks at the first 1000 objects of a prototype chain: a name that only an object further down holds reads as missing here and in native `in`, where it read before (a chain of 1001 objects whose last one holds toString). A native set target still writes such a key as an own key, and the bracket fragments a custom tag receives read the four Object.prototype accessor helpers (__defineGetter__, __defineSetter__, __lookupGetter__, __lookupSetter__) as missing, even when the object holds one as its own key.
* **Fixed — keys named like an `Object.prototype` member.** A key in the data, a template name or a block name that is also the name of an Object.prototype member is read as an own key. A for loop over a mapping that holds a key named hasOwnProperty, or over an object with no prototype, no longer fails with « obj.hasOwnProperty is not a function » in any flavor, and neither does a macro call, or an include with an object, when the context holds such a key or has no prototype; a native block named hasOwnProperty works through extends and {% parent %}. A for loop no longer asks a mapping's own hasOwnProperty function which keys to visit: over a mapping {a, _b, hasOwnProperty} whose hasOwnProperty function leaves out _b, every flavor rendered [a][hasOwnProperty] and now renders [a][_b][hasOwnProperty]. The memory loader no longer serves an inherited member as template source: an include of __proto__, constructor or another Object.prototype name such as toString fails as a missing template does, where native failed with « source.replace is not a function » and swig-twig, swig-jinja2 and swig-django rendered [object Object] for __proto__ and the source of the function for the others. Native groupBy groups the values constructor and __proto__, and a value that converts to one of them such as the list ["__proto__"], where it failed with « out[keyname].push is not a function », and swig-jinja2 groupby groups the values hasOwnProperty and __proto__, where it failed or split the __proto__ group in two. A key "__proto__" in the data stays an own key where a filter maps over an object, where swig-twig merge copies one, where a swig-jinja2 loop filter keeps a mapping item, and in the copies that an include with an object and swig-twig {% with %} make; before, it set the new object's prototype, so the key was lost and the fields of its value read as the object's own. With the memory cache, a template that a custom loader names __proto__ is loaded once, not on every render.
* **Fixed — native `in`.** Native `in`, a key test, no longer finds the members every object gets from Object.prototype: with obj {b: 1}, `{% if k in obj %}` was true for k = constructor, toString, __proto__ or hasOwnProperty, and is now false. Own keys, keys inherited from another prototype (the methods of a class) and array indexes still count, and a string on the right still throws.
* **Fixed — imports, block names and object literals.** Names every object gets from Object.prototype no longer reach a template through an import, a block name or an object literal. On the async render path, swig-twig and swig-jinja2 `{% from "m.html" import toString as t %}` bound the toString function of Object.prototype (`[{{ t }}]` printed its source) and now binds nothing, as a name the template does not export; the same for valueOf and hasOwnProperty, while an exported macro named hasOwnProperty, which failed with « obj.hasOwnProperty is not a function », now binds. A native block named __proto__ fails to compile with « Unsafe block name "__proto__" is not allowed (prototype-chain guard) », where a child's override of it was lost (the parent's content rendered); blocks named constructor, prototype or toString still work. In an output or a built-in tag of native, swig-twig and swig-jinja2, an object literal key "__proto__" is now an own key: `{% set o = {"__proto__": {"a": "P"}, "b": 1} %}` made {"a": "P"} the prototype of o, so `{{ o.a }}` printed P and the json filters left the key out; now `{{ o.a }}` renders nothing and the key is kept, as Jinja2 reads it, and a literal that holds the key twice, which failed to compile with « Duplicate __proto__ fields are not allowed in object literals », keeps the last value. The fragments a custom tag receives are unchanged.
* **Fixed — templates compiled by an earlier release.** Templates compiled by 2.12.1 or earlier keep their old answer for native `in` and for an object literal key "__proto__" until they are recompiled with 2.12.2: those checks are in the code the compiler emits, as is the new code of a swig-jinja2 loop filter and of an async {% from %}. A subscript, or a call on one, compiled by 2.9.10 or later calls a runtime helper and follows the 2.12.2 rule at once. A template compiled by 2.12.2 needs the 2.12.2 runtime: run by 2.12.1, native `in` throws « _utils.hasKey is not a function » and a swig-jinja2 loop filter « _utils.setOwn is not a function ». Recompile precompiled templates (swig compile output, registerBundle bundles, stored precompile() results) with 2.12.2.

See the full [HISTORY.md](./HISTORY.md) and [ROADMAP.md](./ROADMAP.md).

Benchmarks
----------

[`benchmarks/render.js`](./benchmarks/render.js) measures sync-render throughput across five workload shapes against [Nunjucks](https://www.npmjs.com/package/nunjucks).

```bash
cd benchmarks && npm install && node render.js
```

In production-typical settings (autoescape on), `@rhinostone/swig` leads Nunjucks on all five workload shapes — narrowly on simple variable output (1.06×), and by 3.7–5.0× on iteration-heavy templates (median of 5 runs, 2026-10-29, `2.9.11`). See [`benchmarks/README.md`](./benchmarks/README.md) for the methodology, the full result table, and how to reproduce on your own hardware.

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
