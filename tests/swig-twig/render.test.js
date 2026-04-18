var twig = require('@rhinostone/swig-twig'),
  expect = require('expect.js');


/*!
 * Phase 3 Session 17 — Path A render-surface tests.
 *
 * Verifies the full engine.install() API is wired correctly on both the
 * default Twig instance and per-instance `new twig.Twig()` constructors:
 * render / renderFile / compile / compileFile / precompile / run /
 * __express, plus gh-496 isolation (filters / tags / extensions / cache)
 * and filename-aware parse errors.
 *
 * See .claude/architecture/multi-flavor-ir.md § Phase 3 for scope.
 */
describe('@rhinostone/swig-twig — render surface', function () {

  describe('render(source, options)', function () {

    it('renders plain locals', function () {
      var out = twig.render('Hello {{ name }}', { locals: { name: 'world' } });
      expect(out).to.equal('Hello world');
    });

    it('applies a filter chain', function () {
      var out = twig.render('{{ name|upper }}', { locals: { name: 'swig' } });
      expect(out).to.equal('SWIG');
    });

    it('renders an if branch', function () {
      var out = twig.render('{% if flag %}on{% endif %}', { locals: { flag: true } });
      expect(out).to.equal('on');
    });

    it('renders a for loop', function () {
      var out = twig.render('{% for n in items %}{{ n }}{% endfor %}', {
        locals: { items: [1, 2, 3] }
      });
      expect(out).to.equal('123');
    });

    it('autoescapes variable output by default', function () {
      var out = twig.render('{{ s }}', { locals: { s: '<b>' } });
      expect(out).to.equal('&lt;b&gt;');
    });

  });

  describe('renderFile(path, locals, cb)', function () {

    it('renders a template from a memory loader via Express 3-arg callback', function (done) {
      var mytwig = new twig.Twig({
        loader: twig.loaders.memory({ 'home.twig': 'Hi {{ name }}' })
      });
      mytwig.renderFile('home.twig', { name: 'there' }, function (err, out) {
        expect(err).to.be(null);
        expect(out).to.equal('Hi there');
        done();
      });
    });

  });

  describe('compile / precompile / run round-trip', function () {

    it('compile(src)(locals) returns rendered output', function () {
      var fn = twig.compile('Hi {{ name }}');
      expect(fn({ name: 'x' })).to.equal('Hi x');
    });

    it('precompile(src) returns { tpl, tokens }', function () {
      var pre = twig.precompile('{{ name }}');
      expect(pre).to.have.property('tpl');
      expect(pre).to.have.property('tokens');
      expect(pre.tpl).to.be.a('function');
    });

    it('run(tpl, locals) executes a pre-compiled function', function () {
      var pre = twig.precompile('Hi {{ name }}');
      var out = twig.run(pre.tpl, { name: 'ok' });
      expect(out).to.equal('Hi ok');
    });

  });

  describe('compileFile(path, options, cb)', function () {

    it('compiles synchronously against the memory loader', function () {
      var mytwig = new twig.Twig({
        loader: twig.loaders.memory({ 'page.twig': '{{ msg }}' })
      });
      var fn = mytwig.compileFile('page.twig');
      expect(fn({ msg: 'hello' })).to.equal('hello');
    });

    it('compiles asynchronously via callback', function (done) {
      var mytwig = new twig.Twig({
        loader: twig.loaders.memory({ 'page.twig': '{{ msg }}' })
      });
      mytwig.compileFile('page.twig', {}, function (err, fn) {
        expect(err).to.be(null);
        expect(fn({ msg: 'hi' })).to.equal('hi');
        done();
      });
    });

  });

  describe('instance isolation (gh-496)', function () {

    it('does not share filters across instances', function () {
      var a = new twig.Twig();
      a.setFilter('shout', function (input) { return input + '!'; });
      var b = new twig.Twig();
      expect(function () {
        b.render('{{ x|shout }}', { locals: { x: 'hi' } });
      }).to.throwError();
    });

    it('does not share tags across instances', function () {
      var a = new twig.Twig();
      a.setTag(
        'noop',
        function () { return true; },
        function () { return ''; },
        false
      );
      var b = new twig.Twig();
      expect(function () {
        b.render('{% noop %}');
      }).to.throwError();
    });

    it('does not share extensions across instances', function () {
      var a = new twig.Twig();
      a.setExtension('foo', function () { return 'A'; });
      var b = new twig.Twig();
      expect(b.extensions.foo).to.be(undefined);
    });

    it('keeps caches independent', function () {
      var a = new twig.Twig({
        loader: twig.loaders.memory({ 'x.twig': 'A' })
      });
      var b = new twig.Twig({
        loader: twig.loaders.memory({ 'x.twig': 'B' })
      });
      expect(a.renderFile('x.twig')).to.equal('A');
      expect(b.renderFile('x.twig')).to.equal('B');
    });

  });

  describe('filename-aware errors', function () {

    it('attributes parse errors to the source filename', function (done) {
      var mytwig = new twig.Twig({
        loader: twig.loaders.memory({ 'bad.twig': '{% unknowntag %}' })
      });
      mytwig.compileFile('bad.twig', {}, function (err) {
        expect(err).to.be.an(Error);
        expect(err.message).to.contain('bad.twig');
        done();
      });
    });

  });

  describe('__express alias', function () {

    it('is an alias for the default instance renderFile', function () {
      expect(twig.__express).to.equal(twig.renderFile);
    });

  });

});
