var filters = require('../filters'),
  ir = require('@rhinostone/swig-core/lib/ir'),
  _t = require('@rhinostone/swig-core/lib/tokentypes');

/**
 * Apply a filter to an entire block of template.
 *
 * @alias filter
 *
 * @example
 * {% filter uppercase %}oh hi, {{ name }}{% endfilter %}
 * // => OH HI, PAUL
 *
 * @example
 * {% filter replace(".", "!", "g") %}Hi. My name is Paul.{% endfilter %}
 * // => Hi! My name is Paul!
 *
 * @param {function} filter  The filter that should be applied to the contents of the tag.
 */

exports.compile = function (compiler, args, content, parents, options, blockName, token) {
  var filter = args.shift().replace(/\($/, ''),
    bodyJS = compiler(content, parents, options, blockName);

  if (args[args.length - 1] === ')') {
    args.pop();
  }

  // Value prefers the lowered IRExpr[] carried on the token when
  // lowerExpr produced one; otherwise fall back to the joined JS-source
  // fragments the parse handler emitted (preserves userland setTag shape
  // and the arg-less `{% filter name %}` case).
  var irArgs = (token && token.irExpr) ? token.irExpr : (args.length ? args : undefined);
  return ir.filter(filter, [ir.legacyJS(bodyJS)], irArgs);
};

exports.lowerExpr = function (parser, tokens) {
  // Skip leading whitespace; find the filter-name token (VAR, FUNCTION,
  // or FUNCTIONEMPTY).
  var i = 0;
  while (i < tokens.length && tokens[i].type === _t.WHITESPACE) { i += 1; }
  if (i >= tokens.length) { return undefined; }
  var head = tokens[i];
  // Arg-less `{% filter name %}` — nothing to lower. Falling back keeps
  // the userland setTag string-args path live for zero-arg filters.
  if (head.type === _t.VAR) { return undefined; }
  if (head.type === _t.FUNCTIONEMPTY) { return []; }
  if (head.type !== _t.FUNCTION) { return undefined; }

  // FUNCTION consumes its implicit open paren; walk forward tracking
  // paren / bracket / curly depth. Slice at top-level COMMAs; stop at the
  // PARENCLOSE that balances the FUNCTION's paren. Bail (return
  // undefined) on any nested FILTER / FILTEREMPTY — filter pipes inside
  // the argument expression are not part of the expression grammar
  // (Output-site concern; Session 14+ work).
  var depth = 1,
    start = i + 1,
    slices = [],
    j;
  for (j = i + 1; j < tokens.length; j += 1) {
    var tk = tokens[j];
    if (tk.type === _t.FILTER || tk.type === _t.FILTEREMPTY) {
      return undefined;
    }
    if (tk.type === _t.PARENOPEN || tk.type === _t.FUNCTION ||
        tk.type === _t.BRACKETOPEN || tk.type === _t.CURLYOPEN) {
      depth += 1;
      continue;
    }
    if (tk.type === _t.PARENCLOSE || tk.type === _t.BRACKETCLOSE ||
        tk.type === _t.CURLYCLOSE) {
      depth -= 1;
      if (depth === 0) {
        if (j > start) {
          slices.push(tokens.slice(start, j));
        }
        break;
      }
      continue;
    }
    if (tk.type === _t.COMMA && depth === 1) {
      slices.push(tokens.slice(start, j));
      start = j + 1;
    }
  }
  if (depth !== 0) { return undefined; }
  var exprs = [];
  for (j = 0; j < slices.length; j += 1) {
    exprs.push(parser.parseExpr(slices[j]));
  }
  return exprs;
};

exports.parse = function (str, line, parser, types) {
  var filter;

  function check(filter) {
    if (!filters.hasOwnProperty(filter)) {
      throw new Error('Filter "' + filter + '" does not exist on line ' + line + '.');
    }
  }

  parser.on(types.FUNCTION, function (token) {
    if (!filter) {
      filter = token.match.replace(/\($/, '');
      check(filter);
      this.out.push(token.match);
      this.state.push(token.type);
      return;
    }
    return true;
  });

  parser.on(types.VAR, function (token) {
    if (!filter) {
      filter = token.match;
      check(filter);
      this.out.push(filter);
      return;
    }
    return true;
  });

  return true;
};

exports.ends = true;
