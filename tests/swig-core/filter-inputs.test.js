var filters = require('@rhinostone/swig-core/lib/filters'),
  expect = require('../lib/expect.js');

function upper(input) {
  var out = filters.iterateFilter.apply(upper, arguments);
  if (out !== undefined) {
    return out;
  }
  return String(input).toUpperCase();
}

describe('swig-core filter inputs', function () {
  describe('iterateFilter', function () {
    it('gives an empty string for undefined and null', function () {
      expect(filters.iterateFilter.call(upper, undefined)).to.equal('');
      expect(filters.iterateFilter.call(upper, null)).to.equal('');
    });

    it('gives undefined for a scalar, so that the caller handles it', function () {
      ['a', '', 0, 5, false, true].forEach(function (input) {
        expect(filters.iterateFilter.call(upper, input)).to.equal(undefined);
      });
    });

    it('applies the filter to the items of a list, undefined and null included', function () {
      expect(upper(['a', null, undefined, 1])).to.eql(['A', '', '', '1']);
      expect(upper(['a', null, undefined, 1])[1]).to.equal('');
    });

    it('applies the filter to the values of a mapping, undefined and null included', function () {
      var out = upper({ a: 'x', b: null, c: undefined });
      expect(out.a).to.equal('X');
      expect(out.b).to.equal('');
      expect(out.c).to.equal('');
    });
  });

  describe('asText', function () {
    it('gives an empty string for undefined and null', function () {
      expect(filters.asText(undefined)).to.equal('');
      expect(filters.asText(null)).to.equal('');
    });

    it('gives the text of anything else', function () {
      expect(filters.asText('a')).to.equal('a');
      expect(filters.asText('')).to.equal('');
      expect(filters.asText(0)).to.equal('0');
      expect(filters.asText(false)).to.equal('false');
      expect(filters.asText([1, 2])).to.equal('1,2');
    });
  });
});
