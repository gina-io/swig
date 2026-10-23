var fc = require('fast-check'),
  utils = require('@rhinostone/swig-core/lib/utils'),
  expect = require('../lib/expect.js');

/*!
 * The linear text helpers of swig-core replace regexes that take quadratic
 * time on some long inputs. Each helper is checked against the exact regex it
 * replaces, on generated strings rich in the characters that matter, and each
 * is timed on the input shape that made its regex slow. The seed is fixed;
 * SWIG_PROPERTY_SEED and SWIG_PROPERTY_RUNS explore other inputs.
 */
var params = {
  seed: Number(process.env.SWIG_PROPERTY_SEED) || 20261023,
  numRuns: Number(process.env.SWIG_PROPERTY_RUNS) || 2000
};

var C = String.fromCharCode,
  units = ['<', '>', '!', '-', '--', '<!--', '-->', '<!-', '<>', ' ', '\t', '\n', '\r', C(0x0b), C(0x0c), C(0xa0),
    C(0xfeff), C(0x2028), C(0x2029), C(0x1680), C(0x2000), C(0x200a), C(0x202f), C(0x205f), C(0x3000), C(0x180e),
    'a', 'b', '_', 'g', 'u', ',', '\\', '[', ']', '^', C(0xD800)],
  text = fc.string({
    unit: fc.oneof(fc.constantFrom.apply(fc, units), fc.string({ unit: 'binary', minLength: 1, maxLength: 1 })),
    maxLength: 40
  }),
  chars = fc.string({
    unit: fc.constantFrom('-', '_', 'g', 'u', ' ', ',', '\\', '[', ']', '^', 'a', '<', C(0xD800)),
    minLength: 1,
    maxLength: 4
  });

function check(property) {
  fc.assert(property, params);
}

// The character class the Twig and Jinja2 trim filters build from `chars`.
function classOf(s) {
  return '[' + s.replace(/[\\\[\]\^\-]/g, '\\$&') + ']';
}

function msFor(fn) {
  var t0 = Date.now();
  fn();
  return Date.now() - t0;
}

describe('swig-core text helpers — same output as the regexes they replace', function () {
  it('trimEnd removes what /\\s+$/ removes, for every UTF-16 code unit', function () {
    var c, s, bad = [];
    for (c = 0; c < 0x10000; c += 1) {
      s = 'a' + C(c) + C(c);
      if (utils.trimEnd(s) !== s.replace(/\s+$/, '')) {
        bad.push(c);
      }
    }
    expect(bad).to.eql([]);
  });

  it('trimEnd(s) equals s.replace(/\\s+$/, "")', function () {
    check(fc.property(text, function (s) {
      return utils.trimEnd(s) === s.replace(/\s+$/, '');
    }));
  });

  it('trimEnd(s, chars) equals the replace of a [chars]+$ class', function () {
    check(fc.property(text, chars, function (s, cs) {
      return utils.trimEnd(s, cs) === s.replace(new RegExp(classOf(cs) + '+$'), '');
    }));
  });

  it('strip(s) equals s.replace(/^\\s+|\\s+$/g, "")', function () {
    check(fc.property(text, function (s) {
      return utils.strip(s) === s.replace(/^\s+|\s+$/g, '');
    }));
  });

  it('stripTags(s) equals s.replace(/(<([^>]+)>)/ig, "")', function () {
    check(fc.property(text, function (s) {
      return utils.stripTags(s) === s.replace(/(<([^>]+)>)/ig, '');
    }));
  });

  it('stripTags(s, true) equals s.replace(/<[^>]*>/g, "")', function () {
    check(fc.property(text, function (s) {
      return utils.stripTags(s, true) === s.replace(/<[^>]*>/g, '');
    }));
  });

  it('stripComments(s) equals s.replace(/<!--[\\s\\S]*?-->/g, "")', function () {
    check(fc.property(text, function (s) {
      return utils.stripComments(s) === s.replace(/<!--[\s\S]*?-->/g, '');
    }));
  });
});

describe('swig-core text helpers — linear time on the inputs that made the regexes slow', function () {
  var n = 100000;

  it('trimEnd and strip on a long whitespace run inside the string', function () {
    var s = 'x' + ' '.repeat(n) + 'y';
    expect(msFor(function () { utils.trimEnd(s); })).to.be.lessThan(250);
    expect(msFor(function () { utils.strip(s); })).to.be.lessThan(250);
    expect(msFor(function () { utils.trimEnd('x' + '_'.repeat(n) + 'y', '-_'); })).to.be.lessThan(250);
  });

  it('stripTags on many < with no > after them', function () {
    var s = '<'.repeat(n);
    expect(msFor(function () { utils.stripTags(s); })).to.be.lessThan(250);
    expect(msFor(function () { utils.stripTags(s, true); })).to.be.lessThan(250);
  });

  it('stripComments on many <!-- with no --> after them', function () {
    var s = '<!--'.repeat(n / 4);
    expect(msFor(function () { utils.stripComments(s); })).to.be.lessThan(250);
  });
});
