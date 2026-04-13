var utils = require('./utils');

/**
 * JS-codegen backend shared across @rhinostone/swig-family frontends.
 *
 * Phase 1 carve — owns the template-level token walker that turns a
 * parsed token tree into the JS body string fed to
 * `new Function('_swig', '_ctx', '_filters', '_utils', '_fn', body)`.
 * Tag `compile` functions still return JS source strings; this walker
 * splices them together and handles the string-literal emission path.
 *
 * Expression-level codegen (TokenParser inside `{{ … }}` / `{% … %}`)
 * and the `new Function(...)` wrapper stay with the native frontend in
 * Phase 1 and migrate with the constructor split in a later session.
 * See .claude/architecture/multi-flavor-ir.md.
 */

/**
 * Walk a parsed token tree and emit the JS source body for the compiled
 * template function. String tokens become escaped `_output += "..."`
 * statements; TagToken / VarToken entries delegate to the token's own
 * `compile` method with this function passed as the recursion callback.
 *
 * @param  {object|array} template Parsed token object (with `.tokens`) or a bare token array.
 * @param  {array}  [parents]      Parsed parent templates for extends/block resolution.
 * @param  {object} [options]      Swig options object.
 * @param  {string} [blockName]    Name of the enclosing `{% block %}`, if any.
 * @return {string}                JS source body. Does not include the `new Function(...)` wrapper.
 */
exports.compile = function (template, parents, options, blockName) {
  var out = '',
    tokens = utils.isArray(template) ? template : template.tokens;

  utils.each(tokens, function (token) {
    var o;
    if (typeof token === 'string') {
      out += '_output += "' + token.replace(/\\/g, '\\\\').replace(/\n|\r/g, '\\n').replace(/"/g, '\\"') + '";\n';
      return;
    }

    o = token.compile(exports.compile, token.args ? token.args.slice(0) : [], token.content ? token.content.slice(0) : [], parents, options, blockName);
    out += o || '';
  });

  return out;
};
