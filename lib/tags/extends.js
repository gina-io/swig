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
 * @param {string} parentFile  Relative path to the file that this template extends.
 */
// Phase 2 (#T15): extends is a parse-time declaration, not an emit-time
// construct. The engine's getParents / remapBlocks resolves the parent
// chain before the backend walks the token tree, so by compile-time
// there is nothing to emit. No IRExtends node exists — the Template IR
// already carries `.parent` / `.blocks` metadata for flavors that want
// to reason about inheritance before lowering. The compile function
// returns undefined and the backend skips it via the `result === undefined`
// check at the top of the emit loop. This stays this way post-Phase 2.
exports.compile = function () {};

exports.parse = function () {
  return true;
};

exports.ends = false;
