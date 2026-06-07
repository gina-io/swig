/*!
 * Django `{% spaceless %}…{% endspaceless %}` tag.
 *
 * Removes whitespace between HTML tags within the block — every run of
 * whitespace that sits directly between a `>` and a `<` collapses away:
 *
 *   {% spaceless %}
 *     <p>
 *       <a href="foo/">Foo</a>
 *     </p>
 *   {% endspaceless %}
 *   // => <p><a href="foo/">Foo</a></p>
 *
 * Django's rule is strictly `>\s+<` → `><` — it does NOT strip leading /
 * trailing whitespace of the block or whitespace inside a tag or inside
 * text. (This is narrower than the native swig `spaceless`, which also
 * strips the leading/trailing whitespace of the WHOLE output — a quirk this
 * faithful port deliberately avoids.)
 *
 * The body is compiled into a shadowed `_output` local (the same shape the
 * backend uses for `{% filter %}`), so the collapse is scoped to just this
 * region's content — content emitted before / after the block is untouched.
 *
 * Takes no arguments. Extra tokens after `spaceless` are rejected at parse
 * time.
 */

var ir = require('@rhinostone/swig-core/lib/ir');
var utils = require('@rhinostone/swig-core/lib/utils');

exports.ends = true;
exports.block = false;

/**
 * Reject any tokens after the `spaceless` keyword.
 *
 * @param  {string} str    Tag body (everything after `spaceless`).
 * @param  {number} line   Source line of the opening `{%`.
 * @param  {object} parser The Django parser module (unused).
 * @param  {object} types  Django lexer token-type enum (unused).
 * @param  {Array}  stack  Open-tag stack (parser.js manages the push).
 * @param  {object} opts   Per-call options (honors `opts.filename`).
 * @return {boolean}       Always `true` on success. Throws otherwise.
 */
exports.parse = function (str, line, parser, types, stack, opts) {
  var stripped = utils.strip(str || '');
  if (stripped.length > 0) {
    utils.throwError('Unexpected token "' + stripped + '" after "spaceless"', line, opts.filename);
  }
  return true;
};

/**
 * Emit the body into a shadowed `_output` local, then append the
 * whitespace-collapsed result to the real output. Returns an IRLegacyJS
 * node carrying the generated JS.
 *
 * @return {object} IRLegacyJS node.
 */
exports.compile = function (compiler, args, content, parents, options, blockName) {
  var bodyJS = compiler(content, parents, options, blockName);
  return ir.legacyJS(
    '_output += (function () {\n' +
    '  var _output = "";\n' +
    bodyJS +
    '  return _output.replace(/>\\s+</g, "><");\n' +
    '})();\n'
  );
};
