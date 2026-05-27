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

Supported surface
-----------------

Documented at release time. The full tag / operator / filter / test catalog
is enumerated in the [Jinja2 templating docs](https://github.com/gina-io/docs)
and in `lib/` once the carve lands.

Repository
----------

Source: [gina-io/swig/packages/swig-jinja2](https://github.com/gina-io/swig/tree/develop/packages/swig-jinja2). File issues and PRs at [gina-io/swig](https://github.com/gina-io/swig).

License
-------

MIT. See [LICENSE](https://github.com/gina-io/swig/blob/develop/LICENSE) in the monorepo root.
