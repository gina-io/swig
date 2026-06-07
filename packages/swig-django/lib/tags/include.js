/*!
 * Django `{% include %}` tag.
 *
 * Django include syntax:
 *
 *   {% include "partial.html" %}                       (full caller context)
 *   {% include "partial.html" with foo=1 bar=baz %}    (context + extra vars)
 *   {% include "partial.html" with foo=1 only %}        (ONLY the extra vars)
 *   {% include "partial.html" only %}                   (empty isolated context)
 *   {% include dynamicPath %}
 *
 * Path is lowered through `parser.parseExpr`, so STRING literals, VAR
 * references, member access, and any other Django expression all route
 * through the same path.
 *
 * The `with` clause is space-separated `name=value` assignments (Django's
 * shape, NOT Twig's single `{dict}` expression) — each value is lowered
 * through `parser.parseExpr` and collected into an object literal. The
 * trailing `only` keyword isolates the included template to just that
 * object (the backend's `Include` selector emits the object instead of
 * `_ctx`); without `only`, the object is merged over the caller's context.
 * `only` may also appear without a `with`, giving an empty isolated context.
 *
 * Django has no `ignore missing` modifier (a missing template raises), so
 * the IRInclude's `ignoreMissing` flag is always false here.
 *
 * Emits an `IRInclude` node. The backend's `Include` branch owns the
 * `_swig.compileFile(...)` + `resolveFrom` plumbing and the
 * isolated-vs-merged context selector.
 */

var ir = require('@rhinostone/swig-core/lib/ir');
var utils = require('@rhinostone/swig-core/lib/utils');
var _dangerousProps = require('@rhinostone/swig-core/lib/security').dangerousProps;

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
 * Find the first depth-0 VAR token whose match equals `word`. Depth tracks
 * paren / bracket / curly / function nesting so a keyword inside the path
 * expression is left alone.
 *
 * @return {number} Token index, or -1 if not found.
 * @private
 */
function findKeyword(tokens, types, word) {
  var depth = 0, i, tk;
  for (i = 0; i < tokens.length; i += 1) {
    tk = tokens[i];
    if (tk.type === types.PARENOPEN || tk.type === types.BRACKETOPEN ||
        tk.type === types.CURLYOPEN || tk.type === types.FUNCTION) { depth += 1; continue; }
    if (tk.type === types.PARENCLOSE || tk.type === types.BRACKETCLOSE ||
        tk.type === types.CURLYCLOSE) { depth -= 1; continue; }
    if (depth !== 0 || tk.type !== types.VAR) { continue; }
    if (tk.match === word) { return i; }
  }
  return -1;
}

/**
 * Parse space-separated `name = value` pairs from a token slice. Each value
 * is one expression (parseExpr stops at the next bare name, since
 * `<value> <name>` has no operator between them). Stops when the next token
 * is not a `name =` start, returning the unconsumed remainder as `leftover`
 * (e.g. a trailing `only` keyword). Django parses the kwargs greedily first,
 * so `with x=only` binds x to the variable `only` while `with x=1 only`
 * leaves a trailing `only`.
 *
 * @return {{props: object[], leftover: object[]}}
 * @private
 */
function parsePairs(clause, parser, types, line, opts) {
  var props = [];
  var pos = 0;
  function skipWS() { while (pos < clause.length && clause[pos].type === types.WHITESPACE) { pos += 1; } }

  while (true) {
    skipWS();
    if (pos >= clause.length) { break; }
    var nameTok = clause[pos];
    if (nameTok.type !== types.VAR) { break; }
    var j = pos + 1;
    while (j < clause.length && clause[j].type === types.WHITESPACE) { j += 1; }
    if (!(j < clause.length && clause[j].type === types.ASSIGNMENT && clause[j].match === '=')) {
      break;
    }
    if (nameTok.match.indexOf('.') !== -1) {
      utils.throwError('"with" assignment target "' + nameTok.match + '" must be a bare identifier in "include" tag', line, opts.filename);
    }
    if (_dangerousProps.indexOf(nameTok.match) !== -1) {
      utils.throwError('Unsafe "with" assignment to "' + nameTok.match + '" is not allowed (CVE-2023-25345)', line, opts.filename);
    }
    pos = j + 1;
    skipWS();
    var posOut = {};
    var valExpr = parser.parseExpr(clause.slice(pos), {}, posOut);
    pos += posOut.pos;
    props.push(ir.objectProperty(ir.literal('string', nameTok.match), valExpr));
  }

  skipWS();
  return { props: props, leftover: clause.slice(pos) };
}

/**
 * Parse the `{% include %}` tag body — the path expression plus the optional
 * `with name=value …` assignments and trailing `only` keyword.
 *
 * @param  {string} str    Tag body.
 * @param  {number} line   Source line of the opening `{%`.
 * @param  {object} parser The Django parser module (exposes `parseExpr`).
 * @param  {object} types  Django lexer token-type enum.
 * @param  {Array}  stack  Open-tag stack (unused — include has no body).
 * @param  {object} opts   Per-call options (honors `opts.filename`).
 * @param  {object} swig   Swig instance (unused — backend owns load).
 * @param  {object} token  In-progress TagToken. `token.irExpr` gets the
 *                         IRInclude node.
 * @return {boolean}       Always `true` on success. Throws otherwise.
 */
exports.parse = function (str, line, parser, types, stack, opts, swig, token) {
  var tokens = lexer.read(utils.strip(str));

  var isolated = false;
  var ctxExpr;
  var pathTokens;

  var withIdx = findKeyword(tokens, types, 'with');

  if (withIdx !== -1) {
    pathTokens = sliceTrim(tokens, 0, withIdx, types);
    var clause = sliceTrim(tokens, withIdx + 1, tokens.length, types);
    var parsed = parsePairs(clause, parser, types, line, opts);
    if (!parsed.props.length) {
      utils.throwError('Expected at least one "name=value" assignment after "with" in "include" tag', line, opts.filename);
    }
    if (parsed.leftover.length === 1 && parsed.leftover[0].type === types.VAR && parsed.leftover[0].match === 'only') {
      isolated = true;
    } else if (parsed.leftover.length) {
      utils.throwError('Unexpected token "' + parsed.leftover[0].match + '" after "with" assignments in "include" tag', line, opts.filename);
    }
    ctxExpr = ir.objectLiteral(parsed.props);
  } else {
    // No `with`. A trailing bare `only` (with a path before it) isolates the
    // included template to an empty context. `{% include only %}` with no
    // path before it is a path named `only`, not the keyword.
    var trimmed = sliceTrim(tokens, 0, tokens.length, types);
    var lastTok = trimmed.length ? trimmed[trimmed.length - 1] : null;
    if (trimmed.length >= 2 && lastTok.type === types.VAR && lastTok.match === 'only') {
      isolated = true;
      ctxExpr = ir.objectLiteral([]);
      pathTokens = trimmed.slice(0, trimmed.length - 1);
    } else {
      pathTokens = trimmed;
    }
  }

  if (!pathTokens.length) {
    utils.throwError('Expected template path in "include" tag', line, opts.filename);
  }
  var pathExpr = parser.parseExpr(pathTokens);

  var resolveFrom = (opts.filename || '').replace(/\\/g, '\\\\');
  token.irExpr = ir.include(pathExpr, ctxExpr, isolated, false, resolveFrom);
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
