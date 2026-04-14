var utils = require('./utils'),
  ir = require('./ir');

/**
 * JS-codegen backend shared across @rhinostone/swig-family frontends.
 *
 * Phase 2 — the template-level walker dispatches on IR node shape. At
 * entry, every parse-tree token (string, VarToken, TagToken) is wrapped
 * transparently as an `IRLegacyJS` node carrying the JS fragment the
 * pre-Phase-2 walker would have emitted inline; the walker then iterates
 * the IR array and splices each `LegacyJS` node's `js` into the compiled
 * body. Subsequent sessions introduce real IR emitters (`Text`, `Raw`,
 * `Autoescape`, `If`, `For`, `Set`, etc.) alongside their matching tag
 * migrations, and each new shape gets its own dispatch branch here.
 *
 * Tag `compile` functions still return JS source strings — the
 * contract passed through `exports.compile` as the recursion callback
 * is unchanged. The `new Function(...)` wrapper stays with the native
 * frontend (filename-aware error attribution, per the seam rule).
 *
 * See .claude/architecture/multi-flavor-ir.md § Phase 2.
 */

/**
 * Walk a parsed token tree and emit the JS source body for the compiled
 * template function. Each token is wrapped as an `IRLegacyJS` node so
 * the backend sees a uniform IR array; the walker then emits each
 * node's JS fragment.
 *
 * @param  {object|array} template Parsed token object (with `.tokens`) or a bare token array.
 * @param  {array}  [parents]      Parsed parent templates for extends/block resolution.
 * @param  {object} [options]      Swig options object.
 * @param  {string} [blockName]    Name of the enclosing `{% block %}`, if any.
 * @return {string}                JS source body. Does not include the `new Function(...)` wrapper.
 */
exports.compile = function (template, parents, options, blockName) {
  var out = '',
    tokens = utils.isArray(template) ? template : template.tokens,
    nodes = [];

  utils.each(tokens, function (token) {
    var js;
    if (typeof token === 'string') {
      js = '_output += "' + token.replace(/\\/g, '\\\\').replace(/\n|\r/g, '\\n').replace(/"/g, '\\"') + '";\n';
    } else {
      js = token.compile(exports.compile, token.args ? token.args.slice(0) : [], token.content ? token.content.slice(0) : [], parents, options, blockName) || '';
    }
    nodes.push(ir.legacyJS(js));
  });

  utils.each(nodes, function (node) {
    if (node.type === 'LegacyJS') {
      out += node.js;
      return;
    }
  });

  return out;
};
