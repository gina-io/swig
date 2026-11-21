var swigModule = require('../../lib/swig'),
  twigModule = require('@rhinostone/swig-twig'),
  jinja2Module = require('@rhinostone/swig-jinja2'),
  djangoModule = require('@rhinostone/swig-django'),
  runtimeModule = require('../../lib/runtime'),
  loaders = require('@rhinostone/swig-core/lib/loaders'),
  expect = require('../lib/expect.js');

/*!
 * A template function compiled with codegenMode 'async' and registered with
 * register(), registerBundle() or run(tpl, locals, path) cannot render inside
 * a sync render: a sync include of it, or a call a helper makes to compileFile
 * or renderFile for it while a sync render runs, fails with an error naming
 * it, where the include printed [object Promise]. swig-django renders an empty
 * string for the helper, since its resolver reads a callable that raises as a
 * failed lookup. A top-level call still returns the Promise. The sync-compiled
 * body of each case is the control. The tests are generated from the recorded
 * outputs of a probe, in each flavor that has the tags and in the runtime-only
 * build.
 */

var R = {
  mem: loaders.memory,
  native: swigModule,
  twig: twigModule,
  jinja2: jinja2Module,
  django: djangoModule,
  runtime: runtimeModule
};
var CT = { native: 'Swig', twig: 'Twig', jinja2: 'Jinja2', django: 'Django' };
var MSG = 'The registered template "/part.html" was compiled with codegenMode \'async\', so it cannot render inside a sync render: render the page on the async render path, or register a sync-compiled function for "/part.html".';

