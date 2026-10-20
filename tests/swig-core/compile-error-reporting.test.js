var swigModule = require('../../lib/swig'),
  twigModule = require('@rhinostone/swig-twig'),
  jinja2Module = require('@rhinostone/swig-jinja2'),
  djangoModule = require('@rhinostone/swig-django'),
  expect = require('../lib/expect.js');

/*!
 * Errors raised while a parsed template is compiled to a function reach each
 * frontend's onCompileError. It must report them whether or not the caller
 * passed an options object, and name the template file once.
 */

var flavors = [
  ['native', swigModule.Swig],
  ['twig', twigModule.Twig],
  ['jinja2', jinja2Module.Jinja2],
  ['django', djangoModule.Django]
];

function yes() { return true; }

flavors.forEach(function (flavor) {
  var Ctor = flavor[1];

  describe(flavor[0] + ' — compile-phase error reporting', function () {
    function withTag(compile) {
      var s = new Ctor();
      s.setTag('broken', yes, compile, false);
      return s;
    }

    it('reports the error when render is called without options', function () {
      var s = withTag(function () { return '_output += ;'; });
      expect(function () { s.render('{% broken %}'); }).to.throwException(function (e) {
        expect(e instanceof TypeError).to.equal(false);
        expect(e.message).to.match(/Unexpected token/);
      });
    });

    it('adds the file name to an error that does not carry it', function () {
      var s = withTag(function () { return '_output += ;'; });
      expect(function () { s.render('{% broken %}', { filename: '/x.html' }); }).to.throwException(function (e) {
        expect(e.message).to.match(/Unexpected token.* in file \/x\.html\.$/);
      });
    });

    it('names the file once when the error already carries it', function () {
      var s = withTag(function (compiler, args, content, parents, options) {
        throw new Error('Broken tag in file ' + options.filename + '.');
      });
      expect(function () { s.render('{% broken %}', { filename: '/x.html' }); }).to.throwException(function (e) {
        expect(e.message).to.equal('Broken tag in file /x.html.');
      });
    });

    it('rethrows the error unchanged when there is no file name to add', function () {
      var s = withTag(function () { throw new Error('Broken tag.'); });
      expect(function () { s.render('{% broken %}', { locals: {} }); }).to.throwException(function (e) {
        expect(e.message).to.equal('Broken tag.');
      });
    });

    it('wraps a thrown value that is not an Error', function () {
      var s = withTag(function () { throw 'Broken tag'; });
      expect(function () { s.render('{% broken %}', { filename: '/x.html' }); }).to.throwException(function (e) {
        expect(e.message).to.equal('Broken tag in file /x.html.');
      });
      expect(function () { s.render('{% broken %}'); }).to.throwException(function (e) {
        expect(e.message).to.equal('Broken tag.');
      });
    });
  });
});
