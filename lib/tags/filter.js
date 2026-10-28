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
  var filter, irArgs,
    bodyJS = compiler(content, parents, options, blockName);

  // Name and arguments prefer the lowered form carried on the token when
  // lowerExpr produced one (it reads the name itself: a filter applied
  // inside the arguments puts its call before the name in the JS-source
  // fragments); otherwise fall back to the fragments the parse handler
  // emitted (preserves userland setTag shape and the arg-less
  // `{% filter name %}` case).
  if (token && token.irExpr) {
    filter = token.irExpr.name;
    irArgs = token.irExpr.args;
  } else {
    filter = args.shift().replace(/\($/, '');
    if (args[args.length - 1] === ')') {
      args.pop();
    }
    irArgs = args.length ? args : undefined;
  }
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
  var name = head.match.replace(/\($/, '');
  if (head.type === _t.FUNCTIONEMPTY) { return { name: name, args: [] }; }
  if (head.type !== _t.FUNCTION) { return undefined; }

  // FUNCTION consumes its implicit open paren; walk forward tracking
  // paren / bracket / curly depth. Slice at top-level COMMAs; stop at the
  // PARENCLOSE that balances the FUNCTION's paren. A FILTER token
  // consumes its open paren (`|name(`), as FUNCTION does.
  var depth = 1,
    start = i + 1,
    slices = [],
    j;
  for (j = i + 1; j < tokens.length; j += 1) {
    var tk = tokens[j];
    if (tk.type === _t.PARENOPEN || tk.type === _t.FUNCTION ||
        tk.type === _t.BRACKETOPEN || tk.type === _t.CURLYOPEN ||
        tk.type === _t.FILTER) {
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
  return { name: name, args: exprs };
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