function show(v) { return JSON.stringify(String(v)); }
function loaderOf(files, isAsync) {
  var m = R.mem(files, '/');
  if (!isAsync) { return m; }
  return {
    resolve: m.resolve,
    load: function (id, cb) {
      if (!cb) { return m.load(id); }
      setImmediate(function () { var s; try { s = m.load(id); } catch (e) { cb(e); return; } cb(null, s); });
    },
    async: true
  };
}
function inst(fl, files, isAsync) { return new R[fl][CT[fl]]({ loader: loaderOf(files, isAsync) }); }
// A precompiled body, sync-compiled (S) or async-compiled (A), from another
// instance of the flavor.
function body(fl, src, mode, name) {
  var c = new R[fl][CT[fl]]({ loader: R.mem({}, '/') });
  return c.precompile(src, mode === 'A' ? { codegenMode: 'async', filename: name } : { filename: name }).tpl;
}
// A call's outcome: its value, what it throws, or the Promise and what it settles to.
function settle(call) {
  var v;
  try { v = call(); } catch (e) { return Promise.resolve('THROW ' + show(e && e.message)); }
  if (v && typeof v.then === 'function') {
    return v.then(function (r) { return 'PROMISE ' + show(r && r.output); }, function (e) { return 'PROMISE-REJECT ' + show(e && e.message); });
  }
  return Promise.resolve(show(v));
}
function renderCb(s, name, locals) {
  return new Promise(function (res) {
    try {
      s.renderFile(name, locals, function (err, out) {
        if (err) { res('THROW ' + show(err.message)); return; }
        if (out && typeof out.then === 'function') {
          out.then(function (r) { res('CB-PROMISE ' + show(r && r.output)); }, function (e) { res('CB-PROMISE-REJECT ' + show(e && e.message)); });
          return;
        }
        res(show(out));
      });
    } catch (e) { res('THROW ' + show(e.message)); }
  });
}
function later(p, extra) {
  return p.then(function (o) { return new Promise(function (res) { setTimeout(function () { res(o + extra()); }, 30); }); });
}
var SRC = {
  part: 'P{{ x }}',
  partL: 'L{{ x }}',
  partSet: '{% set y = "Y" %}P',
  mid: 'm{% include "/part.html" %}',
  page: '[{% include "/part.html" %}]',
  pageY: '[{% include "/part.html" %}{{ y }}]',
  pageLoop: '[{% for i in items %}{% include "/part.html" %}{% endfor %}]',
  pageMid: '[{% include "/mid.html" %}]',
  pageH: '[{{ h() }}]',
  pageHd: '[{{ h }}]',
  rpage: '{% include "set.html" %}[{{ x }}]{% set y = "Y" %}'
};
function pageH(fl) { return fl === 'django' ? SRC.pageHd : SRC.pageH; }
function syncInc(files, part, locals) {
  return function (fl, mode) {
    var s = inst(fl, files, false);
    s.register('/part.html', body(fl, SRC[part], mode, '/part.html'));
    return settle(function () { return s.renderFile('/page.html', locals || { x: 1 }); });
  };
}
var ROWS = {
  s1: syncInc({ '/page.html': SRC.page }, 'part'),
  I2s: syncInc({ '/page.html': SRC.page, '/part.html': SRC.partL }, 'part'),
  C1s: syncInc({ '/page.html': SRC.pageY }, 'partSet'),
  N1: syncInc({ '/page.html': SRC.pageLoop }, 'part', { x: 1, items: [1, 2] }),
  N2: syncInc({ '/page.html': SRC.pageMid, '/mid.html': SRC.mid }, 'part'),
  H1: function (fl, mode) {
    var s = inst(fl, { '/page.html': pageH(fl) }, false);
    s.register('/part.html', body(fl, SRC.part, mode, '/part.html'));
    return settle(function () { return s.renderFile('/page.html', { x: 1, h: function () { return s.compileFile('/part.html')({ x: 2 }); } }); });
  },
  H2: function (fl, mode) {
    var sink = [], s = inst(fl, { '/page.html': pageH(fl) }, false);
    s.register('/part.html', body(fl, SRC.part, mode, '/part.html'));
    function h() {
      var r = s.compileFile('/part.html')({ x: 2 });
      if (r && typeof r.then === 'function') {
        r.then(function (o) { sink.push('P:' + o.output); }, function (e) { sink.push('REJ:' + e.message); });
      } else { sink.push('V:' + r); }
      return '';
    }
    return later(settle(function () { return s.renderFile('/page.html', { x: 1, h: h }); }), function () { return ' sink=' + JSON.stringify(sink); });
  },
  H3: function (fl, mode) {
    var s = inst(fl, { '/page.html': pageH(fl) }, false);
    s.register('/part.html', body(fl, SRC.part, mode, '/part.html'));
    return settle(function () { return s.renderFile('/page.html', { x: 1, h: function () { return s.renderFile('/part.html', { x: 3 }); } }); });
  },
  R1s: function (fl, mode) {
    var s = inst(fl, { '/page.html': SRC.page }, false), r;
    r = s.run(body(fl, SRC.part, mode, '/part.html'), { x: 9 }, '/part.html');
    if (r && typeof r.then === 'function') { r.then(null, function () {}); }
    return settle(function () { return s.renderFile('/page.html', { x: 1 }); });
  },
  B1s: function (fl, mode) {
    var s = inst(fl, { '/page.html': SRC.page }, false), m = {};
    m['/part.html'] = body(fl, SRC.part, mode, '/part.html');
    s.registerBundle(m);
    return settle(function () { return s.renderFile('/page.html', { x: 1 }); });
  },
  PRE: function (fl, mode) {
    var s = inst(fl, {}, false);
    s.register('/page.html', body(fl, SRC.page, 'S', '/page.html'));
    s.register('/part.html', body(fl, SRC.part, mode, '/part.html'));
    return settle(function () { return s.renderFile('/page.html', { x: 1 }); });
  },
  RT2: function (fl, mode) {
    var rt = new R.runtime.Swig({ loader: R.mem({}, '/') });
    rt.register('/page.html', body('native', SRC.page, 'S', '/page.html'));
    rt.register('/part.html', body('native', SRC.part, mode, '/part.html'));
    return settle(function () { return rt.renderFile('/page.html', { x: 1 }); });
  },
  RT5: function (fl, mode) {
    var rt = new R.runtime.Swig({ loader: R.mem({}, '/') }), r;
    rt.register('/page.html', body('native', SRC.page, 'S', '/page.html'));
    r = rt.run(body('native', SRC.part, mode, '/part.html'), { x: 9 }, '/part.html');
    if (r && typeof r.then === 'function') { r.then(null, function () {}); }
    return settle(function () { return rt.renderFile('/page.html', { x: 1 }); });
  },
  P0: function (fl, mode) {
    var s = inst(fl, { '/set.html': '{% set x = "I" %}' }, true), caller = { z: 1 };
    s.register('/r.html', body(fl, SRC.rpage, mode, '/r.html'));
    return settle(function () { return s.compileFile('/r.html')(caller); }).then(function (o) { return o + ' caller=' + JSON.stringify(caller); });
  },
  s2: function (fl, mode) {
    var s = inst(fl, {}, false);
    s.register('/part.html', body(fl, SRC.part, mode, '/part.html'));
    return settle(function () { return s.compileFile('/part.html')({ x: 1 }); });
  },
  s4: function (fl, mode) {
    var s = inst(fl, {}, false);
    s.register('/part.html', body(fl, SRC.part, mode, '/part.html'));
    return renderCb(s, '/part.html', { x: 1 });
  },
  RT4: function (fl, mode) {
    var rt = new R.runtime.Swig({ loader: R.mem({}, '/') });
    rt.register('/part.html', body('native', SRC.part, mode, '/part.html'));
    return settle(function () { return rt.compileFile('/part.html')({ x: 1 }); });
  }
};
var LABELS = {
  s1: "s1 sync include, registered only",
  I2s: "I2s sync include, registered + loader L",
  C1s: "C1s sync include set reaches the page",
  N1: "N1 sync include in a for loop",
  N2: "N2 sync include two levels down",
  R1s: "R1s run() priming, then sync include",
  B1s: "B1s registerBundle, then sync include",
  PRE: "PRE a registered page includes the registered part",
  RT2: "RT2 runtime build, page compiled by the root",
  RT5: "RT5 runtime build, run() priming, then sync include",
  H1: "H1 helper returns compileFile(name)(locals), sync render",
  H2: "H2 helper uses the Promise and returns \"\", sync render",
  H3: "H3 helper returns renderFile(name, locals), sync render",
  s2: "s2 top compileFile(name)(locals)",
  s4: "s4 top renderFile(name, locals, cb), loader not async",
  P0: "P0 top compileFile(name)(caller), the caller-locals test shape",
  RT4: "RT4 runtime build, top compileFile(name)(locals)"
};

