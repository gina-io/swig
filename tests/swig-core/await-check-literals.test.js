var swig = require('../../lib/swig'),
  twig = require('../../packages/swig-twig'),
  jinja2 = require('../../packages/swig-jinja2'),
  django = require('../../packages/swig-django'),
  loaders = require('../../packages/swig-core/lib/loaders'),
  expect = require('../lib/expect.js');

/*!
 * On the async render path a for loop whose body awaits compiles to
 * _utils.eachAsync, so the compiler reads the body's code for an await, with
 * each single- or double-quoted string literal blanked. These tests pin the
 * answers of that check on edge cases of the blanking, each written by a tag
 * registered with setTag inside a block comment, so the code is valid either
 * way: an unclosed quote, a backslash before a line terminator (LF, CR,
 * U+2028, U+2029), a raw CR or U+2028 inside a literal, a literal written
 * directly between letters, and the member, key and spread forms of the word.
 * A tag that writes nothing and one that writes an await statement are the
 * controls. They also pin the time of the check on a line that holds an
 * unclosed quote followed by 60000 escaped quotes of the same kind, which the
 * code before took time quadratic in the line's length to blank. The expected
 * answers are those of the code before the change, generated from the
 * recorded output of probes; the four flavors agree on each.
 */
var CTORS = { native: swig.Swig, twig: twig.Twig, jinja2: jinja2.Jinja2, django: django.Django };
var CR = String.fromCharCode(13), LF = String.fromCharCode(10), LS = String.fromCharCode(0x2028), PS = String.fromCharCode(0x2029);
// [id, description (null for the controls), what the tag writes, the expected answer: A when the
// loop awaits, S when it does not]
var CASES = [
  ['C0', null, '', 'S'],
  ['C1', null, 'await null;', 'A'],
  ['B1', 'open quote, escaped pair, await', '"\\" await x', 'A'],
  ['B2', 'open double quote, then a single-quoted await', '" \'await\'', 'S'],
  ['B3', 'closed literal, then await', '\'a\' await', 'A'],
  ['B4', 'await inside a literal', '"await"', 'S'],
  ['B5', 'backslash before CR in a literal, then await', '"a\\' + CR + 'await"', 'A'],
  ['B6', 'U+2028 inside a literal holding await', '"a' + LS + 'await"', 'S'],
  ['B7', 'LF ends the literal, await on the next line', '"a' + LF + 'await"', 'A'],
  ['B8', 'escaped pair then a quote closes, then await', '"\\" "x" await', 'A'],
  ['B10', 'single quote, backslash before CR, then a single-quoted await', '\'a\\' + CR + '\'await\'', 'S'],
  ['B12', 'CR inside a literal holding await', '"a' + CR + 'await"', 'S'],
  ['B13', 'member .await', 'x.await', 'S'],
  ['B14', 'object key await:', 'await: 1', 'S'],
  ['B15', 'spread ...await', '...await', 'A'],
  ['B16', 'backslash before U+2028 in a literal, then await', '"a\\' + LS + 'await"', 'A'],
  ['B17', 'backslash before U+2029 in a literal, then await', '"a\\' + PS + 'await"', 'A'],
  ['B18', 'a double-quoted literal between letters, then await', 'x"y"await', 'A'],
  ['B19', 'a single-quoted literal between letters, then await', 'x\'y\'await', 'A']
];

function label(c) {
  if (c[1] === null) { return c[0] + ' ' + (c[2] === '' ? 'a tag that writes nothing (control)' : 'a tag that writes an await statement (control)'); }
  return c[0] + ' ' + c[1];
}

function compiled(flavor, code, template) {
  var s = new CTORS[flavor]({ loader: loaders.memory({ '/p.html': 'P' }, '/'), cache: false });
  s.setTag('pad', function () { return true; }, function () { return code; }, false, false);
  return s.precompile(template, { codegenMode: 'async', filename: '/page.html' }).tpl;
}

function loopKind(body) {
  if (body.indexOf('_utils.eachAsync') !== -1) { return 'A'; }
  return body.indexOf('_utils.each(') !== -1 ? 'S' : 'NO-LOOP';
}

describe('The await check of the async render path, on string literals', function () {
  Object.keys(CTORS).forEach(function (flavor) {
    describe(flavor, function () {
      CASES.forEach(function (c) {
        it(label(c) + (c[3] === 'A' ? ': the loop awaits' : ': the loop does not await'), function () {
          var code = c[1] === null ? c[2] + '\n' : '/*' + c[2] + '*/\n';
          expect(loopKind(compiled(flavor, code, '{% for x in items %}{% pad %}{% endfor %}').toString())).to.equal(c[3]);
        });
      });
    });
  });
});

describe('The await check of the async render path, on a long line', function () {
  Object.keys(CTORS).forEach(function (flavor) {
    [['double', '"'], ['single', "'"]].forEach(function (q) {
      it(flavor + ': an unclosed ' + q[0] + ' quote followed by 60000 escaped quotes compiles in under a second', function () {
        var code = '/*' + q[1] + new Array(60001).join('\\' + q[1]) + '*/\n',
          start = Date.now(),
          tpl = compiled(flavor, code, '{% for x in items %}{% pad %}{% include "/p.html" %}{% endfor %}'),
          ms = Date.now() - start;
        expect(tpl.constructor.name).to.equal('AsyncFunction');
        expect(loopKind(tpl.toString())).to.equal('A');
        expect(ms).to.be.lessThan(1000);
      });
    });
  });
});
