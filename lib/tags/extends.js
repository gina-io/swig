var _t = require('@rhinostone/swig-core/lib/tokentypes');

/**
 * Makes the current template extend a parent template. This tag must be the first item in your template.
 *
 * See <a href="#inheritance">Template Inheritance</a> for more information.
 *
 * @alias extends
 *
 * @example
 * {% extends "./layout.html" %}
 *
 * @example
 * // A dynamic parent path resolves on the async render path
 * // (renderFile(path, locals, cb) with loader.async === true); the
 * // synchronous render path requires a string literal.
 * {% extends layout_var %}
 *
 * @param {string|var} parentFile  Relative path to the file that this template extends. A dynamic (variable) path is resolved on the async render path only.
 */
// extends is a parse-time declaration, not an emit-time construct. The
// engine's getParents / remapBlocks resolves the parent chain before the
// backend walks the token tree, so by compile-time there is nothing to
// emit. No IRExtends node exists — the Template IR already carries
// `.parent` / `.blocks` metadata for flavors that want to reason about
// inheritance before lowering. The compile function returns undefined and
// the backend skips it via the `result === undefined` check at the top of
// the emit loop.
exports.compile = function () {};

exports.parse = function () {
  return true;
};

/*!
 * Lower a dynamic parent-path to IR so `{% extends layout_var %}`
 * resolves at render time on the async codegen path. A lone
 * string-literal path (`{% extends "x.html" %}`) returns undefined, so
 * the engine keeps its existing tokens.parent string + ir.literal path
 * unchanged; only a dynamic path is lowered. Mirrors include.js. The
 * resulting IRExpr is read back as token.irExpr.file by the parser
 * splitter and stashed on the sibling tokens.parentExpr slot.
 */
exports.lowerExpr = function (parser, tokens) {
  var i, tk, pathTokens = [];
  for (i = 0; i < tokens.length; i += 1) {
    tk = tokens[i];
    if (tk.type === _t.WHITESPACE) { continue; }
    pathTokens.push(tk);
  }
  if (!pathTokens.length) { return undefined; }
  if (pathTokens.length === 1 && pathTokens[0].type === _t.STRING) {
    return undefined;
  }
  return { file: parser.parseExpr(tokens) };
};

exports.ends = false;
