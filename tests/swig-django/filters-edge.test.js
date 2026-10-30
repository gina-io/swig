var django = require('@rhinostone/swig-django'),
  filters = require('@rhinostone/swig-django/lib/filters'),
  expect = require('../lib/expect.js');


/*!
 * Edge inputs of the Django filter catalog: widths and sizes that are not
 * numbers, values a filter cannot convert, scalars passed to sequence filters,
 * and the larger filesizeformat units. Each expectation matches what Django
 * 5.2 does with the same input, except in two cases. Where Django raises, the
 * test pins the value swig-django returns instead of throwing. String filters
 * map over the elements of an array, as the Django parity documentation states
 * for upper and lower.
 */
describe('@rhinostone/swig-django — filter edge inputs', function () {

  function render(src, locals) {
    return django.render(src, { locals: locals || {} });
  }

  describe('strings', function () {
    it('urlencode escapes "!"', function () {
      expect(render('{{ x|urlencode }}', { x: 'a!b' })).to.equal('a%21b');
    });
    it('capfirst of an empty string is empty', function () {
      expect(filters.capfirst('')).to.equal('');
    });
    it('escapejs turns a newline into \\u000A', function () {
      expect(render('{{ x|escapejs }}', { x: 'a\nb' })).to.equal('a\\u000Ab');
    });
    it('escape:"js" uses \\u escapes instead of HTML entities', function () {
      expect(render('{{ x|escape:t }}', { x: '<\n', t: 'js' })).to.equal('\\u003C\\u000A');
    });
    it('linenumbers pads each number to the width of the largest', function () {
      expect(render('{{ x|linenumbers }}', { x: 'a\nb\nc\nd\ne\nf\ng\nh\ni\nj' })).to.equal('01. a\n02. b\n03. c\n04. d\n05. e\n06. f\n07. g\n08. h\n09. i\n10. j');
    });
    it('lower and upper map over each element of an array', function () {
      expect(filters.lower(['A', 'B'])).to.eql(['a', 'b']);
      expect(filters.upper(['a', 'b'])).to.eql(['A', 'B']);
    });
  });

  describe('a width or length that is not a number', function () {
    it('center, ljust and rjust return the value unchanged', function () {
      var locals = { x: 'Django', w: 'abc' };
      expect(render('[{{ x|center:w }}]', locals)).to.equal('[Django]');
      expect(render('[{{ x|ljust:w }}]', locals)).to.equal('[Django]');
      expect(render('[{{ x|rjust:w }}]', locals)).to.equal('[Django]');
    });
    it('wordwrap returns the value unchanged', function () {
      expect(render('[{{ x|wordwrap:w }}]', { x: 'a  b c', w: 'abc' })).to.equal('[a  b c]');
    });
    it('truncatechars and truncatewords return the value unchanged', function () {
      expect(render('{{ x|truncatechars:n }}', { x: 'Joel is a slug', n: 'abc' })).to.equal('Joel is a slug');
      expect(render('[{{ x|truncatewords:n }}]', { x: '  a   b  ', n: 'abc' })).to.equal('[  a   b  ]');
    });
    it('floatformat returns the value unformatted', function () {
      expect(render('{{ x|floatformat:a }}', { x: 3.14159, a: 'abc' })).to.equal('3.14159');
    });
  });

  describe('numbers', function () {
    it('add concatenates two arrays', function () {
      expect(filters.add([1, 2], [3, 4])).to.eql([1, 2, 3, 4]);
    });
    it('add returns an empty string when the addition throws', function () {
      var operand = {
        valueOf: function () { throw new Error('no primitive value'); },
        toString: function () { return 'o'; }
      };
      expect(filters.add(operand, 1.5)).to.equal('');
    });
    it('add joins two lists of one number each', function () {
      expect(filters.add([1], [2])).to.eql([1, 2]);
    });
    it('add returns an empty string for two functions', function () {
      expect(filters.add(function () {}, function () {})).to.equal('');
    });
    it('divisibleby zero is false', function () {
      expect(filters.divisibleby(6, 0)).to.equal(false);
    });
    it('filesizeformat of a value that is not a number is 0 bytes', function () {
      expect(render('{{ x|filesizeformat }}', { x: 'abc' })).to.equal('0 bytes');
    });
    it('filesizeformat keeps the sign of a negative size', function () {
      expect(render('{{ x|filesizeformat }}', { x: -2048 })).to.equal('-2.0 KB');
    });
    it('filesizeformat in GB, TB and PB', function () {
      expect(render('{{ g|filesizeformat }} {{ t|filesizeformat }} {{ p|filesizeformat }}', { g: 1610612736, t: 2199023255552, p: 3377699720527872 })).to.equal('1.5 GB 2.0 TB 3.0 PB');
    });
    it('floatformat of a value that is not a number is empty', function () {
      expect(render('[{{ x|floatformat }}]', { x: 'abc' })).to.equal('[]');
    });
    it('get_digit returns a value that is not a number unchanged', function () {
      expect(render('{{ x|get_digit:n }}', { x: 'abc', n: 2 })).to.equal('abc');
    });
    it('get_digit at a position below 1 returns the integer part', function () {
      expect(render('{{ x|get_digit:n }}', { x: 123.9, n: 0 })).to.equal('123');
    });
    it('get_digit past the last digit is 0', function () {
      expect(filters.get_digit(123, 5)).to.equal(0);
    });
    it('pluralize with three forms is empty', function () {
      expect(render('[{{ n|pluralize:a }}]', { n: 2, a: 'a,b,c' })).to.equal('[]');
    });
    it('pluralize counts the items of a list and gives nothing for null', function () {
      expect(filters.pluralize(['a'], 'y,ies')).to.equal('y');
      expect(filters.pluralize(null, 'y,ies')).to.equal('');
    });
  });

  describe('dates', function () {
    it('date applies an explicit timezone offset', function () {
      var t = new Date(Date.UTC(2020, 0, 1, 12, 0, 0));
      expect(filters.date(t, 'H:i', 60)).to.equal('11:00');
    });
  });

  describe('sequences and mappings', function () {
    it('default replaces an empty list or mapping', function () {
      expect(render('{{ x|default:y }}', { x: [], y: 'nothing' })).to.equal('nothing');
      expect(render('{{ x|default:y }}', { x: {}, y: 'nothing' })).to.equal('nothing');
    });
    it('default replaces an empty list that carries its own properties', function () {
      expect(render('{{ x|default:y }}', { x: Object.assign([], { foo: 1 }), y: 'nothing' })).to.equal('nothing');
    });
    it('first and last of a mapping are its first and last values', function () {
      expect(filters.first({ a: 'X', b: 'Y' })).to.equal('X');
      expect(filters.last({ a: 'X', b: 'Y' })).to.equal('Y');
    });
    it('first and last of a number are empty', function () {
      expect(filters.first(5)).to.equal('');
      expect(filters.last(5)).to.equal('');
    });
    it('join returns a number unchanged', function () {
      expect(filters.join(5, ',')).to.equal(5);
    });
    it('length counts the keys of a mapping and is 0 for a number', function () {
      expect(render('{{ x|length }}', { x: { a: 1, b: 2, c: 3 } })).to.equal('3');
      expect(render('{{ x|length }}', { x: 5 })).to.equal('0');
    });
    it('slice returns a value that cannot be sliced unchanged', function () {
      expect(render('{{ x|slice:s }}', { x: 12345, s: ':2' })).to.equal('12345');
    });
    it('slice with a single number takes it as the stop', function () {
      expect(render('{{ x|slice:s }}', { x: 'abcdef', s: '2' })).to.equal('ab');
    });
    it('truncatewords of blank text is empty', function () {
      expect(render('[{{ x|truncatewords:n }}]', { x: '   ', n: 0 })).to.equal('[]');
    });
    it('yesno with a single choice returns the value', function () {
      expect(render('{{ x|yesno:a }}', { x: 'hello', a: 'yeah' })).to.equal('hello');
    });
  });
});
