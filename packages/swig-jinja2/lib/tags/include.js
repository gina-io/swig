/*!
 * Jinja2 `{% include %}` tag.
 *
 * Jinja2 include syntax:
 *
 *   {% include "partial.html" %}
 *   {% include "partial.html" with context %}      (the default)
 *   {% include "partial.html" without context %}
 *   {% include "partial.html" ignore missing %}
 *   {% include "partial.html" ignore missing without context %}
 *   {% include dynamicPath %}
 *
 * Path is lowered through `parser.parseExpr`, so STRING literals, VAR
 * references, member access, inline-ifs, and any other Jinja2 expression
 * all route through the same path.
 *
 * Three keyword markers are recognised via a depth-tracked scan over the
 * lexed token stream, each a two-token VAR sequence at top-level depth:
 * `with context`, `without context`, `ignore missing`. The default is
 * `with context` — the included template sees the caller's locals. Unlike
 * Twig, Jinja2's include has no explicit `with {dict}` context object;
 * `without context` is lowered to an empty-object context so the backend's
 * `Include` selector passes `{}` instead of `_ctx`.
 *
 * The tag emits an `IRInclude` node. The backend's `Include` branch owns
 * the `_swig.compileFile(...)` + `resolveFrom` plumbing and the optional
 * `try { ... } catch {}` wrapper that collapses missing-file errors to the
 * empty string when `ignoreMissing` is set.
 */

var ir = require('@rhinostone/swig-core/lib/ir');
var utils = require('@rhinostone/swig-core/lib/utils');

var lexer = require('../lexer');

exports.ends = false;
exports.block = false;

/**
 * Strip WHITESPACE tokens from both ends of a slice range.
 *
 * @param  {object[]} tokens Token stream.
 * @param  {number}   start  Inclusive start index.
 * @param  {number}   end    Exclusive end index.
 * @param  {object}   types  Lexer token-type enum.
 * @return {object[]}        Trimmed slice.
 * @private
 */
function sliceTrim(tokens, start, end, types) {
  while (start < end && tokens[start].type === types.WHITESPACE) { start += 1; }
  while (end > start && tokens[end - 1].type === types.WHITESPACE) { end -= 1; }
  return tokens.slice(start, end);
}

/**
 * Parse the `{% include %}` tag body — the path expression plus the
 * optional `with context` / `without context` / `ignore missing` markers.
 *
 * @param  {string} str    Tag body.
 * @param  {number} line   Source line of the opening `{%`.
 * @param  {object} parser The Jinja2 parser module (exposes `parseExpr`).
 * @param  {object} types  Jinja2 lexer token-type enum.
 * @param  {Array}  stack  Open-tag stack (unused — include has no body).
 * @param  {object} opts   Per-call options (honors `opts.filename`).
 * @param  {object} swig   Swig instance (unused — backend owns load).
 * @param  {object} token  In-progress TagToken. `token.irExpr` gets the
 *                         IRInclude node.
 * @return {boolean}       Always `true` on success. Throws otherwise.
 */
exports.parse = function (str, line, parser, types, stack, opts, swig, token) {
  var tokens = lexer.read(utils.strip(str));

  var depth = 0;
  var keywordIdx = -1;
  var withContext = false;
  var withoutContext = false;
  var ignoreMissing = false;
  var i, tk, nextVar;

  function nextVarAfter(idx) {
    var j = idx + 1;
    while (j < tokens.length && tokens[j].type === types.WHITESPACE) { j += 1; }
    return j < tokens.length ? tokens[j] : null;
  }
  function markKeyword(idx) {
    if (keywordIdx === -1) { keywordIdx = idx; }
  }

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
    if (depth !== 0 || tk.type !== types.VAR) { continue; }

    if ((tk.match === 'with' || tk.match === 'without') && !withContext && !withoutContext) {
      nextVar = nextVarAfter(i);
      if (nextVar && nextVar.type === types.VAR && nextVar.match === 'context') {
        if (tk.match === 'with') { withContext = true; } else { withoutContext = true; }
        markKeyword(i);
      }
    } else if (tk.match === 'ignore' && !ignoreMissing) {
      nextVar = nextVarAfter(i);
      if (nextVar && nextVar.type === types.VAR && nextVar.match === 'missing') {
        ignoreMissing = true;
        markKeyword(i);
      }
    }
  }

  var pathEnd = keywordIdx === -1 ? tokens.length : keywordIdx;
  var pathTokens = sliceTrim(tokens, 0, pathEnd, types);
  if (!pathTokens.length) {
    utils.throwError('Expected template path in "include" tag', line, opts.filename);
  }
  var pathExpr = parser.parseExpr(pathTokens);

  var resolveFrom = (opts.filename || '').replace(/\\/g, '\\\\');

  // `without context` -> empty-object context + isolated, so the backend's
  // Include selector emits `{}` rather than `_ctx`. `with context` (and the
  // default) leave context undefined + isolated false -> the selector emits
  // `_ctx`. `withContext` is tracked only to mark the path end.
  var ctxExpr;
  if (withoutContext) {
    ctxExpr = ir.objectLiteral([]);
  }

  token.irExpr = ir.include(pathExpr, ctxExpr, withoutContext, ignoreMissing, resolveFrom);
  return true;
};

/**
 * Return the pre-built IRInclude node. In async codegen mode, derive an
 * IRIncludeDeferred from the same fields so the backend routes through the
 * `_swig.getTemplate` + `await` path instead of the sync `_swig.compileFile`
 * call.
 *
 * @return {object} IRInclude or IRIncludeDeferred node.
 */
exports.compile = function (compiler, args, content, parents, options, blockName, token) {
  if (options && options.codegenMode === 'async') {
    var i = token.irExpr;
    return ir.includeDeferred(i.path, i.context, i.isolated, i.ignoreMissing, i.resolveFrom);
  }
  return token.irExpr;
};
