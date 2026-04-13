var utils = require('./utils'),
  backend = require('./backend');

/**
 * Runtime engine plumbing shared across @rhinostone/swig-family frontends.
 *
 * Phase 1 carve — owns the `extends`-chain walker and block-remap helpers.
 * The native Swig constructor in lib/swig.js delegates here so each frontend
 * inherits the loader-walk + circular-extends detection + block merge logic
 * for free.
 *
 * Each helper is pure: frontend-specific state (the resolving loader, the
 * source-to-tokens parseFile, the cache lookup, the parent template cache)
 * is injected via a `deps` parameter rather than captured through a
 * closure. Helpers treat template identifiers as opaque strings — they do
 * not know whether the loader's `resolve` output is a file path, a URL, or
 * a Memcached key.
 *
 * See .claude/architecture/multi-flavor-ir.md — filename-aware code
 * (utils.throwError wrapping, the engine's try/catch that attaches a
 * filename to compile errors) stays in the frontend.
 */

/**
 * Re-map block tags inside a parent token list to the child template's
 * overriding block tags.
 *
 * @param  {object} blocks  Map of block name → overriding block token.
 * @param  {array}  tokens  Parent token list.
 * @return {array}          Remapped token list.
 */
exports.remapBlocks = function remapBlocks(blocks, tokens) {
  return utils.map(tokens, function (token) {
    var args = token.args ? token.args.join('') : '';
    if (token.name === 'block' && blocks[args]) {
      token = blocks[args];
    }
    if (token.content && token.content.length) {
      token.content = remapBlocks(blocks, token.content);
    }
    return token;
  });
};

/**
 * Inject the child template's non-`block` block-level tags (e.g. `set`,
 * `import`) onto the top of the rendered parent's token list so they run
 * before the parent's body.
 *
 * @param  {object} blocks  Child template's block-level token map.
 * @param  {array}  tokens  Token list to prepend onto.
 * @return {undefined}
 */
exports.importNonBlocks = function (blocks, tokens) {
  var temp = [];
  utils.each(blocks, function (block) { temp.push(block); });
  utils.each(temp.reverse(), function (block) {
    if (block.name !== 'block') {
      tokens.unshift(block);
    }
  });
};

/**
 * Walk a template's `extends` chain and build the parent token tree.
 * Detects circular inheritance.
 *
 * Deps are injected so each frontend can plug in its own loader and
 * parse-to-tokens implementation:
 *
 *   deps.resolve(to, from)          → string     (loader.resolve)
 *   deps.parseFile(pathname, opts)  → token tree (frontend-specific)
 *   deps.cacheGet(key, options)     → token tree | undefined
 *
 * @param  {object} tokens    Parsed token tree for the child template.
 *                            Must expose `.parent` (or falsy).
 * @param  {object} [options] Per-call Swig options. `options.filename` is
 *                            required when `tokens.parent` is set.
 * @param  {object} deps      Injected frontend helpers.
 * @return {array}            Parent templates, outermost-first.
 */
exports.getParents = function (tokens, options, deps) {
  var parentName = tokens.parent,
    parentFiles = [],
    parents = [],
    parentFile,
    parent,
    l;

  while (parentName) {
    if (!options || !options.filename) {
      throw new Error('Cannot extend "' + parentName + '" because current template has no filename.');
    }

    parentFile = parentFile || options.filename;
    parentFile = deps.resolve(parentName, parentFile);
    parent = deps.cacheGet(parentFile, options) || deps.parseFile(parentFile, utils.extend({}, options, { filename: parentFile }));
    parentName = parent.parent;

    if (parentFiles.indexOf(parentFile) !== -1) {
      throw new Error('Illegal circular extends of "' + parentFile + '".');
    }
    parentFiles.push(parentFile);

    parents.push(parent);
  }

  // Remap each parent's(1) blocks onto its own parent(2), receiving the full
  // token list for rendering the original parent(1) on its own.
  l = parents.length;
  for (l = parents.length - 2; l >= 0; l -= 1) {
    parents[l].tokens = exports.remapBlocks(parents[l].blocks, parents[l + 1].tokens);
    exports.importNonBlocks(parents[l].blocks, parents[l].tokens);
  }

  return parents;
};

/**
 * Build a renderable template Function from a parsed token tree.
 *
 * Walks tokens via the swig-core backend codegen, wraps the emitted body
 * in the `new Function('_swig', '_ctx', '_filters', '_utils', '_fn', ...)`
 * construction, and returns the function. The argument list is the
 * contract every tag's compile() output depends on — `_output`, `_ext`,
 * `_ctx`, etc. are referenced by name in emitted code.
 *
 * Filename attribution on compile-time failures lives on the frontend
 * per the seam rule (the caller knows which template the body came from
 * and can attach that via options.filename in its own try/catch). This
 * helper only throws whatever `new Function(...)` throws — the caller
 * can catch and rewrap.
 *
 * @param  {object|array} tokens   Parsed token tree.
 * @param  {array}  [parents]      Parent tokens from getParents().
 * @param  {object} [options]      Swig options object.
 * @return {Function}              Template function.
 */
exports.buildTemplateFunction = function (tokens, parents, options) {
  return new Function('_swig', '_ctx', '_filters', '_utils', '_fn',
    '  var _ext = _swig.extensions,\n' +
    '    _output = "";\n' +
    backend.compile(tokens, parents, options) + '\n' +
    '  return _output;\n'
    );
};
