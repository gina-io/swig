var expect = require('../lib/expect.js'),
  backend = require('../../packages/swig-core/lib/backend'),
  utils = require('../../packages/swig-core/lib/utils');


/*!
 * The two helpers behind statement bodies on the async render path:
 * backend.iife wraps a body in an async function, awaited, only in async
 * codegen mode and only when the body holds an await; utils.eachAsync
 * iterates like utils.each and awaits each call before the next.
 */
describe('swig-core async statement bodies', function () {

  describe('backend.iife', function () {
    var body = '  var _output = "";\n_output += (await f()).output;\n  return _output;\n',
      plainBody = '  var _output = "";\n_output += "x";\n  return _output;\n';

    it('emits the plain function in sync mode', function () {
      expect(backend.iife('', body, '', {})).to.equal('(function () {\n' + body + '})()');
      expect(backend.iife('_ctx', body, 'sel', undefined)).to.equal('(function (_ctx) {\n' + body + '})(sel)');
    });

    it('emits the plain function in async mode when the body holds no await', function () {
      expect(backend.iife('', plainBody, '', { codegenMode: 'async' })).to.equal('(function () {\n' + plainBody + '})()');
    });

    it('emits an awaited async function in async mode when the body holds an await', function () {
      expect(backend.iife('_ctx', body, 'sel', { codegenMode: 'async' })).to.equal('(await (async function (_ctx) {\n' + body + '})(sel))');
    });
  });

  describe('utils.eachAsync', function () {

    function later(ms, value) {
      return new Promise(function (resolve) { setTimeout(function () { resolve(value); }, ms); });
    }

    it('awaits each call before the next, in order', function () {
      var seen = [];
      return utils.eachAsync([30, 0, 10], function (ms, i) {
        return later(ms).then(function () { seen.push(i); });
      }).then(function (obj) {
        expect(seen).to.eql([0, 1, 2]);
        expect(obj).to.eql([30, 0, 10]);
      });
    });

    it('walks the own keys of an object and the characters of a string', function () {
      var seen = [], proto = { inherited: 1 }, obj = Object.create(proto);
      obj.a = 1;
      obj.b = 2;
      return utils.eachAsync(obj, function (v, k) {
        seen.push(k + '=' + v);
      }).then(function () {
        return utils.eachAsync('xy', function (c, i) { seen.push(i + ':' + c); });
      }).then(function () {
        expect(seen).to.eql(['a=1', 'b=2', '0:x', '1:y']);
      });
    });

    it('stops when a call returns or resolves to false', function () {
      var seen = [];
      return utils.eachAsync([1, 2, 3], function (v) {
        seen.push(v);
        return later(1, v !== 2);
      }).then(function () {
        expect(seen).to.eql([1, 2]);
      });
    });

    it('rejects with the first error and stops there', function () {
      var seen = [];
      return utils.eachAsync([1, 2, 3], function (v) {
        seen.push(v);
        if (v === 2) {
          throw new Error('stop at 2');
        }
      }).then(function () {
        throw new Error('expected a rejection');
      }, function (err) {
        expect(err.message).to.equal('stop at 2');
        expect(seen).to.eql([1, 2]);
      });
    });
  });
});
