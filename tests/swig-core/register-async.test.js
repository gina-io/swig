var swigModule = require('../../lib/swig'),
  twigModule = require('@rhinostone/swig-twig'),
  jinja2Module = require('@rhinostone/swig-jinja2'),
  djangoModule = require('@rhinostone/swig-django'),
  runtimeModule = require('../../lib/runtime'),
  loaders = require('@rhinostone/swig-core/lib/loaders'),
  runCapped = require('../lib/run-capped.js'),
  expect = require('../lib/expect.js');

/*!
 * A template function compiled with codegenMode 'async' and registered with
 * register(), registerBundle() or run(tpl, locals, path) is used on the async
 * render path: renderFile with a callback on an async loader, compileFile with
 * codegenMode 'async', and the include, import, from and extends of templates
 * rendered on that path read it before the loader. It then takes part in the
 * render that reaches it, as a template from the loader does: a set in a
 * registered include reaches the page, and a registered template that
 * includes or extends itself stops with the nesting or the circular-extends
 * error. A sync-compiled registration keeps to the sync calls, which these
 * tests also pin. The tests are generated from the recorded outputs of a
 * probe, in each flavor that has the tag; the last group runs in child
 * processes whose heap is capped at 64 MB, so a render that never ends aborts
 * that child instead of the test run.
 */

var FLAVORS = {
  native: { lib: swigModule, ctor: 'Swig', mod: require.resolve('../../lib/swig') },
  twig: { lib: twigModule, ctor: 'Twig', mod: require.resolve('@rhinostone/swig-twig') },
  jinja2: { lib: jinja2Module, ctor: 'Jinja2', mod: require.resolve('@rhinostone/swig-jinja2') },
  django: { lib: djangoModule, ctor: 'Django', mod: require.resolve('@rhinostone/swig-django') }
};
var LOADERS = require.resolve('@rhinostone/swig-core/lib/loaders');

var SRC = {
  part: 'P{{ x }}',
  partL: 'L{{ x }}',
  partSet: '{% set y = "Y" %}P',
  partSetX: '{% set y = "Y" %}P{{ x }}',
  partD: 'P{{ d }}{{ x }}',
  mac: '{% macro f() %}M{% endmacro %}',
  macL: '{% macro f() %}L{% endmacro %}',
  base: '[{% block b %}B{% endblock %}]',
  baseL: '<{% block b %}L{% endblock %}>',
  page: '[{% include "/part.html" %}]',
  pageY: '[{% include "/part.html" %}{{ y }}]',
  pageImp: '[{% import "/mac.html" as m %}{{ m.f() }}]',
  pageFrom: '[{% from "/mac.html" import f %}{{ f() }}]',
  child: '{% extends "/base.html" %}{% block b %}C{% endblock %}',
  selfInc: 'x{% include "/part.html" %}',
  selfExt: '{% extends "/base.html" %}{% block b %}C{% endblock %}'
};

