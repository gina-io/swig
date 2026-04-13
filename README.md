Swig
====

[![CI](https://github.com/gina-io/swig/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/gina-io/swig/actions/workflows/ci.yml) [![NPM version](http://img.shields.io/npm/v/@rhinostone/swig.svg?style=flat)](https://www.npmjs.org/package/@rhinostone/swig) [![NPM Downloads](http://img.shields.io/npm/dm/@rhinostone/swig.svg?style=flat)](https://www.npmjs.org/package/@rhinostone/swig) [![Socket Badge](https://socket.dev/api/badge/npm/package/@rhinostone/swig)](https://socket.dev/npm/package/@rhinostone/swig)

> **Maintained fork.** This is [gina-io/swig](https://github.com/gina-io/swig), a maintained fork of the abandoned [paularmstrong/swig](https://github.com/paularmstrong/swig). Security fixes and critical bug fixes land here; no new features are planned. The original project has not had a release since 2014.

> **Part of the [Gina](https://github.com/gina-io/gina) ecosystem.** This fork is the built-in template engine for [Gina](https://gina.io) ([npm](https://www.npmjs.com/package/gina)), a Node.js MVC framework with HTTP/2, multi-bundle architecture, and scope-based data isolation.

Swig is a **Jinja2/Django-inspired** template engine for node.js and browsers. The syntax will feel familiar to Jinja2 and Django users, but Swig is **not drop-in compatible** with either — porting templates from an existing project requires a handful of changes. See the [Migration Guide](https://gina.io/docs/swig/migration) for the full parity list and workaround patterns.

Features
--------

* Available for node.js **and** major web browsers!
* [Express](http://expressjs.com/) compatible.
* Object-Oriented template inheritance.
* Apply filters and transformations to output in your templates.
* Automatically escapes all output for safe HTML rendering.
* Lots of iteration and conditionals supported.
* Robust without the bloat.
* Extendable and customizable. See [Swig-Extras](https://github.com/paularmstrong/swig-extras) (abandoned, kept for reference) for some examples.

Need Help? Have Questions? Comments?
------------------------------------

* File an issue at [gina-io/swig/issues](https://github.com/gina-io/swig/issues).
* [Swig v0.x → v1.x migration notes](https://github.com/paularmstrong/swig/wiki/Migrating-from-v0.x.x-to-v1.0.0) — original upstream wiki, still authoritative for that version jump. (For porting *from Jinja2 or Django* into Swig, see the [Migration Guide](https://gina.io/docs/swig/migration) below.)

Installation
------------

    npm install @rhinostone/swig

Documentation
-------------

User-facing documentation lives in the Gina Docusaurus site under the [Swig Template Engine](https://gina.io/docs/swig) section, maintained in [gina-io/docs](https://github.com/gina-io/docs) at `docs/swig/`. The JSDoc blocks in `lib/swig.js`, `lib/filters.js`, `lib/tags/`, and `lib/loaders/` remain the canonical source-of-truth for the public API and are mirrored into the Docusaurus pages.

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

Full parity tables and workaround patterns: **[Migration Guide](https://gina.io/docs/swig/migration)**.

How it works
------------

Swig reads template files and translates them into cached javascript functions. When we later render a template we call the evaluated function, passing a context object as an argument.

License
-------

MIT. Copyright (c) 2010-2016 Paul Armstrong and contributors, (c) 2026 Rhinostone. See [LICENSE](./LICENSE) for the full text and [AUTHORS](./AUTHORS) for the contributor roster.
