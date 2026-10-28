var swig = require('../lib/swig'),
  expect = require('./lib/expect.js');

// Generated. A filter in a set, if, elseif, for, include or filter tag argument applies to its own operand, as on
// the output path: each generated case renders as the same expression does on the output path, or through a
// {% set %} of it for the for and filter tags, and failed to compile or rendered otherwise before tag arguments
// took filters. The other sections hold expectations written by hand.

var PARTIALS = { '/p.html': 'P', '/q.html': 'Q{{ v }}' };

function locals(extra) {
  return Object.assign({ x: 'ab', n: 3, z: 0, lst: ['q', 'r'], arr: [], o: { k: 'v', l: [1, 2] }, p: 'p.html',
    names: { a: 'p.html' }, f: function (v) { return v + '!'; } }, extra);
}

function renderSync(src, extra) {
  var s = new swig.Swig({ cache: false, autoescape: false, loader: swig.loaders.memory(PARTIALS) });
  try { return s.render(src, { filename: '/main.html', locals: locals(extra) }); } catch (e) { return 'THROW: ' + e.message; }
}

function renderAsync(src, extra) {
  return new Promise(function (resolve) {
    var mem = swig.loaders.memory(Object.assign({ '/main.html': src }, PARTIALS)),
      loader = { async: true, resolve: function (to, from) { return mem.resolve(to, from); },
        load: function (id, cb) {
          if (!cb) { return mem.load(id); }
          setImmediate(function () { var out; try { out = mem.load(id); } catch (e) { return cb(e); } cb(null, out); });
        } };
    new swig.Swig({ cache: false, autoescape: false, loader: loader }).renderFile('/main.html', locals(extra), function (err, out) {
      resolve(err ? 'THROW: ' + err.message : out);
    });
  });
}

// Each check carries the template, so a failure names it.
function checkSync(list, extra) {
  list.forEach(function (c) { expect(c[0] + ' => ' + renderSync(c[0], extra)).to.equal(c[0] + ' => ' + c[1]); });
}

function checkAsync(list, extra, done) {
  Promise.all(list.map(function (c) { return renderAsync(c[0], extra); })).then(function (outs) {
    try { list.forEach(function (c, i) { expect(c[0] + ' => ' + outs[i]).to.equal(c[0] + ' => ' + c[1]); }); done(); } catch (e) { done(e); }
  }, done);
}

var TEMPLATES = {
  set: function (e) { return '{% set y = ' + e + ' %}[{{ y }}]'; },
  'if': function (e) { return '[{% if ' + e + ' %}Y{% else %}N{% endif %}]'; },
  elseif: function (e) { return '[{% if z %}N{% elseif ' + e + ' %}Y{% else %}N{% endif %}]'; },
  'for': function (e) { return '[{% for c in ' + e + ' %}<{{ c }}>{% endfor %}]'; },
  filtertag: function (e) { return '[{% filter replace("a", ' + e + ') %}aaa{% endfilter %}]'; },
  include: function (e) { return '[{% include ' + e + ' %}]'; }
};

