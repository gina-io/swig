/*!
 * Jinja2 `{% elif %}` branch marker.
 *
 * Valid only inside an `{% if %}` body. Parses its test expression onto
 * `token.irExpr`; the enclosing `if` tag's compile consumes the marker and
 * splits its branches at it. The marker never reaches the backend on its
 * own — `compile` only fires if an `elif` somehow escapes an `if`, which
 * the parse-time stack check already prevents.
 */

var utils = require('@rhinostone/swig-core/lib/utils');

var lexer = require('../lexer');

exports.ends = false;
exports.block = false;

exports.parse = function (str, line, parser, types, stack, opts, swig, token) {
  var top = stack[stack.length - 1];
  if (!top || top.name !== 'if') {
    utils.throwError('"elif" is only valid inside an "if" tag', line, opts.filename);
  }
  var tokens = lexer.read(utils.strip(str));
  if (!tokens.length) {
    utils.throwError('Expected conditional expression in "elif" tag', line, opts.filename);
  }
  token.irExpr = parser.parseExpr(tokens);
  return true;
};

exports.compile = function () {
  throw new Error('"elif" used outside an "if" tag.');
};
