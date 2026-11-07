var ir = require('@rhinostone/swig-core/lib/ir');

/**
 * Defines a block in a template that can be overridden by a template extending this one and/or will override the current template's parent template block of the same name.
 *
 * See <a href="#inheritance">Template Inheritance</a> for more information.
 *
 * @alias block
 *
 * @example
 * {% block body %}...{% endblock %}
 *
 * @param {literal}  name   Name of the block for use in parent and extended templates.
 */
exports.compile = function (compiler, args, content, parents, options) {
  var name = args.join('');
  return ir.block(name, [ir.legacyJS(compiler(content, parents, options, name))]);
};

exports.parse = function (str, line, parser) {
  parser.on('*', function (token) {
    this.out.push(token.match);
  });
  // The parser keeps blocks in a plain object keyed by the joined name, so
  // a block named __proto__ would set that object's prototype and lose a
  // child's override. The check reads the whole joined name, as the key is
  // built (`{% block __pro to__ %}` joins to __proto__).
  parser.on('end', function () {
    var name = this.out.join('');
    if (name === '__proto__') {
      throw new Error('Unsafe block name "' + name + '" is not allowed (prototype-chain guard) on line ' + line + '.');
    }
  });
  return true;
};

exports.ends = true;
exports.block = true;
