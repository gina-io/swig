var swig = require('../lib/swig'),
  expect = require('./lib/expect.js'),
  fs = require('fs');

describe('Regressions', function () {
  it('gh-285: preserves forward-slashes in text', function () {
    expect(swig.render('foo\\ blah \\ and stuff'))
      .to.equal('foo\\ blah \\ and stuff');
  });

  it('gh-303: sets work in loops', function () {
    var opts = { locals: { b: [1] }};
    expect(swig.render('{% set foo = "old" %}{% for a in b %}{% if a %}{% set foo = "new" %}{% endif %}{% endfor %}{{ foo }}', opts))
      .to.equal('new');
  });

  it('gh-322: logic words are not partially matched', function () {
    expect(swig.render('{{ org }}', { locals: { org: 'foo' }})).to.equal('foo');
    expect(swig.render('{{ andif }}', { locals: { andif: 'foo' }})).to.equal('foo');
    expect(swig.render('{{ note }}', { locals: { note: 'foo' }})).to.equal('foo');
    expect(swig.render('{{ truestuff }}', { locals: { truestuff: 'foo' }})).to.equal('foo');
    expect(swig.render('{{ falsey }}', { locals: { falsey: 'foo' }})).to.equal('foo');
  });

  it('gh-323: stuff', function () {
    var tpl = "{% set foo = {label:'account.label',value:page.code} %}",
      opts = { locals: { page: { code: 'tacos' }}};
    expect(swig.render(tpl + '{{ foo.value }}', opts)).to.equal('tacos');
  });

  // The following tests should *not* run in the browser
  if (!fs || !fs.readFileSync) {
    return;
  }

  it('gh-287: Options object overwrite exposure', function () {
    var opts = {};
    swig.compileFile(__dirname + '/cases/extends_1.test.html', opts);
    expect(Object.keys(opts)).to.eql([]);
  });

  it('CVE-2023-25345: __proto__ access is blocked in templates', function () {
    expect(function () { swig.render('{{ __proto__ }}'); }).to.throwError(/Unsafe access/);
    expect(function () { swig.render('{{ constructor }}'); }).to.throwError(/Unsafe access/);
    expect(function () { swig.render('{{ prototype }}'); }).to.throwError(/Unsafe access/);
    expect(function () { swig.render('{{ foo.__proto__ }}'); }).to.throwError(/Unsafe access/);
    expect(function () { swig.render('{{ foo.constructor }}'); }).to.throwError(/Unsafe access/);
    expect(function () { swig.render('{{ constructor.constructor }}'); }).to.throwError(/Unsafe access/);
  });

  it('CVE-2023-25345: __proto__ assignment is blocked via set tag', function () {
    expect(function () { swig.render('{% set __proto__ = "x" %}'); }).to.throwError(/Unsafe assignment/);
    expect(function () { swig.render('{% set constructor = "x" %}'); }).to.throwError(/Unsafe assignment/);
    expect(function () { swig.render('{% set foo.__proto__ = "x" %}'); }).to.throwError(/Unsafe assignment/);
  });

  it('CVE-2023-25345: bracket-notation prototype access is blocked', function () {
    expect(function () { swig.render('{{ foo["__proto__"] }}', { locals: { foo: {} } }); }).to.throwError(/Unsafe access/);
    expect(function () { swig.render('{{ foo["constructor"] }}', { locals: { foo: {} } }); }).to.throwError(/Unsafe access/);
    expect(function () { swig.render('{{ foo["prototype"] }}', { locals: { foo: {} } }); }).to.throwError(/Unsafe access/);
    // Single quotes
    expect(function () { swig.render("{{ foo['__proto__'] }}", { locals: { foo: {} } }); }).to.throwError(/Unsafe access/);
    // Chained brackets
    expect(function () { swig.render('{{ foo["bar"]["__proto__"] }}', { locals: { foo: { bar: {} } } }); }).to.throwError(/Unsafe access/);
    // Array literals containing dangerous strings must NOT be blocked
    expect(swig.render('{{ items[0] }}', { locals: { items: ['__proto__'] } })).to.equal('__proto__');
  });

  it('CVE-2023-25345: bracket-notation assignment is blocked in set tag', function () {
    expect(function () { swig.render('{% set foo["__proto__"] = "x" %}'); }).to.throwError(/Unsafe assignment/);
    expect(function () { swig.render('{% set foo["constructor"] = "x" %}'); }).to.throwError(/Unsafe assignment/);
    expect(function () { swig.render('{% set foo["prototype"] = "x" %}'); }).to.throwError(/Unsafe assignment/);
  });

  it('prototype-chain guard: a dot after a bracket or a space is checked in set tag', function () {
    // The lexer folds `foo.__proto__` into one VAR token, but a dot after a
    // bracket or after whitespace lexes as its own DOTKEY token.
    expect(function () { swig.render('{% set foo["bar"].__proto__ = "x" %}'); }).to.throwError(/Unsafe assignment/);
    expect(function () { swig.render('{% set foo .__proto__ = "x" %}'); }).to.throwError(/Unsafe assignment/);
    expect(function () { swig.render('{% set foo .constructor = "x" %}'); }).to.throwError(/Unsafe assignment/);
  });

  it('CVE-2023-25345: dangerous loop variable names are blocked in for tag', function () {
    expect(function () { swig.render('{% for __proto__ in items %}x{% endfor %}', { locals: { items: [1] } }); }).to.throwError(/Unsafe loop variable/);
    expect(function () { swig.render('{% for constructor in items %}x{% endfor %}', { locals: { items: [1] } }); }).to.throwError(/Unsafe loop variable/);
    expect(function () { swig.render('{% for prototype in items %}x{% endfor %}', { locals: { items: [1] } }); }).to.throwError(/Unsafe loop variable/);
    // Key variable
    expect(function () { swig.render('{% for __proto__, val in items %}{{ val }}{% endfor %}', { locals: { items: [1] } }); }).to.throwError(/Unsafe loop variable/);
  });

  it('CVE-2023-25345: dotted-path loop variables are rejected in for tag', function () {
    // The lexer folds dotted paths into a single VAR token, so a loop
    // variable like `foo.__proto__` slips past the _dangerousProps indexOf
    // check against the whole match. Loop variables bind to `_ctx.<name>` —
    // bare identifiers only.
    expect(function () { swig.render('{% for foo.__proto__ in items %}x{% endfor %}', { locals: { items: [1] } }); }).to.throwError(/must be a bare identifier/);
    expect(function () { swig.render('{% for foo.constructor in items %}x{% endfor %}', { locals: { items: [1] } }); }).to.throwError(/must be a bare identifier/);
    expect(function () { swig.render('{% for a.b, c in items %}x{% endfor %}', { locals: { items: [1] } }); }).to.throwError(/must be a bare identifier/);
    expect(function () { swig.render('{% for k, v.x in items %}x{% endfor %}', { locals: { items: [1] } }); }).to.throwError(/must be a bare identifier/);
  });

  it('CVE-2023-25345: dangerous macro names are blocked', function () {
    expect(function () { swig.render('{% macro __proto__() %}test{% endmacro %}'); }).to.throwError(/Unsafe macro name/);
    expect(function () { swig.render('{% macro constructor() %}test{% endmacro %}'); }).to.throwError(/Unsafe macro name/);
    expect(function () { swig.render('{% macro prototype() %}test{% endmacro %}'); }).to.throwError(/Unsafe macro name/);
    // No-args variant
    expect(function () { swig.render('{% macro __proto__() %}test{% endmacro %}'); }).to.throwError(/Unsafe macro name/);
  });

  it('prototype-chain guard: dangerous macro argument names are blocked', function () {
    expect(function () { swig.render('{% macro foo(__proto__) %}test{% endmacro %}'); }).to.throwError(/Unsafe macro argument/);
    expect(function () { swig.render('{% macro foo(a, constructor) %}test{% endmacro %}'); }).to.throwError(/Unsafe macro argument/);
  });

  it('prototype-chain guard: dangerous macro names are blocked when the macro takes arguments', function () {
    expect(function () { swig.render('{% macro __proto__(a) %}test{% endmacro %}'); }).to.throwError(/Unsafe macro name/);
    expect(function () { swig.render('{% macro constructor(a, b) %}test{% endmacro %}'); }).to.throwError(/Unsafe macro name/);
  });

  it('CVE-2023-25345: dangerous import aliases are blocked', function () {
    var s = new swig.Swig({ loader: swig.loaders.memory({ 'macros.html': '{% macro foo() %}test{% endmacro %}' }) });
    expect(function () { s.render('{% import "macros.html" as __proto__ %}', { filename: '/test.html' }); }).to.throwError(/Unsafe import alias/);
    expect(function () { s.render('{% import "macros.html" as constructor %}', { filename: '/test.html' }); }).to.throwError(/Unsafe import alias/);
    expect(function () { s.render('{% import "macros.html" as prototype %}', { filename: '/test.html' }); }).to.throwError(/Unsafe import alias/);
  });

  it('CVE-2023-25345: dangerous props are blocked in ternary branches', function () {
    // Ternary branches lower through the same parsePrimary path as any
    // other expression, so the _dangerousProps guard fires on a dangerous
    // identifier in the condition, the then-branch, or the else-branch.
    expect(function () { swig.render('{{ x ? __proto__ : "safe" }}', { locals: { x: true } }); }).to.throwError(/Unsafe access/);
    expect(function () { swig.render('{{ x ? "safe" : constructor }}', { locals: { x: false } }); }).to.throwError(/Unsafe access/);
    expect(function () { swig.render('{{ __proto__ ? "a" : "b" }}'); }).to.throwError(/Unsafe access/);
    expect(function () { swig.render('{{ x ? a.__proto__ : "safe" }}', { locals: { x: true, a: {} } }); }).to.throwError(/Unsafe access/);
    expect(function () { swig.render('{{ x ?: constructor }}', { locals: { x: false } }); }).to.throwError(/Unsafe access/);
  });

  it('CVE-2023-25345: dangerous props are blocked in ternary branches inside tag arguments', function () {
    // Tag-argument ternary branches reach parseExpr's parsePrimary guard
    // via lowerExpr, and the legacy parseToken walk's parseVar guard now
    // reaches the branch tokens too (the walk no longer aborts on the
    // ternary colon). Either layer rejects a dangerous identifier in
    // either branch.
    // set RHS
    expect(function () { swig.render('{% set r = c ? __proto__ : "safe" %}', { locals: { c: true } }); }).to.throwError(/Unsafe access/);
    expect(function () { swig.render('{% set r = c ? "safe" : constructor %}', { locals: { c: false } }); }).to.throwError(/Unsafe access/);
    expect(function () { swig.render('{% set r = c ?: prototype %}', { locals: { c: false } }); }).to.throwError(/Unsafe access/);
    expect(function () { swig.render('{% set r = c ? a.__proto__ : "safe" %}', { locals: { c: true, a: {} } }); }).to.throwError(/Unsafe access/);
    // if condition
    expect(function () { swig.render('{% if c ? __proto__ : "safe" %}x{% endif %}', { locals: { c: true } }); }).to.throwError(/Unsafe access/);
    expect(function () { swig.render('{% if c ? "safe" : constructor %}x{% endif %}', { locals: { c: false } }); }).to.throwError(/Unsafe access/);
    // for iterable
    expect(function () { swig.render('{% for v in c ? prototype : items %}{{ v }}{% endfor %}', { locals: { c: true, items: [] } }); }).to.throwError(/Unsafe access/);
    expect(function () { swig.render('{% for v in c ? items : __proto__ %}{{ v }}{% endfor %}', { locals: { c: false, items: [] } }); }).to.throwError(/Unsafe access/);
    // A dangerous *string literal* as a branch value is data, not access — must NOT be blocked.
    expect(swig.render('{% set r = c ? "__proto__" : "safe" %}{{ r }}', { locals: { c: true } })).to.equal('__proto__');
  });

  it('CVE-2023-25345: filesystem loader rejects paths escaping the basepath root', function () {
    var path = require('path'),
      root = path.resolve('/srv/app/views'),
      l = swig.loaders.fs(root);
    // In-root paths resolve normally.
    expect(l.resolve('partials/menu.html')).to.equal(path.resolve(root, 'partials/menu.html'));
    expect(l.resolve('./page.html')).to.equal(path.resolve(root, 'page.html'));
    // Resolving to the root directory itself is allowed.
    expect(l.resolve('.')).to.equal(root);
    // Escaping the root via ../ is rejected (the CVE-2023-25345 vector).
    expect(function () { l.resolve('../../../etc/passwd'); }).to.throwError(/resolves outside the loader root/);
    expect(function () { l.resolve('../secret.txt'); }).to.throwError(/resolves outside the loader root/);
    // A sibling directory sharing a name prefix must not bypass the check.
    expect(function () { l.resolve('../views-secret/x.html'); }).to.throwError(/resolves outside the loader root/);
    // The `from` argument cannot be used to escape either (basepath always wins).
    expect(function () { l.resolve('../secret.txt', path.resolve(root, 'deep/page.html')); }).to.throwError(/resolves outside the loader root/);
  });

  it('CVE-2023-25345: allowOutsideRoot opts out of basepath confinement', function () {
    var path = require('path'),
      root = path.resolve('/srv/app/views'),
      l = swig.loaders.fs(root, 'utf8', true);
    // With the opt-out, an escaping path resolves without throwing (pre-fix behavior).
    expect(l.resolve('../secret.txt')).to.equal(path.resolve(root, '../secret.txt'));
    // In-root paths are unaffected by the opt-out.
    expect(l.resolve('page.html')).to.equal(path.resolve(root, 'page.html'));
  });

  it('CVE-2023-25345: include cannot read files outside the loader root', function () {
    var path = require('path'),
      os = require('os'),
      base = fs.mkdtempSync(path.join(os.tmpdir(), 'swig-cve-25345-')),
      views = path.join(base, 'views'),
      s;
    fs.mkdirSync(views);
    fs.writeFileSync(path.join(base, 'secret.txt'), 'TOP-SECRET');
    fs.writeFileSync(path.join(views, 'partial.html'), 'in-root-ok');
    s = new swig.Swig({ loader: swig.loaders.fs(views), cache: false });
    try {
      // In-root include still renders.
      expect(s.render('{% include "./partial.html" %}', { filename: path.join(views, 'a.html') }))
        .to.equal('in-root-ok');
      // Literal traversal out of the root is blocked.
      expect(function () {
        s.render('{% include "../secret.txt" %}', { filename: path.join(views, 'b.html') });
      }).to.throwError(/resolves outside the loader root/);
      // The dangerous vector: an include path supplied via untrusted locals is blocked too.
      expect(function () {
        s.render('{% include leak %}', { filename: path.join(views, 'c.html'), locals: { leak: '../secret.txt' } });
      }).to.throwError(/resolves outside the loader root/);
    } finally {
      fs.unlinkSync(path.join(base, 'secret.txt'));
      fs.unlinkSync(path.join(views, 'partial.html'));
      fs.rmdirSync(views);
      fs.rmdirSync(base);
    }
  });

  it('CVE-2023-25345: a relative basepath still resolves in-root paths (no false-positive rejection)', function () {
    var path = require('path'),
      // A relative basepath is a working, documented mode; the root check
      // must keep resolving in-root templates instead of rejecting every path
      // (an absolute resolved path can never be prefixed by a relative root).
      l = swig.loaders.fs('relbase-views');
    expect(l.resolve('page.html')).to.equal(path.resolve('relbase-views', 'page.html'));
    expect(l.resolve('sub/menu.html')).to.equal(path.resolve('relbase-views', 'sub/menu.html'));
    // Confinement is still enforced when the basepath is relative.
    expect(function () { l.resolve('../secret.txt'); }).to.throwError(/resolves outside the loader root/);
  });

  it('lexer NUMBER rule does not greedy-eat a leading sign in bracket-access expressions', function () {
    var locals = { arr: [10, 20, 30], idx: 2 };
    // Without the fix, the lexer matched `-1` as a single NUMBER token,
    // so `arr[arr.length-1]` lexed VAR + DOTKEY + NUMBER(-1) + `]`,
    // and the parser then bailed with "Unexpected closing square bracket".
    expect(swig.render('{% set a = arr[arr.length-1] %}{{ a }}', { locals: locals })).to.equal('30');
    expect(swig.render('{% set a = arr[arr.length - 1] %}{{ a }}', { locals: locals })).to.equal('30');
    expect(swig.render('{% set a = arr[idx-1] %}{{ a }}', { locals: locals })).to.equal('20');
    expect(swig.render('{% set a = arr[idx - 1] %}{{ a }}', { locals: locals })).to.equal('20');
    // Symmetric `+` shape — same trap, same fix.
    expect(swig.render('{% set a = arr[idx+0] %}{{ a }}', { locals: locals })).to.equal('30');
    expect(swig.render('{% set a = arr[idx-2] %}{{ a }}', { locals: locals })).to.equal('10');
    // The `*` / `/` / `%` operators don't share the trap (the NUMBER regex
    // never had `*?` / `/?` / `%?` prefix), but assert the round-trip so
    // a future lexer change can't silently regress them.
    expect(swig.render('{% set a = arr[idx*1] %}{{ a }}', { locals: locals })).to.equal('30');
    expect(swig.render('{% set a = arr[idx/1] %}{{ a }}', { locals: locals })).to.equal('30');
  });

  it('lexer NUMBER fix preserves unary-minus paths the parser folds via parsePrimary', function () {
    expect(swig.render('{% set x = -5 %}{{ x }}')).to.equal('-5');
    expect(swig.render('{% set x = -1.5 %}{{ x }}')).to.equal('-1.5');
    expect(swig.render('{{ a + -5 }}', { locals: { a: 10 } })).to.equal('5');
    expect(swig.render('{{ a - -5 }}', { locals: { a: 10 } })).to.equal('15');
  });

  it('varStrip / tagStrip do not greedy-eat a leading - of negative-number expressions', function () {
    // Before the fix, lib/parser.js's varStrip / tagStrip regex used
    // `^{{-?\s*-?|-?\s*-?}}$` — the second `-?` after `\s*` matched the
    // leading `-` of a negative-number expression as if it were a
    // whitespace-control marker. `{{ -5 }}` rendered as "5" (sign eaten
    // before the lexer ever saw it).
    expect(swig.render('{{ -5 }}')).to.equal('-5');
    expect(swig.render('{{ -1.5 }}')).to.equal('-1.5');
    expect(swig.render('{{ -5.0 }}')).to.equal('-5');
    // Strip-control still composes with negative-number expressions —
    // `{{-` and `-}}` consume only the strip marker (immediately adjacent
    // to the open / close), the expression's `-` survives.
    expect(swig.render('a\n{{- -5 -}}\nb')).to.equal('a-5b');
    expect(swig.render('a\n{{- -5 }}\nb')).to.equal('a-5\nb');
    expect(swig.render('a\n{{ -5 -}}\nb')).to.equal('a\n-5b');
    // Existing strip-control on regular variables still works.
    expect(swig.render('a\n{{- x -}}\nb', { locals: { x: 'y' } })).to.equal('ayb');
  });

  it('CVE-2021-44906: optimist is no longer a direct dependency', function () {
    // swig -> optimist@0.6.1 -> minimist@~0.0.1 was vulnerable to
    // prototype pollution. optimist was first replaced by yargs (v1.4.5),
    // and yargs in turn by a zero-dependency CLI argument parser. Verify
    // the vulnerable optimist path is gone.
    var deps = require('../package.json').dependencies;
    expect(deps).to.not.have.property('optimist');
  });

  it('keeps the runtime dependency surface to @rhinostone/swig-core only', function () {
    // CLI-only tooling (argument parsing, the --minify minifier) must not
    // sit in production `dependencies` — a library install of swig should
    // pull in nothing but @rhinostone/swig-core. A new runtime dependency
    // tripping this assertion should be a deliberate decision, not an
    // unnoticed regression in the supply-chain surface.
    var deps = require('../package.json').dependencies;
    expect(Object.keys(deps)).to.eql(['@rhinostone/swig-core']);
  });
});

