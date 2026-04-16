/*!
 * Phase 3 Session 11 — Twig `{% apply filter %}…{% endapply %}` tag.
 *
 * Twig apply syntax — pipe the captured body through one or more filters,
 * left-to-right:
 *
 *   {% apply upper %}hello{% endapply %}
 *   {% apply upper|trim %}  hi  {% endapply %}
 *   {% apply replace({'a': 'b'}) %}banana{% endapply %}
 *   {% apply replace({'a': 'b'})|upper %}banana{% endapply %}
 *
 * Emits `IRLegacyJS` rather than `IRFilter` — `IRFilter` is single-filter
 * only (backend wraps the body in one `_filters[name](...)` call), and
 * chains require nested `_filters["f3"](_filters["f2"](_filters["f1"](...),
 * ...), ...)`. Keeping the chain-emission in the tag avoids growing a new
 * IR node for what is a JS plumbing shape; consistent with `{% set %}`'s
 * body-capture form which also emits an IIFE via `IRLegacyJS`.
 *
 * CVE-2023-25345 checkpoint applies to each filter name — prototype-chain
 * names (`__proto__`, `constructor`, `prototype`) are rejected at parse
 * time. Filter argument expressions go through `parser.parseExpr` and
 * inherit the `_dangerousProps` guards the expression parser already
 * applies to VAR / DOTKEY / STRING-in-bracket / FUNCTION callee.
 */

var ir = require('@rhinostone/swig-core/lib/ir');
var utils = require('@rhinostone/swig-core/lib/utils');
var backend = require('@rhinostone/swig-core/lib/backend');
var _dangerousProps = require('@rhinostone/swig-core/lib/security').dangerousProps;

var lexer = require('../lexer');
var _t = require('../tokentypes');

exports.ends = true;
exports.block = false;

/*!
 * Depth-tracked COMMA-split over the token stream starting at `start`
 * (which should be the position immediately after the FUNCTION or FILTER
 * token's implicit open paren). Returns `{ slices, end }` where `end` is
 * the index of the balancing PARENCLOSE (one past the last consumed arg
 * token). Throws via `utils.throwError` on unclosed paren.
 *
 * Pattern mirrors `lib/tags/filter.js:lowerExpr` — paren / bracket /
 * curly / function all bump depth; PARENCLOSE / BRACKETCLOSE /
 * CURLYCLOSE drop it; COMMA at depth 1 is a top-level separator.
 * @private
 */
function sliceCallArgs(tokens, start, line, filename) {
  var depth = 1,
    argStart = start,
    slices = [],
    j;
  for (j = start; j < tokens.length; j += 1) {
    var tk = tokens[j];
    if (tk.type === _t.PARENOPEN || tk.type === _t.FUNCTION ||
        tk.type === _t.BRACKETOPEN || tk.type === _t.CURLYOPEN) {
      depth += 1;
      continue;
    }
    if (tk.type === _t.PARENCLOSE || tk.type === _t.BRACKETCLOSE ||
        tk.type === _t.CURLYCLOSE) {
      depth -= 1;
      if (depth === 0) {
        if (j > argStart) {
          slices.push(tokens.slice(argStart, j));
        }
        return { slices: slices, end: j + 1 };
      }
      continue;
    }
    if (tk.type === _t.COMMA && depth === 1) {
      if (j > argStart) {
        slices.push(tokens.slice(argStart, j));
      }
      argStart = j + 1;
    }
  }
  utils.throwError('Unclosed argument list in "apply" tag', line, filename);
}

/**
 * Parse the `{% apply filter %}` tag body. Extracts the filter chain
 * and validates each filter name against the CVE-2023-25345 blocklist.
 *
 * Stashes `[{name, args: IRExpr[]}, {name, args: IRExpr[]}, ...]` on
 * `token.args`. `args: []` means the filter takes no arguments.
 *
 * @param  {string} str    Tag body.
 * @param  {number} line   Source line of the opening `{%`.
 * @param  {object} parser The Twig parser module (exposes `parseExpr`).
 * @param  {object} types  Twig lexer token-type enum.
 * @param  {Array}  stack  Open-tag stack (parser.js manages push).
 * @param  {object} opts   Per-call options (honors `opts.filename`).
 * @param  {object} swig   Swig instance (unused).
 * @param  {object} token  In-progress TagToken. `token.args` gets the
 *                         filter chain descriptor array.
 * @return {boolean}       Always `true` on success. Throws otherwise.
 */