// One case: a fresh instance with the memory loader over `files` (wrapped in an
// async loader on the async path), the templates of `reg` precompiled on another
// instance (sync-compiled for body S, with codegenMode 'async' for body A) and
// registered with register(), registerBundle() or run(), then `entry` rendered
// with { x: 1 }. path: 'async' renderFile with a callback; 'sync' renderFile;
// 'compileFile' compileFile(entry)(locals); 'compileFileAsync' compileFile(entry,
// { codegenMode: 'async' }, cb), then the function; 'runtime' the runtime-only
// build's renderFile with a callback. want: the output, 'PROMISE <output>' for a
// call that returns a Promise, or 'THROW <start of the message>'.
var ASYNC_CASES = [
  { id: 'T1', title: 'renderFile of a name only registered', flavor: 'native', body: 'S', path: 'async', how: 'register', reg: { '/part.html': 'part' }, files: {}, entry: '/part.html', want: 'THROW Unable to find template "/part.html"' },
  { id: 'T1', title: 'renderFile of a name only registered', flavor: 'native', body: 'A', path: 'async', how: 'register', reg: { '/part.html': 'part' }, files: {}, entry: '/part.html', want: 'P1' },
  { id: 'T1', title: 'renderFile of a name only registered', flavor: 'twig', body: 'S', path: 'async', how: 'register', reg: { '/part.html': 'part' }, files: {}, entry: '/part.html', want: 'THROW Unable to find template "/part.html"' },
  { id: 'T1', title: 'renderFile of a name only registered', flavor: 'twig', body: 'A', path: 'async', how: 'register', reg: { '/part.html': 'part' }, files: {}, entry: '/part.html', want: 'P1' },
  { id: 'T1', title: 'renderFile of a name only registered', flavor: 'jinja2', body: 'S', path: 'async', how: 'register', reg: { '/part.html': 'part' }, files: {}, entry: '/part.html', want: 'THROW Unable to find template "/part.html"' },
  { id: 'T1', title: 'renderFile of a name only registered', flavor: 'jinja2', body: 'A', path: 'async', how: 'register', reg: { '/part.html': 'part' }, files: {}, entry: '/part.html', want: 'P1' },
  { id: 'T1', title: 'renderFile of a name only registered', flavor: 'django', body: 'S', path: 'async', how: 'register', reg: { '/part.html': 'part' }, files: {}, entry: '/part.html', want: 'THROW Unable to find template "/part.html"' },
  { id: 'T1', title: 'renderFile of a name only registered', flavor: 'django', body: 'A', path: 'async', how: 'register', reg: { '/part.html': 'part' }, files: {}, entry: '/part.html', want: 'P1' },
  { id: 'I1', title: 'include of a name only registered', flavor: 'native', body: 'S', path: 'async', how: 'register', reg: { '/part.html': 'part' }, files: { '/page.html': 'page' }, entry: '/page.html', want: 'THROW Unable to find template "/part.html"' },
  { id: 'I1', title: 'include of a name only registered', flavor: 'native', body: 'A', path: 'async', how: 'register', reg: { '/part.html': 'part' }, files: { '/page.html': 'page' }, entry: '/page.html', want: '[P1]' },
  { id: 'I1', title: 'include of a name only registered', flavor: 'twig', body: 'S', path: 'async', how: 'register', reg: { '/part.html': 'part' }, files: { '/page.html': 'page' }, entry: '/page.html', want: 'THROW Unable to find template "/part.html"' },
  { id: 'I1', title: 'include of a name only registered', flavor: 'twig', body: 'A', path: 'async', how: 'register', reg: { '/part.html': 'part' }, files: { '/page.html': 'page' }, entry: '/page.html', want: '[P1]' },
  { id: 'I1', title: 'include of a name only registered', flavor: 'jinja2', body: 'S', path: 'async', how: 'register', reg: { '/part.html': 'part' }, files: { '/page.html': 'page' }, entry: '/page.html', want: 'THROW Unable to find template "/part.html"' },
  { id: 'I1', title: 'include of a name only registered', flavor: 'jinja2', body: 'A', path: 'async', how: 'register', reg: { '/part.html': 'part' }, files: { '/page.html': 'page' }, entry: '/page.html', want: '[P1]' },
  { id: 'I1', title: 'include of a name only registered', flavor: 'django', body: 'S', path: 'async', how: 'register', reg: { '/part.html': 'part' }, files: { '/page.html': 'page' }, entry: '/page.html', want: 'THROW Unable to find template "/part.html"' },
  { id: 'I1', title: 'include of a name only registered', flavor: 'django', body: 'A', path: 'async', how: 'register', reg: { '/part.html': 'part' }, files: { '/page.html': 'page' }, entry: '/page.html', want: '[P1]' },
  { id: 'I2', title: 'include of a name registered and in the loader', flavor: 'native', body: 'S', path: 'async', how: 'register', reg: { '/part.html': 'part' }, files: { '/page.html': 'page', '/part.html': 'partL' }, entry: '/page.html', want: '[L1]' },
  { id: 'I2', title: 'include of a name registered and in the loader', flavor: 'native', body: 'A', path: 'async', how: 'register', reg: { '/part.html': 'part' }, files: { '/page.html': 'page', '/part.html': 'partL' }, entry: '/page.html', want: '[P1]' },
  { id: 'I2', title: 'include of a name registered and in the loader', flavor: 'twig', body: 'S', path: 'async', how: 'register', reg: { '/part.html': 'part' }, files: { '/page.html': 'page', '/part.html': 'partL' }, entry: '/page.html', want: '[L1]' },
  { id: 'I2', title: 'include of a name registered and in the loader', flavor: 'twig', body: 'A', path: 'async', how: 'register', reg: { '/part.html': 'part' }, files: { '/page.html': 'page', '/part.html': 'partL' }, entry: '/page.html', want: '[P1]' },
  { id: 'I2', title: 'include of a name registered and in the loader', flavor: 'jinja2', body: 'S', path: 'async', how: 'register', reg: { '/part.html': 'part' }, files: { '/page.html': 'page', '/part.html': 'partL' }, entry: '/page.html', want: '[L1]' },
  { id: 'I2', title: 'include of a name registered and in the loader', flavor: 'jinja2', body: 'A', path: 'async', how: 'register', reg: { '/part.html': 'part' }, files: { '/page.html': 'page', '/part.html': 'partL' }, entry: '/page.html', want: '[P1]' },
  { id: 'I2', title: 'include of a name registered and in the loader', flavor: 'django', body: 'S', path: 'async', how: 'register', reg: { '/part.html': 'part' }, files: { '/page.html': 'page', '/part.html': 'partL' }, entry: '/page.html', want: '[L1]' },
  { id: 'I2', title: 'include of a name registered and in the loader', flavor: 'django', body: 'A', path: 'async', how: 'register', reg: { '/part.html': 'part' }, files: { '/page.html': 'page', '/part.html': 'partL' }, entry: '/page.html', want: '[P1]' },
  { id: 'C1', title: 'set in a registered include, read by the page', flavor: 'native', body: 'S', path: 'async', how: 'register', reg: { '/part.html': 'partSet' }, files: { '/page.html': 'pageY' }, entry: '/page.html', want: 'THROW Unable to find template "/part.html"' },
  { id: 'C1', title: 'set in a registered include, read by the page', flavor: 'native', body: 'A', path: 'async', how: 'register', reg: { '/part.html': 'partSet' }, files: { '/page.html': 'pageY' }, entry: '/page.html', want: '[PY]' },
  { id: 'C1', title: 'set in a registered include, read by the page', flavor: 'twig', body: 'S', path: 'async', how: 'register', reg: { '/part.html': 'partSet' }, files: { '/page.html': 'pageY' }, entry: '/page.html', want: 'THROW Unable to find template "/part.html"' },
  { id: 'C1', title: 'set in a registered include, read by the page', flavor: 'twig', body: 'A', path: 'async', how: 'register', reg: { '/part.html': 'partSet' }, files: { '/page.html': 'pageY' }, entry: '/page.html', want: '[PY]' },
  { id: 'C1', title: 'set in a registered include, read by the page', flavor: 'jinja2', body: 'S', path: 'async', how: 'register', reg: { '/part.html': 'partSet' }, files: { '/page.html': 'pageY' }, entry: '/page.html', want: 'THROW Unable to find template "/part.html"' },
  { id: 'C1', title: 'set in a registered include, read by the page', flavor: 'jinja2', body: 'A', path: 'async', how: 'register', reg: { '/part.html': 'partSet' }, files: { '/page.html': 'pageY' }, entry: '/page.html', want: '[PY]' },
  { id: 'C2', title: 'top-level render, and the locals object the caller passed', flavor: 'native', body: 'S', path: 'async', how: 'register', reg: { '/part.html': 'partSetX' }, files: {}, entry: '/part.html', want: 'THROW Unable to find template "/part.html"', caller: '{"x":1}' },
  { id: 'C2', title: 'top-level render, and the locals object the caller passed', flavor: 'native', body: 'A', path: 'async', how: 'register', reg: { '/part.html': 'partSetX' }, files: {}, entry: '/part.html', want: 'P1', caller: '{"x":1}' },
  { id: 'C2', title: 'top-level render, and the locals object the caller passed', flavor: 'twig', body: 'S', path: 'async', how: 'register', reg: { '/part.html': 'partSetX' }, files: {}, entry: '/part.html', want: 'THROW Unable to find template "/part.html"', caller: '{"x":1}' },
  { id: 'C2', title: 'top-level render, and the locals object the caller passed', flavor: 'twig', body: 'A', path: 'async', how: 'register', reg: { '/part.html': 'partSetX' }, files: {}, entry: '/part.html', want: 'P1', caller: '{"x":1}' },
  { id: 'C2', title: 'top-level render, and the locals object the caller passed', flavor: 'jinja2', body: 'S', path: 'async', how: 'register', reg: { '/part.html': 'partSetX' }, files: {}, entry: '/part.html', want: 'THROW Unable to find template "/part.html"', caller: '{"x":1}' },
  { id: 'C2', title: 'top-level render, and the locals object the caller passed', flavor: 'jinja2', body: 'A', path: 'async', how: 'register', reg: { '/part.html': 'partSetX' }, files: {}, entry: '/part.html', want: 'P1', caller: '{"x":1}' },
  { id: 'D1', title: 'include of a registered name, with default locals', flavor: 'native', body: 'S', path: 'async', how: 'register', reg: { '/part.html': 'partD' }, files: { '/page.html': 'page' }, entry: '/page.html', opts: { 'locals': { 'd': 'D' } }, want: 'THROW Unable to find template "/part.html"' },
  { id: 'D1', title: 'include of a registered name, with default locals', flavor: 'native', body: 'A', path: 'async', how: 'register', reg: { '/part.html': 'partD' }, files: { '/page.html': 'page' }, entry: '/page.html', opts: { 'locals': { 'd': 'D' } }, want: '[PD1]' },
  { id: 'D1', title: 'include of a registered name, with default locals', flavor: 'twig', body: 'S', path: 'async', how: 'register', reg: { '/part.html': 'partD' }, files: { '/page.html': 'page' }, entry: '/page.html', opts: { 'locals': { 'd': 'D' } }, want: 'THROW Unable to find template "/part.html"' },
  { id: 'D1', title: 'include of a registered name, with default locals', flavor: 'twig', body: 'A', path: 'async', how: 'register', reg: { '/part.html': 'partD' }, files: { '/page.html': 'page' }, entry: '/page.html', opts: { 'locals': { 'd': 'D' } }, want: '[PD1]' },
  { id: 'D1', title: 'include of a registered name, with default locals', flavor: 'jinja2', body: 'S', path: 'async', how: 'register', reg: { '/part.html': 'partD' }, files: { '/page.html': 'page' }, entry: '/page.html', opts: { 'locals': { 'd': 'D' } }, want: 'THROW Unable to find template "/part.html"' },
  { id: 'D1', title: 'include of a registered name, with default locals', flavor: 'jinja2', body: 'A', path: 'async', how: 'register', reg: { '/part.html': 'partD' }, files: { '/page.html': 'page' }, entry: '/page.html', opts: { 'locals': { 'd': 'D' } }, want: '[PD1]' },
  { id: 'D1', title: 'include of a registered name, with default locals', flavor: 'django', body: 'S', path: 'async', how: 'register', reg: { '/part.html': 'partD' }, files: { '/page.html': 'page' }, entry: '/page.html', opts: { 'locals': { 'd': 'D' } }, want: 'THROW Unable to find template "/part.html"' },
  { id: 'D1', title: 'include of a registered name, with default locals', flavor: 'django', body: 'A', path: 'async', how: 'register', reg: { '/part.html': 'partD' }, files: { '/page.html': 'page' }, entry: '/page.html', opts: { 'locals': { 'd': 'D' } }, want: '[PD1]' },
  { id: 'M1', title: 'import of a name only registered', flavor: 'native', body: 'S', path: 'async', how: 'register', reg: { '/mac.html': 'mac' }, files: { '/page.html': 'pageImp' }, entry: '/page.html', want: 'THROW Unable to find template "/mac.html"' },
  { id: 'M1', title: 'import of a name only registered', flavor: 'native', body: 'A', path: 'async', how: 'register', reg: { '/mac.html': 'mac' }, files: { '/page.html': 'pageImp' }, entry: '/page.html', want: '[M]' },
  { id: 'M1', title: 'import of a name only registered', flavor: 'twig', body: 'S', path: 'async', how: 'register', reg: { '/mac.html': 'mac' }, files: { '/page.html': 'pageImp' }, entry: '/page.html', want: 'THROW Unable to find template "/mac.html"' },
  { id: 'M1', title: 'import of a name only registered', flavor: 'twig', body: 'A', path: 'async', how: 'register', reg: { '/mac.html': 'mac' }, files: { '/page.html': 'pageImp' }, entry: '/page.html', want: '[M]' },
  { id: 'M1', title: 'import of a name only registered', flavor: 'jinja2', body: 'S', path: 'async', how: 'register', reg: { '/mac.html': 'mac' }, files: { '/page.html': 'pageImp' }, entry: '/page.html', want: 'THROW Unable to find template "/mac.html"' },
  { id: 'M1', title: 'import of a name only registered', flavor: 'jinja2', body: 'A', path: 'async', how: 'register', reg: { '/mac.html': 'mac' }, files: { '/page.html': 'pageImp' }, entry: '/page.html', want: '[M]' },
  { id: 'M2', title: 'import of a name registered and in the loader', flavor: 'native', body: 'S', path: 'async', how: 'register', reg: { '/mac.html': 'mac' }, files: { '/page.html': 'pageImp', '/mac.html': 'macL' }, entry: '/page.html', want: '[L]' },
  { id: 'M2', title: 'import of a name registered and in the loader', flavor: 'native', body: 'A', path: 'async', how: 'register', reg: { '/mac.html': 'mac' }, files: { '/page.html': 'pageImp', '/mac.html': 'macL' }, entry: '/page.html', want: '[M]' },
  { id: 'M2', title: 'import of a name registered and in the loader', flavor: 'twig', body: 'S', path: 'async', how: 'register', reg: { '/mac.html': 'mac' }, files: { '/page.html': 'pageImp', '/mac.html': 'macL' }, entry: '/page.html', want: '[L]' },
  { id: 'M2', title: 'import of a name registered and in the loader', flavor: 'twig', body: 'A', path: 'async', how: 'register', reg: { '/mac.html': 'mac' }, files: { '/page.html': 'pageImp', '/mac.html': 'macL' }, entry: '/page.html', want: '[M]' },
  { id: 'M2', title: 'import of a name registered and in the loader', flavor: 'jinja2', body: 'S', path: 'async', how: 'register', reg: { '/mac.html': 'mac' }, files: { '/page.html': 'pageImp', '/mac.html': 'macL' }, entry: '/page.html', want: '[L]' },
  { id: 'M2', title: 'import of a name registered and in the loader', flavor: 'jinja2', body: 'A', path: 'async', how: 'register', reg: { '/mac.html': 'mac' }, files: { '/page.html': 'pageImp', '/mac.html': 'macL' }, entry: '/page.html', want: '[M]' },
  { id: 'F1', title: 'from of a name only registered', flavor: 'twig', body: 'S', path: 'async', how: 'register', reg: { '/mac.html': 'mac' }, files: { '/page.html': 'pageFrom' }, entry: '/page.html', want: 'THROW Unable to find template "/mac.html"' },
  { id: 'F1', title: 'from of a name only registered', flavor: 'twig', body: 'A', path: 'async', how: 'register', reg: { '/mac.html': 'mac' }, files: { '/page.html': 'pageFrom' }, entry: '/page.html', want: '[M]' },
  { id: 'F1', title: 'from of a name only registered', flavor: 'jinja2', body: 'S', path: 'async', how: 'register', reg: { '/mac.html': 'mac' }, files: { '/page.html': 'pageFrom' }, entry: '/page.html', want: 'THROW Unable to find template "/mac.html"' },
  { id: 'F1', title: 'from of a name only registered', flavor: 'jinja2', body: 'A', path: 'async', how: 'register', reg: { '/mac.html': 'mac' }, files: { '/page.html': 'pageFrom' }, entry: '/page.html', want: '[M]' },
  { id: 'F2', title: 'from of a name registered and in the loader', flavor: 'twig', body: 'S', path: 'async', how: 'register', reg: { '/mac.html': 'mac' }, files: { '/page.html': 'pageFrom', '/mac.html': 'macL' }, entry: '/page.html', want: '[L]' },
  { id: 'F2', title: 'from of a name registered and in the loader', flavor: 'twig', body: 'A', path: 'async', how: 'register', reg: { '/mac.html': 'mac' }, files: { '/page.html': 'pageFrom', '/mac.html': 'macL' }, entry: '/page.html', want: '[M]' },
  { id: 'F2', title: 'from of a name registered and in the loader', flavor: 'jinja2', body: 'S', path: 'async', how: 'register', reg: { '/mac.html': 'mac' }, files: { '/page.html': 'pageFrom', '/mac.html': 'macL' }, entry: '/page.html', want: '[L]' },
  { id: 'F2', title: 'from of a name registered and in the loader', flavor: 'jinja2', body: 'A', path: 'async', how: 'register', reg: { '/mac.html': 'mac' }, files: { '/page.html': 'pageFrom', '/mac.html': 'macL' }, entry: '/page.html', want: '[M]' },
  { id: 'E1', title: 'extends of a parent only registered', flavor: 'native', body: 'S', path: 'async', how: 'register', reg: { '/base.html': 'base' }, files: { '/page.html': 'child' }, entry: '/page.html', want: 'THROW Unable to find template "/base.html"' },
  { id: 'E1', title: 'extends of a parent only registered', flavor: 'native', body: 'A', path: 'async', how: 'register', reg: { '/base.html': 'base' }, files: { '/page.html': 'child' }, entry: '/page.html', want: '[C]' },
  { id: 'E1', title: 'extends of a parent only registered', flavor: 'twig', body: 'S', path: 'async', how: 'register', reg: { '/base.html': 'base' }, files: { '/page.html': 'child' }, entry: '/page.html', want: 'THROW Unable to find template "/base.html"' },
  { id: 'E1', title: 'extends of a parent only registered', flavor: 'twig', body: 'A', path: 'async', how: 'register', reg: { '/base.html': 'base' }, files: { '/page.html': 'child' }, entry: '/page.html', want: '[C]' },
  { id: 'E1', title: 'extends of a parent only registered', flavor: 'jinja2', body: 'S', path: 'async', how: 'register', reg: { '/base.html': 'base' }, files: { '/page.html': 'child' }, entry: '/page.html', want: 'THROW Unable to find template "/base.html"' },
  { id: 'E1', title: 'extends of a parent only registered', flavor: 'jinja2', body: 'A', path: 'async', how: 'register', reg: { '/base.html': 'base' }, files: { '/page.html': 'child' }, entry: '/page.html', want: '[C]' },
  { id: 'E1', title: 'extends of a parent only registered', flavor: 'django', body: 'S', path: 'async', how: 'register', reg: { '/base.html': 'base' }, files: { '/page.html': 'child' }, entry: '/page.html', want: 'THROW Unable to find template "/base.html"' },
  { id: 'E1', title: 'extends of a parent only registered', flavor: 'django', body: 'A', path: 'async', how: 'register', reg: { '/base.html': 'base' }, files: { '/page.html': 'child' }, entry: '/page.html', want: '[C]' },
  { id: 'E2', title: 'extends of a parent registered and in the loader', flavor: 'native', body: 'S', path: 'async', how: 'register', reg: { '/base.html': 'base' }, files: { '/page.html': 'child', '/base.html': 'baseL' }, entry: '/page.html', want: '<C>' },
  { id: 'E2', title: 'extends of a parent registered and in the loader', flavor: 'native', body: 'A', path: 'async', how: 'register', reg: { '/base.html': 'base' }, files: { '/page.html': 'child', '/base.html': 'baseL' }, entry: '/page.html', want: '[C]' },
  { id: 'E2', title: 'extends of a parent registered and in the loader', flavor: 'twig', body: 'S', path: 'async', how: 'register', reg: { '/base.html': 'base' }, files: { '/page.html': 'child', '/base.html': 'baseL' }, entry: '/page.html', want: '<C>' },
  { id: 'E2', title: 'extends of a parent registered and in the loader', flavor: 'twig', body: 'A', path: 'async', how: 'register', reg: { '/base.html': 'base' }, files: { '/page.html': 'child', '/base.html': 'baseL' }, entry: '/page.html', want: '[C]' },
  { id: 'E2', title: 'extends of a parent registered and in the loader', flavor: 'jinja2', body: 'S', path: 'async', how: 'register', reg: { '/base.html': 'base' }, files: { '/page.html': 'child', '/base.html': 'baseL' }, entry: '/page.html', want: '<C>' },
  { id: 'E2', title: 'extends of a parent registered and in the loader', flavor: 'jinja2', body: 'A', path: 'async', how: 'register', reg: { '/base.html': 'base' }, files: { '/page.html': 'child', '/base.html': 'baseL' }, entry: '/page.html', want: '[C]' },
  { id: 'E2', title: 'extends of a parent registered and in the loader', flavor: 'django', body: 'S', path: 'async', how: 'register', reg: { '/base.html': 'base' }, files: { '/page.html': 'child', '/base.html': 'baseL' }, entry: '/page.html', want: '<C>' },
  { id: 'E2', title: 'extends of a parent registered and in the loader', flavor: 'django', body: 'A', path: 'async', how: 'register', reg: { '/base.html': 'base' }, files: { '/page.html': 'child', '/base.html': 'baseL' }, entry: '/page.html', want: '[C]' },
  { id: 'B1', title: 'include of a name registered with registerBundle', flavor: 'native', body: 'S', path: 'async', how: 'bundle', reg: { '/part.html': 'part' }, files: { '/page.html': 'page' }, entry: '/page.html', want: 'THROW Unable to find template "/part.html"' },
  { id: 'B1', title: 'include of a name registered with registerBundle', flavor: 'native', body: 'A', path: 'async', how: 'bundle', reg: { '/part.html': 'part' }, files: { '/page.html': 'page' }, entry: '/page.html', want: '[P1]' },
  { id: 'B1', title: 'include of a name registered with registerBundle', flavor: 'twig', body: 'S', path: 'async', how: 'bundle', reg: { '/part.html': 'part' }, files: { '/page.html': 'page' }, entry: '/page.html', want: 'THROW Unable to find template "/part.html"' },
  { id: 'B1', title: 'include of a name registered with registerBundle', flavor: 'twig', body: 'A', path: 'async', how: 'bundle', reg: { '/part.html': 'part' }, files: { '/page.html': 'page' }, entry: '/page.html', want: '[P1]' },
  { id: 'B1', title: 'include of a name registered with registerBundle', flavor: 'jinja2', body: 'S', path: 'async', how: 'bundle', reg: { '/part.html': 'part' }, files: { '/page.html': 'page' }, entry: '/page.html', want: 'THROW Unable to find template "/part.html"' },
  { id: 'B1', title: 'include of a name registered with registerBundle', flavor: 'jinja2', body: 'A', path: 'async', how: 'bundle', reg: { '/part.html': 'part' }, files: { '/page.html': 'page' }, entry: '/page.html', want: '[P1]' },
  { id: 'B1', title: 'include of a name registered with registerBundle', flavor: 'django', body: 'S', path: 'async', how: 'bundle', reg: { '/part.html': 'part' }, files: { '/page.html': 'page' }, entry: '/page.html', want: 'THROW Unable to find template "/part.html"' },
  { id: 'B1', title: 'include of a name registered with registerBundle', flavor: 'django', body: 'A', path: 'async', how: 'bundle', reg: { '/part.html': 'part' }, files: { '/page.html': 'page' }, entry: '/page.html', want: '[P1]' },
  { id: 'R1', title: 'include of a name primed with run()', flavor: 'native', body: 'S', path: 'async', how: 'run', reg: { '/part.html': 'part' }, files: { '/page.html': 'page' }, entry: '/page.html', want: 'THROW Unable to find template "/part.html"' },
  { id: 'R1', title: 'include of a name primed with run()', flavor: 'native', body: 'A', path: 'async', how: 'run', reg: { '/part.html': 'part' }, files: { '/page.html': 'page' }, entry: '/page.html', want: '[P1]' },
  { id: 'R1', title: 'include of a name primed with run()', flavor: 'twig', body: 'S', path: 'async', how: 'run', reg: { '/part.html': 'part' }, files: { '/page.html': 'page' }, entry: '/page.html', want: 'THROW Unable to find template "/part.html"' },
  { id: 'R1', title: 'include of a name primed with run()', flavor: 'twig', body: 'A', path: 'async', how: 'run', reg: { '/part.html': 'part' }, files: { '/page.html': 'page' }, entry: '/page.html', want: '[P1]' },
  { id: 'R1', title: 'include of a name primed with run()', flavor: 'jinja2', body: 'S', path: 'async', how: 'run', reg: { '/part.html': 'part' }, files: { '/page.html': 'page' }, entry: '/page.html', want: 'THROW Unable to find template "/part.html"' },
  { id: 'R1', title: 'include of a name primed with run()', flavor: 'jinja2', body: 'A', path: 'async', how: 'run', reg: { '/part.html': 'part' }, files: { '/page.html': 'page' }, entry: '/page.html', want: '[P1]' },
  { id: 'R1', title: 'include of a name primed with run()', flavor: 'django', body: 'S', path: 'async', how: 'run', reg: { '/part.html': 'part' }, files: { '/page.html': 'page' }, entry: '/page.html', want: 'THROW Unable to find template "/part.html"' },
  { id: 'R1', title: 'include of a name primed with run()', flavor: 'django', body: 'A', path: 'async', how: 'run', reg: { '/part.html': 'part' }, files: { '/page.html': 'page' }, entry: '/page.html', want: '[P1]' },
  { id: 's3', title: 'compileFile with codegenMode async of a name only registered', flavor: 'native', body: 'S', path: 'compileFileAsync', how: 'register', reg: { '/part.html': 'part' }, files: {}, entry: '/part.html', want: 'THROW Unable to find template "/part.html"' },
  { id: 's3', title: 'compileFile with codegenMode async of a name only registered', flavor: 'native', body: 'A', path: 'compileFileAsync', how: 'register', reg: { '/part.html': 'part' }, files: {}, entry: '/part.html', want: 'PROMISE P1' },
  { id: 's3', title: 'compileFile with codegenMode async of a name only registered', flavor: 'twig', body: 'S', path: 'compileFileAsync', how: 'register', reg: { '/part.html': 'part' }, files: {}, entry: '/part.html', want: 'THROW Unable to find template "/part.html"' },
  { id: 's3', title: 'compileFile with codegenMode async of a name only registered', flavor: 'twig', body: 'A', path: 'compileFileAsync', how: 'register', reg: { '/part.html': 'part' }, files: {}, entry: '/part.html', want: 'PROMISE P1' },
  { id: 's3', title: 'compileFile with codegenMode async of a name only registered', flavor: 'jinja2', body: 'S', path: 'compileFileAsync', how: 'register', reg: { '/part.html': 'part' }, files: {}, entry: '/part.html', want: 'THROW Unable to find template "/part.html"' },
  { id: 's3', title: 'compileFile with codegenMode async of a name only registered', flavor: 'jinja2', body: 'A', path: 'compileFileAsync', how: 'register', reg: { '/part.html': 'part' }, files: {}, entry: '/part.html', want: 'PROMISE P1' },
  { id: 's3', title: 'compileFile with codegenMode async of a name only registered', flavor: 'django', body: 'S', path: 'compileFileAsync', how: 'register', reg: { '/part.html': 'part' }, files: {}, entry: '/part.html', want: 'THROW Unable to find template "/part.html"' },
  { id: 's3', title: 'compileFile with codegenMode async of a name only registered', flavor: 'django', body: 'A', path: 'compileFileAsync', how: 'register', reg: { '/part.html': 'part' }, files: {}, entry: '/part.html', want: 'PROMISE P1' }
];
var SYNC_CASES = [
  { id: 'C1c', title: 'set in an include from the loader, read by the page', flavor: 'native', body: 'S', path: 'async', how: 'none', reg: {}, files: { '/page.html': 'pageY', '/part.html': 'partSet' }, entry: '/page.html', want: '[PY]' },
  { id: 'C1c', title: 'set in an include from the loader, read by the page', flavor: 'twig', body: 'S', path: 'async', how: 'none', reg: {}, files: { '/page.html': 'pageY', '/part.html': 'partSet' }, entry: '/page.html', want: '[PY]' },
  { id: 'C1c', title: 'set in an include from the loader, read by the page', flavor: 'jinja2', body: 'S', path: 'async', how: 'none', reg: {}, files: { '/page.html': 'pageY', '/part.html': 'partSet' }, entry: '/page.html', want: '[PY]' },
  { id: 's1', title: 'include of a name only registered', flavor: 'native', body: 'S', path: 'sync', how: 'register', reg: { '/part.html': 'part' }, files: { '/page.html': 'page' }, entry: '/page.html', want: '[P1]' },
  { id: 's1', title: 'include of a name only registered', flavor: 'twig', body: 'S', path: 'sync', how: 'register', reg: { '/part.html': 'part' }, files: { '/page.html': 'page' }, entry: '/page.html', want: '[P1]' },
  { id: 's1', title: 'include of a name only registered', flavor: 'jinja2', body: 'S', path: 'sync', how: 'register', reg: { '/part.html': 'part' }, files: { '/page.html': 'page' }, entry: '/page.html', want: '[P1]' },
  { id: 's1', title: 'include of a name only registered', flavor: 'django', body: 'S', path: 'sync', how: 'register', reg: { '/part.html': 'part' }, files: { '/page.html': 'page' }, entry: '/page.html', want: '[P1]' },
  { id: 'I2s', title: 'include of a name registered and in the loader', flavor: 'native', body: 'S', path: 'sync', how: 'register', reg: { '/part.html': 'part' }, files: { '/page.html': 'page', '/part.html': 'partL' }, entry: '/page.html', want: '[P1]' },
  { id: 'I2s', title: 'include of a name registered and in the loader', flavor: 'twig', body: 'S', path: 'sync', how: 'register', reg: { '/part.html': 'part' }, files: { '/page.html': 'page', '/part.html': 'partL' }, entry: '/page.html', want: '[P1]' },
  { id: 'I2s', title: 'include of a name registered and in the loader', flavor: 'jinja2', body: 'S', path: 'sync', how: 'register', reg: { '/part.html': 'part' }, files: { '/page.html': 'page', '/part.html': 'partL' }, entry: '/page.html', want: '[P1]' },
  { id: 'I2s', title: 'include of a name registered and in the loader', flavor: 'django', body: 'S', path: 'sync', how: 'register', reg: { '/part.html': 'part' }, files: { '/page.html': 'page', '/part.html': 'partL' }, entry: '/page.html', want: '[P1]' },
  { id: 'C1s', title: 'set in a registered include, read by the page', flavor: 'native', body: 'S', path: 'sync', how: 'register', reg: { '/part.html': 'partSet' }, files: { '/page.html': 'pageY' }, entry: '/page.html', want: '[PY]' },
  { id: 'C1s', title: 'set in a registered include, read by the page', flavor: 'twig', body: 'S', path: 'sync', how: 'register', reg: { '/part.html': 'partSet' }, files: { '/page.html': 'pageY' }, entry: '/page.html', want: '[PY]' },
  { id: 'C1s', title: 'set in a registered include, read by the page', flavor: 'jinja2', body: 'S', path: 'sync', how: 'register', reg: { '/part.html': 'partSet' }, files: { '/page.html': 'pageY' }, entry: '/page.html', want: '[PY]' },
  { id: 's2', title: 'compileFile of a name only registered', flavor: 'native', body: 'S', path: 'compileFile', how: 'register', reg: { '/part.html': 'part' }, files: {}, entry: '/part.html', want: 'P1' },
  { id: 's2', title: 'compileFile of a name only registered', flavor: 'native', body: 'A', path: 'compileFile', how: 'register', reg: { '/part.html': 'part' }, files: {}, entry: '/part.html', want: 'PROMISE P1' },
  { id: 's2', title: 'compileFile of a name only registered', flavor: 'twig', body: 'S', path: 'compileFile', how: 'register', reg: { '/part.html': 'part' }, files: {}, entry: '/part.html', want: 'P1' },
  { id: 's2', title: 'compileFile of a name only registered', flavor: 'twig', body: 'A', path: 'compileFile', how: 'register', reg: { '/part.html': 'part' }, files: {}, entry: '/part.html', want: 'PROMISE P1' },
  { id: 's2', title: 'compileFile of a name only registered', flavor: 'jinja2', body: 'S', path: 'compileFile', how: 'register', reg: { '/part.html': 'part' }, files: {}, entry: '/part.html', want: 'P1' },
  { id: 's2', title: 'compileFile of a name only registered', flavor: 'jinja2', body: 'A', path: 'compileFile', how: 'register', reg: { '/part.html': 'part' }, files: {}, entry: '/part.html', want: 'PROMISE P1' },
  { id: 's2', title: 'compileFile of a name only registered', flavor: 'django', body: 'S', path: 'compileFile', how: 'register', reg: { '/part.html': 'part' }, files: {}, entry: '/part.html', want: 'P1' },
  { id: 's2', title: 'compileFile of a name only registered', flavor: 'django', body: 'A', path: 'compileFile', how: 'register', reg: { '/part.html': 'part' }, files: {}, entry: '/part.html', want: 'PROMISE P1' },
  { id: 'rt1', title: 'runtime-only build, renderFile with a callback', flavor: 'native', body: 'S', path: 'runtime', how: 'register', reg: { '/part.html': 'part' }, files: {}, entry: '/part.html', want: 'P1' }
];
var GUARD_FLAVORS = ['native', 'jinja2'];
var GUARD_CASES = [
  { id: 'G1', title: 'registered template that includes itself', flavor: 'native', body: 'A', path: 'async', reg: { '/part.html': 'selfInc' }, files: { '/page.html': 'page' }, entry: '/page.html', want: 'THROW Template "/part.html" is nested more than 1000 levels deep: a template probably includes, imports or extend' },
  { id: 'G1', title: 'registered template that includes itself', flavor: 'jinja2', body: 'A', path: 'async', reg: { '/part.html': 'selfInc' }, files: { '/page.html': 'page' }, entry: '/page.html', want: 'THROW Template "/part.html" is nested more than 1000 levels deep: a template probably includes, imports or extend' },
  { id: 'G2', title: 'registered parent that extends itself', flavor: 'native', body: 'A', path: 'async', reg: { '/base.html': 'selfExt' }, files: { '/page.html': 'child' }, entry: '/page.html', want: 'THROW Illegal circular extends of "/base.html"' },
  { id: 'G2', title: 'registered parent that extends itself', flavor: 'jinja2', body: 'A', path: 'async', reg: { '/base.html': 'selfExt' }, files: { '/page.html': 'child' }, entry: '/page.html', want: 'THROW Illegal circular extends of "/base.html"' }
];