var CASES = {
  "set": [
    ["arr[0]|upper", "[]"],
    ["arr[0]|replace(\"a\", \"b\")|upper", "[]"],
    ["arr[0]|length", "[0]"],
    ["arr[0]|json", "[\"\"]"],
    ["arr[0]|first", "[]"],
    ["arr[0]|last", "[]"],
    ["(x)|upper", "[AB]"],
    ["(x)|default(\"d\")", "[ab]"],
    ["(x)|replace(\"a\", \"b\")|upper", "[BB]"],
    ["(x)|length", "[2]"],
    ["(x)|default(\"d\")|length", "[2]"],
    ["(x)|json", "[\"ab\"]"],
    ["(x)|raw", "[ab]"],
    ["(x)|e", "[ab]"],
    ["(x)|first", "[a]"],
    ["(x)|last", "[b]"],
    ["(x)|join(\"-\")", "[ab]"],
    ["(x)|reverse", "[ba]"],
    ["(x)|default(\"d\")|upper", "[AB]"],
    ["(x|upper)", "[AB]"],
    ["(x)|upper", "[AB]"],
    ["(lst)|first", "[q]"],
    ["{a: x|upper}.a", "[AB]"],
    ["(x|upper)|lower", "[ab]"],
    ["((x))|upper", "[AB]"],
    ["f((x))|upper", "[AB!]"],
    ["(3)|default(1)", "[3]"],
    ["\"abc\".length", "[3]"],
    ["\"abc\"[0]", "[a]"]
  ],
  "if": [
    ["arr[0]|upper", "[N]"],
    ["arr[0]|replace(\"a\", \"b\")|upper", "[N]"],
    ["arr[0]|length", "[N]"],
    ["arr[0]|json", "[Y]"],
    ["arr[0]|first", "[N]"],
    ["arr[0]|last", "[N]"],
    ["z and f(x)|upper", "[N]"],
    ["((x))|upper", "[Y]"],
    ["f((x))|upper", "[Y]"]
  ],
  "elseif": [
    ["arr[0]|upper", "[N]"],
    ["arr[0]|replace(\"a\", \"b\")|upper", "[N]"],
    ["arr[0]|length", "[N]"],
    ["arr[0]|json", "[Y]"],
    ["arr[0]|first", "[N]"],
    ["arr[0]|last", "[N]"],
    ["z and f(x)|upper", "[N]"],
    ["((x))|upper", "[Y]"],
    ["f((x))|upper", "[Y]"]
  ],
  "for": [
    ["(x)|upper", "[<A><B>]"],
    ["(x)|default(\"d\")", "[<a><b>]"],
    ["(x)|replace(\"a\", \"b\")|upper", "[<B><B>]"],
    ["(x)|length", "[]"],
    ["(x)|default(\"d\")|length", "[]"],
    ["(x)|json", "[<\"><a><b><\">]"],
    ["(x)|raw", "[<a><b>]"],
    ["(x)|e", "[<a><b>]"],
    ["(x)|first", "[<a>]"],
    ["(x)|last", "[<b>]"],
    ["(x)|join(\"-\")", "[<a><b>]"],
    ["(x)|reverse", "[<b><a>]"],
    ["(x)|default(\"d\")|upper", "[<A><B>]"],
    ["[x, n]|upper", "[<AB><3>]"],
    ["[x, n]|default(\"d\")", "[<ab><3>]"],
    ["[x, n]|length", "[]"],
    ["[x, n]|default(\"d\")|length", "[]"],
    ["[x, n]|json", "[<[><\"><a><b><\"><,><3><]>]"],
    ["[x, n]|raw", "[<ab><3>]"],
    ["[x, n]|e", "[<ab><3>]"],
    ["[x, n]|first", "[<a><b>]"],
    ["[x, n]|last", "[]"],
    ["[x, n]|join(\"-\")", "[<a><b><-><3>]"],
    ["[x, n]|reverse", "[<ab><3>]"],
    ["[x, n]|default(\"d\")|upper", "[<AB><3>]"],
    ["z and f(x)|upper", "[]"],
    ["(x|upper)", "[<A><B>]"],
    ["(x)|upper", "[<A><B>]"],
    ["(lst)|first", "[<q>]"],
    ["(x|upper)|lower", "[<a><b>]"],
    ["((x))|upper", "[<A><B>]"],
    ["f((x))|upper", "[<A><B><!>]"],
    ["\"abc\"[0]", "[<a>]"],
    ["x|upper y", "[<A><B>]"]
  ],
  "filtertag": [
    ["x|upper", "[ABaa]"],
    ["x|default(\"d\")", "[abaa]"],
    ["x|replace(\"a\", \"b\")|upper", "[BBaa]"],
    ["x|length", "[2aa]"],
    ["x|default(\"d\")|length", "[2aa]"],
    ["x|json", "[\"ab\"aa]"],
    ["x|raw", "[abaa]"],
    ["x|e", "[abaa]"],
    ["x|first", "[aaa]"],
    ["x|last", "[baa]"],
    ["x|join(\"-\")", "[abaa]"],
    ["x|reverse", "[baaa]"],
    ["x|default(\"d\")|upper", "[ABaa]"],
    ["n|upper", "[3aa]"],
    ["n|default(\"d\")", "[3aa]"],
    ["n|length", "[aa]"],
    ["n|default(\"d\")|length", "[aa]"],
    ["n|json", "[3aa]"],
    ["n|raw", "[3aa]"],
    ["n|e", "[3aa]"],
    ["n|join(\"-\")", "[3aa]"],
    ["n|reverse", "[3aa]"],
    ["n|default(\"d\")|upper", "[3aa]"],
    ["z|upper", "[0aa]"],
    ["z|default(\"d\")", "[0aa]"],
    ["z|length", "[aa]"],
    ["z|default(\"d\")|length", "[aa]"],
    ["z|json", "[0aa]"],
    ["z|raw", "[0aa]"],
    ["z|e", "[0aa]"],
    ["z|join(\"-\")", "[0aa]"],
    ["z|reverse", "[0aa]"],
    ["z|default(\"d\")|upper", "[0aa]"],
    ["u|upper", "[aa]"],
    ["u|default(\"d\")", "[daa]"],
    ["u|replace(\"a\", \"b\")|upper", "[aa]"],
    ["u|length", "[0aa]"],
    ["u|default(\"d\")|length", "[1aa]"],
    ["u|json", "[\"\"aa]"],
    ["u|raw", "[aa]"],
    ["u|e", "[aa]"],
    ["u|first", "[aa]"],
    ["u|last", "[aa]"],
    ["u|join(\"-\")", "[aa]"],
    ["u|reverse", "[aa]"],
    ["u|default(\"d\")|upper", "[Daa]"],
    ["lst|upper", "[Q,Raa]"],
    ["lst|default(\"d\")", "[q,raa]"],
    ["lst|length", "[2aa]"],
    ["lst|default(\"d\")|length", "[2aa]"],
    ["lst|json", "[[\"q\",\"r\"]aa]"],
    ["lst|raw", "[q,raa]"],
    ["lst|e", "[q,raa]"],
    ["lst|first", "[qaa]"],
    ["lst|last", "[raa]"],
    ["lst|join(\"-\")", "[q-raa]"],
    ["lst|reverse", "[r,qaa]"],
    ["lst|default(\"d\")|upper", "[Q,Raa]"],
    ["arr|upper", "[aa]"],
    ["arr|default(\"d\")", "[aa]"],
    ["arr|length", "[0aa]"],
    ["arr|default(\"d\")|length", "[0aa]"],
    ["arr|json", "[[]aa]"],
    ["arr|raw", "[aa]"],
    ["arr|e", "[aa]"],
    ["arr|join(\"-\")", "[aa]"],
    ["arr|reverse", "[aa]"],
    ["arr|default(\"d\")|upper", "[aa]"],
    ["lst[0]|upper", "[Qaa]"],
    ["lst[0]|default(\"d\")", "[qaa]"],
    ["lst[0]|replace(\"a\", \"b\")|upper", "[Qaa]"],
    ["lst[0]|length", "[1aa]"],
    ["lst[0]|default(\"d\")|length", "[1aa]"],
    ["lst[0]|json", "[\"q\"aa]"],
    ["lst[0]|raw", "[qaa]"],
    ["lst[0]|e", "[qaa]"],
    ["lst[0]|first", "[qaa]"],
    ["lst[0]|last", "[qaa]"],
    ["lst[0]|join(\"-\")", "[qaa]"],
    ["lst[0]|reverse", "[qaa]"],
    ["lst[0]|default(\"d\")|upper", "[Qaa]"],
    ["arr[0]|upper", "[aa]"],
    ["arr[0]|default(\"d\")", "[daa]"],
    ["arr[0]|replace(\"a\", \"b\")|upper", "[aa]"],
    ["arr[0]|length", "[0aa]"],
    ["arr[0]|default(\"d\")|length", "[1aa]"],
    ["arr[0]|json", "[\"\"aa]"],
    ["arr[0]|raw", "[aa]"],
    ["arr[0]|e", "[aa]"],
    ["arr[0]|first", "[aa]"],
    ["arr[0]|last", "[aa]"],
    ["arr[0]|join(\"-\")", "[aa]"],
    ["arr[0]|reverse", "[aa]"],
    ["arr[0]|default(\"d\")|upper", "[Daa]"],
    ["o.k|upper", "[Vaa]"],
    ["o.k|default(\"d\")", "[vaa]"],
    ["o.k|replace(\"a\", \"b\")|upper", "[Vaa]"],
    ["o.k|length", "[1aa]"],
    ["o.k|default(\"d\")|length", "[1aa]"],
    ["o.k|json", "[\"v\"aa]"],
    ["o.k|raw", "[vaa]"],
    ["o.k|e", "[vaa]"],
    ["o.k|first", "[vaa]"],
    ["o.k|last", "[vaa]"],
    ["o.k|join(\"-\")", "[vaa]"],
    ["o.k|reverse", "[vaa]"],
    ["o.k|default(\"d\")|upper", "[Vaa]"],
    ["o[\"k\"]|upper", "[Vaa]"],
    ["o[\"k\"]|default(\"d\")", "[vaa]"],
    ["o[\"k\"]|replace(\"a\", \"b\")|upper", "[Vaa]"],
    ["o[\"k\"]|length", "[1aa]"],
    ["o[\"k\"]|default(\"d\")|length", "[1aa]"],
    ["o[\"k\"]|json", "[\"v\"aa]"],
    ["o[\"k\"]|raw", "[vaa]"],
    ["o[\"k\"]|e", "[vaa]"],
    ["o[\"k\"]|first", "[vaa]"],
    ["o[\"k\"]|last", "[vaa]"],
    ["o[\"k\"]|join(\"-\")", "[vaa]"],
    ["o[\"k\"]|reverse", "[vaa]"],
    ["o[\"k\"]|default(\"d\")|upper", "[Vaa]"],
    ["o.m|upper", "[aa]"],
    ["o.m|default(\"d\")", "[daa]"],
    ["o.m|replace(\"a\", \"b\")|upper", "[aa]"],
    ["o.m|length", "[0aa]"],
    ["o.m|default(\"d\")|length", "[1aa]"],
    ["o.m|json", "[\"\"aa]"],
    ["o.m|raw", "[aa]"],
    ["o.m|e", "[aa]"],
    ["o.m|first", "[aa]"],
    ["o.m|last", "[aa]"],
    ["o.m|join(\"-\")", "[aa]"],
    ["o.m|reverse", "[aa]"],
    ["o.m|default(\"d\")|upper", "[Daa]"],
    ["o.l|upper", "[1,2aa]"],
    ["o.l|default(\"d\")", "[1,2aa]"],
    ["o.l|length", "[2aa]"],
    ["o.l|default(\"d\")|length", "[2aa]"],
    ["o.l|json", "[[1,2]aa]"],
    ["o.l|raw", "[1,2aa]"],
    ["o.l|e", "[1,2aa]"],
    ["o.l|first", "[1aa]"],
    ["o.l|last", "[2aa]"],
    ["o.l|join(\"-\")", "[1-2aa]"],
    ["o.l|reverse", "[2,1aa]"],
    ["o.l|default(\"d\")|upper", "[1,2aa]"],
    ["f(x)|upper", "[AB!aa]"],
    ["f(x)|default(\"d\")", "[ab!aa]"],
    ["f(x)|replace(\"a\", \"b\")|upper", "[BB!aa]"],
    ["f(x)|length", "[3aa]"],
    ["f(x)|default(\"d\")|length", "[3aa]"],
    ["f(x)|json", "[\"ab!\"aa]"],
    ["f(x)|raw", "[ab!aa]"],
    ["f(x)|e", "[ab!aa]"],
    ["f(x)|first", "[aaa]"],
    ["f(x)|last", "[!aa]"],
    ["f(x)|join(\"-\")", "[ab!aa]"],
    ["f(x)|reverse", "[!baaa]"],
    ["f(x)|default(\"d\")|upper", "[AB!aa]"],
    ["f()|upper", "[UNDEFINED!aa]"],
    ["f()|default(\"d\")", "[undefined!aa]"],
    ["f()|replace(\"a\", \"b\")|upper", "[UNDEFINED!aa]"],
    ["f()|length", "[10aa]"],
    ["f()|default(\"d\")|length", "[10aa]"],
    ["f()|json", "[\"undefined!\"aa]"],
    ["f()|raw", "[undefined!aa]"],
    ["f()|e", "[undefined!aa]"],
    ["f()|first", "[uaa]"],
    ["f()|last", "[!aa]"],
    ["f()|join(\"-\")", "[undefined!aa]"],
    ["f()|reverse", "[!denifednuaa]"],
    ["f()|default(\"d\")|upper", "[UNDEFINED!aa]"],
    ["(x)|upper", "[ABaa]"],
    ["(x)|default(\"d\")", "[abaa]"],
    ["(x)|replace(\"a\", \"b\")|upper", "[BBaa]"],
    ["(x)|length", "[2aa]"],
    ["(x)|default(\"d\")|length", "[2aa]"],
    ["(x)|json", "[\"ab\"aa]"],
    ["(x)|raw", "[abaa]"],
    ["(x)|e", "[abaa]"],
    ["(x)|first", "[aaa]"],
    ["(x)|last", "[baa]"],
    ["(x)|join(\"-\")", "[abaa]"],
    ["(x)|reverse", "[baaa]"],
    ["(x)|default(\"d\")|upper", "[ABaa]"],
    ["\"lit\"|upper", "[LITaa]"],
    ["\"lit\"|default(\"d\")", "[litaa]"],
    ["\"lit\"|replace(\"a\", \"b\")|upper", "[LITaa]"],
    ["\"lit\"|length", "[3aa]"],
    ["\"lit\"|default(\"d\")|length", "[3aa]"],
    ["\"lit\"|json", "[\"lit\"aa]"],
    ["\"lit\"|raw", "[litaa]"],
    ["\"lit\"|e", "[litaa]"],
    ["\"lit\"|first", "[laa]"],
    ["\"lit\"|last", "[taa]"],
    ["\"lit\"|join(\"-\")", "[litaa]"],
    ["\"lit\"|reverse", "[tilaa]"],
    ["\"lit\"|default(\"d\")|upper", "[LITaa]"],
    ["1 + n|upper", "[13aa]"],
    ["1 + n|default(\"d\")", "[4aa]"],
    ["1 + n|length", "[1aa]"],
    ["1 + n|default(\"d\")|length", "[1aa]"],
    ["1 + n|json", "[13aa]"],
    ["1 + n|raw", "[4aa]"],
    ["1 + n|e", "[4aa]"],
    ["1 + n|first", "[NaNaa]"],
    ["1 + n|last", "[NaNaa]"],
    ["1 + n|join(\"-\")", "[4aa]"],
    ["1 + n|reverse", "[4aa]"],
    ["1 + n|default(\"d\")|upper", "[13aa]"],
    ["-n|upper", "[-3aa]"],
    ["-n|default(\"d\")", "[-3aa]"],
    ["-n|length", "[0aa]"],
    ["-n|default(\"d\")|length", "[0aa]"],
    ["-n|json", "[-3aa]"],
    ["-n|raw", "[-3aa]"],
    ["-n|e", "[-3aa]"],
    ["-n|first", "[NaNaa]"],
    ["-n|last", "[NaNaa]"],
    ["-n|join(\"-\")", "[-3aa]"],
    ["-n|reverse", "[-3aa]"],
    ["-n|default(\"d\")|upper", "[-3aa]"],
    ["not x|upper", "[falseaa]"],
    ["not x|default(\"d\")", "[falseaa]"],
    ["not x|replace(\"a\", \"b\")|upper", "[falseaa]"],
    ["not x|length", "[falseaa]"],
    ["not x|default(\"d\")|length", "[falseaa]"],
    ["not x|json", "[falseaa]"],
    ["not x|raw", "[falseaa]"],
    ["not x|e", "[falseaa]"],
    ["not x|first", "[falseaa]"],
    ["not x|last", "[falseaa]"],
    ["not x|join(\"-\")", "[falseaa]"],
    ["not x|reverse", "[falseaa]"],
    ["not x|default(\"d\")|upper", "[falseaa]"],
    ["x and n|upper", "[3aa]"],
    ["x and n|default(\"d\")", "[3aa]"],
    ["x and n|length", "[aa]"],
    ["x and n|default(\"d\")|length", "[aa]"],
    ["x and n|json", "[3aa]"],
    ["x and n|raw", "[3aa]"],
    ["x and n|e", "[3aa]"],
    ["x and n|join(\"-\")", "[3aa]"],
    ["x and n|reverse", "[3aa]"],
    ["x and n|default(\"d\")|upper", "[3aa]"],
    ["z or x|upper", "[ABaa]"],
    ["z or x|default(\"d\")", "[abaa]"],
    ["z or x|replace(\"a\", \"b\")|upper", "[BBaa]"],
    ["z or x|length", "[2aa]"],
    ["z or x|default(\"d\")|length", "[2aa]"],
    ["z or x|json", "[\"ab\"aa]"],
    ["z or x|raw", "[abaa]"],
    ["z or x|e", "[abaa]"],
    ["z or x|first", "[aaa]"],
    ["z or x|last", "[baa]"],
    ["z or x|join(\"-\")", "[abaa]"],
    ["z or x|reverse", "[baaa]"],
    ["z or x|default(\"d\")|upper", "[ABaa]"],
    ["x == \"ab\"|upper", "[falseaa]"],
    ["x == \"ab\"|default(\"d\")", "[trueaa]"],
    ["x == \"ab\"|replace(\"a\", \"b\")|upper", "[falseaa]"],
    ["x == \"ab\"|length", "[falseaa]"],
    ["x == \"ab\"|default(\"d\")|length", "[falseaa]"],
    ["x == \"ab\"|json", "[falseaa]"],
    ["x == \"ab\"|raw", "[trueaa]"],
    ["x == \"ab\"|e", "[trueaa]"],
    ["x == \"ab\"|first", "[falseaa]"],
    ["x == \"ab\"|last", "[falseaa]"],
    ["x == \"ab\"|join(\"-\")", "[trueaa]"],
    ["x == \"ab\"|reverse", "[falseaa]"],
    ["x == \"ab\"|default(\"d\")|upper", "[falseaa]"],
    ["[1, 2]|upper", "[1,2aa]"],
    ["[1, 2]|default(\"d\")", "[1,2aa]"],
    ["[1, 2]|length", "[2aa]"],
    ["[1, 2]|default(\"d\")|length", "[2aa]"],
    ["[1, 2]|json", "[[1,2]aa]"],
    ["[1, 2]|raw", "[1,2aa]"],
    ["[1, 2]|e", "[1,2aa]"],
    ["[1, 2]|first", "[1aa]"],
    ["[1, 2]|last", "[2aa]"],
    ["[1, 2]|join(\"-\")", "[1-2aa]"],
    ["[1, 2]|reverse", "[2,1aa]"],
    ["[1, 2]|default(\"d\")|upper", "[1,2aa]"],
    ["{a: 1}|upper", "[[object Object]aa]"],
    ["{a: 1}|default(\"d\")", "[[object Object]aa]"],
    ["{a: 1}|length", "[1aa]"],
    ["{a: 1}|default(\"d\")|length", "[1aa]"],
    ["{a: 1}|json", "[{\"a\":1}aa]"],
    ["{a: 1}|raw", "[[object Object]aa]"],
    ["{a: 1}|e", "[[object Object]aa]"],
    ["{a: 1}|first", "[1aa]"],
    ["{a: 1}|last", "[1aa]"],
    ["{a: 1}|join(\"-\")", "[1aa]"],
    ["{a: 1}|reverse", "[aaa]"],
    ["{a: 1}|default(\"d\")|upper", "[[object Object]aa]"],
    ["[x, n]|upper", "[AB,3aa]"],
    ["[x, n]|default(\"d\")", "[ab,3aa]"],
    ["[x, n]|length", "[2aa]"],
    ["[x, n]|default(\"d\")|length", "[2aa]"],
    ["[x, n]|json", "[[\"ab\",3]aa]"],
    ["[x, n]|raw", "[ab,3aa]"],
    ["[x, n]|e", "[ab,3aa]"],
    ["[x, n]|first", "[abaa]"],
    ["[x, n]|last", "[3aa]"],
    ["[x, n]|join(\"-\")", "[ab-3aa]"],
    ["[x, n]|reverse", "[ab,3aa]"],
    ["[x, n]|default(\"d\")|upper", "[AB,3aa]"],
    ["x ? lst : arr|upper", "[q,raa]"],
    ["x ? lst : arr|default(\"d\")", "[q,raa]"],
    ["x ? lst : arr|replace(\"a\", \"b\")|upper", "[q,raa]"],
    ["x ? lst : arr|length", "[q,raa]"],
    ["x ? lst : arr|default(\"d\")|length", "[q,raa]"],
    ["x ? lst : arr|json", "[q,raa]"],
    ["x ? lst : arr|raw", "[q,raa]"],
    ["x ? lst : arr|e", "[q,raa]"],
    ["x ? lst : arr|first", "[q,raa]"],
    ["x ? lst : arr|last", "[q,raa]"],
    ["x ? lst : arr|join(\"-\")", "[q,raa]"],
    ["x ? lst : arr|reverse", "[q,raa]"],
    ["x ? lst : arr|default(\"d\")|upper", "[q,raa]"],
    ["x ?: n|upper", "[abaa]"],
    ["x ?: n|default(\"d\")", "[abaa]"],
    ["x ?: n|replace(\"a\", \"b\")|upper", "[abaa]"],
    ["x ?: n|length", "[abaa]"],
    ["x ?: n|default(\"d\")|length", "[abaa]"],
    ["x ?: n|json", "[abaa]"],
    ["x ?: n|raw", "[abaa]"],
    ["x ?: n|e", "[abaa]"],
    ["x ?: n|first", "[abaa]"],
    ["x ?: n|last", "[abaa]"],
    ["x ?: n|join(\"-\")", "[abaa]"],
    ["x ?: n|reverse", "[abaa]"],
    ["x ?: n|default(\"d\")|upper", "[abaa]"],
    ["true|upper", "[TRUEaa]"],
    ["true|default(\"d\")", "[trueaa]"],
    ["true|length", "[aa]"],
    ["true|default(\"d\")|length", "[aa]"],
    ["true|json", "[trueaa]"],
    ["true|raw", "[trueaa]"],
    ["true|e", "[trueaa]"],
    ["true|join(\"-\")", "[trueaa]"],
    ["true|reverse", "[trueaa]"],
    ["true|default(\"d\")|upper", "[TRUEaa]"],
    ["x|upper == \"AB\"", "[trueaa]"],
    ["\"AB\" == x|upper", "[trueaa]"],
    ["n + lst|length", "[5aa]"],
    ["lst|length + n", "[5aa]"],
    ["not x|length", "[falseaa]"],
    ["not arr|length", "[trueaa]"],
    ["x|length > 1 and n", "[3aa]"],
    ["z and f(x)|upper", "[0aa]"],
    ["x and f(x)|upper", "[AB!aa]"],
    ["z or lst|first", "[qaa]"],
    ["(x|upper)", "[ABaa]"],
    ["(x)|upper", "[ABaa]"],
    ["(lst)|first", "[qaa]"],
    ["x ? lst|first : \"zz\"", "[qaa]"],
    ["z ? \"zz\" : lst|last", "[raa]"],
    ["f(x)|upper", "[AB!aa]"],
    ["f(x|upper)", "[AB!aa]"],
    ["f(x|upper)|length", "[3aa]"],
    ["x|replace(\"a\", x|upper)", "[ABbaa]"],
    ["[x|upper, n]|join(\"-\")", "[AB-3aa]"],
    ["{a: x|upper}.a", "[ABaa]"],
    ["o[x|replace(\"ab\", \"k\")]", "[vaa]"],
    ["lst[z|default(1)]", "[qaa]"],
    ["lst[0]|upper", "[Qaa]"],
    ["o.l|length", "[2aa]"],
    ["o.l|first + n", "[4aa]"],
    ["-lst|length", "[-2aa]"],
    ["x|upper|lower", "[abaa]"],
    ["x | upper", "[ABaa]"],
    ["f(lst|first, n)", "[q!aa]"],
    ["f(lst|first)|upper", "[Q!aa]"],
    ["x|default(lst|first)", "[abaa]"],
    ["x|json|length", "[4aa]"],
    ["n|default(z)|default(x)", "[3aa]"],
    ["z|default(x)|upper", "[0aa]"],
    ["u|default(x)|upper", "[ABaa]"],
    ["arr[0]|default(x)|upper", "[ABaa]"],
    ["o.m|default(lst)|first", "[qaa]"],
    ["x|upper|e", "[ABaa]"],
    ["lst|join(x|upper)", "[qABraa]"],
    ["x and lst|first", "[qaa]"],
    ["x or lst|first", "[abaa]"],
    ["z == lst|length - 2", "[trueaa]"],
    ["lst|length == 2 and x|upper == \"AB\"", "[trueaa]"],
    ["x|upper()", "[ABaa]"],
    ["x |upper", "[ABaa]"],
    ["x| upper", "[ABaa]"],
    ["x | upper | lower", "[abaa]"],
    ["x|default(\"d\", true)", "[abaa]"],
    ["x|replace(\"a\", \"b\", \"g\")", "[bbaa]"],
    ["x|upper|safe", "[ABaa]"],
    ["lst|join(\", \")|upper", "[Q, Raa]"],
    ["o.l|join", "[1,2aa]"],
    ["x|first|upper", "[Aaa]"],
    ["\"a\"|upper", "[Aaa]"],
    ["1|default(2)", "[1aa]"],
    ["true|json", "[trueaa]"],
    ["-n|default(1)", "[-3aa]"],
    ["not x|upper", "[falseaa]"],
    ["x|upper ? \"a\" : \"b\"", "[aaa]"],
    ["x|upper ?: \"b\"", "[ABaa]"],
    ["[x]|first|upper", "[ABaa]"],
    ["{a: 1}|json", "[{\"a\":1}aa]"],
    ["x|length == lst|length", "[trueaa]"],
    ["(x|upper)|lower", "[abaa]"],
    ["((x))|upper", "[ABaa]"],
    ["f(x)|upper|lower", "[ab!aa]"],
    ["f((x))|upper", "[AB!aa]"],
    ["lst[lst|length - 1]", "[raa]"],
    ["x == \"ab\"|upper", "[falseaa]"],
    ["\"ab\"|upper == x", "[falseaa]"],
    ["n + 3|default(1)", "[6aa]"],
    ["3|default(1) + 1", "[4aa]"],
    ["x ? \"lit\"|upper : \"n\"", "[LITaa]"],
    ["f(\"ab\"|upper)", "[AB!aa]"],
    ["[1|default(2)]|json", "[[1]aa]"],
    ["(3)|default(1)", "[3aa]"],
    ["\"abc\"[0]", "[aaa]"],
    ["x|upper y", "[ABaa]"]
  ],
  "include": [
    ["p|default(\"q.html\")", "[P]"],
    ["u|default(\"p.html\")", "[P]"],
    ["names[\"a\"]|default(\"q.html\")", "[P]"],
    ["o.m|default(\"p.html\")", "[P]"],
    ["(p)|default(\"q.html\")", "[P]"],
    ["u|default(\"p.html\") with o only", "[P]"],
    ["u|default(\"q.html\") with {v: n}", "[Q3]"],
    ["p|replace(\"p\", \"q\")", "[Q]"],
    ["u|default(\"q.html\") ignore missing", "[Q]"],
    ["u|default(\"missing.html\") ignore missing", "[]"],
    ["p|default(\"q.html\") with o", "[P]"],
    ["names[\"b\"]|default(p) with {v: 1} only", "[P]"],
    ["o.m|default(\"q.html\") with {v: lst|first} only", "[Qq]"]
  ]
};

