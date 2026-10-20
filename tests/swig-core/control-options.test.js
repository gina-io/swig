var swigModule = require('../../lib/swig'),
  twigModule = require('@rhinostone/swig-twig'),
  jinja2Module = require('@rhinostone/swig-jinja2'),
  djangoModule = require('@rhinostone/swig-django'),
  expect = require('../lib/expect.js');

/*!
 * Each frontend validates the varControls, tagControls and cmtControls
 * options when an instance is created: both controls must be strings.
 */

var flavors = [
  ['native', swigModule.Swig],
  ['twig', twigModule.Twig],
  ['jinja2', jinja2Module.Jinja2],
  ['django', djangoModule.Django]
];

flavors.forEach(function (flavor) {
  var Ctor = flavor[1];

  describe(flavor[0] + ' — control options', function () {
    ['varControls', 'tagControls', 'cmtControls'].forEach(function (key) {
      it('rejects a ' + key + ' value that is not a string', function () {
        [[12, 34], ['{{', 5], [null, '}}'], [['{{'], '}}']].forEach(function (pair) {
          var o = {};
          o[key] = pair;
          expect(function () { new Ctor(o); }).to.throwException(new RegExp('^Option "' + key + '" must be an array containing 2 different control strings\\.$'));
        });
      });
    });
  });
});