function loaderOf(files, isAsync) {
  var mem = loaders.memory(files, '/');
  if (!isAsync) {
    return mem;
  }
  return {
    async: true,
    resolve: mem.resolve,
    load: function (id, cb) {
      if (!cb) { return mem.load(id); }
      setImmediate(function () {
        var src;
        try { src = mem.load(id); } catch (e) { cb(e); return; }
        cb(null, src);
      });
    }
  };
}

function setup(c) {
  var fl = FLAVORS[c.flavor], files = {}, opts = c.opts ? JSON.parse(JSON.stringify(c.opts)) : {}, s, compiler;
  Object.keys(c.files).forEach(function (name) { files[name] = SRC[c.files[name]]; });
  opts.loader = loaderOf(files, c.path === 'async' || c.path === 'runtime');
  s = c.path === 'runtime' ? new runtimeModule.Swig(opts) : new fl.lib[fl.ctor](opts);
  compiler = new fl.lib[fl.ctor]({ loader: loaders.memory({}, '/') });
  Object.keys(c.reg).forEach(function (name) {
    var fn = compiler.precompile(SRC[c.reg[name]], c.body === 'A' ? { codegenMode: 'async', filename: name } : { filename: name }).tpl,
      map = {};
    if (c.how === 'register') { s.register(name, fn); }
    if (c.how === 'bundle') { map[name] = fn; s.registerBundle(map); }
    if (c.how === 'run') { s.run(fn, { x: 9 }, name); }
  });
  return s;
}