var LITERAL = [
  ["{{ 1 + \"lit\"|upper }}", "1LIT"],
  ["{{ x == \"ab\"|upper }}", "false"],
  ["{{ \"ab\"|upper == x }}", "false"],
  ["{{ x ? \"lit\"|upper : \"n\" }}", "LIT"],
  ["{{ x ? 2|default(1) : 0 }}", "2"],
  ["{{ 3|default(1) + 1 }}", "4"],
  ["{{ 2|default(1) * 3 }}", "6"],
  ["{{ (\"ab\"|upper) }}", "AB"],
  ["{{ f(\"ab\"|upper) }}", "AB!"],
  ["{{ [1|default(2)]|json }}", "[1]"],
  ["{{ (3)|default(1) }}", "3"],
  ["{{ \"lit\"|upper }}", "LIT"],
  ["{{ n + 3|default(1) }}", "6"],
  ["{{ true |json + x }}", "trueab"]
];

var DPAREN = [
  ["{% set y = ((x)) %}[{{ y }}]", "[ab]"],
  ["{% set y = (((x))) %}[{{ y }}]", "[ab]"],
  ["{% set y += ((x)) %}[{{ y }}]", "[qab]"],
  ["[{% for c in ((x)) %}<{{ c }}>{% endfor %}]", "[<a><b>]"],
  ["[{% for k, c in ((o)) %}<{{ k }}{{ c }}>{% endfor %}]", "[<kv><l1,2>]"],
  ["{% set y = ((x))|upper %}[{{ y }}]", "[AB]"],
  ["{% set y = (x)|upper %}[{{ y }}]", "[AB]"],
  ["[{% for c in (x)|reverse %}<{{ c }}>{% endfor %}]", "[<b><a>]"],
  ["[{% for c in ((lst))|reverse %}<{{ c }}>{% endfor %}]", "[<r><q>]"],
  ["{% set y = (x) %}[{{ y }}]", "[ab]"],
  ["[{% if ((x)) %}Y{% endif %}]", "[Y]"],
  ["[{% include ((p)) %}]", "[P]"],
  ["[{% filter replace(\"a\", ((x))) %}aaa{% endfilter %}]", "[abaa]"]
];

