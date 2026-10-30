var dj = require('@rhinostone/swig-django'),
  filters = require('@rhinostone/swig-django/lib/filters'),
  expect = require('../lib/expect.js');

// Generated. Each output equals Django 5.2's, except where Django raises and swig is lenient, for escape,
// escapejs and safe, which keep the empty string of a None value where Django prints None, and for a
// JavaScript undefined, which Django does not have. Each shape: [template, locals factory, expected output].
var SHAPES = [
  ["[{{ x|upper }}]", function () { return { x: null }; }, "[NONE]"],
  ["[{{ f|upper }}]", function () { return { f: function () { return null; } }; }, "[NONE]"],
  ["[{{ items|first|upper }}]", function () { return { items: [null] }; }, "[NONE]"],
  ["[{{ x|lower }}]", function () { return { x: null }; }, "[none]"],
  ["[{{ f|lower }}]", function () { return { f: function () { return null; } }; }, "[none]"],
  ["[{{ items|first|lower }}]", function () { return { items: [null] }; }, "[none]"],
  ["[{{ x|title }}]", function () { return { x: null }; }, "[None]"],
  ["[{{ f|title }}]", function () { return { f: function () { return null; } }; }, "[None]"],
  ["[{{ items|first|title }}]", function () { return { items: [null] }; }, "[None]"],
  ["[{{ x|capfirst }}]", function () { return { x: null }; }, "[None]"],
  ["[{{ f|capfirst }}]", function () { return { f: function () { return null; } }; }, "[None]"],
  ["[{{ items|first|capfirst }}]", function () { return { items: [null] }; }, "[None]"],
  ["[{{ x|addslashes }}]", function () { return { x: null }; }, "[None]"],
  ["[{{ f|addslashes }}]", function () { return { f: function () { return null; } }; }, "[None]"],
  ["[{{ items|first|addslashes }}]", function () { return { items: [null] }; }, "[None]"],
  ["[{{ x|center:\"6\" }}]", function () { return { x: null }; }, "[ None ]"],
  ["[{{ f|center:\"6\" }}]", function () { return { f: function () { return null; } }; }, "[ None ]"],
  ["[{{ items|first|center:\"6\" }}]", function () { return { items: [null] }; }, "[ None ]"],
  ["[{{ x|cut:\"o\" }}]", function () { return { x: null }; }, "[Nne]"],
  ["[{{ f|cut:\"o\" }}]", function () { return { f: function () { return null; } }; }, "[Nne]"],
  ["[{{ items|first|cut:\"o\" }}]", function () { return { items: [null] }; }, "[Nne]"],
  ["[{{ x|force_escape }}]", function () { return { x: null }; }, "[None]"],
  ["[{{ f|force_escape }}]", function () { return { f: function () { return null; } }; }, "[None]"],
  ["[{{ items|first|force_escape }}]", function () { return { items: [null] }; }, "[None]"],
  ["[{{ x|iriencode }}]", function () { return { x: null }; }, "[None]"],
  ["[{{ f|iriencode }}]", function () { return { f: function () { return null; } }; }, "[None]"],
  ["[{{ items|first|iriencode }}]", function () { return { items: [null] }; }, "[None]"],
  ["[{{ x|linebreaks }}]", function () { return { x: null }; }, "[<p>None</p>]"],
  ["[{{ f|linebreaks }}]", function () { return { f: function () { return null; } }; }, "[<p>None</p>]"],
  ["[{{ items|first|linebreaks }}]", function () { return { items: [null] }; }, "[<p>None</p>]"],
  ["[{{ x|linebreaksbr }}]", function () { return { x: null }; }, "[None]"],
  ["[{{ f|linebreaksbr }}]", function () { return { f: function () { return null; } }; }, "[None]"],
  ["[{{ items|first|linebreaksbr }}]", function () { return { items: [null] }; }, "[None]"],
  ["[{{ x|linenumbers }}]", function () { return { x: null }; }, "[1. None]"],
  ["[{{ f|linenumbers }}]", function () { return { f: function () { return null; } }; }, "[1. None]"],
  ["[{{ items|first|linenumbers }}]", function () { return { items: [null] }; }, "[1. None]"],
  ["[{{ x|ljust:\"6\" }}]", function () { return { x: null }; }, "[None  ]"],
  ["[{{ f|ljust:\"6\" }}]", function () { return { f: function () { return null; } }; }, "[None  ]"],
  ["[{{ items|first|ljust:\"6\" }}]", function () { return { items: [null] }; }, "[None  ]"],
  ["[{{ x|rjust:\"6\" }}]", function () { return { x: null }; }, "[  None]"],
  ["[{{ f|rjust:\"6\" }}]", function () { return { f: function () { return null; } }; }, "[  None]"],
  ["[{{ items|first|rjust:\"6\" }}]", function () { return { items: [null] }; }, "[  None]"],
  ["[{{ x|slugify }}]", function () { return { x: null }; }, "[none]"],
  ["[{{ f|slugify }}]", function () { return { f: function () { return null; } }; }, "[none]"],
  ["[{{ items|first|slugify }}]", function () { return { items: [null] }; }, "[none]"],
  ["[{{ x|striptags }}]", function () { return { x: null }; }, "[None]"],
  ["[{{ f|striptags }}]", function () { return { f: function () { return null; } }; }, "[None]"],
  ["[{{ items|first|striptags }}]", function () { return { items: [null] }; }, "[None]"],
  ["[{{ x|truncatechars:\"3\" }}]", function () { return { x: null }; }, "[No\u2026]"],
  ["[{{ f|truncatechars:\"3\" }}]", function () { return { f: function () { return null; } }; }, "[No\u2026]"],
  ["[{{ items|first|truncatechars:\"3\" }}]", function () { return { items: [null] }; }, "[No\u2026]"],
  ["[{{ x|truncatewords:\"2\" }}]", function () { return { x: null }; }, "[None]"],
  ["[{{ f|truncatewords:\"2\" }}]", function () { return { f: function () { return null; } }; }, "[None]"],
  ["[{{ items|first|truncatewords:\"2\" }}]", function () { return { items: [null] }; }, "[None]"],
  ["[{{ x|urlencode }}]", function () { return { x: null }; }, "[None]"],
  ["[{{ f|urlencode }}]", function () { return { f: function () { return null; } }; }, "[None]"],
  ["[{{ items|first|urlencode }}]", function () { return { items: [null] }; }, "[None]"],
  ["[{{ x|wordcount }}]", function () { return { x: null }; }, "[1]"],
  ["[{{ f|wordcount }}]", function () { return { f: function () { return null; } }; }, "[1]"],
  ["[{{ items|first|wordcount }}]", function () { return { items: [null] }; }, "[1]"],
  ["[{{ x|wordwrap:\"5\" }}]", function () { return { x: null }; }, "[None]"],
  ["[{{ f|wordwrap:\"5\" }}]", function () { return { f: function () { return null; } }; }, "[None]"],
  ["[{{ items|first|wordwrap:\"5\" }}]", function () { return { items: [null] }; }, "[None]"],
  ["[{{ x|make_list|join:\"\" }}]", function () { return { x: null }; }, "[None]"],
  ["[{{ f|make_list|join:\"\" }}]", function () { return { f: function () { return null; } }; }, "[None]"],
  ["[{{ items|first|make_list|join:\"\" }}]", function () { return { items: [null] }; }, "[None]"],
  ["[{{ x|floatformat:\"abc\" }}]", function () { return { x: null }; }, "[]"],
  ["[{{ f|floatformat:\"abc\" }}]", function () { return { f: function () { return null; } }; }, "[]"],
  ["[{{ items|first|floatformat:\"abc\" }}]", function () { return { items: [null] }; }, "[]"],
  ["[{{ x|upper }}]", function () { return {}; }, "[]"],
  ["[{{ items|first|upper }}]", function () { return { items: [] }; }, "[]"],
  ["[{{ x|lower }}]", function () { return {}; }, "[]"],
  ["[{{ items|first|lower }}]", function () { return { items: [] }; }, "[]"],
  ["[{{ x|title }}]", function () { return {}; }, "[]"],
  ["[{{ items|first|title }}]", function () { return { items: [] }; }, "[]"],
  ["[{{ x|capfirst }}]", function () { return {}; }, "[]"],
  ["[{{ items|first|capfirst }}]", function () { return { items: [] }; }, "[]"],
  ["[{{ x|center:\"3\" }}]", function () { return {}; }, "[   ]"],
  ["[{{ items|first|center:\"3\" }}]", function () { return { items: [] }; }, "[   ]"],
  ["[{{ x|urlencode }}]", function () { return {}; }, "[]"],
  ["[{{ items|first|urlencode }}]", function () { return { items: [] }; }, "[]"],
  ["[{{ x|wordcount }}]", function () { return {}; }, "[0]"],
  ["[{{ items|first|wordcount }}]", function () { return { items: [] }; }, "[0]"],
  ["[{{ x|make_list|join:\"\" }}]", function () { return {}; }, "[]"],
  ["[{{ items|first|make_list|join:\"\" }}]", function () { return { items: [] }; }, "[]"],
  ["[{{ x|escape }}]", function () { return { x: null }; }, "[]"],
  ["[{{ x|escapejs }}]", function () { return { x: null }; }, "[]"],
  ["[{{ x|safe }}]", function () { return { x: null }; }, "[]"],
  ["{% if x|upper %}Y{% else %}N{% endif %}", function () { return {}; }, "Y"],
  ["{% if x|upper %}Y{% else %}N{% endif %}", function () { return { x: null }; }, "Y"],
  ["{% if x|lower == \"none\" %}Y{% else %}N{% endif %}", function () { return {}; }, "Y"],
  ["{% if x|lower == \"none\" %}Y{% else %}N{% endif %}", function () { return { x: null }; }, "Y"],
  ["{% if user.role|lower == \"admin\" %}A{% else %}B{% endif %}", function () { return {}; }, "B"],
  ["{% if user.role|lower == \"admin\" %}A{% else %}B{% endif %}", function () { return { x: null }; }, "B"],
  ["{% for c in x|make_list %}[{{ c }}]{% endfor %}.", function () { return {}; }, "[N][o][n][e]."],
  ["{% for c in x|make_list %}[{{ c }}]{% endfor %}.", function () { return { x: null }; }, "[N][o][n][e]."],
  ["{% firstof x|upper \"z\" %}", function () { return {}; }, "NONE"],
  ["{% firstof x|upper \"z\" %}", function () { return { x: null }; }, "NONE"],
  ["{% firstof x|lower \"z\" %}", function () { return {}; }, "none"],
  ["{% firstof x|lower \"z\" %}", function () { return { x: null }; }, "none"],
  ["[{{ x|add:1 }}]", function () { return { x: null }; }, "[]"],
  ["[{{ 1|add:x }}]", function () { return { x: null }; }, "[]"],
  ["[{{ \"a\"|add:x }}]", function () { return { x: null }; }, "[]"],
  ["[{{ 1|add:2 }}]", function () { return {}; }, "[3]"],
  ["[{{ \"a\"|add:\"b\" }}]", function () { return {}; }, "[ab]"],
  ["[{{ \"1\"|add:\"2\" }}]", function () { return {}; }, "[3]"],
  ["[{{ x|phone2numeric }}]", function () { return { x: null }; }, "[6663]"],
  ["[{{ \"a\"|add:y }}]", function () { return {}; }, "[]"],
  ["[{{ 1|add:y }}]", function () { return {}; }, "[]"],
  ["[{{ x|date:\"Y\" }}]", function () { return {}; }, "[]"],
  ["[{{ x|date:\"Y\" }}]", function () { return { x: null }; }, "[]"],
  ["[{{ x|date:\"Y\" }}]", function () { return { x: '' }; }, "[]"],
  ["[{{ x|date:\"Y\" }}]", function () { return { x: 'nope' }; }, "[]"],
  ["[{{ x|date:\"Y\" }}]", function () { return { x: new Date(Date.UTC(2020, 5, 15)) }; }, "[2020]"],
  ["[{{ f|date:\"Y\" }}]", function () { return { f: function () { return null; } }; }, "[]"],
  ["[{{ f|upper }}]", function () { return { f: function () {} }; }, "[]"],
  ["[{{ o.m|lower }}]", function () { return { o: { m: function () {} } }; }, "[]"],
  ["[{{ x|upper }}]", function () { return { x: 'ab' }; }, "[AB]"],
  ["[{{ x|default:\"d\" }}]", function () { return { x: null }; }, "[d]"],
  ["[{{ x|default_if_none:\"d\" }}]", function () { return { x: null }; }, "[d]"],
  ["[{{ x|default:\"d\" }}]", function () { return {}; }, "[d]"],
  ["[{{ x|length }}]", function () { return { x: null }; }, "[0]"],
  ["[{{ x|yesno:\"y,n,m\" }}]", function () { return { x: null }; }, "[m]"]
];

