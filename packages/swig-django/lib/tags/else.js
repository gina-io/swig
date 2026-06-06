/*!
 * Django `{% else %}` branch marker.
 *
 * Valid inside an `{% if %}` body (the final fallback branch). It carries no
 * expression; the enclosing `if` tag's compile consumes the marker and
 * splits its body at it. The marker never reaches the backend on its own —
 * `compile` only fires if an `else` escapes its enclosing tag, which the
 * parse-time stack check already prevents.
 *
 * Unlike the Jinja2 sibling, Django's `else` is NOT valid inside a `{% for %}`
 * tag — Django's empty-iterable branch is the dedicated `{% empty %}` marker
 * (added with the `for` tag in a later commit), not `{% else %}`.
 */

var utils = require('@rhinostone/swig-core/lib/utils');

exports.ends = false;
exports.block = false;

exports.parse = function (str, line, parser, types, stack, opts, swig, token) {
  var top = stack[stack.length - 1];
  if (!top || top.name !== 'if') {
    utils.throwError('"else" is only valid inside an "if" tag', line, opts.filename);
  }
  return true;
};

exports.compile = function () {
  throw new Error('"else" used outside an "if" tag.');
};
