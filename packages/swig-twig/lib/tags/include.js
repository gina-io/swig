/*!
 * Phase 3 Session 10 — Twig `{% include %}` tag.
 *
 * Twig include syntax:
 *
 *   {% include "partial.twig" %}
 *   {% include "partial.twig" with ctx %}
 *   {% include "partial.twig" with ctx only %}
 *   {% include "partial.twig" ignore missing %}
 *   {% include "partial.twig" with ctx only ignore missing %}
 *   {% include dynamicPath %}
 *
 * Path is lowered through `parser.parseExpr`, so STRING literals, VAR
 * references, member access, conditionals, and any other Twig
 * expression all route through the same path. The context expression
 * (after `with`) is likewise parsed via `parseExpr` — object literals,
 * function results, ternaries all work.
 *
 * Three Twig-only keywords are recognised via a depth-tracked scan over
 * the lexed token stream: `with`, `only`, `ignore missing`. Each is a
 * bare VAR token at top-level paren/bracket/curly depth — nested
 * occurrences inside expressions are left alone. `only` requires a
 * preceding `with`; `ignore` must be followed by `missing`.
 *
 * The tag emits an `IRInclude` node. The backend's `Include` branch
 * (packages/swig-core/lib/backend.js:310) owns the
 * `_swig.compileFile(...)` + `resolveFrom` plumbing and the optional
 * `try { ... } catch {}` wrapper that collapses missing-file errors to
 * the empty string when `ignoreMissing` is set.
 *
 * `resolveFrom` is the template's own filename (backslash-escaped so
 * Windows paths round-trip through the JSON-literal emit). The native
 * parser's splitter passes it in as a trailing arg; Twig's
 * tag-dispatch shape carries it via `opts.filename`.
 */

var ir = require('@rhinostone/swig-core/lib/ir');
var utils = require('@rhinostone/swig-core/lib/utils');

var lexer = require('../lexer');
var _t = require('../tokentypes');

exports.ends = false;
exports.block = false;

/**
 * Parse the `{% include %}` tag body. Extracts the path expression and
 * the optional `with <ctx>` / `only` / `ignore missing` keyword
 * markers, then lowers each expression slice through
 * `parser.parseExpr`. The resulting IR is attached to `token.irExpr`.
 *
 * @param  {string} str    Tag body.
 * @param  {number} line   Source line of the opening `{%`.
 * @param  {object} parser The Twig parser module (exposes `parseExpr`).
 * @param  {object} types  Twig lexer token-type enum.
 * @param  {Array}  stack  Open-tag stack (unused — include has no body).
 * @param  {object} opts   Per-call options (honors `opts.filename`).
 * @param  {object} swig   Swig instance (unused — backend owns load).
 * @param  {object} token  In-progress TagToken. `token.irExpr` gets
 *                         the IRInclude node.
 * @return {boolean}       Always `true` on success. Throws otherwise.
 */
exports.parse = function (str, line, parser, types, stack, opts, swig, token) {
  var tokens = lexer.read(utils.strip(str));

  var depth = 0;
  var withIdx = -1;
  var onlyIdx = -1;
  var ignoreIdx = -1;
  var missingIdx = -1;
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

    if (tk.match === 'with' && withIdx === -1 && missingIdx === -1) {
      withIdx = i;
    } else if (tk.match === 'only' && onlyIdx === -1) {
      if (withIdx === -1) {
        utils.throwError('"only" keyword in "include" tag requires a preceding "with"', line, opts.filename);
      }
      onlyIdx = i;
    } else if (tk.match === 'ignore' && ignoreIdx === -1) {
      ignoreIdx = i;
    } else if (tk.match === 'missing' && ignoreIdx !== -1 && missingIdx === -1) {
      missingIdx = i;
    }
  }

  if (ignoreIdx !== -1 && missingIdx === -1) {
    utils.throwError('"ignore" keyword in "include" tag must be followed by "missing"', line, opts.filename);
  }

  var pathEnd = tokens.length;
  if (withIdx !== -1 && withIdx < pathEnd) { pathEnd = withIdx; }
  if (ignoreIdx !== -1 && ignoreIdx < pathEnd) { pathEnd = ignoreIdx; }

  var pathTokens = sliceTrim(tokens, 0, pathEnd, types);
  if (!pathTokens.length) {
    utils.throwError('Expected template path in "include" tag', line, opts.filename);
  }
  var pathExpr = parser.parseExpr(pathTokens);

  var ctxExpr;
  if (withIdx !== -1) {
    var ctxEnd = tokens.length;
    if (onlyIdx !== -1 && onlyIdx > withIdx && onlyIdx < ctxEnd) { ctxEnd = onlyIdx; }
    if (ignoreIdx !== -1 && ignoreIdx > withIdx && ignoreIdx < ctxEnd) { ctxEnd = ignoreIdx; }
    var ctxTokens = sliceTrim(tokens, withIdx + 1, ctxEnd, types);
    if (!ctxTokens.length) {
      utils.throwError('Expected context expression after "with" in "include" tag', line, opts.filename);
    }
    ctxExpr = parser.parseExpr(ctxTokens);
  }

  var resolveFrom = (opts.filename || '').replace(/\\/g, '\\\\');

  token.irExpr = ir.include(
    pathExpr,
    ctxExpr,
    onlyIdx !== -1,
    ignoreIdx !== -1,
    resolveFrom
  );
  return true;
};

/**
 * Strip WHITESPACE tokens from both ends of a slice range, returning a
 * plain array. The rest of parser.parseExpr skips whitespace itself, so
 * interior whitespace is harmless — but leading/trailing whitespace can
 * produce a zero-length slice that parseExpr treats as "empty
 * expression" without the explicit empty-check here.
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
 * Return the pre-built IRInclude node for the backend's splice-through
 * path. The backend's `Include` branch owns all plumbing (path +
 * context emission, isolated-vs-merged selector, resolveFrom, optional
 * try/catch for ignoreMissing).
 *
 * @return {object} IRInclude node from `token.irExpr`.
 */
exports.compile = function (compiler, args, content, parents, options, blockName, token) {
  return token.irExpr;
};