var FILTERNAME = [
  ["[{% filter replace(\"a\", f(x)|upper) %}aaa{% endfilter %}]", "[AB!aa]"],
  ["[{% filter replace(\"a\", (x)|upper) %}aaa{% endfilter %}]", "[ABaa]"],
  ["[{% filter replace(\"a\", x|upper) %}aaa{% endfilter %}]", "[ABaa]"],
  ["[{% filter replace(\"a\", lst[0]|upper, \"g\") %}aaa{% endfilter %}]", "[QQQ]"],
  ["[{% filter upper() %}aaa{% endfilter %}]", "[AAA]"],
  ["[{% filter title() %}aaa bbb{% endfilter %}]", "[Aaa Bbb]"],
  ["[{% filter upper %}aaa{% endfilter %}]", "[AAA]"],
  ["[{% filter replace(\"a\", \"b\") %}aaa{% endfilter %}]", "[baa]"]
];

var BINDING = [
  ["[{% if z and f(x)|upper %}Y{% else %}N{% endif %}]", "[N]"],
  ["[{% if x and f(x)|upper %}Y{% else %}N{% endif %}]", "[Y]"],
  ["[{% if z %}N{% elseif z and f(x)|upper %}Y{% else %}N{% endif %}]", "[N]"],
  ["{% set y = z and f(x)|upper %}[{{ y }}]", "[0]"]
];

