/*!
 * Django `{% with %}` tag.
 *
 *   {% with a=1 b=total %}…{% endwith %}      (modern — space-separated pairs)
 *   {% with business.total as t %}…{% endwith %}  (legacy single-binding form)
 *
 * Binds one or more names in a new inner scope for the body. Each value is
 * lowered through `parser.parseExpr` and collected into an object literal
 * that the backend's `With` branch merges over a shallow copy of the outer
 * context — so an assignment's value sees the enclosing scope (not its
 * sibling assignments), and the inner bindings do not leak past
 * `{% endwith %}`. The region is never isolated (Django has no `only` here).
 *
 * The modern form uses space-separated `name=value` pairs (Django's shape,
 * NOT Jinja2's comma-separated list). The legacy form is a single
 * `<expr> as <name>`. Each assignment target is a bare identifier — dotted
 * paths and CVE-2023-25345 prototype-chain names are rejected before the
 * binding lands.
 */

var ir = require('@rhinostone/swig-core/lib/ir');
var utils = require('@rhinostone/swig-core/lib/utils');
var _dangerousProps = require('@rhinostone/swig-core/lib/security').dangerousProps;

var lexer = require('../lexer');

/*!
 * Strip WHITESPACE tokens from both ends of a slice range. @private
 */
function sliceTrim(tokens, start, end, types) {
  while (start < end && tokens[start].type === types.WHITESPACE) { start += 1; }
  while (end > start && tokens[end - 1].type === types.WHITESPACE) { end -= 1; }
  return tokens.slice(start, end);
}

/*!
 * Find the first depth-0 VAR token whose match equals `word`. @private
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

/*!
 * Validate an assignment target name (bare identifier, not a dangerous
 * prototype-chain property). @private
 */
function guardName(name, line, opts) {
  if (name.indexOf('.') !== -1) {
    utils.throwError('"with" assignment target "' + name + '" must be a bare identifier', line, opts.filename);
  }
  if (_dangerousProps.indexOf(name) !== -1) {
    utils.throwError('Unsafe "with" assignment to "' + name + '" is not allowed (CVE-2023-25345)', line, opts.filename);
  }
}

/*!
 * Parse space-separated `name = value` pairs from a token slice into IR
 * object properties. Mirrors the include tag's k=v parsing: each value is
 * one expression (parseExpr stops at the next bare name). @private
 */
function parsePairs(tokens, parser, types, line, opts) {
  var props = [];
  var pos = 0;
  function skipWS() { while (pos < tokens.length && tokens[pos].type === types.WHITESPACE) { pos += 1; } }

  while (true) {
    skipWS();
    if (pos >= tokens.length) { break; }
    var nameTok = tokens[pos];
    if (nameTok.type !== types.VAR) {
      utils.throwError('Expected an assignment name in "with" tag', line, opts.filename);
    }
    var j = pos + 1;
    while (j < tokens.length && tokens[j].type === types.WHITESPACE) { j += 1; }
    if (!(j < tokens.length && tokens[j].type === types.ASSIGNMENT && tokens[j].match === '=')) {
      utils.throwError('Expected "=" after "' + nameTok.match + '" in "with" tag', line, opts.filename);
    }
    guardName(nameTok.match, line, opts);
    pos = j + 1;
    skipWS();
    var posOut = {};
    var valExpr = parser.parseExpr(tokens.slice(pos), {}, posOut);
    pos += posOut.pos;
    props.push(ir.objectProperty(ir.literal('string', nameTok.match), valExpr));
  }
  return props;
}

exports.ends = true;
exports.block = false;

/**
 * Parse the `{% with %}` tag body into an object literal on `token.irExpr`.
 * Supports both the modern space-separated `name=value` form and the legacy
 * `<expr> as <name>` form.
 *
 * @param  {string} str    Tag body.
 * @param  {number} line   Source line of the opening `{%`.
 * @param  {object} parser The Django parser module (exposes `parseExpr`).
 * @param  {object} types  Django lexer token-type enum.
 * @param  {Array}  stack  Open-tag stack (parser.js manages the push).
 * @param  {object} opts   Per-call options (honors `opts.filename`).
 * @param  {object} swig   Swig instance (unused).
 * @param  {object} token  In-progress TagToken. Gets `token.irExpr`.
 * @return {boolean}       Always `true` on success. Throws otherwise.
 */
exports.parse = function (str, line, parser, types, stack, opts, swig, token) {
  var tokens = lexer.read(utils.strip(str));
  if (!tokens.length) {
    utils.throwError('Expected at least one assignment in "with" tag', line, opts.filename);
  }

  var props;
  var asIdx = findKeyword(tokens, types, 'as');

  if (asIdx !== -1) {
    // Legacy `<expr> as <name>` form.
    var exprTokens = sliceTrim(tokens, 0, asIdx, types);
    var nameTokens = sliceTrim(tokens, asIdx + 1, tokens.length, types);
    if (!exprTokens.length) {
      utils.throwError('Expected an expression before "as" in "with" tag', line, opts.filename);
    }
    if (nameTokens.length !== 1 || nameTokens[0].type !== types.VAR) {
      utils.throwError('Expected a single variable name after "as" in "with" tag', line, opts.filename);
    }
    guardName(nameTokens[0].match, line, opts);
    props = [ir.objectProperty(ir.literal('string', nameTokens[0].match), parser.parseExpr(exprTokens))];
  } else {
    props = parsePairs(tokens, parser, types, line, opts);
  }

  token.irExpr = ir.objectLiteral(props);
  return true;
};

/**
 * Emit an IRWith node carrying the assignment object literal and the
 * recursively-compiled body wrapped in IRLegacyJS. The region is never
 * isolated; the backend's `With` branch merges the context over a shallow
 * copy of `_ctx` for the body's lexical scope.
 *
 * @return {object} IRWith node.
 */
exports.compile = function (compiler, args, content, parents, options, blockName, token) {
  var bodyJS = compiler(content, parents, options, blockName);
  return ir.withStmt(token.irExpr, false, [ir.legacyJS(bodyJS)]);
};
