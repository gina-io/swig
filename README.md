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

What's new in v2.12.4
---------------------

> **Upgrade the five packages together (the 2.12.4 frontends require `@rhinostone/swig-core` 2.12.4) and recompile precompiled templates with 2.12.4: a template compiled by 2.12.3 or earlier keeps its old behaviour for these fixes until it is recompiled, except swig-django's reading of functions from `Object.prototype`, which its runtime decides.**
>
> A call of a method that a value gets only from Object.prototype, such as `o.hasOwnProperty("a")` or `o.toString()` on a plain object, renders an empty string in native swig, swig-twig and swig-jinja2: test for a key with `"a" in o` (native swig) or `o.a is defined` (swig-twig and swig-jinja2, false for a key that holds null), and print the value with `{{ o }}`.

* **Fixed — names that are reserved words or names the compiled code uses.** In native swig, swig-twig and swig-jinja2 a variable named with a JavaScript reserved word, such as `{{ class }}`, `{{ super }}`, `{{ enum }}`, `{{ const }}` or `{{ import }}`, renders its value from the context on both render paths, where it failed to compile with a raw JavaScript SyntaxError; swig-django already rendered it. A macro named `__k` called inside a for loop renders in native swig and swig-jinja2 instead of throwing. A loop variable or a macro parameter named like a name the compiled code uses no longer hides that name: in native swig and swig-twig, a loop variable named `_output` no longer drops the loop's output: `{% for _output in xs %}[{{ _output }}]{% endfor %}` over `["A", "B"]` renders `[A][B]` on both render paths, where it rendered an empty string, as does a two-name loop with `_output` as its key or its value; in swig-twig, `{% for _utils in [1] %}` around a range renders `[12]` where it threw « _utils.isArray is not a function », `{% for _ext in [1] %}` around `2 is even` renders `[Y]` where the test read false, and macro parameters named `_utils` or `_ext` behave the same way; in swig-jinja2, a macro parameter named `_ext` no longer makes `2 is even` false, and one named `Math` no longer makes `2 ** 3` render an empty string.
* **Fixed — names from `Object.prototype`.** A name an object gets only from Object.prototype reads as missing, bare or dotted, in all four flavors and on both render paths: `{{ toString }}`, `{{ valueOf }}`, `{{ hasOwnProperty }}`, `{{ isPrototypeOf }}`, `{{ toLocaleString }}`, `{{ __lookupGetter__ }}` and `{{ obj.toString }}` render an empty string, where native swig, swig-twig and swig-jinja2 printed the function's source and swig-django called it (`[object Object]`, `false`, or an empty string for `__lookupGetter__`), and `{% if toString %}` no longer takes its branch, also after a loop over that name: `[{{ toString }}]{% for toString in xs %}{% endfor %}[{{ toString }}]` renders `[][]`, and `{% if valueOf %}` after a loop over `valueOf` is not taken. In native swig, swig-twig and swig-jinja2 a macro parameter of such a name reads its argument: `{% macro m(toString) %}[{{ toString }}]{% endmacro %}{{ m("X") }}` renders `[X]`, where it printed the function's source, and `{{ toString() }}` in that macro calls the argument, where it rendered `[object Undefined]`. swig-django also reads as missing a function added to Object.prototype and a function a Proxy returns for such a name, instead of calling it. A key of that name the object holds itself, and a method of the object's own class, read as before.
* **Fixed — context keys named like a global.** A context key that holds null or undefined and is named like a standard JavaScript global or a name the compiled code uses no longer lets that global or name through, in native swig, swig-twig and swig-jinja2: with such a key, `{{ _output }}` rendered the output so far (`[[]`), `{{ Math }}`, `{{ JSON }}`, `{{ _utils }}` and `{{ _ctx }}` rendered `[object Object]`, `{{ Date }}` and `{{ Object }}` rendered the function's source, and `{{ __l }}` inside a loop rendered the list looped over; each renders an empty string now, as in swig-django. `Math is none` (swig-jinja2), `Math is null` (swig-twig) and `Math is None` (swig-django) are true for such a key, where they were false. With no such key in the context, a global a template reads (`Math`, `JSON`, `Date`, `encodeURIComponent`) is read as before, also after a loop variable named `Math` or `JSON`. When the context has no key of the name at all, `{{ _output }}` rendered the output so far, `{{ _utils }}`, `{{ _swig }}`, `{{ _filters }}` and `{{ _ext }}` rendered `[object Object]`, `{{ _fn }}` rendered the source of a function, and `{{ __l }}` and `{{ __len }}` inside a loop rendered the list looped over and its length; each renders an empty string now too, while `{{ _ctx }}`, and `{{ _exports }}` on the async render path, still render `[object Object]`. A key that holds null and is named like another global, such as `setTimeout`, still lets that global through.
* **Fixed — behaviour these fixes change.** Behaviour that changes with these fixes: in native swig, swig-twig and swig-jinja2 an include inside a macro, and a macro called inside it, see a macro parameter named like a standard JavaScript global, a name the compiled code uses, a member objects get from Object.prototype, one of the nine words that only strict-mode JavaScript reserves (`yield`, `let`, `static`, `implements`, `interface`, `package`, `private`, `protected` and `public`) or `await`, on the sync render path, such as `document`, `_ext`, `_parentTpl`, `toString` or `public` (`{% macro m(document) %}[{% include "p.html" %}]{% endmacro %}{{ m("X") }}`, with p.html holding `{{ document }}`, renders `[X]` on the sync path, where it rendered `[]` (and `[object Object]` with a parameter named `_ext`, and the function's source with one named `toString`), and `{% macro inner() %}{{ document }}{% endmacro %}{% macro m(document) %}[{{ inner() }}]{% endmacro %}{{ m("X") }}` renders `[X]` on both render paths, where it rendered `[]`), while they still see no other parameter; in swig-jinja2 a default that reads a parameter of such a name, an earlier one, its own or a later one, reads that parameter (its argument or, when the call gives none, the value its own default gave it once that default has run, and an empty value otherwise) also when the context holds a key of the same name, as Jinja2 does: with a context key `process` holding `"CTX"`, `{% macro m(process, b=process) %}[{{ b }}]{% endmacro %}` renders `[X]` for `{{ m("X") }}` and `[]` for `{{ m() }}` on both render paths, where it rendered `[CTX]` for both, `{% macro m(process=process) %}[{{ process }}]{% endmacro %}{{ m() }}` renders `[]` and `{% macro m(a=process, process="D") %}[{{ a }}|{{ process }}]{% endmacro %}{{ m() }}` renders `[|D]`, where they rendered `[CTX]` and `[CTX|D]`, while with `zz` for `process` these templates still render the context's key (`[CTX]`, `[CTX]`, `[CTX]` and `[CTX|D]`), where Jinja2 renders `[X]`, `[]`, `[]` and `[|D]`; in swig-jinja2 a macro called from such a default reads a parameter of such a name of the calling macro, its own or a later one, as empty, also when the context holds a key of that name: with the context key `process` holding `"CTX"`, `{% macro h() %}{{ process }}{% endmacro %}{% macro m(b=h(), process="D") %}[{{ b }}|{{ process }}]{% endmacro %}{{ m() }}` renders `[|D]` on both render paths, where it rendered `[CTX|D]`, which Jinja2 renders; in native swig, swig-twig and swig-jinja2 a macro defined inside another macro and called after that macro has returned no longer sees a parameter of such a name of the macro that defined it, which it sees when called inside that macro, and reads the name as the rest of the template does: `{% macro outer(_ext) %}{% macro inner() %}[{{ _ext }}]{% endmacro %}{% endmacro %}{{ outer("X") }}{{ inner() }}` renders `[]` on both render paths, where it rendered `[X]`, while with `zz` for `_ext` it still renders `[X]` (Jinja2 raises an error for that call, as `inner` is local to `outer`); in native swig, swig-twig and swig-jinja2 a `{% set %}` of a parameter of such a name inside its macro no longer stays in the context after the call when the context holds no key of that name: `{% macro m(document) %}{% set document = "S" %}{% endmacro %}{{ m("A") }}[{{ document }}]` renders `[]` on both render paths, as Jinja2 does, where it rendered `[S]`, while with `zz` for `document` it still renders `[S]`, where Jinja2 renders `[]`; in native swig and swig-twig a macro defined inside a for loop and called after the loop reads a loop variable of such a name (also the key or the value of a two-name loop) as the rest of the template does, where it read the variable's last value when the context held no key of that name, or one holding null or undefined (for `arguments` it printed `[object Object]`, and for `toString` with no such key the function's source): `{% for document in xs %}{% macro m() %}[{{ document }}]{% endmacro %}{% endfor %}{{ m() }}` over `["A", "B"]` renders `[]` on both render paths, where it rendered `[B]`, while with `zz` for `document` it still renders `[B]` (Jinja2 raises an error for that call, as `m` is local to the loop); swig-jinja2 no longer reads a global for a loop item that is null or undefined (`{% for Math in xs %}[{{ Math }}]{% endfor %}` over `[undefined, null, 1]` renders `[][][1]`, as the other flavors do, where it rendered `[object Object]` for the first two); in all four flavors `{{ __k }}` inside a one-name loop reads the context, an empty string or the context's `__k`, where it rendered the loop's index; and in native swig, swig-twig and swig-jinja2 a dotted read whose first name is a context key without that member no longer falls back to the global of that name: with `Math` holding `{}`, `{{ Math.PI }}` renders an empty string where it rendered 3.141592653589793, and in swig-jinja2 `Math.PI == x` is false there, as in Jinja2 (`{{ Math.PI }}|{% if Math.PI == x %}Y{% else %}N{% endif %}` with `x` 3.141592653589793 renders `|N` where it rendered `3.141592653589793|Y`). A call reads its name as a plain variable read now does, in native swig, swig-twig and swig-jinja2 and on both render paths: with no context key of the name, `{{ toString() }}` renders an empty string where it rendered `[object Undefined]`, `{{ valueOf() }}` and `{{ hasOwnProperty("a") }}` render an empty string where they threw « Cannot convert undefined or null to object », and `{{ class() }}`, `{{ _output() }}` and `{{ _utils() }}` render an empty string where they failed to compile or threw, while a function under a `class` key is called where the template failed to compile, and one under a `toString` key is called as before; a context key that holds undefined counts as a key: with one named `encodeURIComponent`, `{{ encodeURIComponent("a b") }}` renders an empty string where it rendered `a%20b`, and in swig-jinja2, with one named `Math`, `Math == none` and `Math in [none]` are true and `Math != none` is false, the reverse of before; and a native tag registered with setTag gets the same reads in the compiled fragments it receives: a tag that outputs its argument renders an empty string for `toString` when the context has no such key, where it printed the function's source, and renders the value of a `class` key, where the template failed to compile; for `f (1)`, a call written with a space before its parenthesis, such a tag receives a call that runs, where the template failed to compile with a SyntaxError. A method that a value gets only from Object.prototype reads as missing when the template calls it, in native swig, swig-twig and swig-jinja2 and on both render paths, as a call after a subscript (`{{ os[0].hasOwnProperty("a") }}`) already read it in 2.12.2 and 2.12.3: `{{ o.hasOwnProperty("a") }}` renders an empty string where it rendered `true`, `{% if o.hasOwnProperty("a") %}` no longer takes its branch, and `{{ o.toString() }}` with `o` a plain object, `{{ a.valueOf() }}` with `a` holding `[1, 2]` and `{{ s.toLocaleString() }}` with `s` holding `"1234.5"` render an empty string where they rendered `[object Object]`, `1,2` and `1234.5`, while the methods that numbers, strings and dates define themselves, such as a number's `toString` or a Date's `valueOf`, and a method of the object's own class are called as before; to test for a key, write `"a" in o` in native swig and `o.a is defined` in swig-twig and swig-jinja2 (false there for a key that holds null), and to print the value, write `{{ o }}`.
* **Fixed — swig-jinja2 `super()` and swig-twig `parent()`.** swig-jinja2 `{{ super() }}` and swig-twig `{{ parent() }}` fail at compile, wherever the call stands and on both render paths, with « "super()" is not supported (swig-jinja2 does not render parent blocks) » or « "parent()" is not supported (swig-twig does not render parent blocks) » and the line and file: neither flavor renders a parent block's content. Before, swig-jinja2 failed with a raw « 'super' keyword unexpected here » SyntaxError where the template was compiled, and ignored the call at the top level of an extending template outside its blocks, and on the sync path in a block the parent does not define and at the top level of an imported file; swig-twig rendered the overriding block without the parent's content, and called a macro, an imported macro or a function from the data named parent. A read of the name (`{{ parent }}`, `{{ parent.x }}`) and a call of a member of that name (`{{ o.parent() }}`) are unchanged.
* **Fixed — the word `await` in a macro on the async render path.** On the async render path a macro whose compiled code holds the word `await` no longer throws « The macro … holds an {% include %}, {% import %}, {% from %} or {% block %}, which the async render path does not support inside a macro. » when it holds none of them, in native swig, swig-twig and swig-jinja2: the word in the macro's text, in a string it writes, in a for loop, with, filter, apply or set block inside it, or as the name of a parameter, of a variable it reads, of a loop variable or of a `{% set %}` no longer counts, so in native swig `{% macro m() %}<i>await</i>{% endmacro %}[{{ m() }}]` renders `[<i>await</i>]` on both render paths, and in the three flavors `{% macro m(await) %}[{{ await }}]{% endmacro %}{{ m("X") }}` renders `[X]`, where they threw on the async path; a macro that holds a real include, import, from import or block, or a native tag registered with setTag whose compiled code awaits, still throws. A template compiled with `codegenMode: 'async'` by 2.12.3 keeps the error until it is compiled again. A tag registered with setTag whose compiled code writes `await` on a line after a quote that is not part of a single- or double-quoted string literal (in a regular expression, a comment or a template literal), with another quote of the same kind later on that line, is no longer seen as awaiting: on the async render path a for loop or its else or empty branch, a with, filter, apply or set block, a swig-django spaceless block or a macro (also one that is never called) holding such a tag then fails to compile with a SyntaxError, where 2.12.3 rendered the loop or the block and a template that only defines the macro, and threw the macro error when the macro was called.
* **Fixed — templates compiled by an earlier release.** Templates compiled by 2.12.3 or earlier keep their old reads for these fixes until they are recompiled with 2.12.4: in native swig, swig-twig and swig-jinja2 the compiler decides each read these entries change, and in swig-django it decides `{{ __k }}` in a one-name loop and `Math is None` on a key that holds null. swig-django's reading of a function an object gets from Object.prototype as missing (`{{ toString }}`, `{{ o.toString }}`, `{% if toString %}`) is decided by its runtime and reaches such templates at once, except after a loop over that name, where such a template puts the function back as a key of the context (`[{{ toString }}]{% for toString in xs %}{% endfor %}[{{ toString }}]` renders `[][[object Object]]` until it is recompiled). A template compiled by 2.12.4 keeps its new reads on the 2.12.3 runtime, except in swig-django, whose 2.12.3 runtime still calls those functions. Recompile precompiled templates (swig compile output, registerBundle bundles, stored precompile() results) with 2.12.4.

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