// What a call gives, as text: its output, PROMISE and what the Promise's
// { output } holds, PROMISE-REJECT or THROW and the message.
function settle(call) {
  var v;
  try { v = call(); } catch (e) { return Promise.resolve('THROW ' + (e && e.message)); }
  if (v && typeof v.then === 'function') {
    return v.then(function (r) { return 'PROMISE ' + (r && r.output); }, function (e) { return 'PROMISE-REJECT ' + (e && e.message); });
  }
  return Promise.resolve(String(v));
}

function renderCallback(s, name, locals) {
  return new Promise(function (resolve) {
    var done = false, timer = setTimeout(function () { finish('TIMEOUT'); }, 4000);
    function finish(v) {
      if (!done) { done = true; clearTimeout(timer); resolve(v); }
    }
    try {
      s.renderFile(name, locals, function (err, out) { finish(err ? 'THROW ' + err.message : String(out)); });
    } catch (e) { finish('THROW ' + e.message); }
  });
}

function run(c) {
  var s = setup(c), locals = { x: 1 }, out;
  if (c.path === 'async' || c.path === 'runtime') {
    out = renderCallback(s, c.entry, locals);
  } else if (c.path === 'sync') {
    out = settle(function () { return s.renderFile(c.entry, locals); });
  } else if (c.path === 'compileFile') {
    out = settle(function () { return s.compileFile(c.entry)(locals); });
  } else {
    out = new Promise(function (resolve) {
      try {
        s.compileFile(c.entry, { codegenMode: 'async' }, function (err, fn) {
          if (err) { resolve('THROW ' + err.message); return; }
          settle(function () { return fn(locals); }).then(resolve);
        });
      } catch (e) { resolve('THROW ' + e.message); }
    });
  }
  return out.then(function (seen) { return { seen: seen, caller: JSON.stringify(locals) }; });
}

