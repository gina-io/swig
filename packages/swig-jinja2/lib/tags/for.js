/*!
 * Jinja2 `{% for %}` tag.
 *
 *   {% for <val> in <iterable> %}…{% endfor %}
 *   {% for <key>, <val> in <iterable> %}…{% endfor %}
 *   {% for <val> in <iterable> %}…{% else %}…{% endfor %}   (empty case)
 *
 * Binding follows Jinja2: one name over a mapping binds each key, and two
 * names over a list unpack each item into its first and second values (a
 * list's items, a string's characters, a mapping's keys), so
 * `{% for k, v in d|dictsort %}` binds the key and the value. An item that
 * does not hold two values binds what it holds, a missing value rendering
 * empty, where Jinja2 raises. Two names over a mapping bind the key and the
 * value, a swig extension (Jinja2 iterates the keys and unpacks each one).
 *
 * Loop variable names must be bare identifiers — dotted paths (`foo.bar`)
 * are rejected at parse time. The CVE-2023-25345 `_dangerousProps` guard
 * runs on every bound name (key and val).
 *
 * The iterable is lowered through `parser.parseExpr`, so filter chains,
 * binary ops, function calls, and inline-ifs all route through the same
 * path as any other Jinja2 expression. The resulting IRExpr is attached
 * to `token.irExpr`.
 *
 * The backend's `For` branch owns the full IIFE scaffolding: `_utils.each`,
 * the `_ctx.loop.*` bookkeeping (first / last / index / index0 / revindex /
 * revindex0 / length / key), the `Math.random()`-based loopcache that keeps
 * nested loops from clobbering each other's `_ctx.loop` state, and the
 * `emptyBody` (for-else) emission. The tag ships only semantic IR —
 * (val, key, iterable, body, emptyBody) and the `mapKeys` / `unpack`
 * binding flags.
 *
 * A `{% else %}` inside the for body is captured as a marker token (its
 * stack check in tags/else.js allows `for`); compile splits the content at
 * it into the loop body and the empty body.
 */

var ir = require('@rhinostone/swig-core/lib/ir');
var utils = require('@rhinostone/swig-core/lib/utils');
var _dangerousProps = require('@rhinostone/swig-core/lib/security').dangerousProps;

var lexer = require('../lexer');

exports.ends = true;
exports.block = false;

/**
 * Parse the `{% for %}` tag body. Extracts the binding names (val or
 * key+val), validates them, then lowers the iterable expression. Names go
 * on `token.args` (`[val]` or `[key, val]`); the iterable IR on
 * `token.irExpr`.
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

  function takeName() {
    var tok = consume();
    if (!tok || tok.type !== types.VAR) {
      utils.throwError('Expected loop variable in "for" tag', line, opts.filename);
    }
    if (tok.match.indexOf('.') !== -1) {
      utils.throwError('Loop variable "' + tok.match + '" must be a bare identifier in "for" tag', line, opts.filename);
    }
    if (_dangerousProps.indexOf(tok.match) !== -1) {
      utils.throwError('Unsafe loop variable "' + tok.match + '" is not allowed (prototype-chain guard)', line, opts.filename);
    }
    return tok.match;
  }

  var first = takeName();
  var val = first;
  var key;

  if (peek() && peek().type === types.COMMA) {
    consume();
    key = first;
    val = takeName();
  }

  // The lexer's COMPARATOR rule requires a trailing `\s` on `in`, so
  // `{% for x in %}` (nothing after `in`) lexes `in` as a VAR. Match on the
  // literal string so the error stays "Expected iterable" for that shape.
  var inTok = consume();
  if (!inTok || inTok.match !== 'in' || (inTok.type !== types.COMPARATOR && inTok.type !== types.VAR)) {
    utils.throwError('Expected "in" in "for" tag', line, opts.filename);
  }

  while (pos < tokens.length && tokens[pos].type === types.WHITESPACE) { pos += 1; }

  var iterableTokens = tokens.slice(pos);
  if (!iterableTokens.length) {
    utils.throwError('Expected iterable after "in" in "for" tag', line, opts.filename);
  }

  token.args = key !== undefined ? [key, val] : [val];
  token.irExpr = parser.parseExpr(iterableTokens);
  return true;
};

/**
 * Emit an IRFor node, splitting `content` at a `{% else %}` marker into the
 * loop body and the empty body, and setting the Jinja2 binding flags. The
 * backend's `For` branch owns the loopcache + `_utils.each` scaffolding.
 *
 * @return {object} IRFor node.
 */
exports.compile = function (compiler, args, content, parents, options, blockName, token) {
  var val, key;
  if (args.length === 2) {
    key = args[0];
    val = args[1];
  } else {
    val = args[0];
    key = '__k';
  }

  var loopContent = [],
    emptyContent = null,
    filename = options && options.filename;

  utils.each(content, function (child) {
    if (child && child.name === 'else') {
      if (emptyContent !== null) {
        utils.throwError('Multiple "else" branches in "for" tag', null, filename);
      }
      emptyContent = [];
      return;
    }
    if (emptyContent !== null) {
      emptyContent.push(child);
    } else {
      loopContent.push(child);
    }
  });

  var bodyJS = compiler(loopContent, parents, options, blockName);
  var emptyBody;
  if (emptyContent !== null) {
    emptyBody = [ir.legacyJS(compiler(emptyContent, parents, options, blockName))];
  }
  var node = ir.forStmt(val, token.irExpr, [ir.legacyJS(bodyJS)], key, emptyBody);
  // Jinja2 binding (see the IRFor typedef): two names unpack each item of a
  // list, one name binds each key of a mapping.
  if (args.length === 2) {
    node.unpack = true;
  } else {
    node.mapKeys = true;
  }
  return node;
};
