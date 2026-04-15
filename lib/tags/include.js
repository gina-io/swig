var ir = require('@rhinostone/swig-core/lib/ir'),
  _t = require('@rhinostone/swig-core/lib/tokentypes');

var ignore = 'ignore',
  missing = 'missing',
  only = 'only';

/**
 * Includes a template partial in place. The template is rendered within the current locals variable context.
 *
 * @alias include
 *
 * @example
 * // food = 'burritos';
 * // drink = 'lemonade';
 * {% include "./partial.html" %}
 * // => I like burritos and lemonade.
 *
 * @example
 * // my_obj = { food: 'tacos', drink: 'horchata' };
 * {% include "./partial.html" with my_obj only %}
 * // => I like tacos and horchata.
 *
 * @example
 * {% include "/this/file/does/not/exist" ignore missing %}
 * // => (Nothing! empty string)
 *
 * @param {string|var}  file      The path, relative to the template root, to render into the current context.
 * @param {literal}     [with]    Literally, "with".
 * @param {object}      [context] Local variable key-value object context to provide to the included file.
 * @param {literal}     [only]    Restricts to <strong>only</strong> passing the <code>with context</code> as local variables–the included template will not be aware of any other local variables in the parent template. For best performance, usage of this option is recommended if possible.
 * @param {literal}     [ignore missing] Will output empty string if not found instead of throwing an error.
 */
exports.compile = function (compiler, args, content, parents, options, blockName, token) {
  var file = args.shift(),
    onlyIdx = args.indexOf(only),
    onlyCtx = onlyIdx !== -1 ? args.splice(onlyIdx, 1) : false,
    parentFile = (args.pop() || '').replace(/\\/g, '\\\\'),
    ignoreMissing = args[args.length - 1] === missing ? (args.pop()) : false,
    w = args.join('');

  if (token && token.irExpr) {
    file = token.irExpr.file;
    if (token.irExpr.context !== undefined) {
      w = token.irExpr.context;
    } else {
      w = undefined;
    }
  }

  return ir.include(file, w || undefined, !!onlyCtx, !!ignoreMissing, parentFile);
};

exports.lowerExpr = function (parser, tokens) {
  var i, tk, depth = 0,
    withIdx = -1, onlyIdx = -1, ignoreIdx = -1;

  for (i = 0; i < tokens.length; i++) {
    tk = tokens[i];
    if (tk.type === _t.FILTER || tk.type === _t.FILTEREMPTY) {
      return undefined;
    }
    if (tk.type === _t.PARENOPEN || tk.type === _t.BRACKETOPEN ||
        tk.type === _t.ARRAYOPEN || tk.type === _t.CURLYOPEN ||
        tk.type === _t.FUNCTION || tk.type === _t.METHODOPEN) {
      depth++;
      continue;
    }
    if (tk.type === _t.PARENCLOSE || tk.type === _t.BRACKETCLOSE ||
        tk.type === _t.CURLYCLOSE) {
      depth--;
      continue;
    }
    if (depth !== 0) { continue; }
    if (tk.type === _t.VAR) {
      if (withIdx === -1 && tk.match === 'with') {
        withIdx = i;
      } else if (withIdx !== -1 && onlyIdx === -1 && tk.match === only) {
        onlyIdx = i;
      } else if (ignoreIdx === -1 && tk.match === ignore) {
        ignoreIdx = i;
      }
    }
  }

  var pathEnd = tokens.length;
  if (withIdx !== -1) { pathEnd = withIdx; }
  else if (ignoreIdx !== -1) { pathEnd = ignoreIdx; }

  var pathTokens = tokens.slice(0, pathEnd);
  if (pathTokens.length === 0) { return undefined; }

  var result = { file: parser.parseExpr(pathTokens) };

  if (withIdx !== -1) {
    var ctxEnd = tokens.length;
    if (onlyIdx !== -1) { ctxEnd = onlyIdx; }
    else if (ignoreIdx !== -1) { ctxEnd = ignoreIdx; }
    var ctxTokens = tokens.slice(withIdx + 1, ctxEnd);
    if (ctxTokens.length > 0) {
      result.context = parser.parseExpr(ctxTokens);
    }
  }

  return result;
};

exports.parse = function (str, line, parser, types, stack, opts) {
  var file, w;
  parser.on(types.STRING, function (token) {
    if (!file) {
      file = token.match;
      this.out.push(file);
      return;
    }

    return true;
  });

  parser.on(types.VAR, function (token) {
    if (!file) {
      file = token.match;
      return true;
    }

    if (!w && token.match === 'with') {
      w = true;
      return;
    }

    if (w && token.match === only && this.prevToken.match !== 'with') {
      this.out.push(token.match);
      return;
    }

    if (token.match === ignore) {
      return false;
    }

    if (token.match === missing) {
      if (this.prevToken.match !== ignore) {
        throw new Error('Unexpected token "' + missing + '" on line ' + line + '.');
      }
      this.out.push(token.match);
      return false;
    }

    if (this.prevToken.match === ignore) {
      throw new Error('Expected "' + missing + '" on line ' + line + ' but found "' + token.match + '".');
    }

    return true;
  });

  parser.on('end', function () {
    this.out.push(opts.filename || null);
  });

  return true;
};