// A THROW expectation is the start of the message; anything else is the whole text.
function check(seen, want) {
  expect(want.indexOf('THROW ') === 0 ? String(seen).slice(0, want.length) : seen).to.equal(want);
}

function title(c) {
  return c.id + ' ' + c.title + ' (' + c.flavor + ', ' + (c.body === 'A' ? 'async' : 'sync') + '-compiled body, ' +
    (c.path === 'async' || c.path === 'compileFileAsync' ? 'async' : 'sync') + ')';
}

function caseTests(list) {
  list.forEach(function (c) {
    it(title(c), function () {
      return run(c).then(function (got) {
        check(got.seen, c.want);
        if (c.caller) {
          expect(got.caller).to.equal(c.caller);
        }
      });
    });
  });
}

/*!
 * Runs in the child: registers each guard case's templates, renders its entry
 * on the async path and prints one JSON line of what each render gave.
 */
function runGuards(args) {
  var lib = require(args.mod), memory = require(args.loaders).memory, Ctor = lib[args.ctor], out = {}, i = 0;
  function next() {
    if (i >= args.cases.length) {
      console.log(JSON.stringify(out));
      return;
    }
    var c = args.cases[i], files = memory(c.files, '/'), compiler = new Ctor({ loader: memory({}, '/') }), s;
    i += 1;
    s = new Ctor({ loader: { async: true, resolve: files.resolve, load: function (id, cb) {
      if (!cb) { return files.load(id); }
      setImmediate(function () {
        var src;
        try { src = files.load(id); } catch (e) { cb(e); return; }
        cb(null, src);
      });
    } } });
    Object.keys(c.reg).forEach(function (name) {
      s.register(name, compiler.precompile(c.reg[name], { codegenMode: 'async', filename: name }).tpl);
    });
    s.renderFile(c.entry, { x: 1 }, function (err, output) {
      out[c.id] = err ? 'THROW ' + err.message : String(output);
      next();
    });
  }
  next();
}

