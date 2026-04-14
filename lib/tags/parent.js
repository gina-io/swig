var ir = require('@rhinostone/swig-core/lib/ir');

/**
 * Inject the content from the parent template's block of the same name into the current block.
 *
 * See <a href="#inheritance">Template Inheritance</a> for more information.
 *
 * @alias parent
 *
 * @example
 * {% extends "./foo.html" %}
 * {% block content %}
 *   My content.
 *   {% parent %}
 * {% endblock %}
 *
 */
exports.compile = function (compiler, args, content, parents, options, blockName) {
  if (!parents || !parents.length) {
    return '';
  }

  var parentFile = args[0],
    breaker = true,
    l = parents.length,
    i = 0,
    parent,
    block;

  for (i; i < l; i += 1) {
    parent = parents[i];
    if (!parent.blocks || !parent.blocks.hasOwnProperty(blockName)) {
      continue;
    }
    // Silly JSLint "Strange Loop" requires return to be in a conditional
    if (breaker && parentFile !== parent.name) {
      block = parent.blocks[blockName];
      // Phase 2: the block tag now returns `IRBlock { body: [...] }`.
      // Splice the matched parent block's body into an IRParent node;
      // the backend emits body verbatim plus a trailing newline for
      // byte-identity with the pre-Phase-2 JS-string emission shape.
      var blockNode = block.compile(compiler, [blockName], block.content, parents.slice(i + 1), options);
      return ir.parent((blockNode && blockNode.body) ? blockNode.body.concat([ir.legacyJS('\n')]) : [ir.legacyJS('\n')]);
    }
  }
};

exports.parse = function (str, line, parser, types, stack, opts) {
  parser.on('*', function (token) {
    throw new Error('Unexpected argument "' + token.match + '" on line ' + line + '.');
  });

  parser.on('end', function () {
    this.out.push(opts.filename);
  });

  return true;
};