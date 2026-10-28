var swig = require('../lib/swig'),
  expect = require('./lib/expect.js');

// Generated: each missing case was checked to render [] on the fixed tree, each present case to render as
// in 2.9.10. The filters nul, und, zero and no return null, undefined, 0 and false.

function make(opts) {
  var s = new swig.Swig(Object.assign({ cache: false }, opts));
  s.setFilter("nul", function () { return null; });
  s.setFilter("und", function () { return undefined; });
  s.setFilter("zero", function () { return 0; });
  s.setFilter("no", function () { return false; });
  return s;
}

function locals() {
  return { x: 'v', o: { y: 'v' }, items: [], items2: ['a'], obj: {}, arr: [], ang: '<', fnU: function () {}, fnV: function () { return 'v'; }, d: function () {} };
}

function wrap(tag, tpl) {
  return tag ? '{% autoescape ' + tag + ' %}[' + tpl + ']{% endautoescape %}' : '[' + tpl + ']';
}

function renderAsync(opts, tag, tpl) {
  return new Promise(function (resolve, reject) {
    var src = wrap(tag, tpl), loader = { async: true, resolve: function (to) { return to; },
      load: function (id, cb) { if (!cb) { return src; } setImmediate(function () { cb(null, src); }); } };
    make(Object.assign({ loader: loader }, opts)).renderFile('p.html', locals(), function (err, out) {
      if (err) { reject(err); } else { resolve(out); }
    });
  });
}

