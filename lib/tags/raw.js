// Magic tag, hardcoded into parser

var ir = require('@rhinostone/swig-core/lib/ir');

/**
 * Forces the content to not be auto-escaped. All swig instructions will be ignored and the content will be rendered exactly as it was given.
 *
 * @alias raw
 *
 * @example
 * // foobar = '<p>'
 * {% raw %}{{ foobar }}{% endraw %}
 * // => {{ foobar }}
 *
 */
exports.compile = function (compiler, args, content, parents, options, blockName) {
  var nodes = [];
  var i;
  for (i = 0; i < content.length; i++) {
    if (typeof content[i] === 'string') {
      nodes.push(ir.raw(content[i]));
    } else {
      nodes.push(ir.legacyJS(compiler([content[i]], parents, options, blockName)));
    }
  }
  return nodes;
};
exports.parse = function (str, line, parser) {
  parser.on('*', function (token) {
    throw new Error('Unexpected token "' + token.match + '" in raw tag on line ' + line + '.');
  });
  return true;
};
exports.ends = true;
