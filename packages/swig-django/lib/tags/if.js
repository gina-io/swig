/*!
 * Django `{% if %}` / `{% elif %}` / `{% else %}` tag.
 *
 * Conditional: `{% if <expr> %}…{% elif <expr> %}…{% else %}…{% endif %}`.
 * The test expression is parsed via `parser.parseExpr` and attached to
 * `token.irExpr`. The body content is captured via the parser's open-tag
 * stack (this tag sets `ends: true`).
 *
 * `{% elif %}` and `{% else %}` lex as their own tags (`ends: false`,
 * registered in tags/index.js) and so appear as marker tokens inside this
 * tag's `content`. The compile path walks `content`, splitting at those
 * markers into one IRIfBranch per segment — the backend's `If` walker then
 * emits the `if (…) { … } else if (…) { … } else { … }` envelope.
 */

var ir = require('@rhinostone/swig-core/lib/ir');
var utils = require('@rhinostone/swig-core/lib/utils');

var lexer = require('../lexer');

exports.ends = true;
exports.block = false;

/**
 * Parse the `{% if %}` test expression onto `token.irExpr`.
 *
 * @param  {string} str    Tag body (tag name stripped).
 * @param  {number} line   Source line of the opening `{%`.
 * @param  {object} parser The Django parser module (exposes `parseExpr`).
 * @param  {object} types  Django lexer token-type enum.
 * @param  {Array}  stack  Open-tag stack (managed by parser.js).
 * @param  {object} opts   Per-call options (honors `opts.filename`).
 * @param  {object} swig   Swig instance (unused).
 * @param  {object} token  In-progress TagToken. `token.irExpr` is set.
 * @return {boolean}       Always `true` on success. Throws otherwise.
 */
exports.parse = function (str, line, parser, types, stack, opts, swig, token) {
  var tokens = lexer.read(utils.strip(str));
  if (!tokens.length) {
    utils.throwError('Expected conditional expression in "if" tag', line, opts.filename);
  }
  token.irExpr = parser.parseExpr(tokens);
  return true;
};

/**
 * Split `content` at `elif` / `else` marker tokens and emit a multi-branch
 * IRIf node.
 *
 * @return {object} IRIf node.
 */
exports.compile = function (compiler, args, content, parents, options, blockName, token) {
  var branches = [],
    currentTest = token.irExpr,
    currentBody = [],
    sawElse = false,
    filename = options && options.filename;

  function flush() {
    branches.push(ir.ifBranch(currentTest, [ir.legacyJS(compiler(currentBody, parents, options, blockName))]));
  }

  utils.each(content, function (child) {
    if (child && child.name === 'elif') {
      if (sawElse) { utils.throwError('"elif" after "else" in "if" tag', null, filename); }
      flush();
      currentTest = child.irExpr;
      currentBody = [];
    } else if (child && child.name === 'else') {
      if (sawElse) { utils.throwError('Multiple "else" branches in "if" tag', null, filename); }
      flush();
      currentTest = null;
      currentBody = [];
      sawElse = true;
    } else {
      currentBody.push(child);
    }
  });
  flush();

  return ir.ifStmt(branches);
};
