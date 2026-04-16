/*!
 * Phase 3 Session 12 — Twig `{% with %}` tag.
 *
 * Twig scoped-context region:
 *
 *   {% with %}…{% endwith %}                    (shallow copy of _ctx)
 *   {% with <ctx> %}…{% endwith %}              (merge ctx into _ctx)
 *   {% with <ctx> only %}…{% endwith %}         (isolated, ctx is context)
 *   {% with only %}…{% endwith %}               (isolated, empty context)
 *
 * The context expression (when present) is lowered through
 * `parser.parseExpr`, so object literals, variable references,
 * conditionals, function calls — any Twig expression — all route
 * through the same path.
 *
 * The `only` keyword is recognised as a bare VAR token at top-level
 * paren/bracket/curly/function depth. Depth tracking prevents a nested
 * `only` inside the context expression (unlikely but possible) from
 * being mistaken for the keyword.
 *
 * The tag emits an `IRWith` node. The backend's `With` branch
 * (packages/swig-core/lib/backend.js) owns the IIFE scaffolding that
 * shadows `_ctx` for the body's lexical scope while letting `_output`
 * stay in the outer scope via closure capture.
 */

var ir = require('@rhinostone/swig-core/lib/ir');
var utils = require('@rhinostone/swig-core/lib/utils');

var lexer = require('../lexer');
var _t = require('../tokentypes');

exports.ends = true;
exports.block = false;

/**
 * Parse the `{% with %}` tag body. Extracts the optional context
 * expression and the optional `only` keyword marker, lowers the
 * context slice through `parser.parseExpr`, and stashes the result on
 * `token.irExpr` along with the `isolated` flag on `token.args`.
 *
 * @param  {string} str    Tag body.
 * @param  {number} line   Source line of the opening `{%`.
 * @param  {object} parser The Twig parser module (exposes `parseExpr`).
 * @param  {object} types  Twig lexer token-type enum.
 * @param  {Array}  stack  Open-tag stack (parser.js manages the push).
 * @param  {object} opts   Per-call options (honors `opts.filename`).
 * @param  {object} swig   Swig instance (unused).
 * @param  {object} token  In-progress TagToken.
 * @return {boolean}       Always `true` on success. Throws otherwise.
 */
exports.parse = function (str, line, parser, types, stack, opts, swig, token) {
  var tokens = lexer.read(utils.strip(str));

  var depth = 0;
  var onlyIdx = -1;
  var i, tk;

  for (i = 0; i < tokens.length; i += 1) {
    tk = tokens[i];
    if (tk.type === types.PARENOPEN || tk.type === types.BRACKETOPEN ||
        tk.type === types.CURLYOPEN || tk.type === types.FUNCTION) {
      depth += 1;
      continue;
    }
    if (tk.type === types.PARENCLOSE || tk.type === types.BRACKETCLOSE ||
        tk.type === types.CURLYCLOSE) {
      depth -= 1;
      continue;
    }
    if (depth !== 0) { continue; }
    if (tk.type !== types.VAR) { continue; }

    if (tk.match === 'only' && onlyIdx === -1) {
      onlyIdx = i;
    }
  }

  var ctxEnd = (onlyIdx !== -1) ? onlyIdx : tokens.length;
  var ctxTokens = sliceTrim(tokens, 0, ctxEnd, types);

  var ctxExpr;
  if (ctxTokens.length) {
    ctxExpr = parser.parseExpr(ctxTokens);
  }

  // Trailing tokens after `only` are not allowed — `{% with ctx only extra %}`
  // is ambiguous (is `extra` a second context slot? a stray keyword?).
  if (onlyIdx !== -1) {
    var tail = sliceTrim(tokens, onlyIdx + 1, tokens.length, types);
    if (tail.length) {
      utils.throwError('Unexpected tokens after "only" in "with" tag', line, opts.filename);
    }
  }

  token.args = [!!(onlyIdx !== -1)];
  token.irExpr = ctxExpr;
  return true;
};

/**
 * Strip WHITESPACE tokens from both ends of a slice range, returning a
 * plain array. Parser.parseExpr skips whitespace in the interior, but
 * leading/trailing whitespace produces a zero-length effective slice
 * that parseExpr cannot classify; the explicit trim keeps the empty-
 * context detection (`ctxTokens.length === 0`) honest.
 *
 * @param  {object[]} tokens Token stream.
 * @param  {number}   start  Inclusive start index.
 * @param  {number}   end    Exclusive end index.
 * @param  {object}   types  Twig lexer token-type enum.
 * @return {object[]}        Trimmed slice.
 * @private
 */
function sliceTrim(tokens, start, end, types) {
  while (start < end && tokens[start].type === types.WHITESPACE) { start += 1; }
  while (end > start && tokens[end - 1].type === types.WHITESPACE) { end -= 1; }
  return tokens.slice(start, end);
}

/**
 * Emit an IRWith node carrying the optional context IRExpr, the
 * `isolated` flag, and the recursively-compiled body wrapped in
 * IRLegacyJS. The backend's `With` branch owns the IIFE-shadow of
 * `_ctx` for the body's lexical scope.
 *
 * @return {object} IRWith node.
 */
exports.compile = function (compiler, args, content, parents, options, blockName, token) {
  var isolated = !!args[0];
  var bodyJS = compiler(content, parents, options, blockName);
  return ir.withStmt(token.irExpr, isolated, [ir.legacyJS(bodyJS)]);
};