var FORHEAD = [
  ["[{% for a b in x %}<{{ a }}|{{ b }}>{% endfor %}]", "[<a|><b|>]"],
  ["[{% for a b c in x %}<{{ a }}|{{ b }}|{{ c }}>{% endfor %}]", "[<a||><b||>]"],
  ["[{% for a, b, c in x %}<{{ a }}|{{ b }}|{{ c }}>{% endfor %}]", "[<0|a|><1|b|>]"],
  ["[{% for k, v in o|default(lst) %}<{{ k }}={{ v }}>{% endfor %}]", "[<k=v><l=1,2>]"],
  ["[{% for k, v in lst|reverse %}<{{ k }}={{ v }}>{% endfor %}]", "[<0=r><1=q>]"]
];

var USERLAND = [
  ["{% myset y = x %}[{{ y }}]", "[ab]"],
  ["{% myset y += x %}[{{ y }}]", "[qab]"],
  ["{% myset y = x|upper %}[{{ y }}]", "[AB]"],
  ["[{% myfor k, v in o %}<{{ k }}={{ v }}>{% endmyfor %}]", "[<k=v><l=1,2>]"],
  ["[{% myfor c in x %}<{{ c }}>{% endmyfor %}]", "[<a><b>]"],
  ["[{% myfilter default(\"z\") %}{% endmyfilter %}]", "[z]"],
  ["[{% myfilter upper %}aaa{% endmyfilter %}]", "[AAA]"]
];

