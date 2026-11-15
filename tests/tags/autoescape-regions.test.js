var swig = require('../../lib/swig'),
  expect = require('../lib/expect.js'),
  Swig = swig.Swig;

function render(src, locals, opts) {
  var s = new Swig(opts || {});
  return s.render(src, { locals: locals || {} });
}

describe('Tag: autoescape arguments and regions', function () {

  describe('a tag with no argument', function () {
    it('fails at compile', function () {
      expect(function () {
        render('{% autoescape %}{{ v }}{% endautoescape %}', { v: '<i>' });
      }).to.throwError(/^Expected true, false, "html" or "js" in autoescape tag on line 1\.$/);
    });

    it('names the line and the file', function () {
      expect(function () {
        new Swig().render('a\n{% autoescape %}x{% endautoescape %}', { filename: 'page.html' });
      }).to.throwError(/^Expected true, false, "html" or "js" in autoescape tag on line 2 in file page\.html\.$/);
    });

    it('fails on an instance whose default is false', function () {
      expect(function () {
        render('{% autoescape %}{{ v }}{% endautoescape %}', { v: '<i>' }, { autoescape: false });
      }).to.throwError(/^Expected true, false, "html" or "js" in autoescape tag on line 1\.$/);
    });
  });

  describe('a string argument', function () {
    it('accepts "html" and \'html\'', function () {
      expect(render('{% autoescape "html" %}{{ v }}{% endautoescape %}', { v: '<i>' }, { autoescape: false })).to.equal('&lt;i&gt;');
      expect(render("{% autoescape 'html' %}{{ v }}{% endautoescape %}", { v: '<i>' }, { autoescape: false })).to.equal('&lt;i&gt;');
    });

    it('accepts "js" and \'js\'', function () {
      expect(render('{% autoescape "js" %}{{ v }}{% endautoescape %}', { v: '<' })).to.equal('\\u003C');
      expect(render("{% autoescape 'js' %}{{ v }}{% endautoescape %}", { v: '<' })).to.equal('\\u003C');
    });

    it('rejects another string', function () {
      expect(function () {
        render('{% autoescape "foo" %}{{ v }}{% endautoescape %}', { v: '<i>' });
      }).to.throwError(/^Unexpected token ""foo"" in autoescape tag on line 1\.$/);
      expect(function () {
        render("{% autoescape 'foo' %}{{ v }}{% endautoescape %}", { v: '<i>' });
      }).to.throwError(/^Unexpected token "'foo'" in autoescape tag on line 1\.$/);
      expect(function () {
        render('{% autoescape "" %}{{ v }}{% endautoescape %}', { v: '<i>' });
      }).to.throwError(/^Unexpected token """" in autoescape tag on line 1\.$/);
      expect(function () {
        render('{% autoescape "HTML" %}{{ v }}{% endautoescape %}', { v: '<i>' });
      }).to.throwError(/^Unexpected token ""HTML"" in autoescape tag on line 1\.$/);
    });

    it('keeps the boolean arguments', function () {
      expect(render('{% autoescape true %}{{ v }}{% endautoescape %}', { v: '<i>' }, { autoescape: false })).to.equal('&lt;i&gt;');
      expect(render('{% autoescape false %}{{ v }}{% endautoescape %}', { v: '<i>' })).to.equal('<i>');
    });
  });

  describe('nested regions', function () {
    var v = { v: '<i>' };

    it('an inner false region inside an outer true region restores the outer region', function () {
      expect(render('{% autoescape true %}{% autoescape false %}{{ v }}{% endautoescape %}{{ v }}{% endautoescape %}{{ v }}', v, { autoescape: false }))
        .to.equal('<i>&lt;i&gt;<i>');
    });

    it('an inner true region inside an outer false region restores the outer region', function () {
      expect(render('{% autoescape false %}{% autoescape true %}{{ v }}{% endautoescape %}{{ v }}{% endautoescape %}{{ v }}', v))
        .to.equal('&lt;i&gt;<i>&lt;i&gt;');
    });

    it('an inner "js" region restores an outer true region', function () {
      expect(render('{% autoescape true %}{% autoescape "js" %}{{ v }}{% endautoescape %}{{ v }}{% endautoescape %}', { v: '<' }, { autoescape: false }))
        .to.equal('\\u003C&lt;');
    });

    it('three levels restore each enclosing region in turn', function () {
      var src = '{% autoescape false %}{{ v }}' +
        '{% autoescape true %}{{ v }}' +
        '{% autoescape false %}{{ v }}{% endautoescape %}' +
        '{{ v }}{% endautoescape %}' +
        '{{ v }}{% endautoescape %}{{ v }}';
      expect(render(src, v)).to.equal('<i>&lt;i&gt;<i>&lt;i&gt;<i>&lt;i&gt;');
    });

    it('sibling regions each return to the template default', function () {
      var src = '{% autoescape true %}{{ v }}{% endautoescape %}{{ v }}{% autoescape true %}{{ v }}{% endautoescape %}{{ v }}';
      expect(render(src, v, { autoescape: false })).to.equal('&lt;i&gt;<i>&lt;i&gt;<i>');
    });

    it('restores the enclosing region on the async compile path', function (done) {
      var src = '{% autoescape true %}{% autoescape false %}{{ v }}{% endautoescape %}{{ v }}{% endautoescape %}',
        out = new Swig({ autoescape: false }).compile(src, { codegenMode: 'async' })(v);
      Promise.resolve(out).then(function (r) {
        try {
          expect(r.output).to.equal('<i>&lt;i&gt;');
          done();
        } catch (e) {
          done(e);
        }
      }, done);
    });
  });

  describe('a per-call autoescape option of undefined', function () {
    it('reads as true on an instance whose default is true', function () {
      expect(new Swig().render('{{ v }}', { locals: { v: '<i>' }, autoescape: undefined })).to.equal('&lt;i&gt;');
    });

    it('reads as true on an instance whose default is false', function () {
      expect(new Swig({ autoescape: false }).render('{{ v }}', { locals: { v: '<i>' }, autoescape: undefined })).to.equal('&lt;i&gt;');
    });

    it('leaves an explicit false alone', function () {
      expect(new Swig().render('{{ v }}', { locals: { v: '<i>' }, autoescape: false })).to.equal('<i>');
    });
  });

  describe('other autoescape option values', function () {
    it('reads undefined in the instance options as true', function () {
      expect(new Swig({ autoescape: undefined }).render('{{ v }}', { locals: { v: '<i>' } })).to.equal('&lt;i&gt;');
    });

    it('reads a per-call null as no escaping', function () {
      expect(new Swig().render('{{ v }}', { locals: { v: '<i>' }, autoescape: null })).to.equal('<i>');
    });
  });
});
