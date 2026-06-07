/*!
 * Django `{% cycle %}` tag (anonymous form).
 *
 *   {% cycle "row1" "row2" %}      (alternates on each invocation)
 *   {% cycle a b c %}              (values may be expressions)
 *
 * Cycles through its values, emitting the next one on each invocation — so
 * inside a `{% for %}` loop it alternates per iteration. State is a
 * per-occurrence counter stored on `_ctx` under a unique key (the same
 * `Math.random()` scheme the for-loop uses for its loopcache), so it
 * persists across loop iterations within a render and resets on the next
 * render (fresh `_ctx`). Two distinct `{% cycle %}` tags never share state.
 *
 * Values are evaluated fresh on each invocation (Django re-evaluates), and
 * the emitted value is autoescaped per the enclosing region (`token.escape`).
 *
 * The named / reusable forms — `{% cycle a b as name %}`, `{% cycle name %}`,
 * and the `silent` modifier — are not yet supported (they need cross-tag
 * cycle-name tracking) and are rejected with a clear message.
 */

var ir = require('@rhinostone/swig-core/lib/ir');
var utils = require('@rhinostone/swig-core/lib/utils');
var backend = require('@rhinostone/swig-core/lib/backend');

var lexer = require('../lexer');

exports.ends = false;
exports.block = false;

/*!
 * True if a bare VAR token matching `word` appears anywhere in `tokens`.
 * @private
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
 * @param  {Array}  stack  Open-tag stack (unused — cycle has no body).
 * @param  {object} opts   Per-call options (honors `opts.filename`).
 * @param  {object} swig   Swig instance (unused).
 * @param  {object} token  In-progress TagToken. Gets `token.irArgs`.
 * @return {boolean}       Always `true` on success. Throws otherwise.
 */
exports.parse = function (str, line, parser, types, stack, opts, swig, token) {
  var tokens = lexer.read(utils.strip(str));
  if (!tokens.length) {
    utils.throwError('Expected at least one value in "cycle" tag', line, opts.filename);
  }
  if (hasKeyword(tokens, types, 'as')) {
    utils.throwError('Named cycles (the "as name" form of "cycle") are not yet supported', line, opts.filename);
  }
  if (hasKeyword(tokens, types, 'silent')) {
    utils.throwError('The "silent" modifier on "cycle" is not yet supported', line, opts.filename);
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
 * Emit the stateful cycle: build the value array, advance a per-occurrence
 * counter on `_ctx`, and append the current value (escaped per the region).
 *
 * @return {object} IRLegacyJS node.
 */
exports.compile = function (compiler, args, content, parents, options, blockName, token) {
  var parts = [];
  utils.each(token.irArgs, function (a) { parts.push(backend.emitExpr(a)); });

  var key = ('__cycle' + Math.random()).replace(/\./g, '');
  var value = '__cv[_ctx.' + key + ' % __cv.length]';
  var emit = token.escape ? '_filters["e"](' + value + ')' : '_utils.coerceOutput(' + value + ')';

  return ir.legacyJS(
    '(function () {\n' +
    '  var __cv = [' + parts.join(', ') + '];\n' +
    '  _ctx.' + key + ' = (_ctx.' + key + ' === undefined) ? 0 : (_ctx.' + key + ' + 1);\n' +
    '  _output += ' + emit + ';\n' +
    '})();\n'
  );
};
