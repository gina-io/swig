/*!
 * Django `{% for %}` tag.
 *
 *   {% for <val> in <iterable> %}…{% endfor %}
 *   {% for <key>, <val> in <iterable> %}…{% endfor %}
 *   {% for <val> in <iterable> %}…{% empty %}…{% endfor %}
 *
 * Surfaces Django's `forloop` context object — `forloop.counter` /
 * `counter0` / `revcounter` / `revcounter0` / `first` / `last` /
 * `parentloop` — by setting the opt-in `loopName` / `loopFields` /
 * `loopParent` flags on the IRFor node. The swig-core backend owns the
 * loopcache + `_utils.each` scaffolding (the same IIFE every flavor's `for`
 * loop compiles to); the flags only rename the emitted loop var + counter
 * fields and expose the enclosing loop, so nested-loop safety and the
 * for-empty handling come for free.
 *
 * Binding follows Django through the opt-in `mapKeys` and `unpack` flags: one
 * name over a dict binds each key, and two names over a list unpack each item
 * into its first and second values (a list's items, a string's characters, a
 * mapping's keys). An item that does not hold two values binds what it holds,
 * a missing value rendering empty, where Django raises. Two names over a
 * mapping bind the key and the value, a swig extension (Django iterates the
 * keys and unpacks each one) that a two-name `.items` loop relies on.
 *
 * Loop variable names must be bare identifiers — dotted paths are rejected
 * at parse time, and the CVE-2023-25345 `_dangerousProps` guard runs on
 * every bound name (key and val).
 *
 * Django's empty-iterable branch is `{% empty %}` (NOT `{% else %}`, which
 * is `if`-only here); it lexes as its own marker token (tags/empty.js) and
 * compile splits the content at it into the loop body and the empty body.
 *
 * Django's dict-iteration pseudo-methods are supported on the iterable —
 * `{% for k in d.keys %}`, `{% for v in d.values %}`, the canonical
 * `{% for key, value in d.items %}`, and the one-name
 * `{% for pair in d.items %}`, which binds each [key, value] pair. As in
 * Django, a mapping's own key of that name is read first (see
 * rewriteDictIterable).
 *
 * The `reversed` modifier (`{% for x in items reversed %}`) is not yet
 * supported; it is detected and rejected with a clear message rather than
 * the cryptic `Unexpected token "reversed"` that parseExpr's
 * full-consumption check would otherwise raise.
 */

var ir = require('@rhinostone/swig-core/lib/ir');
var utils = require('@rhinostone/swig-core/lib/utils');
var _dangerousProps = require('@rhinostone/swig-core/lib/security').dangerousProps;

var lexer = require('../lexer');

/*!
 * Django `forloop` ↔ swig `loop` counter-field map. `first` / `last` are
 * identical in both, so only the four counters are renamed; `parentloop`
 * is surfaced separately via the `loopParent` flag. @private
 */
var DJANGO_LOOP_FIELDS = {
  index: 'counter',
  index0: 'counter0',
  revindex: 'revcounter',
  revindex0: 'revcounter0'
};

/*!
 * Django dict-iteration pseudo-methods recognized on a `for` iterable.
 * @private
 */
var DICT_PSEUDO_METHODS = { keys: true, values: true, items: true };

/*!
 * Build a resolve-flagged VarRef for an object path (the iterable with its
 * trailing pseudo-method segment removed) so the object itself is resolved
 * Django-style by the swig-core variable resolver. @private
 */
function resolveVar(path) {
  var n = ir.varRef(path);
  n.resolve = true;
  return n;
}