describe('a registered template and the async render path', function () {
  caseTests(ASYNC_CASES);
});

describe('a registered template and the sync calls', function () {
  caseTests(SYNC_CASES);
});

describe('a registered async template that includes or extends itself', function () {
  var results = {};

  before(function () {
    GUARD_FLAVORS.forEach(function (name) {
      var fl = FLAVORS[name], cases = GUARD_CASES.filter(function (c) { return c.flavor === name; }).map(function (c) {
        var reg = {}, files = {};
        Object.keys(c.reg).forEach(function (k) { reg[k] = SRC[c.reg[k]]; });
        Object.keys(c.files).forEach(function (k) { files[k] = SRC[c.files[k]]; });
        return { id: c.id, reg: reg, files: files, entry: c.entry };
      });
      results[name] = runCapped('(' + runGuards.toString() + ')(' + JSON.stringify({ mod: fl.mod, loaders: LOADERS, ctor: fl.ctor, cases: cases }) + ')');
    });
  });

  GUARD_CASES.forEach(function (c) {
    it(title(c), function () {
      var raw = results[c.flavor], m = /^(\S+) (\S+) ([\s\S]*)$/.exec(raw), res;
      // The child exits on its own; a signal means it ran out of heap or time.
      expect(m ? m[1] + ' ' + m[2] : raw).to.equal('null 0');
      res = JSON.parse(m[3]);
      check(res[c.id], c.want);
    });
  });
});
