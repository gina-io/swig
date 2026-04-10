Swig
====

[![NPM version](http://img.shields.io/npm/v/@rhinostone/swig.svg?style=flat)](https://www.npmjs.org/package/@rhinostone/swig) [![NPM Downloads](http://img.shields.io/npm/dm/@rhinostone/swig.svg?style=flat)](https://www.npmjs.org/package/@rhinostone/swig)

> **Maintained fork.** This is [gina-io/swig](https://github.com/gina-io/swig), a maintained fork of the abandoned [paularmstrong/swig](https://github.com/paularmstrong/swig). Security fixes and critical bug fixes land here; no new features are planned. The original project has not had a release since 2014.

Swig is a Django/Jinja-like template engine for node.js and browsers.

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
* [Migration Guide](https://github.com/paularmstrong/swig/wiki/Migrating-from-v0.x.x-to-v1.0.0) (original upstream wiki, still authoritative for 0.x → 1.x migrations).

Installation
------------

    npm install @rhinostone/swig

Documentation
-------------

API reference is generated from [JSDoc](https://jsdoc.app) comments inline in `lib/swig.js`, `lib/filters.js`, `lib/tags/`, and `lib/loaders/`. Run `make docs` to build and preview the static documentation site locally.

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

How it works
------------

Swig reads template files and translates them into cached javascript functions. When we later render a template we call the evaluated function, passing a context object as an argument.

License
-------

MIT. Copyright (c) 2010-2016 Paul Armstrong and contributors, (c) 2026 Rhinostone. See [LICENSE](./LICENSE) for the full text and [AUTHORS](./AUTHORS) for the contributor roster.
