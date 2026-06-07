/*!
 * Django `{% empty %}` branch marker.
 *
 * Valid only inside a `{% for %}` body — Django's empty-iterable fallback
 * (the equivalent of Jinja2's `{% for … %}{% else %}`). It carries no
 * expression; the enclosing `for` tag's compile consumes the marker and
 * splits its body at it into the loop body and the empty body. The marker
 * never reaches the backend on its own — `compile` only fires if an
 * `empty` escapes its enclosing `for`, which the parse-time stack check
 * already prevents.
 */

var utils = require('@rhinostone/swig-core/lib/utils');

exports.ends = false;
exports.block = false;

exports.parse = function (str, line, parser, types, stack, opts, swig, token) {
  var top = stack[stack.length - 1];
  if (!top || top.name !== 'for') {
    utils.throwError('"empty" is only valid inside a "for" tag', line, opts.filename);
  }
  return true;
};

exports.compile = function () {
  throw new Error('"empty" used outside a "for" tag.');
};
