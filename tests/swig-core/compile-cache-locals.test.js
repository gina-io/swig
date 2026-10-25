var swigModule = require('../../lib/swig'),
  twigModule = require('@rhinostone/swig-twig'),
  jinja2Module = require('@rhinostone/swig-jinja2'),
  djangoModule = require('@rhinostone/swig-django'),
  expect = require('../lib/expect.js');

/*!
 * With the default memory cache, compile cached under the filename a function
 * that carried the locals given in the options of the call that created the
 * entry. A later render, compile or compileFile of the same file got that
 * function: render(source, { filename, locals }) rendered the first call's
 * locals on every later call, and a later caller that passed its own locals got
 * the first call's under them, through renderFile and an include too. The cache
 * now keeps a function without those locals, and each call binds its own.
 */

var flavors = [
  ['native', swigModule, 'Swig'],
  ['twig', twigModule, 'Twig'],
  ['jinja2', jinja2Module, 'Jinja2'],
  ['django', djangoModule, 'Django']
];

var files = {
  '/f.html': '<{{ v }}>',
  '/x.html': '<{{ user }}|{{ secret }}>',
  '/y.html': '[{% include "/x.html" %}]'
};

flavors.forEach(function (flavor) {
  var lib = flavor[1],
    Ctor = lib[flavor[2]];

  function instance(opts) {
    var o = { loader: lib.loaders.memory(files, '/') }, k;
    for (k in (opts || {})) {
      o[k] = opts[k];
    }
    return new Ctor(o);
  }

  describe(flavor[0] + ' — compile cache and the locals of a call', function () {
    it('renders each call\'s locals through render with a filename', function () {
      var s = instance();
      expect(s.render('<{{ v }}>', { filename: '/p.html', locals: { v: 'first' } })).to.equal('<first>');
      expect(s.render('<{{ v }}>', { filename: '/p.html', locals: { v: 'second' } })).to.equal('<second>');
    });

    it('renders each call\'s locals through compile with a filename', function () {
      var s = instance();
      expect(s.compile('<{{ v }}>', { filename: '/c.html', locals: { v: 'first' } })()).to.equal('<first>');
      expect(s.compile('<{{ v }}>', { filename: '/c.html', locals: { v: 'second' } })()).to.equal('<second>');
    });

    it('keeps one compile call\'s locals out of a later compile of the same file', function () {
      var s = instance(), src = '<{{ user }}|{{ secret }}>';
      expect(s.compile(src, { filename: '/q.html', locals: { user: 'alice', secret: 's1' } })()).to.equal('<alice|s1>');
      expect(s.compile(src, { filename: '/q.html' })({ user: 'bob' })).to.equal('<bob|>');
    });

    it('renders each call\'s locals through compileFile', function () {
      var s = instance();
      expect(s.compileFile('/f.html', { locals: { v: 'first' } })()).to.equal('<first>');
      expect(s.compileFile('/f.html', { locals: { v: 'second' } })()).to.equal('<second>');
    });

    it('keeps a render\'s locals out of a later renderFile of the same file', function () {
      var s = instance();
      expect(s.render(files['/x.html'], { filename: '/x.html', locals: { user: 'alice', secret: 's1' } })).to.equal('<alice|s1>');
      expect(s.renderFile('/x.html', { user: 'bob' })).to.equal('<bob|>');
    });

    it('keeps a render\'s locals out of a later include of the same file', function () {
      var s = instance();
      expect(s.render(files['/x.html'], { filename: '/x.html', locals: { user: 'alice', secret: 's1' } })).to.equal('<alice|s1>');
      expect(s.renderFile('/y.html', { user: 'bob' })).to.equal('[<bob|>]');
    });

    it('keeps the instance default locals under each call\'s locals', function () {
      var s = instance({ locals: { site: 'S' } });
      expect(s.render('<{{ site }}{{ v }}>', { filename: '/d.html', locals: { v: 'first' } })).to.equal('<Sfirst>');
      expect(s.render('<{{ site }}{{ v }}>', { filename: '/d.html', locals: { v: 'second' } })).to.equal('<Ssecond>');
    });

    it('renders each call\'s locals on the async-codegen path', function () {
      var s = instance(), opts = { filename: '/a.html', codegenMode: 'async' };
      return s.render('<{{ v }}>', { filename: opts.filename, codegenMode: opts.codegenMode, locals: { v: 'first' } }).then(function (first) {
        expect(first.output).to.equal('<first>');
        return s.render('<{{ v }}>', { filename: opts.filename, codegenMode: opts.codegenMode, locals: { v: 'second' } });
      }).then(function (second) {
        expect(second.output).to.equal('<second>');
      });
    });

    it('renders each call\'s locals through the deprecated compileFileAsync', function (done) {
      var s = instance();
      s.compileFileAsync('/f.html', { locals: { v: 'first' } }, function (err, fn) {
        if (err) { return done(err); }
        expect(fn()).to.equal('<first>');
        s.compileFileAsync('/f.html', { locals: { v: 'second' } }, function (err2, fn2) {
          if (err2) { return done(err2); }
          expect(fn2()).to.equal('<second>');
          done();
        });
      });
    });

    it('renders a call\'s own locals over the locals of its compile call', function () {
      var c = instance().compile('<{{ a }}{{ b }}>', { filename: '/m.html', locals: { a: 'A', b: 'x' } });
      expect(c({ b: 'B' })).to.equal('<AB>');
      expect(c()).to.equal('<Ax>');
    });

    it('renders the locals of a compile call as they were when it was made', function () {
      var locals = { v: 'before' },
        c = instance().compile('<{{ v }}>', { filename: '/s.html', locals: locals });
      locals.v = 'after';
      expect(c()).to.equal('<before>');
    });

    it('still returns the cached function for a compile without locals', function () {
      var s = instance();
      expect(s.compile('<{{ v }}>', { filename: '/i.html' })).to.be(s.compile('<{{ v }}>', { filename: '/i.html' }));
    });

    it('keeps the parse tree on the function returned for a call with locals', function () {
      var s = instance(), src = '{% block b %}B{% endblock %}',
        withLocals = s.compile(src, { filename: '/t.html', locals: { v: 1 } }),
        plain = s.compile(src, { filename: '/t.html' });
      expect(withLocals.tokens).to.be(plain.tokens);
      expect(Object.keys(withLocals.blocks)).to.eql(['b']);
      expect(withLocals()).to.equal('B');
    });

    if (flavor[0] !== 'django') {
      it('starts each call of a function compiled with locals from fresh locals', function () {
        var c = instance().compile('[{% if seen %}again{% endif %}{% set seen = 1 %}{{ v }}]', { locals: { v: 'x' } });
        expect(c()).to.equal('[x]');
        expect(c()).to.equal('[x]');
      });
    }
  });
});