describe('GHSA-q89c: resolveFrom filename escaping', function () {
  var twig = require('@rhinostone/swig-twig');

  // A double quote in the `filename` option must not break out of the
  // resolveFrom string literal in the compiled body (GHSA-q89c). precompile
  // builds the function via new Function / AsyncFunction, so an unescaped
  // quote throws here on the unpatched code; the escaped literal is asserted.
  it('sync include: escapes a double quote in the filename', function () {
    var body = swig.precompile('{% include "p.html" %}', { filename: 'a"b.html' }).tpl.toString();
    expect(body).to.contain('resolveFrom: "a\\"b.html"');
  });

  it('async include: escapes a double quote in the filename', function () {
    var body = swig.precompile('{% include "p.html" %}', { filename: 'a"b.html', codegenMode: 'async' }).tpl.toString();
    expect(body).to.contain('resolveFrom: "a\\"b.html"');
  });

  it('async import: escapes a double quote in the filename', function () {
    var body = swig.precompile('{% import "m.html" as m %}', { filename: 'a"b.html', codegenMode: 'async' }).tpl.toString();
    expect(body).to.contain('resolveFrom: "a\\"b.html"');
  });

  it('async extends: escapes a double quote in the filename', function () {
    var body = swig.precompile('{% extends "b.html" %}', { filename: 'a"b.html', codegenMode: 'async' }).tpl.toString();
    expect(body).to.contain('resolveFrom: "a\\"b.html"');
  });

  it('async from import (twig): escapes a double quote in the filename', function () {
    var body = twig.precompile('{% from "m.twig" import a %}', { filename: 'a"b.html', codegenMode: 'async' }).tpl.toString();
    expect(body).to.contain('resolveFrom: "a\\"b.html"');
  });

  // import / from / extends passed resolveFrom raw, so a backslash in the
  // filename produced broken JS before the fix (latent Windows-path bug).
  it('async import: escapes backslashes in the filename', function () {
    var body = swig.precompile('{% import "m.html" as m %}', { filename: 'C:\\d\\f.html', codegenMode: 'async' }).tpl.toString();
    expect(body).to.contain('resolveFrom: "C:\\\\d\\\\f.html"');
  });
});

