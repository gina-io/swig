var utils = require('@rhinostone/swig-core/lib/utils'),
  backend = require('@rhinostone/swig-core/lib/backend'),
  ir = require('@rhinostone/swig-core/lib/ir'),
  expect = require('../lib/expect.js');

/*!
 * `_utils.isIn` backs the `in` operator of swig-twig, swig-jinja2 and
 * swig-django: each flags its IR node with its flavor name, and the backend
 * emits the call. Native swig keeps the JavaScript `in` operator.
 */
describe('swig-core utils.isIn', function () {

  describe('Jinja2 and Django', function () {
    it('tests a list item with ===', function () {
      expect(utils.isIn(3, [1, 2, 3], 'jinja2')).to.be(true);
      expect(utils.isIn(0, [1, 2, 3], 'jinja2')).to.be(false);
      expect(utils.isIn('1', [1], 'django')).to.be(false);
      expect(utils.isIn(true, [1], 'django')).to.be(false);
    });

    it('treats null and a missing value as equal', function () {
      expect(utils.isIn(undefined, [null], 'django')).to.be(true);
      expect(utils.isIn(null, [undefined], 'jinja2')).to.be(true);
      expect(utils.isIn(null, [''], 'django')).to.be(false);
    });

    it('tests a substring when the needle is a string', function () {
      expect(utils.isIn('bc', 'abc', 'jinja2')).to.be(true);
      expect(utils.isIn('', '', 'django')).to.be(true);
      expect(utils.isIn(1, '123', 'jinja2')).to.be(false);
    });

    it('tests the own keys of a mapping; a number tests the key with the same digits', function () {
      expect(utils.isIn('a', { a: 1 }, 'jinja2')).to.be(true);
      expect(utils.isIn('toString', {}, 'django')).to.be(false);
      expect(utils.isIn(1, { '1': 'x' }, 'django')).to.be(true);
      expect(utils.isIn(null, { a: 1 }, 'jinja2')).to.be(false);
    });

    it('is false for a test Python cannot run', function () {
      expect(utils.isIn(1, 5, 'jinja2')).to.be(false);
      expect(utils.isIn(1, null, 'django')).to.be(false);
      expect(utils.isIn(1, undefined, 'django')).to.be(false);
      expect(utils.isIn([1], { a: 1 }, 'jinja2')).to.be(false);
      expect(utils.isIn(1, function () { return [1]; }, 'jinja2')).to.be(false);
    });
  });

  describe('Twig', function () {
    it('compares a list item with == between scalars, and by identity otherwise', function () {
      var a = [1];
      expect(utils.isIn('1', [1], 'twig')).to.be(true);
      expect(utils.isIn(true, [1], 'twig')).to.be(true);
      expect(utils.isIn(1, [[1]], 'twig')).to.be(false);
      expect(utils.isIn([1], [[1]], 'twig')).to.be(false);
      expect(utils.isIn(a, [a], 'twig')).to.be(true);
    });

    it('tests the values of a mapping', function () {
      expect(utils.isIn(1, { a: 1 }, 'twig')).to.be(true);
      expect(utils.isIn('a', { a: 1 }, 'twig')).to.be(false);
    });

    it('tests a substring for a string or number needle', function () {
      expect(utils.isIn(1, '123', 'twig')).to.be(true);
      expect(utils.isIn('', 'abc', 'twig')).to.be(true);
      expect(utils.isIn(null, 'abc', 'twig')).to.be(false);
      expect(utils.isIn(true, 'abc', 'twig')).to.be(false);
    });

    it('is false for anything else', function () {
      expect(utils.isIn(1, 5, 'twig')).to.be(false);
      expect(utils.isIn(1, null, 'twig')).to.be(false);
    });
  });

  describe('backend emission', function () {
    function inNode(flavor) {
      var node = ir.binaryOp('in', ir.literal('string', 'a'), ir.varRef(['items']));
      node.membership = flavor;
      return node;
    }

    it('emits _utils.isIn with the flavor name for a flagged node', function () {
      var js = backend.emitExpr(inNode('django'));
      expect(js).to.match(/^_utils\.isIn\("a", \(/);
      expect(js).to.match(/, "django"\)$/);
      expect(backend.emitExpr(inNode('twig'))).to.match(/, "twig"\)$/);
      expect(backend.emitExpr(inNode('jinja2'))).to.match(/, "jinja2"\)$/);
    });

    it('writes only a known flavor name into the code', function () {
      expect(backend.emitExpr(inNode('unknown'))).to.match(/, "jinja2"\)$/);
    });
  });
});
