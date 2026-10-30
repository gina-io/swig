[2.10.0](https://github.com/gina-io/swig/tree/v2.10.0) / 2026-10-31
-------------------------------------------------------------------

* **Added** swig-jinja2: the tests `is integer` and `is float`, and the guards `"name" is filter` and `"name" is test`, as in Jinja2. JavaScript has one number type, so `is integer` reads the value: 1.0 and 1e300 are integers here and floats in Python, and NaN and the infinities are floats, as in Python. `is filter` and `is test` take a string literal; another subject fails as an unknown test.

* **Fixed** swig-twig: a filter or test name the instance does not hold is a compile error wherever it stands, as in Twig (`Invalid filter "nosuch" on line 3 in file page.html.`, `Invalid test "frob" on line 2.`). An unknown filter used to compile, then throw `_filters.nosuch is not a function` at render, or pass unnoticed in a branch not taken; an unknown test used to read as false, and `is not` as true, with no error. Four things change for a template or a setup that relied on that: a name in a branch not taken stops the compile; a filter registered with setFilter or a test registered with setExtension after the compile that uses it fails at that compile; `{{ x|toString }}`, `{{ x|hasOwnProperty }}` and the like, which called the Object.prototype method, are rejected; and `is none`, `is sequence`, `is mapping` and `is constant`, Twig tests that swig-twig does not provide, no longer read as false.

* **Fixed** swig-jinja2: a filter or test name the instance does not hold now fails as in Jinja2. It is a compile error (`Invalid filter "nosuch" on line 3 in file page.html.`), except directly inside an if or an inline-if, where the template compiles and the same error is thrown when the expression is reached. An unknown filter used to compile, then throw `_filters.nosuch is not a function` at render; an unknown test used to read as false, and `is not` as true, with no error. Four things change for a template or a setup that relied on that: a name that is never reached can stop the compile (in a for, with, macro or block body inside an if, or after a short-circuiting and or or); a filter registered with setFilter or a test registered with setExtension after the compile that uses it fails, at that compile or when reached; `{{ x|toString }}`, `{{ x|hasOwnProperty }}` and the like, which called the Object.prototype method, are rejected; and the Jinja2 tests that swig-jinja2 does not provide (`eq`, `ne`, `lt`, `le`, `gt`, `ge` and their aliases, `escaped`) no longer read as false.

* **Fixed** swig-django: a filter name the instance does not hold is a compile error wherever it stands, as in Django (`Invalid filter "nosuch" on line 3 in file page.html.`). It used to compile, then throw `_filters.nosuch is not a function` at render, or pass unnoticed in a branch not taken. Three things change for a template or a setup that relied on that: a name in a branch not taken stops the compile, a filter registered with setFilter after the compile that uses it fails at that compile, and `{{ x|toString }}`, `{{ x|hasOwnProperty }}` and the like, which called the Object.prototype method, are rejected.

* **Fixed** swig-twig, swig-jinja2 and swig-django: an expression error names its line and file, as native swig and the tag errors of those flavors do. `{{ ) }}` threw `Unexpected token ")".` and now throws `Unexpected token ")" on line 1 in file page.html.`, in outputs and in tag arguments, and so do the prototype-chain guard errors and the error for a character the lexer rejects (`{{ " }}`).

* **Fixed** swig-twig and swig-jinja2: an error names the right line after a `-%}` or `-}}` that strips line breaks. The count skipped the line breaks it stripped, so a name on line 4 after one such marker was reported on line 3, in expression errors and in tag errors alike.

[2.9.13](https://github.com/gina-io/swig/tree/v2.9.13) / 2026-10-30
-------------------------------------------------------------------

* **Fixed** Native swig: a filter whose input is undefined or null no longer fails or prints [object Object]. A filter after a filter or a call that found nothing renders an empty string, so `{{ items|first|lower }}` over an empty list and `{{ f()|upper }}` with an undefined or null result, which threw or printed [object Object], render nothing, in outputs and in tag arguments. first, last and replace give an empty string for such an input (they threw) and length gives 0 (it threw on undefined). date gives an empty string for a missing, null, empty or invalid value (it printed NaN, or 1970 for a filter or call result of null). replace reads a missing replacement, such as a subscript that found nothing, as an empty string (it printed undefined), and replace and addslashes take a number or a boolean (they threw); replace on an array or an object still fails. Behaviour change for a custom filter that calls `iterateFilter`: an undefined or null input now gives it an empty string back, so its own code no longer runs on undefined, and null no longer gives it an empty object.

* **Fixed** swig-twig: a filter whose input is undefined or null no longer fails or prints [object Object]. A filter after a filter or a call that found nothing renders an empty string (`{{ items|first|lower }}` over an empty list threw), and first and last give an empty string for such an input (they threw). length gives 0 for undefined, null and an empty string (it gave an empty string for undefined and an empty string). date follows Twig: a missing value, null, an empty string and "now" give the current date (they printed NaN, or 1970 for a filter or call result of null), and a string that is no date gives an empty string (it printed NaN). replace writes a replacement that is undefined or null as an empty string (it printed undefined or null).

* **Fixed** swig-jinja2: a filter whose input is undefined or null no longer fails or prints undefined, null, Undefined or [object Object]. A filter after a filter or a call that found nothing renders an empty string (`{{ items|first|lower }}` over an empty list threw, and `{{ f()|upper }}` printed [object Object] for a null result). truncate, indent, center, urlencode, striptags and title read such an input as an empty string, and wordcount gives 0 (it gave 1). length and count give 0 for undefined, null and an empty string (they gave an empty string). date gives an empty string for a missing, null, empty or invalid value (it printed NaN, or 1970 for a filter or call result of null).

* **Fixed** swig-django: the string filters read a None value, and a variable that fails to resolve where Django reads it as None (if, for, firstof), as the text None, as Django does. `{{ x|upper }}` with x None renders NONE (it printed [object Object]), title, capfirst, linebreaks and the other string filters print None (they printed null or Null), `{% if user.role|lower == "admin" %}` over a missing role takes the else branch (it threw), and `{% for c in x|make_list %}` over a missing x walks None (it walked undefined). escape, escapejs and safe keep the empty string of `{{ x }}`. add gives an empty string when its input or its argument is None or missing (it printed aundefined for a missing argument, or the other operand for None), date gives an empty string for a string that is no date (it printed NaN), and floatformat with an invalid argument gives an empty string for None (it printed null).

* **Fixed** A filter or call result that is undefined or null reads as an empty string at an arithmetic, ~ or unary operand, as a variable holding one does, in swig, swig-twig and swig-jinja2: `{{ 1 + f() }}` renders 1 and `{{ -f() }}` renders 0 with an undefined result (they printed NaN), and `{{ items|first ~ "a" }}` over an empty list and `{{ f() ~ "a" }}` render a (they printed undefineda or nulla). The operands of swig-jinja2's `**` are not covered: `{{ f() ** 2 }}` still prints NaN. The change is in the compiled code, so templates precompiled by an earlier release keep the old output until they are compiled again.

* **Fixed** The async render path (renderFile with `loader.async`, compileFile with `codegenMode: 'async'`) keeps compiled templates in the instance's cache: with `cache: 'memory'` (the default) or a custom cache, a template, an included partial and an extends parent are loaded and compiled once, where every render and every include loaded and compiled them again (a 200-item loop with one include called the loader 201 times per render). Behaviour change, as on the sync path: an edited template is no longer picked up until `invalidateCache()` is called (a custom cache must drop the entry itself), and the first compile of a file fixes its compile options. `cache: false` keeps loading on every render.

* **Fixed** renderFile on the async render path no longer calls its callback a second time when the callback throws, with the exception as the error. The exception now surfaces as an unhandled rejection.

* **Fixed** swig-django: add gives an empty string for operands Python cannot add, as Django does: a string and a number, a list or a mapping with anything but a list, and two mappings. `{{ "a"|add:1 }}` printed a1, `{{ 1|add:"a" }}` 1a, `{{ x|add:1 }}` over a missing x 1, and two mappings [object Object][object Object]. Behaviour change for a template that used add to join a string and a number. Numbers, numeric strings, two strings and two lists add as before, except that two lists of one number each now join (`{{ a|add:b }}` with [1] and [2] gave 3).

[2.9.12](https://github.com/gina-io/swig/tree/v2.9.12) / 2026-10-30
-------------------------------------------------------------------

* **Fixed** Blocks nested in blocks follow one chain of definitions per block name, on the sync and async render paths, in all four flavors. In native swig `{% parent %}` in a block nested in an override renders the next definition of its name instead of nothing, on both paths (`<YC>` becomes `<YCI>`, as Jinja2 renders `super()`). On the sync path `{% parent %}` in an override of a nested block renders the next definition too (`<O[C]>` becomes `<O[CI]>`), a block rendered through `{% parent %}` keeps the overrides of the blocks nested in it, and a block in a for loop or a filter tag of the root, overridden with `{% parent %}`, renders the parent content. Five behaviours change. A block nested in any block of an extending template is now a definition of its name, even when the root has no block for the enclosing one, so a template with no `{% parent %}` in it can render differently (`<P>` becomes `<N>` in all four flavors, as Jinja2 and Django render it). A block that renders itself through a nested block or `{% parent %}` now fails with an error naming the block when the render reaches it, where it rendered a truncated output or overflowed the stack before; a condition that ends such a recursion still lets the async path render it, while the sync path, which expands blocks at compile time, fails. A native child block named `__proto__` no longer overrides on the sync path, as on the async path. A custom tag compiled inside a block on the sync path now receives, as `parents`, the farther definitions of that block (entries with `name` and `blocks`, no `tokens`) instead of the parent templates; outside a block it receives the parent templates as before. On the async path a block body no longer reads a variable that a custom tag declares around the block (`_ctx` still reaches it). Repeated block names, which the docs leave undefined, now render alike on the two paths in most shapes. A template precompiled by an earlier release keeps rendering as it did until it is compiled again.

* **Fixed** The 2.9.11 notes named one behaviour change, for a filter after a call in an `{% if %}` test. It also holds in `{% set %}`, `{% elseif %}` and `{% for %}` arguments: up to 2.9.10 a filter after a function or method call in those arguments applied to everything before it, and since 2.9.11 it applies to the call only, as in an output. With a = "x", x = "ab" and f returning its argument, `{% set y = a + f(x)|upper %}` gave « XAB » and gives « xAB », and `{% for c in a + f(x)|upper %}` loops over « xAB ». A filter after a variable is unchanged.

[2.9.11](https://github.com/gina-io/swig/tree/v2.9.11) / 2026-10-29
-------------------------------------------------------------------

* **Fixed** In native swig an output whose variable is followed by a filter of its own no longer prints « undefined » or « null » when the last filter returns one: `{{ items|first }}` and `{{ items|last }}` over an empty list, `{{ obj|first }}` over an empty object, `{{ fn|json }}` for a function and a custom filter that returns undefined or null now render an empty string, as swig-twig and swig-jinja2 already did. Native outputs under a string escape strategy (the autoescape 'html' or 'js' option) and inside an `{% autoescape %}` region that turns escaping on, `{% autoescape true %}` included, now follow the rule that 2.9.10 brought to other outputs: `{{ arr[0] }}`, `{{ obj["k"] }}` and a call that returns undefined render an empty string instead of « undefined », and `{{ arr[0].x }}` and `{{ arr[0]|upper }}` no longer throw. The 2.9.10 entry said that in swig any output that comes out undefined or null renders an empty string; that did not hold for these outputs.

* **Fixed** In native swig a filter after a literal in an output now applies to that literal when the output also holds an operator or a ternary. The filter, and everything after it, was dropped since 2.0.0: in 2.9.10, with x = "ab", `{{ "ab"|upper == x }}` rendered « ab », `{{ x == "ab"|upper }}` « true », `{{ 3|default(1) + 1 }}` « 3 » and `{{ true |json + x }}` « true », and `{{ x ? "lit"|upper : "n" }}` failed to compile. They now render « false », « false », « 4 », « trueab » and « LIT ».

* **Fixed** In native swig a filter inside a `{% set %}`, `{% if %}`, `{% elseif %}`, `{% for %}`, `{% include %}` or `{% filter %}` argument now applies to its own operand, as it does in an output: `{% set y = arr[0]|upper %}` and `{% if arr[0]|length %}` over an empty list no longer throw a TypeError at render, and `{% set y = (x)|upper %}`, `{% for c in (x)|reverse %}`, `{% include name|default("p.html") %}` and `{% filter replace("a", x|upper) %}` now compile (they failed in 2.9.10; the last one worked in 1.6.0). `{% filter upper() %}` with empty parentheses works, which it never did, and a group in double parentheses no longer breaks a set or a for tag: `{% set y = ((x)) %}` and `{% for c in ((x)) %}` failed to compile in 2.9.10. One behaviour change: a filter after a call in an if test now applies to that call only, so `{% if z and f(x)|upper %}` with z = 0 is false, where 2.9.10 applied the filter to `z and f(x)` and took the branch. A prototype-chain name called in a filtered tag argument, as in `{% set r = __proto__(x)|upper %}` or `{% if constructor(x)|upper %}`, now fails at compile with the prototype-chain guard, as it does without the filter; 2.9.10 compiled both.

[2.9.10](https://github.com/gina-io/swig/tree/v2.9.10) / 2026-10-28
-------------------------------------------------------------------

* **Fixed** A subscript or member of a missing value no longer prints « undefined » or « null » and no longer throws. In swig, swig-twig and swig-jinja2, `{{ arr[0].x }}`, `{{ obj["k"].x }}` and `{{ arr[0][1] }}` over an empty list or object failed with « Cannot read properties of undefined » and now render an empty string; in swig and swig-twig `{{ arr[0] }}` and `{{ obj["k"] }}` printed « undefined » (« null » for a null item) and now render an empty string, as a missing variable does. A missing subscript that enters a filter or an arithmetic, `~` or unary operand reads as an empty string too: `arr[0]|upper` failed, `arr[0] ~ "x"` gave « undefinedx » and `arr[0] * 2` gave « NaN » (now `0`). A call on a subscript keeps its receiver and gives an empty string when there is nothing to call. In native swig a tag argument that applies a filter, such as `{% set y = arr[0]|upper %}`, still fails on a missing subscript. Behaviour change: in swig and swig-twig, any output that comes out undefined or null now renders an empty string, as swig-jinja2 already did, including a function result that printed « undefined » or « null » before.

[2.9.9](https://github.com/gina-io/swig/tree/v2.9.9) / 2026-10-28
-----------------------------------------------------------------

* **Fixed** swig-django for loops over a mapping's items, keys or values read a key of that name first when the mapping has one, as Django does, and otherwise apply the dict method as before. The for tag rewrote these three names when the template compiled, so such a key was never read: {% for item in page.data.items %} over { items: [1, 2] } failed to compile ("requires two loop variables"), {% for v in d.values %} over { values: [7, 8], z: 1 } gave the values of both keys instead of the list stored under values, and .keys and a two-name .items loop likewise walked the whole mapping. One loop variable over .items on a mapping without an items key now binds each key and value as a pair, so {% for pair in d.items %}{{ pair.0 }}={{ pair.1 }}{% endfor %} works as in Django, where it failed to compile; over an empty mapping, a list, a string or a missing value it runs the {% empty %} branch, as in Django. A pair printed whole renders as JavaScript joins it (a,1), where Django prints the tuple.

* **Fixed** swig-django for loops over .items, .keys or .values of a list, a string, a number or a boolean run no item, as in Django, which finds no dict method on such a value. In 2.9.8 a two-name .items loop over a list of pairs unpacked each pair ([1=2] for [[1, 2]]) and .keys over a list gave its indices ([0][1]). A mapping is unchanged.

* **Fixed** In swig-django a variable that fails to resolve (a missing name, key or index, or a None value that a later segment of its path reads) reaches its filters as "", as in Django, which gives it string_if_invalid before any filter runs, in {{ }} outputs and in the values of with, cycle and include-with. In 2.9.8 {{ missing|upper }}, {{ missing|lower }} and a with, cycle or include-with value such as missing|upper threw (Cannot read properties of undefined), title and capfirst rendered "Undefined", slugify, striptags, cut, urlencode and others rendered "undefined", truncatechars:3 rendered "un…", wordcount 1, yesno "maybe" and default_if_none its default, {{ x.y|upper }} with x None rendered "[object Object]", and {% cycle missing "z" %} rendered "undefined". default_if_none now gives "" for a missing variable, as in Django (default covers it). if, for and firstof are unchanged (Django reads a failed lookup there as None), and so is a None value.

* **Fixed** swig-django if expressions bind not, in and the comparisons at the levels Django uses: not takes a comparison, in, not in or is into its operand, and in and not in bind more loosely than the comparisons. In 2.9.8 not bound only the name after it, so {% if not x == y %} with x 1 and y 2 was false (Django: true), and so were {% if not x in y %} with 5 and [1, 2, 3] and {% if not x is None %} with x 1; and in bound more tightly than == and !=, so {% if a == b in c %} read a == (b in c). and and or are unchanged.

* **Fixed** swig-django {% cycle %} escapes its value with a string autoescape strategy, as {{ }} and {% firstof %} do: under the autoescape: "js" option, 2.9.8 escaped a cycle value for HTML (&lt;x&#39;&gt;) where {{ }} and firstof escaped it for JavaScript.

* **Fixed** swig-jinja2 {% else %} and swig-django {% else %} and {% empty %} reject arguments when the template compiles, as Jinja2 and Django do. In 2.9.8 they ignored them, so {% if a %}A{% else if b %}B{% endif %} rendered B with a and b both false (else if is not elif); such a template now fails to compile, naming the tag, the line and the file.

* **Fixed** In swig-twig, swig-jinja2 and swig-django a key named _ext, _utils or Math in the template context, from the locals or set by the template, no longer replaces the engine helpers that tests, ranges, slices, ** and // call. In 2.9.8 the emitted code read these names from the context first: in swig-jinja2 {% if x is string %} was false with the locals { _ext: { _test_string: 0 } }, l[1:] rendered nothing with { _utils: { slice: 0 } } and the render failed with { _utils: { slice: "text" } }, and 2 ** 3 and 7 // 2 rendered nothing with { Math: { pow: 0 } } and { Math: { floor: 0 } }; in swig-twig x is even was false with { _ext: { _test_even: 0 } } and 1..n gave no items with { _utils: { range: 0 } }; in swig-django l[1:] rendered nothing with { _utils: { slice: 0 } } and t with { _utils: "text" }. A function in the locals under _ext._test_<name> also answered an unknown test name in swig-jinja2 (x is frobnicate was true); an unknown test is now false whatever the locals hold. Names a template binds as loop variables or macro parameters behave as before. In swig-django, .keys and .values for loops ran no item when the locals held _utils: { keys: 0, values: 0 } and failed with a string _utils; they now iterate the mapping (the dict-iteration fix in this release).

* **Fixed** swig-jinja2 reads true, false and none, each also capitalised, as Jinja2's constants: x == none and x is sameas none read like x is none and x != none like x is not none, the tests true and false are added, and batch and slice no longer pad with none. In 2.9.8 True, False, None and none were variable names, which render "": {% if True %} and {% if x == True %} with x true took the else branch, x == none was true for x = 0 and for x = "", x != none was false for x = 0, x is sameas none was true for x = "", [1,2,3]|batch(2, none) and [1,2,3]|slice(2, none) padded the short row with "", x is true and x is false failed to compile (Unexpected token "true" after "is" / "is not"), and (x is true) and (x is false) were false whatever x held. A template that binds one of the six names (set, for, a macro name or parameter, with, an import alias, a from name or alias) now fails to compile with Cannot assign to the constant "<name>" in "<tag>" tag, as in Jinja2; a macro named none in an imported file makes the importing template fail as well. none still renders "" wherever a variable holding None does ({{ none }}, none ~ "x", none|upper), and x == none, like x is none, is also true for an undefined variable. A None that a filter returns reaches the next filter as null: {{ x|default(none)|upper }} now renders "[object Object]" where 2.9.8 rendered "" (Jinja2 renders NONE), as a None value from the locals already did in 2.9.8 ({{ items|first|upper }} with items [None]).

* **Fixed** The keywords and, or, not, in and not in now read as operators when ( follows them with no space, in all four flavors, as they already did before a space: {% if not(x) %}, a and(b), a or(b), 1 in(l) and 1 not in(l) mean what their spaced forms mean. In 2.9.8 native swig read a and(b) and a or(b) as a, and 1 in(l) as 1, with no error, and not(x) called a function named not, which is false for every x; swig-twig, swig-jinja2 and swig-django read not(x) the same way and failed to compile and(, or(, in( and not in( with « Unexpected token »; swig-jinja2 also failed on "a" if(c) else "b" and on else("b"). Names that only start with a keyword (index, order, notify, android) are unchanged, and so are object keys named and, or, not or in. Two changes in native swig: a function passed in the locals and named not, and or or can no longer be called by that name (not(1) negates 1, and and(1) or or(1) fails to compile with « Unexpected logic »), and a {% macro %} head that is not a name fails to compile with « Expected a macro name on line N. », including a macro named not, and or or, which 2.9.8 accepted, and {% macro !(a) %}, which defined a macro named a.

* **Fixed** The swig-django README no longer says that {{ block.super }} fails with a clear parse-time error: it is deferred and renders an empty string, with no error. It also no longer lists one-variable {% for x in dict.items %} as deferred, since this release supports it.

[2.9.8](https://github.com/gina-io/swig/tree/v2.9.8) / 2026-10-27
-----------------------------------------------------------------

* **Fixed** On the async render path (renderFile with a loader whose async flag is set, or compileFile with codegenMode 'async'), a call of an imported macro no longer puts every name the imported template bound back in place: since 2.9.6 each call set the macros, top-level sets and import aliases of that template in the importer's context and took each out again, so a page making 2000 calls into a 20-macro import rendered about three times slower than on 2.9.5. A call now puts in place only the names the imported template's macros can reach, which their compiled code records, followed through the macros, imports and from-imports that template bound; when a name leads to a value nothing recorded (a function from the locals, an object or an array), or a macro hands the context itself to other code or holds a {% with %}, every name is in place as before. That page now renders in about a fifth of its 2.9.7 time. One behaviour change follows: while the macro runs, code that comes into it from the importing side (a macro or an import alias passed as an argument, a macro of an importing template called back by name, the importer's alias of another file) still sees the names the imported macros can reach, but no longer the others; for those it reads its own template's names, and the sync render path never put them in place either. The same holds for {% from %} in Twig and Jinja2.

[2.9.7](https://github.com/gina-io/swig/tree/v2.9.7) / 2026-10-27
-----------------------------------------------------------------

* **Fixed** On the sync render path, {% import %} and {% from %} rewrote the compiled code of the imported macros by name, and several templates broke on it. In native swig a macro named k failed to compile and one whose name holds a $ rendered nothing. In native swig, Twig and Jinja2 a macro named sa failed, as did a set target named like another macro of the same file and an import whose alias is the name of one of its macros; a parameter named like another macro of the file rendered that macro's code instead of the argument, and one named like an import of the file rendered [object Object]; text or a string holding "_ctx." followed by such a name was changed; and an import inside the imported file whose alias equals the importer's alias rendered nothing. In Twig and Jinja2 a {% from %} also bound swapped aliases (import foo as bar, bar as foo) to the wrong macros, its macros could not call a macro of their file that it did not name, and an importer variable or loop variable named like such a macro made the call fail. A locals key counts too, so data passed as locals could make such a render throw; that template already dropped the macro's output, and a {% from %} that also names the macro did not fail. The imported file's own imports and macros now run unrewritten in a scope of the import, so all of these render as on the async render path, where they already did. One behaviour change follows: an import inside the imported file is no longer reachable through the importer's alias ({{ alias.inner.macro() }} renders nothing), as on the async render path; the imported macros still use it. The name rewrite dates back to the original swig in native, and to the first release of swig-twig (2.0.0-alpha.3) and of swig-jinja2 (2.5.0).

[2.9.6](https://github.com/gina-io/swig/tree/v2.9.6) / 2026-10-25
-----------------------------------------------------------------

* **Fixed** On the async render path (renderFile with a loader whose async flag is set, or compileFile with codegenMode 'async'), {% parent %} in a block of a template that extends another rendered nothing, in every release since 2.2.0. It now renders the version of the block in the template above, as the sync path does: through each level of an extends chain, when a level in between does not have the block, inside a for loop, an if, a filter or spaceless tag, and under a dynamic {% extends %}. An override of a block that sits inside another block of the template above renders that version through {% parent %} as Jinja2's super() does, where the sync path drops it. A macro that calls {% parent %} throws a clear error naming it when it is called on the async path, as a macro holding an include already does; a template that only defines it renders.

* **Fixed** On the async render path (renderFile with a loader whose async flag is set, or compileFile with codegenMode 'async'), an imported template's own bindings no longer land in the template that imports it: its macros, its top-level sets, the aliases of its own imports and the names set by a template it includes stayed in the importer's context, where the sync path keeps them out, and an importer's own variable named like one of its macros was replaced by that macro. The import now takes them back out when it returns, and the imported macros still see them while they run. The same holds for {% from %} in Twig and Jinja2. Native and Twig had it since 2.2.0, Jinja2 since its first release, 2.5.0.

* **Security** With the default memory cache, or a custom cache object, the locals given in the options of render, compile or compileFile no longer reach other calls for the same file. compile cached one function per filename, and that function kept the locals of the call that created it: render(source, { filename, locals }) rendered the first call's locals on every later call with that filename, compile and compileFile with locals returned that same function, and a later caller passing its own locals, through renderFile or an include of the file, got the first call's locals under its own. An application that rendered per-user data this way, as the documented render example with a filename does, showed the first user's data to every later user of that page. The cache now keeps a function without those locals, and each call binds its own. Two other changes follow: a {% set %} no longer carries over between calls of one function compiled with locals, and compileFile with locals now applies them to a template stored with register. Null-prototype options.locals, which the first call already rejected, are now rejected on every call. Every release has it, native back to the original swig 1.4.2 and each flavor since its first release, on the sync and the async render path, and through the deprecated compileFileAsync.

* **Security** A render without call-time locals on an instance with default locals, and run without locals, now work on a copy of the default locals. They used the defaults object itself as the template's context, so what the template wrote ({% set %}, macros, imports, loop variables, Django {% cycle %} state) stayed in the defaults and reached every later render of every template on that instance, and instances built without their own locals share one defaults object, so run on one instance reached the others. With a request-scoped helper in the default locals, such as one that reads the current user from AsyncLocalStorage, one of two concurrent renders on the async render path showed the other's data, and Django's {% cycle %} continued from one render to the next instead of starting again. The copy keeps the prototype of the defaults object, so a class instance's methods and getters still resolve and a null-prototype defaults object still renders; as with call locals, an own getter runs once per render and an own non-enumerable property is not seen. Every release has it, native back to the original swig 1.4.2 and each flavor since its first release.

* **Security** A render now works on a copy of the locals object the caller passes, made at its top. On an instance without default locals the template used that object itself as its context, so the names it set ({% set %}, macros, imports, loop variables, Django {% cycle %} state) landed in it: a later render given the same object read them, and two concurrent renders on the async render path given one object read each other's; with a request-scoped helper in that object, such as one that reads the current user from AsyncLocalStorage, one user's page showed another user's data. A template rendered as part of the render, an include on either path, still shares its context, so an include's sets still reach its includer. Three cases still write into the object they are given: a template rendered from inside another render of the same instance (a helper that renders a partial), an include given an object with `with … only`, and a dotted set such as {% set site.user = who %}, since the copy is shallow. The render reads the caller's own enumerable properties once, at its top, as it already did on an instance with default locals: a getter runs once, and a value a Proxy only synthesizes, or a non-enumerable property, is not seen. With frozen locals a {% set %}, which was dropped, and a macro or an import, which failed, now work. The later-render case is in every release, native back to the original swig 1.4.2 and each flavor since its first release; the concurrent case since 2.2.0 in native and Twig, since 2.5.0 (its first release) in Jinja2 and since 2.9.4 in Django, the first release where a loop holding an include renders on the async render path.

[2.9.5](https://github.com/gina-io/swig/tree/v2.9.5) / 2026-10-25
-----------------------------------------------------------------

* **Security** With the default memory cache, a page's override of a block nested inside another block, an if or a for loop no longer shows on other pages that extend the same layout. Once the layout was in the compile cache (compiled, rendered or included on its own), or the middle template of a three-level chain had been rendered as a page, the first page that overrode such a block put its block into the cached layout, and every page compiled later that did not override that block rendered it until the cache was cleared: content written for one page, such as a block only administrators should see, showed on other pages. The leaked block rendered with the data of the page that showed it, not with the data of the page it came from, and the leak depended only on which templates the process compiled first, not on any value in the request. A parent taken from the compile cache is now copied before its blocks are remapped. The same shared parent made native {% parent %} in a middle template that was in the compile cache render that template's block twice; it now renders it once. Every release has the leak, back to the original swig 1.4.2, and every native release the double render.

* **Security** On the async render path (renderFile with a loader whose async flag is set, or compileFile with codegenMode 'async'), a template that includes, imports or extends itself, directly or through other templates, no longer loads templates until the process runs out of memory. An extends cycle now fails at once with the sync path's "Illegal circular extends" error, and each top-level render counts the templates it has in progress: loading a template while 1000 are in progress fails with an error naming it, so a recursive include renders 1000 levels deep and fails at 1001, which rendered before. An include marked ignore missing swallows that error, as it swallows any error of the template it includes, so a self-include marked ignore missing now ends after 1000 levels. This change leaves the sync render path, which already ended these renders, unchanged. Every release since 2.2.0 has it (swig-jinja2 since 2.5.0, swig-django since 2.7.0); a template mistake reached it, and so did an include or extends path taken from the request.

[2.9.4](https://github.com/gina-io/swig/tree/v2.9.4) / 2026-10-24
-----------------------------------------------------------------

* **Fixed** swig-jinja2 loop filters work as in Jinja2: {% for x in xs if x > 1 %} keeps the items the test holds for, with the loop variables bound in the test, and loop.index, loop.length, loop.last and the else branch count only the kept items. Before, the if tail was read as an inline-if on the whole iterable, evaluated once outside the loop, so a test that used the loop variable rendered nothing. As in Jinja2, loop in the test is the enclosing loop, and if( written without a space starts a filter too. An inline-if iterable without parentheses, {% for x in a if c else b %}, which Jinja2 rejects, still compiles as before.

* **Fixed** The swig-jinja2 README no longer says a dynamic {% extends %} takes string-literal paths only: it renders on the async render path (renderFile with an async loader) and throws on the sync path; a dynamic {% import %} or {% from %} still needs a string literal. Documentation only; no runtime or API change.

* **Fixed** On the async render path (renderFile(path, locals, cb) with a loader that sets loader.async, or a compile with codegenMode async), an {% include %}, {% import %}, {% from %} or {% block %} inside a for loop (its else or empty branch too), a with, a filter or apply tag, a set block or a Django spaceless block now renders as on the sync path, in all four flavors. Before, such a template failed to compile with "SyntaxError: missing ) after argument list" ({% from %} failed only when it ran, with "await is not defined"), since the async render path shipped in 2.2.0 (measured on 2.2.0, 2.9.2 and 2.9.3). The loop runs its items one after another, so the loop variables and loop.* keep their values. A macro whose body holds one of those tags is not supported on the async render path: calling it throws an error that names the macro and its template and says the async render path does not support those tags inside a macro, and a template that only defines it renders. This change leaves the sync path and every other compiled template unchanged.

* **Fixed** swig, swig-twig and swig-jinja2: an {% import %} or {% from %} on the sync render path no longer discards output. The compiled tag declared its own output variable, so a template lost everything it had rendered before the tag (a doctype line at the top of a page, or, when the tag sat in a block of an extends child, the parent output before the block), a for loop holding the tag rendered nothing, and a macro body lost what it had rendered before the tag. An import at the top of a template, before any output, was not affected. Every release had it (measured on 2.9.3; the native tag carried the declaration from the original project, and the swig-twig and swig-jinja2 tags since they were written). The async render path is unchanged.

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
