/*!
 * Django `{% autoescape %}` tag.
 *
 *   {% autoescape on %}{{ html }}{% endautoescape %}    (escape the region)
 *   {% autoescape off %}{{ html }}{% endautoescape %}   (don't escape)
 *
 * Controls auto-escaping of variable output within its body. The escape
 * decision is baked at parse time: the parser maintains an escape-value
 * stack that this tag's open pushes onto and `{% endautoescape %}` pops, so
 * each `{{ … }}` inside the region gets (or omits) the `e` filter tail
 * accordingly. The emitted IRAutoescape node is therefore inert at the
 * backend — it exists so the IR tree reflects the region.
 *
 * Only the literal keywords `on` and `off` are accepted (Django's spelling;
 * the other flavors use `true` / `false`). `on` / `off` lex as VAR tokens,
 * not BOOL. A runtime expression (`{% autoescape some_var %}`) is rejected
 * at parse time — the parse-time escape model can only resolve a literal
 * strategy.
 */

var ir = require('@rhinostone/swig-core/lib/ir');
var utils = require('@rhinostone/swig-core/lib/utils');

var lexer = require('../lexer');

exports.ends = true;
exports.block = false;

/**
 * Parse the `{% autoescape %}` tag body. Requires a single `on` / `off`
 * VAR token and stashes the resolved boolean on `token.escapeValue` — the
 * parser reads it to push onto the escape-value stack for the region, and
 * compile reads it to build the IRAutoescape node.
 *
 * @param  {string} str    Tag body.
 * @param  {number} line   Source line of the opening `{%`.
 * @param  {object} parser The Django parser module (unused).
 * @param  {object} types  Django lexer token-type enum.
 * @param  {Array}  stack  Open-tag stack (parser.js manages the push).
 * @param  {object} opts   Per-call options (honors `opts.filename`).
 * @param  {object} swig   Swig instance (unused).
 * @param  {object} token  In-progress TagToken. Gets `token.escapeValue`.
 * @return {boolean}       Always `true` on success. Throws otherwise.
 */
exports.parse = function (str, line, parser, types, stack, opts, swig, token) {
  var tokens = lexer.read(utils.strip(str));
  var pos = 0;

  while (pos < tokens.length && tokens[pos].type === types.WHITESPACE) { pos += 1; }
  var tok = pos < tokens.length ? tokens[pos] : null;
  if (!tok || tok.type !== types.VAR || (tok.match !== 'on' && tok.match !== 'off')) {
    utils.throwError('Expected "on" or "off" in "autoescape" tag', line, opts.filename);
  }
  pos += 1;

  while (pos < tokens.length && tokens[pos].type === types.WHITESPACE) { pos += 1; }
  if (pos < tokens.length) {
    utils.throwError('Unexpected token "' + tokens[pos].match + '" in "autoescape" tag', line, opts.filename);
  }

  token.escapeValue = (tok.match === 'on');
  return true;
};

/**
 * Emit an IRAutoescape node wrapping the recursively-compiled body. The
 * body's `{{ … }}` outputs already carry (or omit) their `e` tails from
 * parse time, so the backend emits the body verbatim; the strategy is
 * carried for IR fidelity.
 *
 * @return {object} IRAutoescape node.
 */
exports.compile = function (compiler, args, content, parents, options, blockName, token) {
  var bodyJS = compiler(content, parents, options, blockName);
  return ir.autoescape(token.escapeValue, [ir.legacyJS(bodyJS)]);
};