exports.parse = function (str, line, parser, types, stack, opts, swig, token) {
  var tokens = lexer.read(utils.strip(str));
  var pos = 0;

  while (pos < tokens.length && tokens[pos].type === types.WHITESPACE) { pos += 1; }

  if (pos >= tokens.length) {
    utils.throwError('Expected filter name in "apply" tag', line, opts.filename);
  }

  function checkName(name) {
    if (_dangerousProps.indexOf(name) !== -1) {
      utils.throwError('Unsafe filter name "' + name + '" is not allowed (CVE-2023-25345)', line, opts.filename);
    }
  }

  var chain = [];

  // Head filter — VAR (bare name), FUNCTIONEMPTY (`name()`), or FUNCTION
  // (`name(args...)`). Subsequent filters must come in via FILTER /
  // FILTEREMPTY — a trailing bare VAR / FUNCTION would be a syntax error.
  var head = tokens[pos];
  if (head.type === types.VAR) {
    checkName(head.match);
    chain.push({ name: head.match, args: [] });
    pos += 1;
  } else if (head.type === types.FUNCTIONEMPTY) {
    checkName(head.match);
    chain.push({ name: head.match, args: [] });
    pos += 1;
  } else if (head.type === types.FUNCTION) {
    checkName(head.match);
    var result = sliceCallArgs(tokens, pos + 1, line, opts.filename);
    var exprs = [];
    for (var i = 0; i < result.slices.length; i += 1) {
      exprs.push(parser.parseExpr(result.slices[i]));
    }
    chain.push({ name: head.match, args: exprs });
    pos = result.end;
  } else {
    utils.throwError('Expected filter name in "apply" tag', line, opts.filename);
  }

  // Chain tail — each FILTER or FILTEREMPTY appends another filter call.
  while (pos < tokens.length) {
    while (pos < tokens.length && tokens[pos].type === types.WHITESPACE) { pos += 1; }
    if (pos >= tokens.length) { break; }

    var tk = tokens[pos];
    if (tk.type === types.FILTEREMPTY) {
      checkName(tk.match);
      chain.push({ name: tk.match, args: [] });
      pos += 1;
      continue;
    }
    if (tk.type === types.FILTER) {
      checkName(tk.match);
      var r = sliceCallArgs(tokens, pos + 1, line, opts.filename);
      var e = [];
      for (var k = 0; k < r.slices.length; k += 1) {
        e.push(parser.parseExpr(r.slices[k]));
      }
      chain.push({ name: tk.match, args: e });
      pos = r.end;
      continue;
    }
    utils.throwError('Unexpected token "' + tk.match + '" in "apply" tag filter chain', line, opts.filename);
  }

  token.args = chain;
  return true;
};

/**
 * Emit an `IRLegacyJS` node that captures the body into a local
 * `_output` via an IIFE and folds the filter chain left-to-right into
 * nested `_filters["<name>"](input, ...args)` calls.
 *
 * For `{% apply upper|trim %}body{% endapply %}` this produces roughly:
 *
 *   _output += _filters["trim"](_filters["upper"](
 *     (function () { var _output = ""; <bodyJS> return _output; })()
 *   ));
 *
 * @return {object} IRLegacyJS node.
 */
exports.compile = function (compiler, args, content, parents, options, blockName) {
  var chain = args;
  var bodyJS = compiler(content, parents, options, blockName);
  var input = '(function () {\n  var _output = "";\n' + bodyJS + '  return _output;\n})()';

  var expr = input;
  for (var i = 0; i < chain.length; i += 1) {
    var entry = chain[i];
    var argsJS = '';
    if (entry.args && entry.args.length) {
      var parts = [];
      for (var j = 0; j < entry.args.length; j += 1) {
        parts.push(backend.emitExpr(entry.args[j]));
      }
      argsJS = ', ' + parts.join(', ');
    }
    expr = '_filters["' + entry.name + '"](' + expr + argsJS + ')';
  }

  return ir.legacyJS('_output += ' + expr + ';\n');
};
