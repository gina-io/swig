/*!
 * Phase 3 Session 11 — Twig `{% verbatim %}…{% endverbatim %}` tag.
 *
 * Preserves arbitrary template-like content as literal output. Inside
 * a verbatim block, `{{ … }}`, `{% … %}` (other than `{% endverbatim %}`),
 * and `{# … #}` are NOT parsed — the splitter in `parser.js` flips an
 * `inVerbatim` flag that bypasses the variable/tag/comment branches and
 * wraps each chunk as `ir.text`, so the content array handed to this
 * tag's compile is already a list of IRText nodes.
 *
 * Takes no arguments. Extra tokens after `verbatim` are rejected at
 * parse time with a filename-aware throw.
 */

var utils = require('@rhinostone/swig-core/lib/utils');

/**
 * Reject any tokens after the `verbatim` keyword. The splitter owns
 * all content-capture behaviour via its `inVerbatim` flag, so this
 * handler only has to validate the tag's own argument list (which
 * must be empty).
 *
 * @param  {string} str    Tag body (everything after `verbatim`).
 * @param  {number} line   Source line of the opening `{%`.
 * @param  {object} parser The Twig parser module (unused).
 * @param  {object} types  Twig lexer token-type enum (unused).
 * @param  {Array}  stack  Open-tag stack (parser.js manages the push).
 * @param  {object} opts   Per-call options (honors `opts.filename`).
 * @return {boolean}       Always `true` on success. Throws otherwise.
 */
exports.parse = function (str, line, parser, types, stack, opts) {
  var stripped = utils.strip(str || '');
  if (stripped.length > 0) {
    utils.throwError('Unexpected token "' + stripped + '" after "verbatim"', line, opts.filename);
  }
  return true;
};

/**
 * Return the captured content array unchanged. Each item is already
 * an IRText node (or another pre-built IR node that the backend will
 * splice through), so the backend's emit loop can iterate and emit
 * without any further wrapping.
 *
 * @return {Array} Content node list.
 */
exports.compile = function (compiler, args, content) {
  return content;
};

exports.ends = true;
exports.block = false;
