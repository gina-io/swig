var utils = require('../utils');

/**
 * Used within an <code data-language="swig">{% if %}</code> tag, the code block following this tag up until <code data-language="swig">{% endif %}</code> will be rendered if the <i>if</i> statement returns false.
 *
 * @alias else
 *
 * @example
 * {% if false %}
 *   statement1
 * {% else %}
 *   statement2
 * {% endif %}
 * // => statement2
 *
 */
exports.compile = function () {
  return '} else {\n';
};

exports.parse = function (str, line, parser, types, stack, opts) {
  parser.on('*', function (token) {
    throw new Error('"else" tag does not accept any tokens. Found "' + token.match + '" on line ' + line + '.');
  });

  // A second else compiled to invalid JavaScript (a raw "Unexpected token
  // 'else'"); refuse it as Jinja2 and Django do.
  if (exports.hasElse(stack)) {
    utils.throwError('Multiple "else" branches in "if" tag', line, opts && opts.filename);
  }

  return (stack.length && stack[stack.length - 1].name === 'if');
};

/*!
 * Whether the innermost open tag is an if whose content already holds an
 * else branch. The elseif tag uses it too.
 * @param  {TagToken[]} stack The open tags.
 * @return {boolean}
 * @private
 */
exports.hasElse = function (stack) {
  var top = stack.length ? stack[stack.length - 1] : null, i;
  if (!top || top.name !== 'if') {
    return false;
  }
  for (i = 0; i < top.content.length; i += 1) {
    if (top.content[i] && top.content[i].name === 'else') {
      return true;
    }
  }
  return false;
};