describe('Non-string filename option', function () {
  var twig = require('@rhinostone/swig-twig');

  // The code generator escapes the filename (resolveFrom) before writing it
  // into the compiled body; a number used to reach the escape as a number and
  // throw "value.replace is not a function". It is converted to a string
  // first, so the body carries the text a number had before the escape.
  it('sync include: compiles with a numeric filename', function () {
    var body = swig.precompile('{% include "p.html" %}', { filename: 123 }).tpl.toString();
    expect(body).to.contain('resolveFrom: "123"');
  });

  it('async include: compiles with a numeric filename', function () {
    var body = swig.precompile('{% include "p.html" %}', { filename: 123, codegenMode: 'async' }).tpl.toString();
    expect(body).to.contain('resolveFrom: "123"');
  });

  it('async import: compiles with a numeric filename', function () {
    var body = swig.precompile('{% import "m.html" as m %}', { filename: 123, codegenMode: 'async' }).tpl.toString();
    expect(body).to.contain('resolveFrom: "123"');
  });

  it('async extends: compiles with a numeric filename', function () {
    var body = swig.precompile('{% extends "b.html" %}', { filename: 123, codegenMode: 'async' }).tpl.toString();
    expect(body).to.contain('resolveFrom: "123"');
  });

  it('async from import (twig): compiles with a numeric filename', function () {
    var body = twig.precompile('{% from "m.twig" import a %}', { filename: 123, codegenMode: 'async' }).tpl.toString();
    expect(body).to.contain('resolveFrom: "123"');
  });

  it('include: the loader receives the numeric filename as a string', function () {
    var seen = [],
      inst = new swig.Swig({
        cache: false,
        loader: {
          resolve: function (to, from) { seen.push(from); return to; },
          load: function (id) { return id === 'c.html' ? 'C' : ''; }
        }
      });
    expect(inst.render('[{% include "c.html" %}]', { filename: 123 })).to.equal('[C]');
    expect(seen.length).to.equal(1);
    expect(seen[0]).to.equal('123');
  });
});