var TRAILING = [
  "{% for a, in x %}{{ a }}{% endfor %}",
  "{% for a , in x %}{{ a }}{% endfor %}",
  "{% for a, \"b\" in x %}{{ a }}{% endfor %}"
];

var GUARDS = [
  "{% set r = foo[\"__proto__\"]|upper %}",
  "{% set r = foo.__proto__|upper %}",
  "{% set r = __proto__|upper %}",
  "{% set r = x|default(constructor) %}",
  "{% set r = x|replace(\"a\", foo[\"prototype\"]) %}",
  "{% set r = __proto__(x)|upper %}",
  "{% set r = x|upper ? __proto__ : \"s\" %}",
  "{% set r = c ? prototype|default(1) : \"s\" %}",
  "{% if __proto__|length %}Y{% endif %}",
  "{% if constructor(x)|upper %}Y{% endif %}",
  "{% if x|upper and foo.constructor %}Y{% endif %}",
  "{% if z %}N{% elseif foo[\"constructor\"]|length %}Y{% endif %}",
  "{% for v in prototype|default(items) %}{{ v }}{% endfor %}",
  "{% for v in c ? prototype|default(1) : items %}{{ v }}{% endfor %}",
  "{% include __proto__|default(\"p.html\") %}",
  "{% include \"p.html\" with foo[\"constructor\"]|default({}) %}",
  "{% filter replace(\"a\", constructor|upper) %}aaa{% endfilter %}",
  "{% filter replace(\"a\", foo.__proto__|upper) %}aaa{% endfilter %}"
];

