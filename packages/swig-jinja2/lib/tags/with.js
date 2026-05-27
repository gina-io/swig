/*!
 * Jinja2 `{% with %}` tag.
 *
 * Jinja2 scoped-context region with optional named assignments:
 *
 *   {% with %}…{% endwith %}                     (new scope, shallow copy of _ctx)
 *   {% with x = 1 %}…{% endwith %}               (x bound in the inner scope)
 *   {% with x = 1, y = total + 1 %}…{% endwith %}  (multiple assignments)
 *
 * Each assignment is `<name> = <expr>`; the value expression is lowered
 * through `parser.parseExpr`, so object literals, variable references,
 * conditionals, and function calls all route through the same path. The
 * assignments are collected into an object literal that the backend
 * merges over a shallow copy of the outer context — so an assignment's
 * value sees the enclosing scope (not its sibling assignments), and the
 * inner bindings do not leak past `{% endwith %}`.
 *
 * Unlike Twig's `{% with {ctx} only %}`, Jinja2 has no `only` keyword and
 * the region is never isolated — the outer context stays visible inside.
 *
 * Each assignment target is a bare identifier — dotted paths are rejected
 * at parse time, and CVE-2023-25345 prototype-chain names are rejected
 * before the binding lands (a quoted `"__proto__"` object key still sets
 * the prototype in JS).
 */

var ir = require('@rhinostone/swig-core/lib/ir');
var utils = require('@rhinostone/swig-core/lib/utils');
var _dangerousProps = require('@rhinostone/swig-core/lib/security').dangerousProps;

var lexer = require('../lexer');

exports.ends = true;
exports.block = false;

/**
 * Parse the `{% with %}` tag body. Collects zero or more
 * comma-separated `<name> = <expr>` assignments into an object literal on
 * `token.irExpr`. A bare `{% with %}` leaves `token.irExpr` undefined so
 * the backend emits a shallow copy of `_ctx`.
 *
 * @param  {string} str    Tag body.
 * @param  {number} line   Source line of the opening `{%`.
 * @param  {object} parser The Jinja2 parser module (exposes `parseExpr`).
 * @param  {object} types  Jinja2 lexer token-type enum.
 * @param  {Array}  stack  Open-tag stack (parser.js manages the push).
 * @param  {object} opts   Per-call options (honors `opts.filename`).
 * @param  {object} swig   Swig instance (unused).
 * @param  {object} token  In-progress TagToken.
 * @return {boolean}       Always `true` on success. Throws otherwise.
 */
exports.parse = function (str, line, parser, types, stack, opts, swig, token) {
  var tokens = lexer.read(utils.strip(str));
  var pos = 0;

  function peek() {
    while (pos < tokens.length && tokens[pos].type === types.WHITESPACE) { pos += 1; }
    return pos < tokens.length ? tokens[pos] : null;
  }
  function consume() {
    var t = peek();
    if (t) { pos += 1; }
    return t;
  }

  var props = [];

  // Bare `{% with %}` has no assignments — the leading peek() is null and
  // the loop is skipped, leaving token.irExpr undefined.
  if (peek()) {
    while (true) {
      var nameTok = consume();
      if (!nameTok || nameTok.type !== types.VAR) {
        utils.throwError('Expected variable name in "with" tag', line, opts.filename);
      }
      if (nameTok.match.indexOf('.') !== -1) {
        utils.throwError('"with" assignment target "' + nameTok.match + '" must be a bare identifier', line, opts.filename);
      }
      if (_dangerousProps.indexOf(nameTok.match) !== -1) {
        utils.throwError('Unsafe "with" assignment to "' + nameTok.match + '" is not allowed (CVE-2023-25345)', line, opts.filename);
      }

      var eqTok = consume();
      if (!eqTok || eqTok.type !== types.ASSIGNMENT || eqTok.match !== '=') {
        utils.throwError('Expected "=" after "' + nameTok.match + '" in "with" tag', line, opts.filename);
      }

      // Parse a single value expression from the cursor. parseExpr stops
      // at the next COMMA (which is not part of an expression); the
      // out-param reports how many slice tokens it consumed.
      var posOut = {};
      var valExpr = parser.parseExpr(tokens.slice(pos), {}, posOut);
      pos += posOut.pos;
      props.push(ir.objectProperty(ir.literal('string', nameTok.match), valExpr));

      var next = peek();
      if (!next) { break; }
      if (next.type !== types.COMMA) {
        utils.throwError('Expected "," between assignments in "with" tag', line, opts.filename);
      }
      consume();
    }
  }

  token.irExpr = props.length ? ir.objectLiteral(props) : undefined;
  return true;
};

/**
 * Emit an IRWith node carrying the optional context object literal (the
 * collected assignments) and the recursively-compiled body wrapped in
 * IRLegacyJS. The region is never isolated; the backend's `With` branch
 * merges the context over a shallow copy of `_ctx` for the body's lexical
 * scope.
 *
 * @return {object} IRWith node.
 */
exports.compile = function (compiler, args, content, parents, options, blockName, token) {
  var bodyJS = compiler(content, parents, options, blockName);
  return ir.withStmt(token.irExpr, false, [ir.legacyJS(bodyJS)]);
};