// [row, flavor, body, outcome]; a leading THROW-MSG stands for the error above.
var CASES = [
  ["s1","native","S","\"[P1]\""],
  ["s1","native","A","THROW-MSG"],
  ["s1","twig","S","\"[P1]\""],
  ["s1","twig","A","THROW-MSG"],
  ["s1","jinja2","S","\"[P1]\""],
  ["s1","jinja2","A","THROW-MSG"],
  ["s1","django","S","\"[P1]\""],
  ["s1","django","A","THROW-MSG"],
  ["I2s","native","S","\"[P1]\""],
  ["I2s","native","A","THROW-MSG"],
  ["I2s","twig","S","\"[P1]\""],
  ["I2s","twig","A","THROW-MSG"],
  ["I2s","jinja2","S","\"[P1]\""],
  ["I2s","jinja2","A","THROW-MSG"],
  ["I2s","django","S","\"[P1]\""],
  ["I2s","django","A","THROW-MSG"],
  ["C1s","native","S","\"[PY]\""],
  ["C1s","native","A","THROW-MSG"],
  ["C1s","twig","S","\"[PY]\""],
  ["C1s","twig","A","THROW-MSG"],
  ["C1s","jinja2","S","\"[PY]\""],
  ["C1s","jinja2","A","THROW-MSG"],
  ["N1","native","S","\"[P1P1]\""],
  ["N1","native","A","THROW-MSG"],
  ["N1","twig","S","\"[P1P1]\""],
  ["N1","twig","A","THROW-MSG"],
  ["N1","jinja2","S","\"[P1P1]\""],
  ["N1","jinja2","A","THROW-MSG"],
  ["N1","django","S","\"[P1P1]\""],
  ["N1","django","A","THROW-MSG"],
  ["N2","native","S","\"[mP1]\""],
  ["N2","native","A","THROW-MSG"],
  ["N2","twig","S","\"[mP1]\""],
  ["N2","twig","A","THROW-MSG"],
  ["N2","jinja2","S","\"[mP1]\""],
  ["N2","jinja2","A","THROW-MSG"],
  ["N2","django","S","\"[mP1]\""],
  ["N2","django","A","THROW-MSG"],
  ["H1","native","S","\"[P2]\""],
  ["H1","native","A","THROW-MSG"],
  ["H1","twig","S","\"[P2]\""],
  ["H1","twig","A","THROW-MSG"],
  ["H1","jinja2","S","\"[P2]\""],
  ["H1","jinja2","A","THROW-MSG"],
  ["H1","django","S","\"[P2]\""],
  ["H1","django","A","\"[]\""],
  ["H2","native","S","\"[]\" sink=[\"V:P2\"]"],
  ["H2","native","A","THROW-MSG sink=[]"],
  ["H2","twig","S","\"[]\" sink=[\"V:P2\"]"],
  ["H2","twig","A","THROW-MSG sink=[]"],
  ["H2","jinja2","S","\"[]\" sink=[\"V:P2\"]"],
  ["H2","jinja2","A","THROW-MSG sink=[]"],
  ["H2","django","S","\"[]\" sink=[\"V:P2\"]"],
  ["H2","django","A","\"[]\" sink=[]"],
  ["H3","native","S","\"[P3]\""],
  ["H3","native","A","THROW-MSG"],
  ["H3","twig","S","\"[P3]\""],
  ["H3","twig","A","THROW-MSG"],
  ["H3","jinja2","S","\"[P3]\""],
  ["H3","jinja2","A","THROW-MSG"],
  ["H3","django","S","\"[P3]\""],
  ["H3","django","A","\"[]\""],
  ["R1s","native","S","\"[P1]\""],
  ["R1s","native","A","THROW-MSG"],
  ["R1s","twig","S","\"[P1]\""],
  ["R1s","twig","A","THROW-MSG"],
  ["R1s","jinja2","S","\"[P1]\""],
  ["R1s","jinja2","A","THROW-MSG"],
  ["R1s","django","S","\"[P1]\""],
  ["R1s","django","A","THROW-MSG"],
  ["B1s","native","S","\"[P1]\""],
  ["B1s","native","A","THROW-MSG"],
  ["B1s","twig","S","\"[P1]\""],
  ["B1s","twig","A","THROW-MSG"],
  ["B1s","jinja2","S","\"[P1]\""],
  ["B1s","jinja2","A","THROW-MSG"],
  ["B1s","django","S","\"[P1]\""],
  ["B1s","django","A","THROW-MSG"],
  ["P0","native","S","\"[I]\" caller={\"z\":1}"],
  ["P0","native","A","PROMISE \"[I]\" caller={\"z\":1}"],
  ["P0","twig","S","\"[I]\" caller={\"z\":1}"],
  ["P0","twig","A","PROMISE \"[I]\" caller={\"z\":1}"],
  ["P0","jinja2","S","\"[I]\" caller={\"z\":1}"],
  ["P0","jinja2","A","PROMISE \"[I]\" caller={\"z\":1}"],
  ["s2","native","S","\"P1\""],
  ["s2","native","A","PROMISE \"P1\""],
  ["s2","twig","S","\"P1\""],
  ["s2","twig","A","PROMISE \"P1\""],
  ["s2","jinja2","S","\"P1\""],
  ["s2","jinja2","A","PROMISE \"P1\""],
  ["s2","django","S","\"P1\""],
  ["s2","django","A","PROMISE \"P1\""],
  ["s4","native","S","\"P1\""],
  ["s4","native","A","CB-PROMISE \"P1\""],
  ["s4","twig","S","\"P1\""],
  ["s4","twig","A","CB-PROMISE \"P1\""],
  ["s4","jinja2","S","\"P1\""],
  ["s4","jinja2","A","CB-PROMISE \"P1\""],
  ["s4","django","S","\"P1\""],
  ["s4","django","A","CB-PROMISE \"P1\""],
  ["PRE","native","S","\"[P1]\""],
  ["PRE","native","A","THROW-MSG"],
  ["PRE","twig","S","\"[P1]\""],
  ["PRE","twig","A","THROW-MSG"],
  ["PRE","jinja2","S","\"[P1]\""],
  ["PRE","jinja2","A","THROW-MSG"],
  ["PRE","django","S","\"[P1]\""],
  ["PRE","django","A","THROW-MSG"],
  ["RT2","native","S","\"[P1]\""],
  ["RT2","native","A","THROW-MSG"],
  ["RT4","native","S","\"P1\""],
  ["RT4","native","A","PROMISE \"P1\""],
  ["RT5","native","S","\"[P1]\""],
  ["RT5","native","A","THROW-MSG"]
];

describe('swig-core — an async-compiled registration reached by a sync render', function () {
  CASES.forEach(function (c) {
    it(LABELS[c[0]] + ' (' + c[1] + ', ' + (c[2] === 'A' ? 'async' : 'sync') + ')', function () {
      return ROWS[c[0]](c[1], c[2]).then(function (out) {
        expect(out).to.equal(c[3].indexOf('THROW-MSG') === 0 ? 'THROW ' + JSON.stringify(MSG) + c[3].slice(9) : c[3]);
      });
    });
  });
});