function expanded(ctx) {
  return CASES[ctx].map(function (c) { return [TEMPLATES[ctx](c[0]), c[1]]; });
}

describe('Filters in tag arguments', function () {
  it("apply to their own operand in set arguments", function () {
    checkSync(expanded("set"));
  });

  it("apply to their own operand in set arguments on the async render path", function (done) {
    checkAsync(expanded("set"), undefined, done);
  });

  it("apply to their own operand in if arguments", function () {
    checkSync(expanded("if"));
  });

  it("apply to their own operand in if arguments on the async render path", function (done) {
    checkAsync(expanded("if"), undefined, done);
  });

  it("apply to their own operand in elseif arguments", function () {
    checkSync(expanded("elseif"));
  });

  it("apply to their own operand in elseif arguments on the async render path", function (done) {
    checkAsync(expanded("elseif"), undefined, done);
  });

  it("apply to their own operand in for arguments", function () {
    checkSync(expanded("for"));
  });

  it("apply to their own operand in for arguments on the async render path", function (done) {
    checkAsync(expanded("for"), undefined, done);
  });

  it("apply to their own operand in filter tag arguments", function () {
    checkSync(expanded("filtertag"));
  });

  it("apply to their own operand in filter tag arguments on the async render path", function (done) {
    checkAsync(expanded("filtertag"), undefined, done);
  });

  it("apply to their own operand in include arguments", function () {
    checkSync(expanded("include"));
  });

  it("apply to their own operand in include arguments on the async render path", function (done) {
    checkAsync(expanded("include"), undefined, done);
  });

  it('bind a filter after and to its operand, not to the whole test', function () {
    checkSync(BINDING);
  });

  it('bind a filter after and to its operand on the async render path', function (done) {
    checkAsync(BINDING, undefined, done);
  });

  it('read the filter tag name and arguments when an argument holds a call or a group before a filter', function () {
    checkSync(FILTERNAME);
  });

  it('read the filter tag name and arguments the same on the async render path', function (done) {
    checkAsync(FILTERNAME, undefined, done);
  });

  it('reject a prototype-chain name at compile time', function () {
    GUARDS.forEach(function (src) {
      expect(function () {
        new swig.Swig({ cache: false, loader: swig.loaders.memory(PARTIALS) }).precompile(src, { filename: '/main.html' });
      }).to.throwError(/Unsafe access/);
    });
  });

  it('reject a prototype-chain name at compile time in async codegen mode', function () {
    GUARDS.forEach(function (src) {
      expect(function () {
        new swig.Swig({ cache: false, loader: swig.loaders.memory(PARTIALS) }).precompile(src, { filename: '/main.html', codegenMode: 'async' });
      }).to.throwError(/Unsafe access/);
    });
  });
});

