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

What's new in v2.9.9
--------------------

> **Five behaviour changes.** A template that relied on one of these renders or compiles differently on 2.9.9:
>
> * swig-django: `default_if_none` now gives `""` for a variable that fails to resolve, as in Django, so `{{ missing|default_if_none:"d" }}` renders `""` where 2.9.8 rendered the default (`default` covers a missing variable).
> * swig-jinja2 `{% else %}`, and swig-django `{% else %}` and `{% empty %}`, fail to compile when given arguments, naming the tag, the line and the file, as in Jinja2 and Django. 2.9.8 ignored the arguments, so `{% if a %}A{% else if b %}B{% endif %}` rendered `B` with `a` and `b` both false.
> * swig-jinja2 refuses to bind `true`, `false` or `none`, each also capitalised (in `set`, `for`, a macro name or parameter, `with`, an import alias, a `from` name or alias): such a template fails to compile with `Cannot assign to the constant "<name>" in "<tag>" tag`, as in Jinja2.
> * swig-jinja2: a None that a filter returns reaches the next filter as null, so `{{ x|default(none)|upper }}` renders `[object Object]` where 2.9.8 rendered `""` (Jinja2 renders `NONE`), as a None value from the locals already did in 2.9.8.
> * Native swig: a function passed in the locals and named `not`, `and` or `or` can no longer be called by that name, and a `{% macro %}` head that is not a name fails to compile with `Expected a macro name on line N.`, including a macro named `not`, `and` or `or`, which 2.9.8 accepted.

* **Fixed — swig-django variables that fail to resolve.** A missing name, key or index, or a None value that a later segment of its path reads, reaches its filters as `""`, as in Django, which gives it `string_if_invalid` before any filter runs, in `{{ }}` outputs and in the values of `with`, `cycle` and `include-with`. In 2.9.8 `{{ missing|upper }}` and `{{ missing|lower }}` threw, `title` and `capfirst` rendered `Undefined`, and `slugify`, `striptags`, `cut`, `urlencode` and others rendered `undefined`. `if`, `for` and `firstof` are unchanged (Django reads a failed lookup there as None), and so is a None value.
* **Fixed — swig-jinja2 `true`, `false` and `none`.** Each also capitalised, they read as Jinja2's constants: `x == none` and `x is sameas none` read like `x is none`, `x != none` like `x is not none`, the tests `true` and `false` are added, and `batch` and `slice` no longer pad with none. In 2.9.8 they were variable names, which render `""`: `{% if True %}` took the else branch, `x == none` was true for `x = 0` and for `x = ""`, and `x is true` failed to compile. `none` still renders `""` wherever a variable holding None does.
* **Fixed — swig-django `.items`, `.keys` and `.values` in for loops.** A mapping's own key of that name is read first, as Django does, and otherwise the dict method applies as before. In 2.9.8 `{% for item in page.data.items %}` over `{ items: [1, 2] }` failed to compile, and `.values` and `.keys` over a mapping with such a key walked the whole mapping. One loop variable over `.items` now binds each key and value as a pair, so `{% for pair in d.items %}{{ pair.0 }}={{ pair.1 }}{% endfor %}` works as in Django, where it failed to compile.
* **Fixed — swig-django `.items`, `.keys` and `.values` of a value that is not a mapping.** Over a list, a string, a number or a boolean such a loop runs no item, as in Django. In 2.9.8 a two-name `.items` loop over a list of pairs unpacked each pair and `.keys` over a list gave its indices.
* **Fixed — `and`, `or`, `not`, `in` and `not in` before `(`.** In all four flavors they read as operators when `(` follows them with no space, as they already did before a space: `{% if not(x) %}`, `a and(b)`, `a or(b)`, `1 in(l)` and `1 not in(l)` mean what their spaced forms mean. In 2.9.8 `not(x)` called a function named `not`, which is false for every x, native swig read `a and(b)` and `a or(b)` as `a` with no error, and swig-twig, swig-jinja2 and swig-django failed to compile `and(`, `or(`, `in(` and `not in(`. Names that only start with a keyword (`index`, `order`, `notify`) and object keys named like one are unchanged.
* **Fixed — swig-django `not`, `in` and the comparisons in `if`.** They bind at the levels Django uses: `not` takes a comparison, `in`, `not in` or `is` into its operand, and `in` and `not in` bind more loosely than the comparisons. In 2.9.8 `{% if not x == y %}` with `x` 1 and `y` 2 was false (Django: true), and `{% if a == b in c %}` read `a == (b in c)`.
* **Fixed — swig-jinja2 `{% else %}` and swig-django `{% else %}` / `{% empty %}` with arguments.** They reject arguments when the template compiles, as Jinja2 and Django do; 2.9.8 ignored them (`else if` is not `elif`).
* **Fixed — engine helpers shadowed by the template context.** In swig-twig, swig-jinja2 and swig-django a key named `_ext`, `_utils` or `Math`, from the locals or set by the template, no longer replaces the helpers that tests, ranges, slices, `**` and `//` call. In 2.9.8 swig-jinja2 `{% if x is string %}` was false with the locals `{ _ext: { _test_string: 0 } }`, and slices, ranges, `**` and `//` rendered nothing, or failed, with a matching key. In swig-jinja2 an unknown test is now false whatever the locals hold.
* **Fixed — swig-django `{% cycle %}` with a string autoescape strategy.** It escapes its value with the strategy, as `{{ }}` and `{% firstof %}` do; under the `autoescape: "js"` option 2.9.8 escaped a cycle value for HTML.
* **Fixed — the swig-django README.** It no longer says that `{{ block.super }}` fails with a clear parse-time error (it renders an empty string, with no error), or that one-variable `{% for x in dict.items %}` is deferred.

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