describe('Outputs that come out undefined or null', function () {
  describe("under the default autoescape", function () {
    it('renders an empty string for a variable whose own filter gives undefined or null, and for a missing subscript or call', function () {
      var s = make({});
      expect(s.render(wrap(null, "{{ x|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ o.y|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ missing|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ x|und }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ x|upper|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ items|first }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ items|last }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ obj|first }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ x|nul|safe }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ d|json }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ arr[0] }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ arr[0].x }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ obj[\"k\"] }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ fnU() }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ \"a\"|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ arr[0]|upper }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ x ? arr[0] : \"\" }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ x ? x|nul : \"\" }}"), { locals: locals() })).to.equal("[]");
    });

    it('renders present values as in 2.9.10', function () {
      var s = make({});
      expect(s.render(wrap(null, "{{ x }}"), { locals: locals() })).to.equal("[v]");
      expect(s.render(wrap(null, "{{ x|upper }}"), { locals: locals() })).to.equal("[V]");
      expect(s.render(wrap(null, "{{ o.y }}"), { locals: locals() })).to.equal("[v]");
      expect(s.render(wrap(null, "{{ items2|first }}"), { locals: locals() })).to.equal("[a]");
      expect(s.render(wrap(null, "{{ ang }}"), { locals: locals() })).to.equal("[&lt;]");
      expect(s.render(wrap(null, "{{ ang|upper }}"), { locals: locals() })).to.equal("[&lt;]");
      expect(s.render(wrap(null, "{{ x|zero }}"), { locals: locals() })).to.equal("[0]");
      expect(s.render(wrap(null, "{{ x|no }}"), { locals: locals() })).to.equal("[false]");
      expect(s.render(wrap(null, "{{ fnV() }}"), { locals: locals() })).to.equal("[v]");
      expect(s.render(wrap(null, "{{ \"a\"|upper }}"), { locals: locals() })).to.equal("[A]");
      expect(s.render(wrap(null, "{{ x ? ang : \"\" }}"), { locals: locals() })).to.equal("[&lt;]");
      expect(s.render(wrap(null, "{{ ang + x|upper }}"), { locals: locals() })).to.equal("[&lt;V]");
    });
  });

  describe("under autoescape false", function () {
    it('renders an empty string for a variable whose own filter gives undefined or null, and for a missing subscript or call', function () {
      var s = make({"autoescape":false});
      expect(s.render(wrap(null, "{{ x|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ o.y|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ missing|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ x|und }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ x|upper|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ items|first }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ items|last }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ obj|first }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ x|nul|safe }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ d|json }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ arr[0] }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ arr[0].x }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ obj[\"k\"] }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ fnU() }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ \"a\"|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ arr[0]|upper }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ x ? arr[0] : \"\" }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ x ? x|nul : \"\" }}"), { locals: locals() })).to.equal("[]");
    });

    it('renders present values as in 2.9.10', function () {
      var s = make({"autoescape":false});
      expect(s.render(wrap(null, "{{ x }}"), { locals: locals() })).to.equal("[v]");
      expect(s.render(wrap(null, "{{ x|upper }}"), { locals: locals() })).to.equal("[V]");
      expect(s.render(wrap(null, "{{ o.y }}"), { locals: locals() })).to.equal("[v]");
      expect(s.render(wrap(null, "{{ items2|first }}"), { locals: locals() })).to.equal("[a]");
      expect(s.render(wrap(null, "{{ ang }}"), { locals: locals() })).to.equal("[<]");
      expect(s.render(wrap(null, "{{ ang|upper }}"), { locals: locals() })).to.equal("[<]");
      expect(s.render(wrap(null, "{{ x|zero }}"), { locals: locals() })).to.equal("[0]");
      expect(s.render(wrap(null, "{{ x|no }}"), { locals: locals() })).to.equal("[false]");
      expect(s.render(wrap(null, "{{ fnV() }}"), { locals: locals() })).to.equal("[v]");
      expect(s.render(wrap(null, "{{ \"a\"|upper }}"), { locals: locals() })).to.equal("[A]");
      expect(s.render(wrap(null, "{{ x ? ang : \"\" }}"), { locals: locals() })).to.equal("[<]");
      expect(s.render(wrap(null, "{{ ang + x|upper }}"), { locals: locals() })).to.equal("[<V]");
    });
  });

  describe("under the autoescape 'html' option", function () {
    it('renders an empty string for a variable whose own filter gives undefined or null, and for a missing subscript or call', function () {
      var s = make({"autoescape":"html"});
      expect(s.render(wrap(null, "{{ x|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ o.y|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ missing|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ x|und }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ x|upper|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ items|first }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ items|last }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ obj|first }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ x|nul|safe }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ d|json }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ arr[0] }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ arr[0].x }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ obj[\"k\"] }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ fnU() }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ \"a\"|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ arr[0]|upper }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ x ? arr[0] : \"\" }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ x ? x|nul : \"\" }}"), { locals: locals() })).to.equal("[]");
    });

    it('renders present values as in 2.9.10', function () {
      var s = make({"autoescape":"html"});
      expect(s.render(wrap(null, "{{ x }}"), { locals: locals() })).to.equal("[v]");
      expect(s.render(wrap(null, "{{ x|upper }}"), { locals: locals() })).to.equal("[V]");
      expect(s.render(wrap(null, "{{ o.y }}"), { locals: locals() })).to.equal("[v]");
      expect(s.render(wrap(null, "{{ items2|first }}"), { locals: locals() })).to.equal("[a]");
      expect(s.render(wrap(null, "{{ ang }}"), { locals: locals() })).to.equal("[&lt;]");
      expect(s.render(wrap(null, "{{ ang|upper }}"), { locals: locals() })).to.equal("[&lt;]");
      expect(s.render(wrap(null, "{{ x|zero }}"), { locals: locals() })).to.equal("[0]");
      expect(s.render(wrap(null, "{{ x|no }}"), { locals: locals() })).to.equal("[false]");
      expect(s.render(wrap(null, "{{ fnV() }}"), { locals: locals() })).to.equal("[v]");
      expect(s.render(wrap(null, "{{ \"a\"|upper }}"), { locals: locals() })).to.equal("[A]");
      expect(s.render(wrap(null, "{{ x ? ang : \"\" }}"), { locals: locals() })).to.equal("[&lt;]");
      expect(s.render(wrap(null, "{{ ang + x|upper }}"), { locals: locals() })).to.equal("[&lt;V]");
    });
  });

  describe("under the autoescape 'js' option", function () {
    it('renders an empty string for a variable whose own filter gives undefined or null, and for a missing subscript or call', function () {
      var s = make({"autoescape":"js"});
      expect(s.render(wrap(null, "{{ x|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ o.y|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ missing|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ x|und }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ x|upper|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ items|first }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ items|last }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ obj|first }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ x|nul|safe }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ d|json }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ arr[0] }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ arr[0].x }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ obj[\"k\"] }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ fnU() }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ \"a\"|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ arr[0]|upper }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ x ? arr[0] : \"\" }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ x ? x|nul : \"\" }}"), { locals: locals() })).to.equal("[]");
    });

    it('renders present values as in 2.9.10', function () {
      var s = make({"autoescape":"js"});
      expect(s.render(wrap(null, "{{ x }}"), { locals: locals() })).to.equal("[v]");
      expect(s.render(wrap(null, "{{ x|upper }}"), { locals: locals() })).to.equal("[V]");
      expect(s.render(wrap(null, "{{ o.y }}"), { locals: locals() })).to.equal("[v]");
      expect(s.render(wrap(null, "{{ items2|first }}"), { locals: locals() })).to.equal("[a]");
      expect(s.render(wrap(null, "{{ ang }}"), { locals: locals() })).to.equal("[\\u003C]");
      expect(s.render(wrap(null, "{{ ang|upper }}"), { locals: locals() })).to.equal("[\\u003C]");
      expect(s.render(wrap(null, "{{ x|zero }}"), { locals: locals() })).to.equal("[0]");
      expect(s.render(wrap(null, "{{ x|no }}"), { locals: locals() })).to.equal("[false]");
      expect(s.render(wrap(null, "{{ fnV() }}"), { locals: locals() })).to.equal("[v]");
      expect(s.render(wrap(null, "{{ \"a\"|upper }}"), { locals: locals() })).to.equal("[A]");
      expect(s.render(wrap(null, "{{ x ? ang : \"\" }}"), { locals: locals() })).to.equal("[\\u003C]");
      expect(s.render(wrap(null, "{{ ang + x|upper }}"), { locals: locals() })).to.equal("[\\u003CV]");
    });
  });

  describe("under a {% autoescape \"js\" %} region", function () {
    it('renders an empty string for a variable whose own filter gives undefined or null, and for a missing subscript or call', function () {
      var s = make({});
      expect(s.render(wrap("\"js\"", "{{ x|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("\"js\"", "{{ o.y|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("\"js\"", "{{ missing|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("\"js\"", "{{ x|und }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("\"js\"", "{{ x|upper|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("\"js\"", "{{ items|first }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("\"js\"", "{{ items|last }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("\"js\"", "{{ obj|first }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("\"js\"", "{{ x|nul|safe }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("\"js\"", "{{ d|json }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("\"js\"", "{{ arr[0] }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("\"js\"", "{{ arr[0].x }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("\"js\"", "{{ obj[\"k\"] }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("\"js\"", "{{ fnU() }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("\"js\"", "{{ \"a\"|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("\"js\"", "{{ arr[0]|upper }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("\"js\"", "{{ x ? arr[0] : \"\" }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("\"js\"", "{{ x ? x|nul : \"\" }}"), { locals: locals() })).to.equal("[]");
    });

    it('renders present values as in 2.9.10', function () {
      var s = make({});
      expect(s.render(wrap("\"js\"", "{{ x }}"), { locals: locals() })).to.equal("[v]");
      expect(s.render(wrap("\"js\"", "{{ x|upper }}"), { locals: locals() })).to.equal("[V]");
      expect(s.render(wrap("\"js\"", "{{ o.y }}"), { locals: locals() })).to.equal("[v]");
      expect(s.render(wrap("\"js\"", "{{ items2|first }}"), { locals: locals() })).to.equal("[a]");
      expect(s.render(wrap("\"js\"", "{{ ang }}"), { locals: locals() })).to.equal("[\\u003C]");
      expect(s.render(wrap("\"js\"", "{{ ang|upper }}"), { locals: locals() })).to.equal("[\\u003C]");
      expect(s.render(wrap("\"js\"", "{{ x|zero }}"), { locals: locals() })).to.equal("[0]");
      expect(s.render(wrap("\"js\"", "{{ x|no }}"), { locals: locals() })).to.equal("[false]");
      expect(s.render(wrap("\"js\"", "{{ fnV() }}"), { locals: locals() })).to.equal("[v]");
      expect(s.render(wrap("\"js\"", "{{ \"a\"|upper }}"), { locals: locals() })).to.equal("[A]");
      expect(s.render(wrap("\"js\"", "{{ x ? ang : \"\" }}"), { locals: locals() })).to.equal("[\\u003C]");
      expect(s.render(wrap("\"js\"", "{{ ang + x|upper }}"), { locals: locals() })).to.equal("[\\u003CV]");
    });
  });

  describe("under a {% autoescape 'html' %} region", function () {
    it('renders an empty string for a variable whose own filter gives undefined or null, and for a missing subscript or call', function () {
      var s = make({});
      expect(s.render(wrap("'html'", "{{ x|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("'html'", "{{ o.y|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("'html'", "{{ missing|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("'html'", "{{ x|und }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("'html'", "{{ x|upper|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("'html'", "{{ items|first }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("'html'", "{{ items|last }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("'html'", "{{ obj|first }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("'html'", "{{ x|nul|safe }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("'html'", "{{ d|json }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("'html'", "{{ arr[0] }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("'html'", "{{ arr[0].x }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("'html'", "{{ obj[\"k\"] }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("'html'", "{{ fnU() }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("'html'", "{{ \"a\"|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("'html'", "{{ arr[0]|upper }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("'html'", "{{ x ? arr[0] : \"\" }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("'html'", "{{ x ? x|nul : \"\" }}"), { locals: locals() })).to.equal("[]");
    });

    it('renders present values as in 2.9.10', function () {
      var s = make({});
      expect(s.render(wrap("'html'", "{{ x }}"), { locals: locals() })).to.equal("[v]");
      expect(s.render(wrap("'html'", "{{ x|upper }}"), { locals: locals() })).to.equal("[V]");
      expect(s.render(wrap("'html'", "{{ o.y }}"), { locals: locals() })).to.equal("[v]");
      expect(s.render(wrap("'html'", "{{ items2|first }}"), { locals: locals() })).to.equal("[a]");
      expect(s.render(wrap("'html'", "{{ ang }}"), { locals: locals() })).to.equal("[&lt;]");
      expect(s.render(wrap("'html'", "{{ ang|upper }}"), { locals: locals() })).to.equal("[&lt;]");
      expect(s.render(wrap("'html'", "{{ x|zero }}"), { locals: locals() })).to.equal("[0]");
      expect(s.render(wrap("'html'", "{{ x|no }}"), { locals: locals() })).to.equal("[false]");
      expect(s.render(wrap("'html'", "{{ fnV() }}"), { locals: locals() })).to.equal("[v]");
      expect(s.render(wrap("'html'", "{{ \"a\"|upper }}"), { locals: locals() })).to.equal("[A]");
      expect(s.render(wrap("'html'", "{{ x ? ang : \"\" }}"), { locals: locals() })).to.equal("[&lt;]");
      expect(s.render(wrap("'html'", "{{ ang + x|upper }}"), { locals: locals() })).to.equal("[&lt;V]");
    });
  });

  describe("under a {% autoescape true %} region", function () {
    it('renders an empty string for a variable whose own filter gives undefined or null, and for a missing subscript or call', function () {
      var s = make({});
      expect(s.render(wrap("true", "{{ x|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("true", "{{ o.y|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("true", "{{ missing|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("true", "{{ x|und }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("true", "{{ x|upper|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("true", "{{ items|first }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("true", "{{ items|last }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("true", "{{ obj|first }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("true", "{{ x|nul|safe }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("true", "{{ d|json }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("true", "{{ arr[0] }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("true", "{{ arr[0].x }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("true", "{{ obj[\"k\"] }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("true", "{{ fnU() }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("true", "{{ \"a\"|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("true", "{{ arr[0]|upper }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("true", "{{ x ? arr[0] : \"\" }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap("true", "{{ x ? x|nul : \"\" }}"), { locals: locals() })).to.equal("[]");
    });

    it('renders present values as in 2.9.10', function () {
      var s = make({});
      expect(s.render(wrap("true", "{{ x }}"), { locals: locals() })).to.equal("[v]");
      expect(s.render(wrap("true", "{{ x|upper }}"), { locals: locals() })).to.equal("[V]");
      expect(s.render(wrap("true", "{{ o.y }}"), { locals: locals() })).to.equal("[v]");
      expect(s.render(wrap("true", "{{ items2|first }}"), { locals: locals() })).to.equal("[a]");
      expect(s.render(wrap("true", "{{ ang }}"), { locals: locals() })).to.equal("[&lt;]");
      expect(s.render(wrap("true", "{{ ang|upper }}"), { locals: locals() })).to.equal("[&lt;]");
      expect(s.render(wrap("true", "{{ x|zero }}"), { locals: locals() })).to.equal("[0]");
      expect(s.render(wrap("true", "{{ x|no }}"), { locals: locals() })).to.equal("[false]");
      expect(s.render(wrap("true", "{{ fnV() }}"), { locals: locals() })).to.equal("[v]");
      expect(s.render(wrap("true", "{{ \"a\"|upper }}"), { locals: locals() })).to.equal("[A]");
      expect(s.render(wrap("true", "{{ x ? ang : \"\" }}"), { locals: locals() })).to.equal("[&lt;]");
      expect(s.render(wrap("true", "{{ ang + x|upper }}"), { locals: locals() })).to.equal("[&lt;V]");
    });
  });

  describe("under an empty autoescape option", function () {
    it('renders an empty string for a variable whose own filter gives undefined or null, and for a missing subscript or call', function () {
      var s = make({"autoescape":""});
      expect(s.render(wrap(null, "{{ x|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ o.y|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ missing|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ x|und }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ x|upper|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ items|first }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ items|last }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ obj|first }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ x|nul|safe }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ d|json }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ arr[0] }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ arr[0].x }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ obj[\"k\"] }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ fnU() }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ \"a\"|nul }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ arr[0]|upper }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ x ? arr[0] : \"\" }}"), { locals: locals() })).to.equal("[]");
      expect(s.render(wrap(null, "{{ x ? x|nul : \"\" }}"), { locals: locals() })).to.equal("[]");
    });

    it('renders present values as in 2.9.10', function () {
      var s = make({"autoescape":""});
      expect(s.render(wrap(null, "{{ x }}"), { locals: locals() })).to.equal("[v]");
      expect(s.render(wrap(null, "{{ x|upper }}"), { locals: locals() })).to.equal("[V]");
      expect(s.render(wrap(null, "{{ o.y }}"), { locals: locals() })).to.equal("[v]");
      expect(s.render(wrap(null, "{{ items2|first }}"), { locals: locals() })).to.equal("[a]");
      expect(s.render(wrap(null, "{{ ang }}"), { locals: locals() })).to.equal("[<]");
      expect(s.render(wrap(null, "{{ ang|upper }}"), { locals: locals() })).to.equal("[<]");
      expect(s.render(wrap(null, "{{ x|zero }}"), { locals: locals() })).to.equal("[0]");
      expect(s.render(wrap(null, "{{ x|no }}"), { locals: locals() })).to.equal("[false]");
      expect(s.render(wrap(null, "{{ fnV() }}"), { locals: locals() })).to.equal("[v]");
      expect(s.render(wrap(null, "{{ \"a\"|upper }}"), { locals: locals() })).to.equal("[A]");
      expect(s.render(wrap(null, "{{ x ? ang : \"\" }}"), { locals: locals() })).to.equal("[<]");
      expect(s.render(wrap(null, "{{ ang + x|upper }}"), { locals: locals() })).to.equal("[<V]");
    });
  });

  describe('on the async render path', function () {
    it("renders as the sync path under the default autoescape", function (done) {
      Promise.all([
        renderAsync({}, null, "{{ x|nul }}"),
        renderAsync({}, null, "{{ items|first }}"),
        renderAsync({}, null, "{{ arr[0] }}"),
        renderAsync({}, null, "{{ fnU() }}"),
        renderAsync({}, null, "{{ x|upper }}"),
        renderAsync({}, null, "{{ ang }}")
      ]).then(function (outs) {
        try {
          expect(outs[0]).to.equal("[]");
          expect(outs[1]).to.equal("[]");
          expect(outs[2]).to.equal("[]");
          expect(outs[3]).to.equal("[]");
          expect(outs[4]).to.equal("[V]");
          expect(outs[5]).to.equal("[&lt;]");
          done();
        } catch (e) { done(e); }
      }, done);
    });
    it("renders as the sync path under the autoescape 'js' option", function (done) {
      Promise.all([
        renderAsync({"autoescape":"js"}, null, "{{ x|nul }}"),
        renderAsync({"autoescape":"js"}, null, "{{ items|first }}"),
        renderAsync({"autoescape":"js"}, null, "{{ arr[0] }}"),
        renderAsync({"autoescape":"js"}, null, "{{ fnU() }}"),
        renderAsync({"autoescape":"js"}, null, "{{ x|upper }}"),
        renderAsync({"autoescape":"js"}, null, "{{ ang }}")
      ]).then(function (outs) {
        try {
          expect(outs[0]).to.equal("[]");
          expect(outs[1]).to.equal("[]");
          expect(outs[2]).to.equal("[]");
          expect(outs[3]).to.equal("[]");
          expect(outs[4]).to.equal("[V]");
          expect(outs[5]).to.equal("[\\u003C]");
          done();
        } catch (e) { done(e); }
      }, done);
    });
    it("renders as the sync path under a {% autoescape \"js\" %} region", function (done) {
      Promise.all([
        renderAsync({}, "\"js\"", "{{ x|nul }}"),
        renderAsync({}, "\"js\"", "{{ items|first }}"),
        renderAsync({}, "\"js\"", "{{ arr[0] }}"),
        renderAsync({}, "\"js\"", "{{ fnU() }}"),
        renderAsync({}, "\"js\"", "{{ x|upper }}"),
        renderAsync({}, "\"js\"", "{{ ang }}")
      ]).then(function (outs) {
        try {
          expect(outs[0]).to.equal("[]");
          expect(outs[1]).to.equal("[]");
          expect(outs[2]).to.equal("[]");
          expect(outs[3]).to.equal("[]");
          expect(outs[4]).to.equal("[V]");
          expect(outs[5]).to.equal("[\\u003C]");
          done();
        } catch (e) { done(e); }
      }, done);
    });
  });
});