describe('Autoescape option set to an escape strategy name', function () {
  var x = { x: '<a href="u">' },
    js = '\\u003Ca href\\u003D\\u0022u\\u0022\\u003E',
    html = '&lt;a href=&quot;u&quot;&gt;',
    rejected = /Option "autoescape" must be true, false or an escape strategy name/;

  // The option is handed to the e filter as its strategy argument. It used to
  // be written into the compiled template as code, so 'js' and 'html' were read
  // as identifiers and rendering threw a ReferenceError.
  it('autoescape: "js" escapes for JavaScript', function () {
    expect(swig.render('{{ x }}', { autoescape: 'js', locals: x })).to.equal(js);
  });

  it('autoescape: "html" escapes for HTML', function () {
    expect(swig.render('{{ x }}', { autoescape: 'html', locals: x })).to.equal(html);
  });

  it('a strategy name the e filter does not know falls back to HTML escaping', function () {
    expect(swig.render('{{ x }}', { autoescape: 'css', locals: x })).to.equal(html);
  });

  it('writes the option into the compiled template as a string literal', function () {
    expect(swig.precompile('{{ x }}', { autoescape: 'js' }).tpl.toString()).to.contain(', "js")');
  });

  it('a value already wrapped in quotes keeps working', function () {
    expect(swig.render('{{ x }}', { autoescape: "'js'", locals: x })).to.equal(js);
    expect(swig.render('{{ x }}', { autoescape: '"js"', locals: x })).to.equal(js);
  });

  it('a backslash in the value stays part of the strategy name', function () {
    expect(swig.render('{{ x }}', { autoescape: 'a\\b', locals: x })).to.equal(html);
  });

  it('rejects a value holding a double quote or a line break', function () {
    expect(function () { swig.render('{{ x }}', { autoescape: 'a"b', locals: x }); }).to.throwError(rejected);
    expect(function () { swig.render('{{ x }}', { autoescape: 'a\nb', locals: x }); }).to.throwError(rejected);
    expect(function () { swig.render('{{ x }}', { autoescape: 'a\rb', locals: x }); }).to.throwError(rejected);
  });

  it('an empty string still turns escaping off', function () {
    expect(swig.render('{{ x }}', { autoescape: '', locals: x })).to.equal('<a href="u">');
  });

  it('applies again after an {% autoescape %} region ends', function () {
    expect(swig.render('{% autoescape false %}{{ x }}{% endautoescape %}|{{ x }}', { autoescape: 'js', locals: x }))
      .to.equal('<a href="u">|' + js);
  });

  it('reaches imported macros, included templates and extended parents', function () {
    var inst = new swig.Swig({
      autoescape: 'js',
      cache: false,
      loader: swig.loaders.memory({
        'm.html': '{% macro m(v) %}[{{ v }}]{% endmacro %}',
        'c.html': '({{ x }})',
        'p.html': '<{{ x }}{% block b %}{% endblock %}>',
        'page.html': '{% import "m.html" as lib %}{{ lib.m(x) }}{% include "c.html" %}',
        'child.html': '{% extends "p.html" %}{% block b %}|{{ x }}{% endblock %}'
      })
    });
    expect(inst.renderFile('page.html', x)).to.equal('[' + js + '](' + js + ')');
    expect(inst.renderFile('child.html', x)).to.equal('<' + js + '|' + js + '>');
  });
});

describe('Regressions — filters in linear time on long template data', function () {
  // The striptags regex took time quadratic in the input length on many <
  // with no > after them: about 5 s for 100 000 characters.
  it('striptags renders 100 000 < in well under a second, with the same output', function () {
    var s = '<'.repeat(100000), t0 = Date.now(), out;
    out = swig.render('{{ x|striptags }}', { locals: { x: s } });
    expect(Date.now() - t0).to.be.lessThan(500);
    expect(out).to.equal('&lt;'.repeat(100000));
  });

  it('striptags keeps removing tags and keeps <> and a lone <', function () {
    var filters = require('../lib/filters');
    expect(filters.striptags('<p>foo</p> <b class="x">bar</b>')).to.equal('foo bar');
    expect(filters.striptags('a<>b<c')).to.equal('a<>b<c');
    expect(filters.striptags('<<a>b>')).to.equal('b>');
  });
});