describe('Group parens in set and for arguments', function () {
  it('keep the set target, the operator and the for loop names', function () {
    checkSync(DPAREN, { y: 'q' });
  });

  it('keep them on the async render path', function (done) {
    checkAsync(DPAREN, { y: 'q' }, done);
  });

  it('leave the loop names of a head without a comma as they were: a name without a comma before it is ignored', function () {
    checkSync(FORHEAD);
  });

  it('leave those loop names as they were on the async render path', function (done) {
    checkAsync(FORHEAD, undefined, done);
  });

  it('still fail to compile a loop head with a comma and no name after it', function () {
    TRAILING.forEach(function (src) {
      expect(function () {
        new swig.Swig({ cache: false }).precompile(src);
      }).to.throwError();
    });
  });
});

describe('Tags registered with setTag from a built-in tag', function () {
  it('read the fragments of their arguments, as before', function () {
    var s = new swig.Swig({ cache: false, autoescape: false });
    ['set', 'for', 'filter'].forEach(function (n) {
      var t = require('../lib/tags/' + n);
      s.setTag('my' + n, t.parse, t.compile, t.ends, t.block);
    });
    USERLAND.forEach(function (c) {
      expect(c[0] + ' => ' + s.render(c[0], { locals: locals({ y: 'q' }) })).to.equal(c[0] + ' => ' + c[1]);
    });
  });
});

describe('A filter after a literal on the output path', function () {
  it('applies to the literal inside an operation, a comparison or a ternary branch', function () {
    checkSync(LITERAL);
  });

  it('applies to the literal on the async render path', function (done) {
    checkAsync(LITERAL, undefined, done);
  });
});