function renderAsync(src, locals) {
  return new Promise(function (resolve, reject) {
    var loader = { async: true, resolve: function (to) { return to; },
      load: function (id, cb) { if (!cb) { return src; } setImmediate(function () { cb(null, src); }); } };
    new dj.Django({ cache: false, loader: loader }).renderFile('p.html', locals, function (err, out) {
      if (err) { reject(err); } else { resolve(out); }
    });
  });
}

describe('swig-django filter inputs that are undefined or null', function () {
  describe('direct calls', function () {
    it('upper and lower read them as the text None', function () {
      [undefined, null].forEach(function (input) {
        expect(filters.upper(input)).to.equal('NONE');
        expect(filters.lower(input)).to.equal('none');
      });
    });

    it('upper and lower still map a list', function () {
      expect(filters.upper(['a', null])).to.eql(['A', 'NONE']);
      expect(filters.lower(['A', undefined])).to.eql(['a', 'none']);
    });

    it('add gives an empty string', function () {
      [undefined, null].forEach(function (value) {
        expect(filters.add(value, 1)).to.equal('');
        expect(filters.add(1, value)).to.equal('');
        expect(filters.add('a', value)).to.equal('');
      });
      expect(filters.add(1, 2)).to.equal(3);
      expect(filters.add(0, 0)).to.equal(0);
    });

    it('floatformat with an invalid argument gives an empty string', function () {
      expect(filters.floatformat(undefined, 'abc')).to.equal('');
      expect(filters.floatformat(null, 'abc')).to.equal('');
      expect(filters.floatformat(1.5, 'abc')).to.equal('1.5');
    });

    it('date gives an empty string for a value that is no date', function () {
      [undefined, null, '', 'nope', new Date(NaN)].forEach(function (input) {
        expect(filters.date(input, 'Y')).to.equal('');
      });
      expect(filters.date(new Date(Date.UTC(2020, 5, 15)), 'Y')).to.equal('2020');
    });
  });

  describe('sync render', function () {
    SHAPES.forEach(function (shape) {
      it(shape[0] + ' over ' + JSON.stringify(shape[1]()) + ' gives ' + shape[2], function () {
        expect(new dj.Django({ cache: false }).render(shape[0], { locals: shape[1]() })).to.equal(shape[2]);
      });
    });
  });

  describe('async render', function () {
    SHAPES.forEach(function (shape) {
      it(shape[0] + ' over ' + JSON.stringify(shape[1]()) + ' gives ' + shape[2], function () {
        return renderAsync(shape[0], shape[1]()).then(function (out) {
          expect(out).to.equal(shape[2]);
        });
      });
    });
  });
});
