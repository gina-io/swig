/*!
 * Django `{% firstof %}` tag.
 *
 *   {% firstof a b c %}            (output the first "truthy" value)
 *   {% firstof a b "fallback" %}   (a trailing literal is just another value)
 *
 * Outputs the first argument that evaluates truthy, or the empty string if
 * none do. Each argument is lowered through `parser.parseExpr`, so variables,
 * literals, and member access all work. A missing variable resolves to `""`
 * (via emitVarRef) and so counts as falsy — exactly like Django.
 *
 * The output is autoescaped according to the enclosing region's autoescape
 * state (the same `e`-filter tail a `{{ … }}` would get), read from
 * `token.escape`. There is no user filter chain on a firstof value.
 *
 * The `{% firstof a b as var %}` assign-to-variable form (Django 1.9+) is not
 * yet supported and is rejected with a clear message.
 */

var ir = require('@rhinostone/swig-core/lib/ir');
var utils = require('@rhinostone/swig-core/lib/utils');

var lexer = require('../lexer');

exports.ends = false;
exports.block = false;

/*!
 * True if a bare VAR token matching `word` appears anywhere in `tokens`.
 * firstof / cycle arguments are simple values, so no paren-depth tracking is
 * needed to spot a trailing keyword. @private
 */
function hasKeyword(tokens, types, word) {
  var i;
  for (i = 0; i < tokens.length; i += 1) {
    if (tokens[i].type === types.VAR && tokens[i].match === word) { return true; }
  }
  return false;
}

/**
 * Parse the space-separated value list onto `token.irArgs` (an IRExpr[]).
 *
 * @param  {string} str    Tag body.
 * @param  {number} line   Source line of the opening `{%`.
 * @param  {object} parser The Django parser module (exposes `parseExpr`).
 * @param  {object} types  Django lexer token-type enum.
 * @param  {Array}  stack  Open-tag stack (unused — firstof has no body).
 * @param  {object} opts   Per-call options (honors `opts.filename`).
 * @param  {object} swig   Swig instance (unused).
 * @param  {object} token  In-progress TagToken. Gets `token.irArgs`.
 * @return {boolean}       Always `true` on success. Throws otherwise.
 */
exports.parse = function (str, line, parser, types, stack, opts, swig, token) {
  var tokens = lexer.read(utils.strip(str));
  if (!tokens.length) {
    utils.throwError('Expected at least one value in "firstof" tag', line, opts.filename);
  }
  if (hasKeyword(tokens, types, 'as')) {
    utils.throwError('The "as" (assign-to-variable) form of "firstof" is not yet supported', line, opts.filename);
  }

  var args = [];
  var pos = 0;
  while (true) {
    while (pos < tokens.length && tokens[pos].type === types.WHITESPACE) { pos += 1; }
    if (pos >= tokens.length) { break; }
    var posOut = {};
    var expr = parser.parseExpr(tokens.slice(pos), {}, posOut);
    pos += posOut.pos;
    args.push(expr);
  }

  token.irArgs = args;
  return true;
};

/**
 * Emit an IROutput whose expression is the values chained with `||` and
 * terminated by an empty-string literal (`a || b || c || ""`), so the result
 * is the first truthy value or `""`. The `e` filter tail is appended when the
 * region is autoescaping.
 *
 * @return {object} IROutput node.
 */
exports.compile = function (compiler, args, content, parents, options, blockName, token) {
  var exprs = token.irArgs.slice();
  exprs.push(ir.literal('string', ''));

  var acc = exprs[exprs.length - 1];
  var i;
  for (i = exprs.length - 2; i >= 0; i -= 1) {
    acc = ir.binaryOp('||', exprs[i], acc);
  }

  var tail;
  if (token.escape) {
    tail = [ir.filterCall('e', (typeof token.escape === 'string') ? [ir.literal('string', token.escape)] : undefined)];
  }
  return ir.output(acc, tail);
};
