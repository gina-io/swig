/*!
 * Jinja2 `{% else %}` branch marker.
 *
 * Valid inside an `{% if %}` body (the final fallback branch) or a
 * `{% for %}` body (the empty-iterable branch). It carries no expression;
 * the enclosing tag's compile consumes the marker and splits its body at
 * it. The marker never reaches the backend on its own — `compile` only
 * fires if an `else` escapes its enclosing tag, which the parse-time stack
 * check already prevents.
 */

var utils = require('@rhinostone/swig-core/lib/utils');

exports.ends = false;
exports.block = false;

exports.parse = function (str, line, parser, types, stack, opts, swig, token) {
  var top = stack[stack.length - 1];
  if (!top || (top.name !== 'if' && top.name !== 'for')) {
    utils.throwError('"else" is only valid inside an "if" or "for" tag', line, opts.filename);
  }
  return true;
};

exports.compile = function () {
  throw new Error('"else" used outside an "if" or "for" tag.');
};
