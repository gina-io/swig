[2.9.3](https://github.com/gina-io/swig/tree/v2.9.3) / 2026-10-24
-----------------------------------------------------------------

* **Fixed** swig-jinja2 for loops bind their variables as Jinja2 does. One loop variable over a mapping binds each key, where it bound each value, so {% for x in d %}{{ x }}={{ d[x] }}{% endfor %} works as in Jinja2. Two loop variables over a list unpack each item, where they bound the index and the item, so {% for k, v in d|dictsort %} binds the key and the value: a pair gives its two values, a two-character string its characters, a two-key mapping its keys. An item that does not hold two values binds what it holds (a missing value renders empty, extra values are ignored), where Jinja2 raises. Two loop variables over a mapping still bind the key and the value, a swig extension (Jinja2 unpacks each key).

* **Fixed** swig-django for loops unpack two loop variables over a list as Django does, where they bound the index and the item: a pair gives its two values, a two-character string its characters, a two-key mapping its keys, so {% for k, v in pairs %} binds the key and the value. An item that does not hold two values binds what it holds (a missing value renders empty, extra values are ignored), where Django raises. Two loop variables over a mapping still bind the key and the value, a swig extension that {% for k, v in d.items %} relies on.

* **Fixed** swig-django for loops bind one loop variable over a dict to each key, as Django does, where it bound each value, so {% for x in d %}{{ x }}{% endfor %} renders the keys. {% for v in d.values %} still gives the values, {% for k in d.keys %} the keys and {% for k, v in d.items %} the key and the value.

[2.9.2](https://github.com/gina-io/swig/tree/v2.9.2) / 2026-10-24
-----------------------------------------------------------------

* **Security** swig-twig ranges and batch no longer build an array from a huge number in the data. a..b built one element per value up to its bound, and batch padded the last chunk up to its size, so a large bound or size from the data exhausted the heap and aborted the process; under a 256 MB heap 1e8 did so within a second. A range whose values reach 2^53 (9007199254740992), where adding 1 no longer changes a number, never ended, so it aborted the process whatever the heap. A range of more than 1,000,000 elements is now empty, as for an infinite bound, and a batch size above 1,000,000 leaves the last chunk unpadded; smaller ranges and batches are unchanged. The limit is maxSize in the swig-core utils, whose range helper backs a..b. Every release since 2.0.0-alpha.3 has the batch padding and every release since 2.0.0-alpha.5 the ranges; reaching either takes an application that passes a number from the request into a range bound or a batch size.

* **Security** swig-jinja2 slice and batch no longer build an array from a huge number in the data. slice built one column per count, and batch padded the last row up to its size, so a large count or size from the data exhausted the heap and aborted the process; under a 256 MB heap a slice count of 1e7 or a batch size of 1e8 did so within a second. slice with more than 1,000,000 columns now returns an empty list, as for an infinite count, and a batch size above 1,000,000 leaves the last row unpadded; smaller counts and sizes are unchanged. Every swig-jinja2 release since 2.5.0 has both; reaching them takes an application that passes a number from the request into the filter.

[2.9.1](https://github.com/gina-io/swig/tree/v2.9.1) / 2026-10-23
-----------------------------------------------------------------

* **Fixed** The Express example (examples/express) no longer has its catch-all route, which rendered any .html file a URL named as a template, including files outside the views folder. Its pages link only to the explicit routes, which are unchanged. The example is not part of any package; an application built from it should remove or confine that route.

* **Changed** The test suite gains property-based tests, which check each property on many generated inputs: in every flavor the escape filter is idempotent and leaves no raw markup character, `{{ x }}` renders the escaped string, text with no tag renders unchanged apart from line endings, and any template filename reaches the loader unchanged through an include; the membership helper behind the `in` operator matches its definition on lists. They run with the new fast-check dev dependency (MIT, one dependency, pure-rand) under a fixed seed. Development and CI only; the published package is unaffected and its only runtime dependency remains @rhinostone/swig-core.

* **Security** swig striptags no longer takes time quadratic in the length of its input. On text with many < and no > after them it ran for about five seconds per 100 000 characters, so a template that applied it to request data could be made to block the event loop. It now runs in linear time with the same output. The regex dates from the original project, so every earlier release has it.

* **Security** swig-twig striptags and trim no longer take time quadratic in the length of their input. striptags ran for about five seconds per 100 000 characters on text with many < and no > after them, and trim took about as long on a long run of the trimmed characters inside the text, so a template that applied either to request data could be made to block the event loop. Both now run in linear time with the same output. Every swig-twig release since 2.0.0-alpha.3 has them.

* **Security** swig-jinja2 striptags, trim and format no longer take time quadratic in the length of their input. striptags ran for about five seconds per 100 000 characters on text with many < or <!-- and nothing closing them, trim took as long on a long run of the trimmed characters inside the text, and format longer still on a % followed by a long run of zeros. A template that applied one of them to request data could be made to block the event loop. All three now run in linear time with the same output (Jinja2 3.1.6 strips tags and trims these inputs in linear time). Every swig-jinja2 release since 2.5.0 has them.

* **Security** swig-django striptags, truncatewords, pluralize, slugify and floatformat no longer take time quadratic in the length of their input. striptags ran for about five seconds per 100 000 characters on text with many < and no > after them, truncatewords and pluralize took about as long on a long run of whitespace inside the value, slugify on a long run of underscores, and floatformat on an argument with a long run of g or u not at its end. A template that applied one of them to request data could be made to block the event loop. All five now run in linear time with the same output (Django 5.2.18 handles these inputs in linear time). Every swig-django release since 2.7.0 has them, except pluralize, which has had it since 2.8.2.

[2.9.0](https://github.com/gina-io/swig/tree/v2.9.0) / 2026-10-23
-----------------------------------------------------------------

* **Added** An OpenSSF Scorecard badge at the top of the README of each of the five packages. It shows the score that a Scorecard workflow publishes for the repository on every push to develop and every week, and links to the Scorecard report. Documentation only; no runtime or API change.

* **Added** swig-twig, swig-jinja2 and swig-django: the `not in` operator, as Twig, Jinja2 and Django have it. `x not in y` negates `x in y` and binds at the same level; where Django cannot run the test it is false, as Django gives it, and where Jinja2 raises swig gives true. Until now `x not in y` failed to parse. Native swig still rejects `not in`.

* **Fixed** swig-twig, swig-jinja2 and swig-django: the `in` operator tests membership as Twig, Jinja2 and Django do. In Jinja2 and Django a list holds an equal item, a string a substring and a mapping a key; in Twig a list or a mapping holds a value, compared loosely, and a string holds a string or number as a substring. Until now `in` was the JavaScript operator, which tests keys: `3 in [1, 2, 3]` was false, `0 in [5]` true, and `"b" in "abc"` threw. A test the reference engine cannot run (a number or null container, for instance) is false instead of an error. Native swig keeps the JavaScript `in`.

[2.8.4](https://github.com/gina-io/swig/tree/v2.8.4) / 2026-10-21
-----------------------------------------------------------------

* **Fixed** A filename option that is not a string, such as a number, compiles again with import, from and extends on the async render path, as it did in 2.8.2, and include, which failed with a number in 2.8.2 as well, now compiles too. 2.8.3 escaped the filename as a string before writing it into the compiled template, so a number failed with value.replace is not a function; the filename is now converted to a string first. All four frontends.

* **Fixed** The autoescape option of @rhinostone/swig now takes the name of an escape strategy, as documented: autoescape set to 'js' gives JavaScript escaping and 'html' HTML escaping. The option was written into the compiled template as code, so these values failed with ReferenceError: js is not defined, and an autoescape option built from untrusted input could run as code in the template. A value already wrapped in quotes keeps working, and a value holding a double quote or a line break is now rejected with an error. The Twig, Jinja2 and Django frontends already passed the option to the escape filter as a string.

[2.8.3](https://github.com/gina-io/swig/tree/v2.8.3) / 2026-10-21
-----------------------------------------------------------------

* **Security** The template compiler now escapes the including template filename (resolveFrom) before writing it into the compiled function body, so a double quote in a filename option can no longer break out of the generated string literal (GHSA-q89c). Escaping is centralized in the code generator, which also fixes a latent broken-JS bug for backslash paths through import, from and extends.

[2.8.2](https://github.com/gina-io/swig/tree/v2.8.2) / 2026-10-20
-----------------------------------------------------------------

* **Fixed** SECURITY.md's supported-versions table now names 2.8.x as the supported release line; it still listed 2.7.x.

* **Fixed** The issue and pull-request templates no longer open with the original project's "Swig is no longer maintained" notice. The issue template asks for the package and version, the environment, and a template with locals that reproduces the problem, and sends security reports to SECURITY.md; the pull-request template points to the develop branch and the test, lint and bundle checks.

* **Fixed** The README no longer says a callback to compileFile is enough to load templates through an async loader: compileFile also needs codegenMode set to async in its options, as its API documentation says, while renderFile switches on loader.async alone. It now also says that, in that mode, the compiled function returns a promise of { output, exports }. The README's documentation section now names packages/swig-core/lib/loaders/, where the loader JSDoc lives, instead of the one-line lib/loaders/ re-exports, and the swig-jinja2 and swig-django READMEs lead with renderFile against an async loader and mark renderFileAsync and compileFileAsync as deprecated.

* **Fixed** A template compiled with codegenMode set to async no longer shares its cache entry with a sync compile of the same file. A sync render or include of a file first compiled in async mode now renders its output instead of [object Promise], and an async-mode compile after a sync one now returns an async function instead of the cached sync one. The fix is in the shared engine, so all four frontends get it; the async entry is cached under its own key.

* **Fixed** An error raised while a template is compiled is now reported when render, compile or precompile is called without an options object; it used to surface as TypeError: Cannot read properties of undefined (reading 'filename'), hiding the template error. An error whose message already names the template file, such as Multiple "else" branches in "if" tag in file page.html, now names it once instead of twice, and an error with no file name to add is thrown unchanged instead of being wrapped again with an "Error: " prefix and a doubled period. All four frontends.

* **Fixed** The varControls, tagControls and cmtControls options are rejected when a control is not a string, with the message Option "<name>" must be an array containing 2 different control strings. A number or a nested array used to pass validation and fail at the first render with str.replace is not a function, and null failed inside the validator with a TypeError. All four frontends.

* **Fixed** The error for a control option that is too short now names the right control: a short open control is reported as the open control and a short close control as the close control; the two words were swapped. All four frontends.

* **Fixed** Jinja2 first, last, reverse, unique, min, max and slice now use the keys of a mapping, as Jinja2 iterates a mapping. first and last give the first and last key, reverse gives the keys in reverse order, unique the unique keys, min and max compare the keys, and slice distributes them; they used the values before. sum and random keep their results on a mapping, where Jinja2 raises.

* **Fixed** Jinja2 batch now follows Jinja2. A new row starts when the current one holds exactly size items, so a size of 0 gives an empty first row and a size that no row length can equal (negative, fractional or not a number) gives a single row; batch returned an empty list for a size of 0, a negative size or one that is not a number, rounded a fractional size up, and read a numeric string such as "2" as a number. A string is now batched by its characters and a mapping by its keys; batch returned an empty list for a string and used the values of a mapping. The fill pads the last row only up to a finite numeric size.

* **Fixed** Jinja2 sort of a string now returns its characters as a sorted list, as Jinja2 does; it joined them back into a string, so "cba" gave "abc" where Jinja2 gives ["a", "b", "c"].

* **Fixed** Jinja2 replace now follows Python. A number input is converted to a string first, so 5|replace("5", "X") gives "X" where it returned the number 5; an empty search string inserts the replacement before each character and at the end, honouring the count, so "abc"|replace("", "X") gives "XaXbXcX" where it returned "abc"; and a negative count replaces every occurrence, where it replaced none.

* **Fixed** Jinja2 format now prints %e and %E with at least two exponent digits, as Python does, so 12345.678 gives "1.234568e+04" where it gave "1.234568e+4". %g and %G now follow Python too: the precision (6 by default) counts significant digits, the number is printed in fixed notation when its decimal exponent is at least -4 and below the precision and in exponential notation otherwise, and trailing zeros are removed; they printed the number as JavaScript does, so 1234567 gave "1234567" where Python gives "1.23457e+06".

* **Fixed** swig-jinja2 wordwrap keeps the separating space when a line is exactly full before a long word, as Python textwrap does, so the output is "abcd |xxxxx|xxxxx" where it was "abcd|xxxxx|xxxxx".

* **Fixed** Django join now joins the characters of a string and the keys of a mapping, as Django does. It returned a string unchanged, so "abc"|join:"," gave "abc" where Django gives "a,b,c", and it returned a mapping itself, which rendered as [object Object].

* **Fixed** Django pluralize now reads its input as Django does. A boolean is compared with 1, so true gives the singular and false the plural, where both gave the empty string; a string must parse as a Python float, so "abc" and the empty string give the empty string where they gave the plural, and "1_000" gives the plural where it gave the singular; a mapping counts its keys, so an empty mapping gives the plural where it gave the empty string.

* **Fixed** Django truncatechars and truncatewords now return the empty string for a count of 0 or less, as Django does, where truncatechars gave the ellipsis alone and truncatewords kept a word or added an ellipsis ("a"|truncatewords:0 gave " …"). They also read the count as Python int() does, so a count string int() rejects, such as "3abc" or "2.5", returns the value unchanged where swig truncated on its leading digits.

* **Fixed** The Jinja2 lower and upper tests now need a cased letter, as Python's islower and isupper do: an empty string, digits, punctuation, whitespace or an uncased script such as Chinese is neither lower nor upper, and so is a null or missing variable; they used to be both.

* **Fixed** The Jinja2 odd test now follows Python's n % 2 == 1, so a non-integer such as 1.5, or an infinity, is not odd, as in Jinja2; it used to call them odd. A negative odd integer is still odd.

* **Fixed** The Jinja2 number test now accepts NaN, as Python's numbers.Number does; it used to reject it.

* **Fixed** Parenthesized sub-expressions keep their grouping when a template compiles, in every flavor. Since 2.0.0-alpha.2 the emitted JavaScript could lose the parentheses of a group, so a group whose operator binds more loosely than the operator outside it was evaluated wrongly ({{ (1 + 2) * 3 }} rendered 7, and {% if (x or y) and z %} took its branch with x true and z false), as were a comparison grouped inside a comparison and a subscript on a + group (("a" + "b")[1] rendered aundefined), and {{ -(-x) }} failed to compile. A group that JavaScript reads the same way without the parentheses, not (...), -(...) and a group followed by a filter rendered correctly.

* **Fixed** swig-jinja2 applies a unary minus or plus before the filters and the ** that follow it, as Jinja2 does: {{ -x|abs }} is the absolute value of -x, so it gives 5 for x 5 where it gave -5, and -2 ** 2 is (-2) ** 2, so it gives 4 where it gave -4.

* **Fixed** swig-jinja2 reads a chain of ** from the left, as Jinja2 does: 2 ** 3 ** 2 is (2 ** 3) ** 2, so it gives 64 where it gave 512.

* **Fixed** swig-jinja2 binds a test to the operand next to it, as Jinja2 does: {{ 1 + 2 is number }} tests 2, so it gives 2 where it gave true, and {% if not x is defined %} negates the test, so it is false for a defined x where it was true. A test also takes one argument without parentheses, as in Jinja2 (x is divisibleby 3, x is sameas false), where that threw an Unexpected token error.

* **Fixed** swig-jinja2 gives not its Jinja2 level, below the comparisons and arithmetic: {% if not x == y %} is not (x == y), so it is true for x 1 and y 2 where it was false, and {% if not x + y %} negates the sum, so it is false for x 0 and y 1 where it was true. A not in another operand position (x == not y) still binds its operand.

* **Fixed** The error messages of the prototype-chain guards, in every package, end with (prototype-chain guard) instead of (CVE-2023-25345). That CVE is the directory traversal through include and extends that 2.7.1 fixed in the filesystem loader, whose message keeps the label; the guards block access to __proto__, constructor and prototype. Code that matched the old text has to match the new one.

* **Fixed** swig-core, swig-twig, swig-jinja2 and swig-django export their version as a string, as swig always has; the property was undefined.

* **Changed** Upgraded the globals dev dependency, which the ESLint config reads, from 16.x to 17.x. Its node global set drops DisposableStack, AsyncDisposableStack and SuppressedError, which no linted file uses, and its mocha set is unchanged, so make lint reports the same clean result.

* **Security** swig-jinja2 wordwrap no longer hangs on a width below 1. A width of 0 or less, given as a number or as a string such as "0", ran for four to six seconds and took more than 2 GB of memory before a RangeError; it now returns the input unchanged (Jinja2 raises). A width between 0 and 1, which hung the same way, now breaks one character at a time, as Python does. Every swig-jinja2 release since 2.5.0 has the hang; reaching it takes an application that passes a width from the request into the filter.

* **Security** swig-twig ranges no longer hang on an infinite bound. With a bound of Infinity, which plain JSON produces for a number such as 1e999, a..b looped until the array overflowed, taking up to about three seconds and more than 2 GB of memory before a RangeError. The range is now empty, as it already was for NaN (PHP 8.3 rejects such a bound). Every release since 2.0.0-alpha.5 has the hang; reaching it takes an application that passes a number from the request into a range bound.

[2.8.1](https://github.com/gina-io/swig/tree/v2.8.1) / 2026-10-20
-----------------------------------------------------------------

* **Added** A "What's new in v<version>" section at the top of the README, regenerated from the release notes at every cut

* **Fixed** Refreshed stale README claims — the benchmark summary now reflects the latest measured run (swig leads on all five workloads; the previous table predated the 2.2.0 escape-filter rewrite and showed nunjucks ahead on simple var output), and the security bullet no longer pins an exact CVE regression-test count nor conflates the prototype-chain hardening with CVE-2023-25345 (a directory-traversal fix)

* **Fixed** README completeness pass against the 2.x release line — the feature list now covers the async-loader render path (callback dispatch with loader.async, dynamic extends included) and the single-runtime-dependency posture, the "How it works" section explains the runtime-only strict-CSP path, and the Jinja2/Django migration notes no longer list the default filter as absent (it has been built into native swig since upstream 2014)

* **Fixed** The v0.9.0 changelog entry's PHP date-format citation now links to the canonical `https://www.php.net/manual/en/function.date.php` instead of the plain-HTTP `http://php.net/date` it had carried since upstream. The old form still resolves — it 301s through to exactly that URL — so this is the same destination over HTTPS, with the link text unchanged; it removes the last plain-HTTP link a link-health scan can flag in this repo (reported twice, gina-io/gina#51 and #58). Documentation only; no runtime or API change.

* **Fixed** The bundled DateZ attribution banner now points at `https://github.com/tn0ms/DateZ`, following the fourth rename of that upstream account. The previous `tomoio` form still resolves — GitHub 301s a renamed account through to its current owner — so this is the same destination, with the misspelled upstream `LISENCE` filename preserved because that is genuinely how the file is named there. The banner ships in every `dist/` artifact, so the corrected URL reaches consumers at the next publish. Documentation only; no runtime or API change.

* **Changed** Upgraded the ESLint dev dependency from 9.x, which its maintainers no longer support, to 10.x. The flat-config eslint.config.js carries over unchanged, and make lint reports the same results as under 9.x. ESLint 10 raises the lint toolchain Node floor to ^20.19.0, ^22.13.0 or >=24, which affects development and CI only; the published package is unaffected and its only runtime dependency remains @rhinostone/swig-core.

[2.8.0](https://github.com/gina-io/swig/tree/v2.8.0) / 2026-08-02
-----------------------------------------------------------------

* **Added** AOT template registration — swig.register(path, fn) and swig.registerBundle(map) on every flavor store pre-compiled templates in the template cache under loader-normalized keys, wrapped in the locals-binding call shape include expects (priming via swig.run cached the raw template function, which crashed included partials that used variables or filters); swig compile --recursive --register emits a self-registering browser bundle

* **Added** Runtime-only browser build — dist/swig.runtime.js and dist/swig.runtime.min.js execute pre-compiled template bundles (register, registerBundle, run, compileFile, renderFile with the native filter catalog and a root-based memory loader) and ship no parser and no new Function, so pages under a strict Content-Security-Policy without unsafe-eval can render AOT-compiled templates; also exposed to Node as require("@rhinostone/swig/runtime")

* **Fixed** Updated the stale `/docs/swig` and `/docs/swig/migration` documentation links to their canonical `/docs/templating/swig` and `/docs/templating/swig/migration` paths in `README.md` (4 occurrences) and `CONTRIBUTING.md` (1 occurrence) (2026-06-15 link-health scan, gina-io/gina#39). The old URLs still resolved via the 301 redirects added in the 2026-04-23 Templating umbrella restructure, but were no longer canonical and kept accruing redirect hops. Documentation only; no runtime or API change.

* **Fixed** Refreshed two stale external URLs flagged by the 2026-06-22 / 2026-06-29 link-health scans (gina-io/gina#43). `README.md` now links to `https://expressjs.com/` instead of the plain-HTTP `http://expressjs.com/` (the domain 301-redirects HTTP to HTTPS). `browser/comments.js` updates the DateZ `@license` URL from `github.com/ocrybit/DateZ` to `github.com/tomoio/DateZ` — the upstream GitHub user was renamed again (same class as the v2.0.0 `TomoUniversalis` to `ocrybit` rename); the target repo keeps the upstream `LISENCE` spelling. Documentation and comment-only; no runtime or API change.

* **Fixed** De-linked the two remaining live references to the archived `paularmstrong/swig` repository (GitHub topic `unmaintained-dont-use`, last released 2014), flagged by the 2026-07-06 link-health scan (gina-io/gina#47). `README.md` no longer links the "abandoned `paularmstrong/swig`" mention to the archived repo root, and `CONTRIBUTING.md` de-links the "Pull Request 273" historical example (a PR on the archived repo, where contributions are disabled) — both references are preserved as plain text for traceability, matching the de-linking house style from the gina-io/gina#18 and #33 link-health fixes. Documentation only; no runtime or API change.

* **Fixed** Several template-cache paths failed silently and now report the problem. The memory loader rejects a climbing path when a basepath is set, instead of resolving it to a different template than the one requested — with a root basepath it clamped and rendered the wrong file, mirroring the confinement the filesystem loader already enforces. Passing a filepath to run stores the same locals-binding wrapper, under the same resolved key, that a cache lookup expects, so a template primed that way is usable by a later include rather than crashing on the raw function argument shape. The memory cache no longer reads inherited object members, so an identifier-style loader cannot resolve a name such as constructor to a cache hit. Both minified bundles now point at the source map filename that is actually written.

[2.7.3](https://github.com/gina-io/swig/tree/v2.7.3) / 2026-06-10
-----------------------------------------------------------------

* **Fixed** Fixed a filter-chain argument leak in the expression parsers — the per-filter argument accumulator was function-scoped and never reset between iterations, so an arg-bearing filter earlier in a chain leaked its arguments onto a later no-arg filter (e.g. `x|default("y")|upper` lowered `upper` with the leaked `["y"]`). Affected nested and parenthesized chains in the shared core parser and all filter chains in the Twig and Jinja2 frontends; the Django frontend shipped the per-iteration reset at carve time.

[2.7.2](https://github.com/gina-io/swig/tree/v2.7.2) / 2026-06-09
-----------------------------------------------------------------

* **Fixed** The filesystem loader no longer rejects in-root `include` / `extends` / `import` paths when the `basepath` is a relative path. The CVE-2023-25345 root confinement added in 2.7.1 compared each (always-absolute) resolved template path against a `basepath` that was only normalized, so a relative `basepath` matched nothing and every in-root path was wrongly rejected. The `basepath` is now resolved to an absolute path before the check; confinement for absolute basepaths and the escape / prefix-bypass rejections are unchanged.

[2.7.1](https://github.com/gina-io/swig/tree/v2.7.1) / 2026-06-08
-----------------------------------------------------------------

* **Security** The filesystem loader now confines `include` / `extends` / `import` path resolution to the configured loader root. When a `basepath` is set, template paths that resolve outside that root — including paths supplied by an untrusted runtime variable such as `{% include userVar %}` — are rejected, closing a directory-traversal arbitrary-file-read vector (CVE-2023-25345). A new `allowOutsideRoot` loader option opts out for templates that intentionally read files from outside the root.

[2.7.0](https://github.com/gina-io/swig/tree/v2.7.0) / 2026-06-07
-----------------------------------------------------------------

* **Added** `@rhinostone/swig-django` is a new Django Template Language frontend for the `@rhinostone/swig-core` engine — the fourth flavor in the multi-flavor family alongside the native, Twig, and Jinja2 frontends. It renders real Django templates: the full built-in tag set (`for`/`empty` with `forloop`, `if`/`elif`/`else`, `block`/`extends`/`include`, `with`, `autoescape`, `spaceless`, `comment`, `verbatim`, `cycle`, `firstof`), ~42 built-in filters with colon-argument syntax such as `{{ value|date:"Y-m-d" }}`, a Django-faithful variable resolver (auto-calls callable attributes while honoring `alters_data`/`do_not_call_in_templates`, numeric indexing like `{{ list.0 }}`, and `.keys`/`.values`/`.items` dict iteration), and async loader support via `renderFile(path, locals, cb)`. Installs as `npm install @rhinostone/swig-django`.

* **Fixed** De-linked the dead `paularmstrong/swig` issue and pull-request references in `HISTORY.md` and the matching `.changes/v*.md` fragments (2026-06-01 link-health scan, gina-io/gina#33). The upstream repository remains but its issue tracker is disabled, so the inline `[gh-N](...)` links are now plain `gh-N` text — every reference is preserved for historical traceability, and the fragments are edited in lockstep with `HISTORY.md` to keep `changie merge` idempotent. Documentation / changelog only; no runtime or API change.

[2.6.0](https://github.com/gina-io/swig/tree/v2.6.0) / 2026-06-03
-----------------------------------------------------------------

* **Changed** The native `json` / `json_encode` filters now HTML-escape their output (`<`, `>`, `&`, `'`) and are marked safe, so `{{ data|json }}` renders valid JSON that is safe to embed directly inside a `<script>` block instead of `&quot;`-escaped text. `url_encode` is now marked safe as well — its output never contains HTML-significant characters. `url_decode` is unchanged — its output remains autoescaped, since decoded content can contain HTML.

* **Changed** Replaced the `expect.js` test-assertion dev dependency with a small in-repo shim (`tests/lib/expect.js`) that reproduces the subset of its API the suite uses, with verified behavioral parity. Dev-only — the published packages are unaffected (their only runtime dependency remains `@rhinostone/swig-core`), and the full test suite plus the CVE-2023-25345 regressions pass unchanged. `npm audit` was already clean (`expect.js` is zero-dependency and advisory-free), so this is dependency-hygiene polish, not a security fix.

[2.5.3](https://github.com/gina-io/swig/tree/v2.5.3) / 2026-06-02
-----------------------------------------------------------------

* **Changed** Dynamic `{% extends %}` on the synchronous render path now throws a clear error pointing to the async render path (`renderFile` with `loader.async === true`), instead of a generic "template not found" / "no filename" error. Dynamic extends has always required the async render path — this only improves the diagnostic. Applies to all flavors via the shared engine.

[2.5.2](https://github.com/gina-io/swig/tree/v2.5.2) / 2026-06-02
-----------------------------------------------------------------

* **Fixed** Dynamic `{% extends %}` paths (e.g. `{% extends layout_var %}`) now resolve on the async-loader render path (`renderFile(path, locals, cb)` with `loader.async`) in `@rhinostone/swig-twig` and `@rhinostone/swig-jinja2`, matching native swig and real Twig/Jinja2. Static string-literal extends and the synchronous render path are unchanged.

* **Fixed** Dynamic `{% extends %}` paths (e.g. `{% extends layout_var %}`) now resolve on the async-loader render path (`renderFile(path, locals, cb)` with `loader.async`); previously a dynamic parent path produced a garbage template lookup. Static string-literal extends and the synchronous render path are unchanged.

[2.5.1](https://github.com/gina-io/swig/tree/v2.5.1) / 2026-05-28
-----------------------------------------------------------------

* **Fixed** Restored the JSDoc blocks on the top-level Swig public API methods (setFilter, setTag, setExtension, precompile, compile, compileFile, render, renderFile, run, invalidateCache) that were inadvertently stripped from lib/swig.js when the Swig constructor body was carved into @rhinostone/swig-core/lib/engine.js. The documentation comments now sit above the corresponding exports.* re-exports where make build-docs and IDE hover tooling read them. No runtime behavior change — the published lib/ code is byte-identical and only the JSDoc surface is updated.

* **Changed** Rephrased two stale internal-process tracker references in lib/tags/set.js source comments that survived the prior single-line audit sweep because the markers spanned a line wrap. The explanatory content is preserved verbatim; only the dead tracker tokens are dropped, per the in-repo no-internal-markers-in-shipping-source convention. No behavior change.

* **Changed** Migrated the test toolchain from mocha 1.12.0 to the Node.js built-in test runner (node:test) with built-in line coverage, removing the mocha, blanket, and travis-cov dev dependencies. This clears all 6 npm audit advisories (4 high, 2 critical) that were rooted in mocha's transitive dependency tree; the full suite passes unchanged and the 95% coverage gate over lib/ is preserved. The published package is unaffected — its only runtime dependency remains @rhinostone/swig-core.

* **Changed** Removed the unmaintained phantomjs and mocha-phantomjs browser-test toolchain, dropping the vulnerable form-data (CVE-2025-7783) and the rest of the legacy request dependency subtree from the dev dependency tree. Browser parity is verified through the production bundle build, pending a modern browser-test harness.

* **Changed** Upgraded the ESLint dev dependency from 8.57.1 to 9.x and migrated the lint configuration from the deprecated .eslintrc.json (eslintrc format) to the flat-config eslint.config.js, adding the globals dev dependency. The lenient rule set is preserved exactly (no indent enforcement, eqeqeq/no-eval/no-new-func off, semi always, max-len 600, plus an explicit linterOptions.reportUnusedDisableDirectives off to match the eslintrc default). ESLint 9 raises the lint toolchain Node floor to >=18.18, which affects development and CI only; the published package is unaffected and its only runtime dependency remains @rhinostone/swig-core.

* **Changed** Upgraded the example/development express dependency from the abandoned 3.x line to 4.x, dropping the vulnerable transitive morgan (CVE-2019-5413) and the legacy connect subtree from the dev dependency tree. The Express view-engine example runs unchanged. The published package is unaffected; its only runtime dependency remains @rhinostone/swig-core.

* **Changed** Upgraded the development lodash dependency from 1.3.x to 4.x, dropping the prototype-pollution and command-injection advisories (affecting lodash through 4.17.23) from the dev dependency tree. lodash is a test-only utility and the full suite passes unchanged on 4.x. The published package is unaffected; its only runtime dependency remains @rhinostone/swig-core.

[2.5.0](https://github.com/gina-io/swig/tree/v2.5.0) / 2026-05-27
-----------------------------------------------------------------

* **Added** @rhinostone/swig-jinja2 — a Python Jinja2-syntax frontend on the shared swig-core engine (13 tags, 39 filters, 16 is-tests, async loader support, autoescape and CVE-2023-25345 guards inherited from swig-core). Releases in lockstep with @rhinostone/swig, @rhinostone/swig-core, and @rhinostone/swig-twig.

[2.4.3](https://github.com/gina-io/swig/tree/v2.4.3) / 2026-05-22
-----------------------------------------------------------------

* **Fixed** Native `import` no longer leaks an imported file's own import aliases into the importing template's context. A file-level `{% import %}` inside an imported file is now re-homed under the importing alias instead of emitted bare, so it cannot clobber a same-named variable in the caller, corrupt a macro when the caller later reassigns that name, or cascade across import depth. Macros still resolve their own file's imports at call time.

[2.4.2](https://github.com/gina-io/swig/tree/v2.4.2) / 2026-05-22
-----------------------------------------------------------------

* **Fixed** @rhinostone/swig-twig macros now resolve macros that were imported at the top of their own defining file, via either {% import %} or {% from %}. Previously such a call compiled to a binding that was never set up in the caller scope, so it rendered empty. Imports stay local to the template that declares them and are not leaked into the importing template, and resolution works recursively across import depth.

[2.4.1](https://github.com/gina-io/swig/tree/v2.4.1) / 2026-05-22
-----------------------------------------------------------------

* **Fixed** Macros now resolve macros that were imported at the top of their own defining file. Previously such a call compiled to a reference that was never set up in the caller scope, so it rendered empty instead of erroring. Resolves recursively across import depth. gh-2

[2.4.0](https://github.com/gina-io/swig/tree/v2.4.0) / 2026-05-15
-----------------------------------------------------------------

* **Added** Ternary (`a ? b : c`) and Elvis (`a ?: b`) operator support in template expressions, usable in `{{ }}` output and in tag arguments such as `{% if %}`, `{% set %}`, and `{% for %}`.

* **Fixed** `make coverage` now invokes mocha directly via `node node_modules/mocha/bin/_mocha` instead of the `node_modules/.bin/mocha` shim, which exits silently with no output on Node >= 18 — the 95% line-coverage gate is enforced again rather than silently passing.

* **Fixed** `swig compile -o <dir>` no longer re-throws `EEXIST` when the output directory already exists. The mkdir guard matched the legacy numeric errno 47, which no longer identifies EEXIST on modern Node; it now matches `e.code === 'EEXIST'`, the stable cross-version identifier.

[2.3.0](https://github.com/gina-io/swig/tree/v2.3.0) / 2026-05-14
-----------------------------------------------------------------

* **Changed** Drop `yargs` and `terser` from production `dependencies`. CLI argument parsing now uses a small built-in zero-dependency parser; `terser` (used only by `swig compile --minify`) is loaded lazily and moves to `devDependencies`. A library install of `@rhinostone/swig` now pulls in only `@rhinostone/swig-core`.

[2.2.0](https://github.com/gina-io/swig/tree/v2.2.0) / 2026-05-11
-----------------------------------------------------------------

* **Added** `renderFile(path, locals, cb)` and `compileFile(path, options, cb)` automatically route to the async-codegen path when the configured loader signals async support via `loader.async === true`. The async path defers template resolution from parse time to render time via a new `_swig.getTemplate(path, options)` runtime helper that returns `Promise<TemplateFn>` — `extends`, `include`, `import`, and `from` emit deferred IR shapes from the frontend (`IRExtendsDeferred`, `IRIncludeDeferred`, `IRImportDeferred`, `IRFromImportDeferred`) and the shared backend wraps the compiled body in an `AsyncFunction`. Block overrides thread through the inheritance chain via a sixth `_blocks` positional argument on the wrapped template function; macro imports pick up exports via the new `Promise<{output, exports}>` template-fn return shape. Both `@rhinostone/swig` and `@rhinostone/swig-twig` flavors — parity across the two surfaces. Static template targets (string literals in `extends` / `include` / `import` / `from`) work end-to-end against async loaders; dynamic targets (`{% extends parent_var %}`, `{% include user_template %}`) are not yet supported on the async path and surface a clear runtime error with the unresolved expression visible in the message — full dynamic-target support is tracked as a follow-up. The sync render path is unchanged — loaders without `loader.async === true` continue to use the established sync `_swig.compileFile(...)` resolution, including the built-in `loaders.fs` and `loaders.memory` which remain dual-mode. End-to-end coverage at `tests/async/render-file-cb-dispatch.test.js` (native, 11 cases) and `tests/swig-twig/async/render-file-cb-dispatch.test.js` (Twig, 11 cases) covers static extends chains, includes, macro imports, mixed graphs, dynamic include paths surfacing the runtime error, the `ignoreMissing` flag, `with-context` isolation, bare-name and aliased `from` import, and error propagation.

* **Changed** `renderFileAsync(path, locals, cb)` and `compileFileAsync(path, options, cb)` on both `@rhinostone/swig` and `@rhinostone/swig-twig` are soft-deprecated via JSDoc only — no runtime warning, no `console.warn`. Use `renderFile(path, locals, cb)` / `compileFile(path, options, cb)` with an async loader (`loader.async === true`) instead; the dispatch is automatic. The legacy pre-walker entry points remain fully functional in 2.x and will be removed in 3.0.

* **Changed** Improved the performance of the `escape` / `e` filter in both `@rhinostone/swig` and `@rhinostone/swig-twig`. The HTML default branch now runs a two-pass form — an entity-aware first pass that preserves already-escaped sequences (`&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`) followed by a single character-class regex `[<>"']` with a lookup function for the rest — instead of five sequential single-character regex passes. A scalar fast-path also skips `iterateFilter.apply` when input is null, undefined, or a non-object. Output is byte-identical to the previous behavior on every input, including the entity-preservation semantics swig has shipped since the upstream fork. Measured against `benchmarks/render.js` (medians of 5 runs, autoescape on, Node 25), simple-var-output goes from ~2.46M to 3.86M ops/s (+57%, flipping the verdict from `nunjucks 1.32x faster` to `swig 1.18x faster`); filter chain +37%; for-loop (5 items) +54%; if/else branch +71%; nested for+if+filter +56%. The `case 'js'` branch and array-iteration fallback through `iterateFilter` are unchanged. All 1443 tests pass including the 9 CVE regressions.

[2.1.0](https://github.com/gina-io/swig/tree/v2.1.0) / 2026-05-10
-----------------------------------------------------------------

* **Added** `@rhinostone/swig` and `@rhinostone/swig-twig` gain `renderFileAsync(path, locals, cb)` and `compileFileAsync(path, options, cb)` for use with async-only loaders (S3, Redis, CDN, fetch-backed). The implementation pre-walks the template dependency graph through the user loader's cb-shape arm (`loader.load(path, cb)`), builds an in-memory map keyed by resolved path, then runs the existing sync render path against an in-memory wrapper for the duration of the call. The pre-walker text-scans for `extends` / `include` / `import` (and Twig `from`) string-literal targets only — dynamic paths (`{% extends parent_var %}`) are not pre-resolved and surface a `Pre-walked map missing path` error at render time, with full async-parse support for dynamic paths tracked separately. Isolation strategy is transactional `self.options.loader` mutation for the duration of the sync render — safe under JS event-loop semantics because sync render never yields, so concurrent `renderFileAsync` calls don't interleave their render phases; documented caveat is not to externally mutate `swig.options.loader` mid-flight on the same instance while async renders are pending. Pre-walker modules live at `lib/async/pre-walker.js` (native) and `packages/swig-twig/lib/async/pre-walker.js` (Twig) — per-flavor copies because the rawTag (`raw` vs `verbatim`) and keyword set differ. Existing sync `renderFile` / `compileFile` consumers are unaffected.

* **Changed** Internal scaffolding for a future async parse path. `@rhinostone/swig-core` gains four deferred-resolution IR shapes (`IRExtendsDeferred`, `IRIncludeDeferred`, `IRImportDeferred`, `IRFromImportDeferred`) and matching backend emit branches that produce `AsyncFunction`-wrapped template bodies. The async emit flows through a new `_swig.getTemplate(<path>, options)` runtime helper that returns `Promise<TemplateFn>`, and async-mode template functions return `Promise<{output, exports}>` so importers can pick up macro definitions at runtime. Block override resolution rides on a new sixth `_blocks` positional parameter on the wrapped AsyncFunction. All gated behind an explicit `options.codegenMode === 'async'` flag — default is sync and no behavior changes for existing consumers; the frontend tag wiring and public API dispatch that would activate this path are not yet shipped. Mock coverage at `tests/swig-core/async-emit.test.js` (63 cases across the four deferred shapes plus macro exports and block override). ESLint `parserOptions.ecmaVersion` bumped to 2017 for the AsyncFunction literal.

* **Changed** Internal cleanup. `@rhinostone/swig-core` `IRVarRef` emit shape simplified from a nested-ternary dot-walk into a single-evaluation ternary expression with the same runtime semantics, producing smaller compiled bodies and easier-to-read `precompile().tpl.toString()` output. The legacy twin in `lib/tokenparser.js`'s `checkMatch` updated to match. Phase 2 byte-identity test rewritten to assert the new shape; multi-segment substring assertions still hold unchanged. New `benchmarks/` directory with a runnable render-throughput suite comparing `@rhinostone/swig` against Nunjucks (`benchmarks/render.js`), excluded from the published tarball via `.npmignore`. README clarifications surfaced the prototype-pollution hardening across CVE-2023-25345 / CVE-2021-44906 and added a benchmark pointer.

[2.0.1](https://github.com/gina-io/swig/tree/v2.0.1) / 2026-05-10
-----------------------------------------------------------------

* **Fixed** Fixed bracket-access expressions failing on unspaced binary arithmetic in both `@rhinostone/swig` and `@rhinostone/swig-twig`. The lexer NUMBER rule's optional sign prefix (`[+\-]?`) greedy-ate a leading operator inside bracket expressions — `arr[arr.length-1]` and `arr[idx-1]` lexed as VAR + DOTKEY/VAR + NUMBER(-1) + `]`, and parsePostfix then bailed with "Unexpected closing square bracket". Dropped the optional sign from both `lib/lexer.js` and `packages/swig-twig/lib/lexer.js`; parsePrimary's OPERATOR branch already wraps unary `-` / `+` as IRUnaryOp via parseUnary, so signed-literal paths (`{% set x = -5 %}`, `{{ a + -5 }}`) continue to work and the backend's emitUnaryOp produces byte-identical JS for negative numbers (the `emit('-1.5') === '-1.5'` round-trip is unchanged). Three pre-existing parse/lexer assertions documented the old "NUMBER rule, not UnaryOp" choice and were rewritten to assert the new IRUnaryOp shape; a regression suite covers `arr[arr.length-1]` / `arr[idx-1]` / `arr[idx+0]` / `arr[idx-2]` plus a `*` / `/` round-trip sweep on both render surfaces.

* **Fixed** Fixed missing whitespace-control parity in `@rhinostone/swig-twig`. `{{- … -}}` and `{%- … -%}` markers now strip surrounding whitespace at chunk boundaries, matching the native swig surface and the upstream Twig spec. Previously absent — `packages/swig-twig/lib/parser.js` had only a basic strip regex and no `varStripBefore` / `*After` / `tagStripBefore` / `*After` detection regexes, so `{{- foo -}}` either rendered as junk or threw "Unexpected end of expression". Implementation mirrors the native chunk-boundary pattern (`stripPrev` / `stripNext` flags, `stripPrevToken` helper) with the corrected strip-regex shape baked in from day one (`-?` adjacent to the open / close marker only, not after `\s*`), so negative-literal expressions like `{{ -5 }}` and `{{- -5 -}}` compose correctly. New `tests/swig-twig/whitespace.test.js` covers the six mirror-of-native cases (strips before / after / both, on `{{...}}` and `{%...%}`) plus four negative-literal composition cases. Same one-level-deep limitation as native — a `{%- endif %}` strips the trailing whitespace of the immediately enclosing tag's last child only, not deeper.

* **Fixed** Fixed `varStrip` / `tagStrip` regexes in `lib/parser.js` greedy-eating the leading `-` of negative-number expressions. The strip patterns were `^{{-?\s*-?|-?\s*-?}}$` (and the tag-form equivalent) — the second `-?` after `\s*` matched the leading `-` of an expression as if it were a whitespace-control marker, so `{{ -5 }}` and `{{ -1.5 }}` rendered as `"5"` / `"1.5"` (the sign was eaten before the lexer ever saw the chunk). Dropped the inner `-?` from both regexes; whitespace-control now fires only when `-` is immediately adjacent to the open / close marker (`{{-`, `-}}`, `{%-`, `-%}`), matching the standard Twig/Jinja2 contract. Existing whitespace strip-control tests continue to pass, and a new regression case covers negative literals plain, with strip-control before / after / both, plus a check that strip-control on regular variables still composes correctly. `@rhinostone/swig-twig` was unaffected — its parser-side strip regex (`packages/swig-twig/lib/parser.js`) is a simpler `^{{ \s*|\s* }}$` with no `-?` markers, so the same shape doesn't apply (a side-effect of the verification surfaced that swig-twig has no whitespace-control support today; tracked separately).

[2.0.0](https://github.com/gina-io/swig/tree/v2.0.0) / 2026-05-06
-----------------------------------------------------------------

* **Fixed** Refreshed stale external URL references across documentation surfaces from the 2026-04-13 link-health audit (gina-io/gina#18). `README.md`, `packages/swig-core/README.md`, `packages/swig-twig/README.md` — swapped `www.npmjs.org` for the canonical `www.npmjs.com` in the NPM badges (the old `.org` form now redirects). `README.md` — rewrote the "Swig v0.x → v1.x migration notes" bullet, since the `paularmstrong/swig/wiki/Migrating-from-...` page was deleted upstream (302s to repo root). `HISTORY.md` — dropped the three dead upstream-wiki links around the v1.0.0 / v1.0.0-pre1 entries; the breaking-change prose stays intact. `browser/comments.js` — updated the DateZ `@license` URL from `TomoUniversalis/DateZ` to `ocrybit/DateZ` (the upstream GitHub user was renamed). `packages/swig-core/lib/dateformatter.js` — dropped the dead `tomouniversalis.com` parenthetical from the DateZ copyright comment (domain NXDOMAINs). `.changes/v1.0.0.md` and `.changes/v1.0.0-pre1.md` synced to match the rewritten `HISTORY.md` lines so future `changie merge` runs stay idempotent. Documentation and comment-only; no runtime or API change.

* **Changed** `2.0.0` stable. Multi-flavor architecture (introduced across `2.0.0-alpha.1` through `2.0.0-alpha.5`) is the production-ready cut. No functional or API changes since `2.0.0-alpha.5`; the `alpha.6`–`alpha.8` cycle was metadata republishes plus removal of the soft-deprecated `exports.parse` Path B wrapper from `@rhinostone/swig-twig`. IR ABI is stable from this release onward; cross-package dependencies pin exact versions and frontends + core release in lockstep. README messaging refreshed across all three packages to reflect production-ready status; package descriptions cleaned of historical internal-tracking references.

[2.0.0-alpha.8](https://github.com/gina-io/swig/tree/v2.0.0-alpha.8) / 2026-04-20
---------------------------------------------------------------------------------

* **Changed** `@rhinostone/swig-twig` removes the soft-deprecated `exports.parse(source, options)` wrapper (Path B). Soft-deprecated since `2.0.0-alpha.4`; removed now so any remaining consumer surfaces during the alpha.8 bake window before `2.0.0` stable. Migrate to the per-instance API installed by `engine.install`: `new twig.Twig(opts)` (or the default instance `exports.precompile` / `exports.compile` / `exports.render` / `exports.renderFile`). The full-instance path uses closure-captured tag/filter maps and honors per-instance `setFilter` / `setTag` overrides; the Path B wrapper did not. Internal plumbing (`exports.parser.parse`, `exports.parseFile`) is unaffected.

[2.0.0-alpha.7](https://github.com/gina-io/swig/tree/v2.0.0-alpha.7) / 2026-04-20
---------------------------------------------------------------------------------

* **Changed** Source-comment cleanup pass across the workspace. No functional or API changes since 2.0.0-alpha.5; this is a metadata-only republish with commit messages and source comments tidied. Supersedes 2.0.0-alpha.6 (unpublished).

[2.0.0-alpha.6](https://github.com/gina-io/swig/tree/v2.0.0-alpha.6) / 2026-04-20
---------------------------------------------------------------------------------

* **Added** README.md files for @rhinostone/swig-core and @rhinostone/swig-twig so the npm landing pages and socket.dev have orientation content describing the alpha status, the shared-runtime relationship, and the supported Twig surface. Metadata-only release; no functional changes since 2.0.0-alpha.5.

[2.0.0-alpha.5](https://github.com/gina-io/swig/tree/v2.0.0-alpha.5) / 2026-04-19
---------------------------------------------------------------------------------

* **Added** `@rhinostone/swig-core` gains an `IRVarRefExists` IR node + backend emitter carrying a boolean defined-and-non-null signal for VarRef paths. Needed by Twig `is defined` / `is null` tests and by `??` undefined-fallback, both of which cannot use `IRVarRef` directly because `emitVarRef` coerces missing / `null` to `""`. `ir.varRefExists()` factory on the shared IR surface; `emitVarRefExists` dispatches in `emitExpr` and honors the `_dangerousProps` guard per segment. `checkDot` hoisted out of `checkMatchExpr` into a top-level `checkDotExpr` helper so `emitVarRef` and `emitVarRefExists` share the dot-walk shape; `checkMatchExpr`-emitted output stays byte-identical.

* **Added** `@rhinostone/swig-twig` `is <test>` / `is not <test>` now routes through `_ext._test_<name>(subject, ...args)`. VarRef subjects with `is defined` / `is null` special-case through `IRVarRefExists` to preserve the defined-or-not-null signal `emitVarRef` would otherwise coerce to `""`. Seven built-in test helpers ship at `packages/swig-twig/lib/tests/index.js` and register on every `Twig` instance via `setExtension`: `defined`, `null`, `empty`, `iterable`, `odd`, `even`, `divisibleby`. Closes the last Phase 4 runtime-parity gap on the render corpus — 11 new `is-*` render fixtures + a `null-coalesce` fixture exercising both branches land under `tests/swig-twig/cases/`.

* **Added** `@rhinostone/swig-twig` `..` range operator now lowers through `_utils.range`. Previously the parser lowered to an IR varRef of `_range`, which resolved to `_ctx._range` and silently fell through to `_fn` (returning `""`). Now emits `ir.fnCall(ir.varRef([_utils, range]), [start, end])`; the shared `@rhinostone/swig-core` backend reaches `_utils` via the 4th positional arg of the compiled template function. `@rhinostone/swig-core/lib/utils.js` adds `range(start, end)` with Twig-compatible inclusive-both-ends semantics for numeric + single-char-string bounds (ascending and descending). Three new render fixtures (`range-asc`, `range-desc`, `range-char`) under `tests/swig-twig/cases/`.

* **Added** `@rhinostone/swig-twig` end-to-end render-fixture suite at `tests/swig-twig/cases/` (19 `*.test.twig` + `.expectation.html` pairs across operators, Twig-specific tags, filter semantics, and multi-template flows), walked by `tests/swig-twig/templates.test.js`.

* **Fixed** `@rhinostone/swig-core` backend now routes Twig / Jinja2 `??` undefined-fallback through `IRVarRefExists` for VarRef LHS, matching Twig-strict semantics (fallback on undefined OR missing property). Before the fix `{{ foo ?? "x" }}` always returned `""` because `emitVarRef` coerces missing paths to `""`, and JavaScript's native `??` only triggers on `null` / `undefined` — the empty-string output was never falsy enough to trip the right-hand expression. `emitBinaryOp` now special-cases VarRef LHS adjacent to `~` and `in`: re-uses the already-emitted `left` string wrapped in an `IRVarRefExists`-gated ternary. Non-VarRef LHS (FnCall, FilterCall, Literal) falls through to bare `left??right` — those emitters do not coerce missing → `""`, so JS-native `??` is sufficient.

* **Fixed** `@rhinostone/swig-twig` parser now routes STRING and NUMBER literal LHS through `parsePostfix`, so filter chains like `{{ "hi"|upper }}` and `{{ 42|json_encode }}` parse correctly instead of bailing with `Unexpected token "<filter>"`.

* **Fixed** `@rhinostone/swig-core` backend now lowers Twig/Jinja2 `~` (string-concat) to `(String(left) + String(right))`. Bare `<left>~<right>` emission was JS unary bitwise-NOT and threw `SyntaxError` at compile time.

[2.0.0-alpha.4](https://github.com/gina-io/swig/tree/v2.0.0-alpha.4) / 2026-04-18
---------------------------------------------------------------------------------

* **Added** `@rhinostone/swig-twig` gains the `{{ x|date(format[, offset[, abbr]]) }}` filter. Accepts a `Date`, epoch-ms number, or date-compatible string; format spec matches PHP `date()` (backslash escapes literal characters). Wraps the shared `@rhinostone/swig-core/lib/dateformatter`, so `swig.setDefaultTZOffset` applies in Twig templates too. Twig-native `DateTime` / `DateInterval` inputs, timezone-string arguments, and locale-aware month/day names are Phase 4 concerns — today the filter surface matches native swig `date` verbatim.

* **Fixed** `@rhinostone/swig@2.0.0-alpha.2` was unusable as a Node consumer — it relied on `@rhinostone/swig-core` at runtime but did not declare the dependency, so a fresh `npm install @rhinostone/swig@alpha` failed with `Cannot find module '@rhinostone/swig-core'`. `2.0.0-alpha.3` adds an exact-version pin (`"@rhinostone/swig-core": "2.0.0-alpha.3"`) and ships all three packages (`@rhinostone/swig-core`, `@rhinostone/swig`, `@rhinostone/swig-twig`) in lockstep. `@rhinostone/swig@2.0.0-alpha.2` has been deprecated on the registry pointing users at alpha.3.

* **Changed** Internal carve — `lib/dateformatter.js` moved into `@rhinostone/swig-core/lib/dateformatter`. The old path stays as a shim so every existing `require('./dateformatter')` consumer (including `lib/swig.js` and `lib/filters.js`) resolves to the same exports object via Node's module cache. `swig.setDefaultTZOffset` continues to mutate the shared `tzOffset` binding. No user-visible change.

* **Changed** `@rhinostone/swig-twig` soft-deprecates the legacy `exports.parse(source, options)` Path B wrapper. Calling it still returns a parse-tree shape (`{ name, parent, tokens, blocks }`) for backwards compatibility, but emits a one-shot `console.warn` on first invocation. Slated for removal in `2.0.0` stable. Migrate to `new twig.Twig(opts)` and the per-instance `precompile` / `compile` / `render` API installed by `engine.install` — the full-instance path uses closure-captured tag/filter maps and honors `setFilter` / `setTag` overrides, which the Path B wrapper does not.

[2.0.0-alpha.2](https://github.com/gina-io/swig/tree/v2.0.0-alpha.2) / 2026-04-15
---------------------------------------------------------------------------------

* **Changed** Phase 2 of the multi-flavor architecture: native frontend now compiles source → IR → backend. All built-in tags (`autoescape`, `filter`, `if`/`elseif`/`else`, `for`, `set`, `block`/`extends`/`parent`, `include`, `import`, `macro`) emit structured IR nodes; `IRLegacyJS` preserves the JS-string `compile` path for userland `setTag` consumers. TokenParser expression-level codegen migrated to IRExpr — every `{{ … }}` output site lowers through `parseOutput` + `parseExpr` (Pratt parser), with a structured fallback to `IRLegacyJS` for shapes the flat IR cannot represent. Filter chains, deep-filter compositions (`{{ a|f(b|g) }}`), and per-operand filter precedence (`{{ a|upper + b|lower }}`) all route through IR via the new `IRFilterCallExpr`. Internal-only carve; no user-visible API changes vs `2.0.0-alpha.1` — same entry points, same compiled-output semantics, all 7 CVE-2023-25345 + 1 CVE-2021-44906 regressions remain green. 526 → 673 Node tests (added IR + parseExpr + parseOutput acceptance suites).

[2.0.0-alpha.1](https://github.com/gina-io/swig/tree/v2.0.0-alpha.1) / 2026-04-14
---------------------------------------------------------------------------------

* **Changed** First release on the 2.0.0 track. Internals carved into `@rhinostone/swig-core` (Phase 1). No user-visible API changes vs 1.6.0 — same entry points, same compiled output, same test suite.

[1.6.0](https://github.com/gina-io/swig/tree/v1.6.0) / 2026-04-13
-----------------------------------------------------------------

* **Added** `swig compile --recursive <dir>` walks a directory and emits a single AOT bundle module mapping relative paths to compiled template functions. Honours optional `--ext` extension filter; conflicts with `--method-name` / `--wrap-start` / `--wrap-end`. `extends` / `include` / `import` are still resolved at render time through the consumer's loader.

[1.5.0](https://github.com/gina-io/swig/tree/v1.5.0) / 2026-04-12
-----------------------------------------------------------------

* **Security** Extended CVE-2023-25345 guards to bracket-notation access (`foo["__proto__"]`), for-loop variables, macro names, and import aliases. All five gaps now rejected at parse time.

[1.4.7](https://github.com/gina-io/swig/tree/v1.4.7) / 2026-04-10
-----------------------------------------------------------------

* **Changed** Upgrade `yargs` from 3.x to 17.x, replacing unmaintained transitive dependencies (`os-locale`, `window-size`, `number-is-nan`, `ansi-regex@2`, etc.) with actively maintained equivalents

* **Changed** Update `engines` field to `node >= 12` (reflects actual minimum required by `terser` and `yargs` 17)

* **Fixed** Replace private IP address (`192.168.0.2`) with `localhost:11211` in JSDoc example for template loaders
[1.4.6](https://github.com/gina-io/swig/tree/v1.4.6) / 2026-04-10
-----------------------------------------------------------------

* **Changed** Exclude `.github/` from npm tarball

* **Changed** Replace `uglify-js` with `terser` in CLI (`--minify` flag), removing the last Snyk-flagged runtime dependency (ReDoS, CVE in uglify-js@2.4)

[1.4.5](https://github.com/gina-io/swig/tree/v1.4.5) / 2026-04-10
-----------------------------------------------------------------

* **Added** GitHub Actions CI workflow (lint + test on PRs and pushes)

* **Added** Public roadmap (`ROADMAP.md`)

* **Changed** Clean up legacy `paularmstrong` references in documentation

* **Security** Replace `optimist` with `yargs` in CLI, removing `minimist` from the production dependency tree entirely (CVE-2021-44906 fully resolved)

[1.4.4](https://github.com/gina-io/swig/tree/v1.4.4) / 2026-04-10
-----------------------------------------------------------------

* **Changed** Replace uglify-js with terser in the Makefile build target -- make build now works on Node >= 14

* **Security** Block __proto__, constructor, and prototype access in template variables and set-tag assignments to prevent prototype-chain traversal and arbitrary code execution (CVE-2023-25345)

[1.4.3](https://github.com/gina-io/swig/tree/v1.4.3) / 2026-04-09
-----------------------------------------------------------------

* **Security** Pin `minimist` to `^1.2.8` via npm `overrides` to close CVE-2021-44906 (prototype pollution reachable through `swig` → `optimist@0.6.1` → `minimist@~0.0.1`). Requires npm >= 8.3 to honour the override. gh-swig-cve-2021-44906

[1.4.2](https://github.com/paularmstrong/swig/tree/v1.4.2) / 2014-08-04
-----------------------------------------------------------------------

* **Added** Report JS parse errors with template filenames. gh-492
* **Fixed** Ensure block-level tags (`set`, etc) are parsed in correct order. gh-495
* **Fixed** Ensure import tag uses current Swig instance's loader. gh-421, gh-503
* **Fixed** Allow disabling cache on compile/render functions directly. gh-423
* **Fixed** Ensure compilation does not leak global variables. gh-496
* **Fixed** Fix for-loops to run on strings. gh-478, gh-479
* **Fixed** Allow macro output to be assigned using `set` tag. gh-499, gh-502

[1.4.1](https://github.com/paularmstrong/swig/tree/v1.4.1) / 2014-07-03
-----------------------------------------------------------------------

* **Fixed** `macro` argument names colliding with context variable names. gh-457
* **Fixed** filter chaining within tags. gh-441

[1.4.0](https://github.com/paularmstrong/swig/tree/v1.4.0) / 2014-07-03
-----------------------------------------------------------------------

* **Changed** Allow variable tokens to start with `$`. gh-455
* **Changed** `fs` loader should take `cwd` as default base path. gh-419
* **Changed** handle errors which occur at the time of rendering. gh-417
* **Changed** default options in bin (`varControls`, `tagControls`, `cmtControls`). gh-415
* **Changed** `null` should yield empty string when resolving variable. gh-408
* **Added** Escape character for `date` filter argument. gh-427, gh-432
* **Added** Make `if` and `elseif` throw a better error message when a tag body is omitted. gh-425
* **Fixed** don't throw errors on accessing property of `null` object. gh-471
* **Fixed** `loop` variables work correctly in nested loops. gh-433
* **Fixed** Some IE8 compatibility (require es5). gh-428

[1.3.2](https://github.com/paularmstrong/swig/tree/v1.3.2) / 2014-01-27
-----------------------------------------------------------------------

* **Fixed** `for` loop variables on objects. gh-409
* **Fixed** Misc. IE8 fixes. gh-410
* **Fixed** `include` files when loaders have base paths. gh-407

[1.3.0](https://github.com/paularmstrong/swig/tree/v1.3.0) / 2014-01-20
-----------------------------------------------------------------------

* **Changed** Removed official node v0.8.x support
* **Added** Custom template loader support. gh-377, gh-384, gh-382
* **Added** Ability to set root path using template loaders. gh-382, gh-293
* **Added** CLI now accepts custom filter and tag arguments. gh-391
* **Added** Allow `set` tag to set keys on objects with bracket and dot-notation. gh-388
* **Added** `groupBy` filter from swig-extras. gh-383
* **Fixed** `swig.run` `filepath` arg is always optional. gh-402
* **Fixed** Filters on non-empty functions apply correctly. gh-397
* **Fixed** Filters applied to functions w/ & w/o dotkeys. gh-365
* **Fixed** `date` filter `N` option returns correct number. gh-375
* **Fixed** Ensure getting parent template checks cache if on. gh-378

[1.2.2](https://github.com/paularmstrong/swig/tree/v1.2.2) / 2013-12-02
-----------------------------------------------------------------------

* **Fixed** CTX var output in imported macros. gh-363

[1.2.1](https://github.com/paularmstrong/swig/tree/v1.2.1) / 2013-12-02
-----------------------------------------------------------------------

* **Fixed** Scoping for Express. gh-363

[1.2.0](https://github.com/paularmstrong/swig/tree/v1.2.0) / 2013-12-01
-----------------------------------------------------------------------

* **Added** Filepath parameter can be passed to swig.run to allow extends in-browser. gh-349
* **Changed** Use local-context first for var lookups. gh-344, gh-347
* **Changed** Allow DOTKEY after functions/objects/filters. gh-355
* **Changed** Context of for-tags carries into includes. gh-356
* **Changed** When a callback is passed into compileFile, catch all errors thrown by compile and pass the error to callback. gh-340
* **Fixed** Instances of Swig retain their options properly. gh-351
* **Fixed** Fix misc documentation issues. gh-359, gh-358

[1.1.0](https://github.com/paularmstrong/swig/tree/v1.1.0) / 2013-10-02
-----------------------------------------------------------------------

* **Added** Allow logic in default parsing. gh-326
* **Fixed** Error when attempting to wrap spaceless tag around macro/function output. gh-336
* **Fixed** Don't overwrite keys on the locals object. gh-337

[1.0.0](https://github.com/paularmstrong/swig/tree/v1.0.0) / 2013-09-23
-----------------------------------------------------------------------

* **Fixed** Allow parent and other tags to work correctly nested in other tags. gh-331
* **Fixed** Prevent lexer from matching partial logic/words in variables. gh-330

Migrating from v0.x.x? The upstream wiki has since been deleted; see the individual breaking-change entries below.

[1.0.0-rc3](https://github.com/paularmstrong/swig/tree/v1.0.0-rc3) / 2013-09-14
-------------------------------------------------------------------------------

* **Fixed** Allow bools in token parser by default. gh-321
* **Fixed** Allow variables as object values. gh-323
* **Fixed** Don't partially match logic words. gh-322
* **Fixed** Parent tag in parent's block with no local block edge case. gh-316

[1.0.0-rc2](https://github.com/paularmstrong/swig/tree/v1.0.0-rc2) / 2013-09-06
-------------------------------------------------------------------------------

* **Changed** Function output from `variable` blocks are no longer auto-escaped. gh-309
* **Fixed** Allow nested macros to work when importing. gh-310
* **Fixed** swig.setDefaultTZOffset. gh-311
* **Changed** `set` tag assigns to the local context, allowing setting within `for` loops, etc. gh-303
* **Fixed** Standardize variable undefined checking. gh-301
* **Fixed** Remove multiple redefinition of block-level tags in compiled templates.
* **Fixed** Performance issue with compile if no default locals are defined.

[1.0.0-rc1](https://github.com/paularmstrong/swig/tree/v1.0.0-rc1) / 2013-08-28
-------------------------------------------------------------------------------

* **Added** `include` tag now accepts `only` (and is preferred, if possible). gh-240
* **Added** `swig.version` and `-v` to cli
* **Changed** Deprecated `raw` filter. Use `safe`.
* **Changed** Allow `import` and `macro` tags to be outside of blocks. gh-299
* **Changed** Don't escape `macro` output. gh-297
* **Changed** (Custom) Filters can be marked as `safe` to disable auto-escaping. gh-294
* **Fixed** `{% for k,v ... %}` tag syntax assigned variables backwards.
* **Fixed** Filters being applied to empty functions throwing errors. gh-296
* **Fixed** `include` paths on windows. gh-295

[1.0.0-pre3](https://github.com/paularmstrong/swig/tree/v1.0.0-pre3) / 2013-08-20
---------------------------------------------------------------------------------

* **Changed** Allow tags at block-level if specified. gh-289
* **Fixed** `swig.compileFile` runs callback template is found in cache. gh-291
* **Fixed** Accidental modification of Swig Options Object. gh-287
* **Fixed** Preserve forward-slashes in text chunks. gh-285

[1.0.0-pre2](https://github.com/paularmstrong/swig/tree/v1.0.0-pre2) / 2013-08-18
---------------------------------------------------------------------------------

* **Changed** Binary: Allow --method-name to be a shortcut for --wrap-start var setting.
* **Changed** Make reverse filter an alias for `sort(true)`.
* **Added** Allow asyncronous `compileFile` and `renderFile` operations. gh-283
* **Added** Filter: `sort`.
* **Added** Allow {% end[tag] tokens... %}. gh-278
* **Added** Built source map for minified browser source.
* **Added** Contextual support for object method calls. gh-275
* **Added** `parser.on('start'|'end'...` options. gh-274
* **Added** Allow object prototypal inheritance. gh-273
* **Fixed** Prevent circular extends. gh-282
* **Fixed** Throw an error if reserved word is used as var. gh-276
* **Fixed** Add filename to errors if possible. gh-280
* **Fixed** Filters work over arrays/objects if possible. gh-259
* **Fixed** Allow {% parent %} to work in middle parent templates. gh-277
* **Fixed** Allow newlines in tags/vars/comments. gh-272

[1.0.0-pre1](https://github.com/paularmstrong/swig/tree/v1.0.0-pre1) / 2013-08-14
---------------------------------------------------------------------------------

* **Changed** Completely rewritting parsing engine supports many more syntaxes and is much easier to extend.
* **Changed** There is no more `swig.init` method.
* **Changed** Custom filters can be added using `swig.addFilter`
* **Changed** Custom tags can be added using `swig.addTag`
* **Changed** Writing custom tags uses an entirely new, simplified format
* **Changed** Removed the underscore/lodash dependency
* **Changed** Template parsing has been completely rewritten
* **Changed** `swig.compileFile` returns a function that renders templates, not an object
* **Changed** Express-compatible using `swig.renderFile`.
* **Changed** `extends`, `import`, and `include` now reference files with relative paths from the current file.
* **Changed** `extends` may no longer accept variables.
* **Changed** `else if` tag is now `elseif` or `elif`.
* **Changed** Removed `only` argument from `include`.
* **Changed** allow `_`, `$` to start var names in templates.
* **Changed** Documentation is auto-generated from jsdoc comments in-files.
* **Added** Ability to set custom var/tag/comment controls (`{{`, `}}`, etc, can be customized).
* **Added** Variable/string concatenation gh-135.
* **Added** Binary application for `compile`, `run`, and `render` (Lets you pre-compile templates into JS functions for client-side delivery).
* **Fixed** Lots.

[0.14.0](https://github.com/paularmstrong/swig/tree/v0.14.0) / 2013-06-08
-------------------------------------------------------------------------

* **Added** Allow executing functions from within templates gh-182
* **Added** New `spaceless` tag gh-193
* **Fixed** bug when attempting to loop over nested vars with `for`. gh-232

[0.13.5](https://github.com/paularmstrong/swig/tree/v0.13.5) / 2013-01-29
-------------------------------------------------------------------------

* **Fixed** date filter output for 'O' when time-zone offset is negative gh-185

[0.13.4](https://github.com/paularmstrong/swig/tree/v0.13.4) / 2012-12-19
-------------------------------------------------------------------------

* **Fixed** Runaway loop on missing template gh-162 gh-165
* **Fixed** Allow variables in if tag conditionals to have filters with arguments gh-167

[0.13.3](https://github.com/paularmstrong/swig/tree/v0.13.3) / 2012-12-07
-------------------------------------------------------------------------

* **Added** Support % (modulus) in if tags gh-155
* **Added** Support multi-root via array gh-143

[0.13.2](https://github.com/paularmstrong/swig/tree/v0.13.2) / 2012-10-28
-------------------------------------------------------------------------

* **Changed** Allow variables, filters, arguments to span lines gh-122
* **Changed** Throw Errors when using undefined filters gh-115
* **Fixed** compiling files from absolute paths gh-103
* **Fixed** Prevent global variables from being used before context variables gh-117

[Documentation](https://github.com/paularmstrong/swig/tree/v0.13.2/docs)

[0.13.1](https://github.com/paularmstrong/swig/tree/v0.13.1) / 2012-10-28
-------------------------------------------------------------------------

* **Fixed** Macros should be preserved when using inheritence gh-132 ([nsaun](https://github.com/nsaun))
* **Fixed** bug in parent tag logic gh-130
* **Fixed** Error messaging when parent block failed compilation gh-129 ([nsaun](https://github.com/nsaun))

[Documentation](https://github.com/paularmstrong/swig/tree/v0.13.1/docs)

[0.13.0](https://github.com/paularmstrong/swig/tree/v0.13.0) / 2012-10-20
-------------------------------------------------------------------------

* **Added** Support for nested blocks! gh-64 gh-129 ([nsaun](https://github.com/nsaun))
* **Changed** Removed the `parentBlock` argument from tags.
* **Fixed** Object keys may now contain dots

[Documentation](https://github.com/paularmstrong/swig/tree/v0.13.0/docs)

[0.12.1](https://github.com/paularmstrong/swig/tree/v0.12.1) / 2012-10-05
-------------------------------------------------------------------------

* **Added** More information on some parser errors
* **Added** indent parameter to json_encode filter to support pretty-printing.
* **Added** support for variables as `extends` tag parameters
* **Fixed** Compile errors in Android and other random browsers
* **Fixed** Misc documentation
* **Fixed** Leaking __keys variable into global scope
*
[Documentation](https://github.com/paularmstrong/swig/tree/v0.12.1/docs)

[0.12.0](https://github.com/paularmstrong/swig/tree/v0.12.0) / 2012-07-26
-------------------------------------------------------------------------

* **Fixed** Misc documenation
* **Changed** Support Node.js >=v0.6

[Documentation](https://github.com/paularmstrong/swig/tree/v0.12.0/docs)

[0.11.2](https://github.com/paularmstrong/swig/tree/v0.11.2) / 2012-04-10
-------------------------------------------------------------------------

* **Fixed** Update support for underscore@1.3.3 gh-70 gh-71

[Documentation](https://github.com/paularmstrong/swig/tree/v0.11.2/docs)

[0.11.1](https://github.com/paularmstrong/swig/tree/v0.11.1) / 2012-04-01
-------------------------------------------------------------------------

* **Fixed** Duplicate (string) tokens were being removed when extending a base template. gh-67

[Documentation](https://github.com/paularmstrong/swig/tree/v0.11.1/docs)

[0.11.0](https://github.com/paularmstrong/swig/tree/v0.11.0) / 2012-02-27
-------------------------------------------------------------------------

* **Added** Support for Windows style paths gh-57
* **Added** `ignore missing` tokens to include tag
* **Changed** include tag `with context` to only work if `context` is an object
* **Changed** `autoescape` tag controls no longer 'yes' or 'no'. Use `true` and `false`
* **Changed** parser is now passed into tags as an argument
* **Changed** don't require passing context object when rendering template
* **Fixed** dateformats `N` and `w` gh-59
* **Fixed** number changing to string after add filter or set from variable gh-53 gh-58
* **Fixed** speed decrease caused by loop.cycle fixed
* **Fixed** Ensure set tag bubbles through extends and blocks

[Documentation](https://github.com/paularmstrong/swig/tree/v0.11.0/docs)

[0.10.0](https://github.com/paularmstrong/swig/tree/v0.10.0) / 2012-02-13
-------------------------------------------------------------------------

* **Added** loop.index0, loop.revindex, loop.revindex0, and loop.cycle gh-48
* **Added** init config `extensions` for 3rd party extension access in custom tags gh-44
* **Added** Whitespace Control gh-46
* **Changed** The `empty` tag in `for` loops is now `else` gh-49
* **Changed** `forloop` vars to `loop` closes gh-47
* **Fixed** `include` tag's `with` and `only` args documentation gh-50

[Documentation](https://github.com/paularmstrong/swig/tree/v0.10.0/docs)

[0.9.4](https://github.com/paularmstrong/swig/tree/v0.9.4) / 2012-02-07
-----------------------------------------------------------------------

* **Fixed** `parent` tag would not render when called within tags gh-41
* **Fixed** Documentation for forloop.index & forloop.key gh-42
* **Fixed** Errors when using `include` inside base template `block` tags gh-43
* **Fixed** Allow `set` tag to set values to numbers gh-45
* **Fixed** `set` tag for booleans using too many checks

[Documentation](https://github.com/paularmstrong/swig/tree/v0.9.4/docs)

[0.9.3](https://github.com/paularmstrong/swig/tree/v0.9.3) / 2012-01-28
-----------------------------------------------------------------------

* **Fixed** Allow object and array values to be accessed via context variables gh-40

[Documentation](https://github.com/paularmstrong/swig/tree/v0.9.3/docs)

[0.9.2](https://github.com/paularmstrong/swig/tree/v0.9.2) / 2012-01-23
-----------------------------------------------------------------------

* **Fixed** Correctly reset autoescape after closing an autoescape tag. gh-39

[Documentation](https://github.com/paularmstrong/swig/tree/v0.9.2/docs)

[0.9.1](https://github.com/paularmstrong/swig/tree/v0.9.1) / 2012-01-18
-----------------------------------------------------------------------

* **Fixed** Allow multi-line tags and comments. gh-30

[Documentation](https://github.com/paularmstrong/swig/tree/v0.9.1/docs)

[0.9.0](https://github.com/paularmstrong/swig/tree/v0.9.0) / 2011-12-30
-----------------------------------------------------------------------

* **Added** DateZ license to browser header, use link to underscore license.
* **Added** Timezone support in `date` filter gh-27.
* **Added** New `raw` tag.
* **Changed** Swig is no longer node 0.4 compatible.
* **Fixed** Filter `date('f')` for 10am times.
* **Fixed** Filter `date('r')` returns in UTC date format. This is more correct tospec RFC2822, per [php.net/date](https://www.php.net/manual/en/function.date.php).
* **Fixed** Filter `add` when adding numbers/numbers+strings together.
* **Fixed** Tests for error messages that changed in node >0.6.0.

[Documentation](https://github.com/paularmstrong/swig/tree/v0.9.0/docs)

[0.8.0](https://github.com/paularmstrong/swig/tree/v0.8.0) / 2011-11-04
-----------------------------------------------------------------------

* **Added** date filter formats `z`, `W`, `t`, `L`, `o`, `B`, and `c`.
* **Added** New `filter` tag.
* **Added** Node.js compatible 0.4.1 - 0.6.X
* **Added** Allow setting cache globally or per-template.
* **Changed** Removed `swig.render` and `swig.fromString`.
* **Changed** `swig.fromFile` is now `swig.compileFile`.
* **Changed** `swig.init()` will clear template cache.
* **Changed** `swig.init()` is now optional for browser mode with no custom settings.
* **Changed** Development dependencies are be more lenient.
* **Fixed** Parser will properly preserver '\' escaping. gh-24
* **Fixed** Rewrote tag argument parsing for proper space handling.
* **Fixed** Rewrote filter argument parsing. gh-23
* **Fixed** Allow pipe `|` characters in filter arguments. gh-22

[Documentation](https://github.com/paularmstrong/swig/tree/v0.8.0/docs)

[0.7.0](https://github.com/paularmstrong/swig/tree/v0.7.0) / 2011-10-05
-----------------------------------------------------------------------

* **Added** `make browser` will build Swig for use in major browsers. gh-3
* **Changed** Allow overriding `escape` filters. gh-19

[Documentation](https://github.com/paularmstrong/swig/tree/v0.7.0/docs)

[0.6.1](https://github.com/paularmstrong/swig/tree/v0.6.1) / 2011-10-02
-----------------------------------------------------------------------

* **Fixed** chaining filters when the first takes a variable as an argument will not crash parsing.

[Documentation](https://github.com/paularmstrong/swig/tree/v0.6.1/docs)

[0.6.0](https://github.com/paularmstrong/swig/tree/v0.6.0) / 2011-10-02
-----------------------------------------------------------------------

* **Added** `{% import foo as bar %}` tag for importing macros.
* **Added** Allow escaping for js in escape filter and autoescape tag.
* **Added** `raw` filter to force variable to not be escaped.
* **Added** `escape` and `e` filters to force variable to be escaped.
* **Added** Allow filters to accept any JS objects, arrays, strings, and context variables.
* **Changed** `if`, `else`, and `else if` tags support all JS-valid if-syntaxes + extra operators.
* **Fixed** `default` filter for undefined variables. closes gh-18

[Documentation](https://github.com/paularmstrong/swig/tree/v0.6.0/docs)

[0.5.0](https://github.com/paularmstrong/swig/tree/v0.5.0) / 2011-09-27
-----------------------------------------------------------------------

* **Added** More error messaging in some edge cases.
* **Added** Better error messaging including context and line numbers.
* **Changed** Improved compile and render speeds.
* **Changed** `include` tags accept context variables instead of just strings.
* **Changed** Templates can be compiled and rendered from an absolute path outside of the template root.
* **Fixed** Will not double escape output.

[Documentation](https://github.com/paularmstrong/swig/tree/v0.5.0/docs)

[0.4.0](https://github.com/paularmstrong/swig/tree/v0.4.0) / 2011-09-24
-----------------------------------------------------------------------

* **Added** Macro support [docs](docs/tags.md)
* **Changed** Removed requirement to manually specify `locals` for express support.
* **Changed** Increased cache lookup speed by removing crypto dependency.
* **Fixed** `length` filter returns length of objects (number of keys).
* **Fixed** Filters return empty string unless they can apply to the given object.
* **Fixed** Filters will attempt to apply to all values in an object or array.

[Documentation](https://github.com/paularmstrong/swig/tree/v0.4.0/docs)

[0.3.0](https://github.com/paularmstrong/swig/tree/v0.3.0) / 2011-09-17
-----------------------------------------------------------------------

* **Added** Support for `{% set ... %}` tag.

[Documentation](https://github.com/paularmstrong/swig/tree/v0.3.0/docs)

[0.2.3](https://github.com/paularmstrong/swig/tree/v0.2.3) / 2011-09-16
-----------------------------------------------------------------------

* **Fixed** Critical fix for negations in `if` blocks.
* **Added** Support for `forloop.first` in `for` blocks.
* **Added** Support for `forloop.last` in `for` blocks.
* **Added** Support for `forloop.key` in `for` blocks.
* **Added** Support for `{% empty %}` in `for` blocks.

[Documentation](https://github.com/paularmstrong/swig/tree/v0.2.3/docs)

[0.2.2](https://github.com/paularmstrong/swig/tree/v0.2.2) / 2011-09-16
-----------------------------------------------------------------------

* **Added** Support for `else if ...` within `if` blocks.

[Documentation](https://github.com/paularmstrong/swig/tree/v0.2.2/docs)

[0.2.1](https://github.com/paularmstrong/swig/tree/v0.2.1) / 2011-09-13
-----------------------------------------------------------------------

* **Added** Support for `else` within `if` blocks.

[Documentation](https://github.com/paularmstrong/swig/tree/v0.2.1/docs)

[0.2.0](https://github.com/paularmstrong/swig/tree/v0.2.0) / 2011-09-11
-----------------------------------------------------------------------

* **Fixed** `if` statements allow filters applied to operands.
* **Fixed** `for` loops allow filters applied to the object that will be iterated over.

[Documentation](https://github.com/paularmstrong/swig/tree/v0.2.0/docs)

[0.1.9](https://github.com/paularmstrong/swig/tree/v0.1.9) / 2011-09-11
-----------------------------------------------------------------------

* **Added** `allowErrors` flag will allow errors to be thrown and bubbled up. Default to catch errors.
* **Changed** Internal speed improvements.

[Documentation](https://github.com/paularmstrong/swig/tree/v0.1.9/docs)

[0.1.8](https://github.com/paularmstrong/swig/tree/v0.1.8) / 2011-09-10
-----------------------------------------------------------------------

* **Added** `add`, `addslashes`, and `replace` filters.
* **Changed** All tags that 'end' must use named ends like `endblock`, `endif`, `endfor`, etc...

[Documentation](https://github.com/paularmstrong/swig/tree/v0.1.8/docs)

[0.1.7](https://github.com/paularmstrong/swig/tree/v0.1.7) / 2011-09-05
-----------------------------------------------------------------------

* **Added** this History document
* **Fixed** date filter to zero-pad correctly during september when using 'm' format

[Documentation](https://github.com/paularmstrong/swig/tree/v0.1.7/docs)

[0.1.6](https://github.com/paularmstrong/swig/tree/v0.1.6) / 2011-09-04
-----------------------------------------------------------------------

* **Fixed** Template inheritance blocks messing up.

[Documentation](https://github.com/paularmstrong/swig/tree/v0.1.6/docs)

[0.1.5](https://github.com/paularmstrong/swig/tree/v0.1.5) / 2011-09-04
-----------------------------------------------------------------------

* **Added** `first`, `last`, and `uniq` filters
* **Added** ability to specify custom filters
* **Added** ability to specify custom tags
* **Changed** slots removed -- implement using custom tags if desired
* **Fixed** ability to do either dot- or bracket-notation or mixed in variables
* **Fixed** internal parsing helpers

[Documentation](https://github.com/paularmstrong/swig/tree/v0.1.5/docs)

[0.1.3](https://github.com/paularmstrong/swig/tree/v0.1.3) / 2011-09-01
-----------------------------------------------------------------------

* **Fixed** filter parser to work correctly with single-quoted params in filters.

[Documentation](https://github.com/paularmstrong/swig/tree/v0.1.3/docs)

[0.1.2](https://github.com/paularmstrong/swig/tree/v0.1.2) / 2011-09-01
-----------------------------------------------------------------------

* Initial **swig** publish after forking from [node-t](https://github.com/skid/node-t)

[Documentation](https://github.com/paularmstrong/swig/tree/v0.1.2/docs)