/*!
 * Rewrite a `for` iterable that ends in a Django dict-iteration
 * pseudo-method (`.keys` / `.values` / `.items`), so the loop walks the
 * mapping the way Django does. With the variable resolver in place a trailing
 * `.keys` / `.values` / `.items` would otherwise resolve to a (usually
 * missing) object property, yielding an empty loop.
 *
 * The iterable becomes the mapping (the path without its last segment), and
 * `token.dictIter` records the name, which compile sets on the IRFor node.
 * At render the backend passes the mapping to `_utils.dictIter`, which reads
 * the mapping's own key of that name first, as Django's dictionary lookup
 * does (so `{% for item in page.data.items %}` iterates the list stored under
 * `items`), and otherwise applies the method:
 *
 *   - `.keys`   → the keys (a one-name `for` binds each key).
 *   - `.values` → the values (a one-name `for` binds each value).
 *   - `.items`  → the mapping itself, so two names bind key + value per entry
 *                 exactly as Django's `{% for k, v in d.items %}`; with one
 *                 name (`pairs`), each [key, value] pair, Django's
 *                 (key, value) tuple, and nothing for a value that is not a
 *                 mapping.
 *
 * Anything that is not a resolved user-variable path of length >= 2 ending in
 * one of the three names is returned unchanged.
 *
 * @param  {object}  it          Parsed iterable IRExpr.
 * @param  {boolean} hasTwoNames Whether the loop declared `key, val`.
 * @param  {object}  token       In-progress TagToken; gets `dictIter`.
 * @return {object}              The (possibly rewritten) iterable IRExpr.
 * @private
 */
function rewriteDictIterable(it, hasTwoNames, token) {
  if (!it || it.type !== 'VarRef' || !it.resolve || it.path.length < 2) {
    return it;
  }
  var lastSeg = it.path[it.path.length - 1];
  if (!DICT_PSEUDO_METHODS.hasOwnProperty(lastSeg)) {
    return it;
  }
  token.dictIter = { name: lastSeg };
  if (lastSeg === 'items' && !hasTwoNames) {
    token.dictIter.pairs = true;
  }
  return resolveVar(it.path.slice(0, -1));
}

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
 * @param  {object} parser The Django parser module (exposes `parseExpr`).
 * @param  {object} types  Django lexer token-type enum.
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

  // `{% for x in items reversed %}` — trailing `reversed` modifier (a real
  // Django feature, not yet supported). Detect a trailing bare `reversed`
  // VAR with an iterable before it and reject clearly. A lone `reversed`
  // (`{% for x in reversed %}`) is a legitimate variable name and is left
  // to parseExpr.
  var lastTok = iterableTokens[iterableTokens.length - 1];
  if (iterableTokens.length > 1 && lastTok.type === types.VAR && lastTok.match === 'reversed') {
    utils.throwError('The "reversed" modifier in the "for" tag is not yet supported', line, opts.filename);
  }

  token.args = key !== undefined ? [key, val] : [val];
  token.irExpr = rewriteDictIterable(parser.parseExpr(iterableTokens), key !== undefined, token);
  return true;
};

/**
 * Emit an IRFor node, splitting `content` at an `{% empty %}` marker into
 * the loop body and the empty body, and setting the Django `forloop` and
 * binding opt-in flags. The backend's `For` branch owns the loopcache +
 * `_utils.each` scaffolding.
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
    if (child && child.name === 'empty') {
      if (emptyContent !== null) {
        utils.throwError('Multiple "empty" branches in "for" tag', null, filename);
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
  // Opt-in loop-context flags → Django `forloop` (see ir.js IRFor typedef +
  // the backend `For` emit). Absent on every other flavor, so their emit
  // stays byte-identical.
  node.loopName = 'forloop';
  node.loopFields = DJANGO_LOOP_FIELDS;
  node.loopParent = true;
  // Django binding (see the IRFor typedef): two names unpack each item of a
  // list, one name binds each key of a dict.
  if (args.length === 2) {
    node.unpack = true;
  } else {
    node.mapKeys = true;
  }
  // A dict pseudo-method on the iterable (see rewriteDictIterable).
  if (token.dictIter) {
    node.dictIter = token.dictIter;
  }
  return node;
};
