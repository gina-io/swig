@rhinostone/swig-django
=======================

[![NPM version](https://img.shields.io/npm/v/@rhinostone/swig-django.svg?style=flat)](https://www.npmjs.com/package/@rhinostone/swig-django) [![Socket Badge](https://socket.dev/api/badge/npm/package/@rhinostone/swig-django)](https://socket.dev/npm/package/@rhinostone/swig-django)

Django Template Language frontend for the [@rhinostone/swig-core](https://www.npmjs.com/package/@rhinostone/swig-core) template engine. Part of the multi-flavor architecture introduced in `2.0.0` — see [ROADMAP.md](https://github.com/gina-io/swig/blob/develop/ROADMAP.md) for the release narrative.

Installation
------------

    npm install @rhinostone/swig-django

This pulls in `@rhinostone/swig-core` as a peer dependency, pinned to the matching version. Frontends and the core release in lockstep — do not mix versions.

Basic example
-------------

```js
var swig = require('@rhinostone/swig-django');

var out = swig.render('Hello, {{ name|upper }}!', {
  locals: { name: 'world' }
});
// => Hello, WORLD!
```

Supported surface (as of 2.7.0)
-------------------------------

Renders real Django templates — everything below was cross-checked against Django 5.2.

* **Tags** — `if` / `elif` / `else`, `for` / `empty` (with `forloop`), `block`, `extends`, `include`, `with`, `autoescape`, `spaceless`, `comment`, `verbatim`, `cycle`, `firstof`.
* **Variable resolution** — Django-faithful attribute / dictionary / index lookup. Callable attributes are auto-called (honoring `alters_data` / `do_not_call_in_templates`), numeric indexing works (`{{ list.0 }}`), and dicts iterate via `.keys` / `.values` / `.items`.
* **Filter arguments** — Django colon syntax (`{{ value|date:"Y-m-d" }}`).
* **Filters** — 42 built-ins (`add`, `addslashes`, `capfirst`, `center`, `cut`, `date`, `default`, `default_if_none`, `divisibleby`, `escape` / `e`, `escapejs`, `filesizeformat`, `first`, `floatformat`, `force_escape`, `get_digit`, `iriencode`, `join`, `last`, `length`, `linebreaks`, `linebreaksbr`, `linenumbers`, `ljust`, `lower`, `make_list`, `phone2numeric`, `pluralize`, `rjust`, `safe`, `slice`, `slugify`, `striptags`, `time`, `title`, `truncatechars`, `truncatewords`, `upper`, `urlencode`, `wordcount`, `wordwrap`, `yesno`). See `lib/filters.js` for the full list.
* **Async** — `renderFileAsync` / `compileFileAsync` for async loaders, plus `renderFile(path, locals, cb)` against a loader with `async === true`.

Explicitly unsupported (parse-time throw or absent)
---------------------------------------------------

* No sandboxed-rendering mode — template source is trusted.
* `{% load %}` and custom tag libraries — no code-loading.
* `{% url %}`, `{% static %}`, `{% csrf_token %}`, `{% trans %}`, `{% blocktrans %}` — framework infrastructure, out of scope.
* No whitespace-control (`{%- … -%}`) — not part of the Django Template Language.
* No `is` tests — Django's `is` is identity comparison, not Jinja2-style tests.
* `{{ block.super }}`, `{% for … reversed %}`, and one-variable `{% for x in dict.items %}` are deferred (clear parse-time errors).
* Deferred filters — `dictsort` / `dictsortreversed`, `stringformat`, `random`, `urlize` / `urlizetrunc`, `timesince` / `timeuntil`, `unordered_list`, `json_script`, `truncatechars_html` / `truncatewords_html`, `safeseq`, `pprint`.

Repository
----------

Source: [gina-io/swig/packages/swig-django](https://github.com/gina-io/swig/tree/develop/packages/swig-django). File issues and PRs at [gina-io/swig](https://github.com/gina-io/swig).

License
-------

MIT. See [LICENSE](https://github.com/gina-io/swig/blob/develop/LICENSE) in the monorepo root.
