var ir = require('@rhinostone/swig-core/lib/ir'),
  _t = require('@rhinostone/swig-core/lib/tokentypes');

// CVE-2023-25345: prototype-chain properties that must not be used as loop
// variable names. The for tag assigns loop variables to _ctx, so dangerous
// names would pollute the prototype chain.
var _dangerousProps = require('@rhinostone/swig-core/lib/security').dangerousProps;

/**
 * Loop over objects and arrays.
 *
 * @alias for
 *
 * @example
 * // obj = { one: 'hi', two: 'bye' };
 * {% for x in obj %}
 *   {% if loop.first %}<ul>{% endif %}
 *   <li>{{ loop.index }} - {{ loop.key }}: {{ x }}</li>
 *   {% if loop.last %}</ul>{% endif %}
 * {% endfor %}
 * // => <ul>
 * //    <li>1 - one: hi</li>
 * //    <li>2 - two: bye</li>
 * //    </ul>
 *
 * @example
 * // arr = [1, 2, 3]
 * // Reverse the array, shortcut the key/index to `key`
 * {% for key, val in arr|reverse %}
 * {{ key }} -- {{ val }}
 * {% endfor %}
 * // => 0 -- 3
 * //    1 -- 2
 * //    2 -- 1
 *
 * @param {literal} [key]     A shortcut to the index of the array or current key accessor.
 * @param {literal} variable  The current value will be assigned to this variable name temporarily. The variable will be reset upon ending the for tag.
 * @param {literal} in        Literally, "in". This token is required.
 * @param {object}  object    An enumerable object that will be iterated over.
 *
 * @return {loop.index} The current iteration of the loop (1-indexed)
 * @return {loop.index0} The current iteration of the loop (0-indexed)
 * @return {loop.revindex} The number of iterations from the end of the loop (1-indexed)
 * @return {loop.revindex0} The number of iterations from the end of the loop (0-indexed)
 * @return {loop.key} If the iterator is an object, this will be the key of the current item, otherwise it will be the same as the loop.index.
 * @return {loop.first} True if the current object is the first in the object or array.
 * @return {loop.last} True if the current object is the last in the object or array.
 */
exports.compile = function (compiler, args, content, parents, options, blockName, token) {
  var val, key = '__k', last;

  if (token && token.irExpr) {
    // lowerExpr read the loop names itself: a group paren at the start of
    // the iterable displaces the fragments the legacy walk emits before it.
    val = token.irExpr.val;
    if (token.irExpr.key) { key = token.irExpr.key; }
    last = token.irExpr.iter;
  } else {
    val = args.shift();
    if (args[0] && args[0] === ',') {
      args.shift();
      key = val;
      val = args.shift();
    }
    last = args.join('');
  }

  var bodyJS = compiler(content, parents, options, blockName);
  return ir.forStmt(val, last, [ir.legacyJS(bodyJS)], key);
};

exports.lowerExpr = function (parser, tokens) {
  var inIdx = -1, i, head = [], val, key;
  for (i = 0; i < tokens.length; i++) {
    if (tokens[i].type === _t.COMPARATOR && tokens[i].match === 'in') {
      inIdx = i;
      break;
    }
    if (tokens[i].type !== _t.WHITESPACE) { head.push(tokens[i]); }
  }
  if (inIdx === -1 || !head.length || head[0].type !== _t.VAR) { return undefined; }
  // The loop names as the fragments read them: the first name binds the
  // value, unless a comma and a second name follow it, which make the first
  // the key and the second the value; a name without a comma before it is
  // ignored, and a comma with no name after it keeps the fragments.
  val = head[0].match;
  if (head.length > 1 && head[1].type === _t.COMMA) {
    if (head.length < 3 || head[2].type !== _t.VAR) { return undefined; }
    key = val;
    val = head[2].match;
  }
  return { val: val, key: key, iter: parser.parseExpr(tokens.slice(inIdx + 1)) };
};

exports.parse = function (str, line, parser, types) {
  var firstVar, ready;

  parser.on(types.NUMBER, function (token) {
    var lastState = this.state.length ? this.state[this.state.length - 1] : null;
    if (!ready ||
        (lastState !== types.ARRAYOPEN &&
          lastState !== types.CURLYOPEN &&
          lastState !== types.CURLYCLOSE &&
          lastState !== types.FUNCTION &&
          lastState !== types.FILTER)
        ) {
      throw new Error('Unexpected number "' + token.match + '" on line ' + line + '.');
    }
    return true;
  });

  parser.on(types.VAR, function (token) {
    if (ready && firstVar) {
      return true;
    }

    // CVE-2023-25345: the lexer folds dotted paths into a single VAR token
    // (e.g. `foo.__proto__` matches as one VAR with .match === "foo.__proto__"),
    // so the _dangerousProps indexOf check below misses the prototype segment.
    // Loop variables bind to `_ctx.<name>` — bare identifiers only.
    if (token.match.indexOf('.') !== -1) {
      throw new Error('Loop variable "' + token.match + '" must be a bare identifier in "for" tag on line ' + line + '.');
    }

    // CVE-2023-25345: block prototype-chain property names as loop variables
    if (_dangerousProps.indexOf(token.match) !== -1) {
      throw new Error('Unsafe loop variable "' + token.match + '" is not allowed (prototype-chain guard) on line ' + line + '.');
    }

    if (!this.out.length) {
      firstVar = true;
    }

    this.out.push(token.match);
  });

  parser.on(types.COMMA, function (token) {
    if (firstVar && this.prevToken.type === types.VAR) {
      this.out.push(token.match);
      return;
    }

    return true;
  });

  parser.on(types.COMPARATOR, function (token) {
    if (token.match !== 'in' || !firstVar) {
      throw new Error('Unexpected token "' + token.match + '" on line ' + line + '.');
    }
    ready = true;
    this.filterApplyIdx.push(this.out.length);
  });

  return true;
};

exports.ends = true;
