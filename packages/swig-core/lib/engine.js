var utils = require('./utils'),
  ir = require('./ir'),
  backend = require('./backend'),
  cache = require('./cache');

/**
 * Constructor for AsyncFunction. Not a global; resolved once at module
 * load via the prototype-chain walk of an async function expression.
 * Used by {@link buildTemplateFunction} to wrap async-codegen template
 * bodies so they return a Promise. Available in any engine that supports
 * the `async function` syntax — Node ≥ 7.6 / all modern browsers; the
 * package's engine floor (>=12) guarantees it.
 * @private
 */
var AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

/**
 * Empty function used as a fallback in compiled template code.
 * @return {string} Empty string.
 * @private
 */
function efn() { return ''; }

/**
 * Cache key for a compiled template. An async-mode compile returns a
 * different function shape (a Promise of `{ output, exports }`), so it is
 * stored under its own key: neither mode is served, or replaces, the other
 * mode's entry for the same file.
 *
 * @param  {string} filename  Template identifier (the resolved path for files).
 * @param  {object} [options] Compile options; `codegenMode` is read.
 * @return {string}           Cache key.
 * @private
 */
function compileCacheKey(filename, options) {
  return (options && options.codegenMode === 'async') ? filename + '#async' : filename;
}

/*!
 * Bind the locals given in the options of a compile or compileFile call to a
 * compiled template, leaving the function the cache holds untouched: the cache
 * keeps one function per file for every caller, so one call's locals must not
 * reach another. Each call of the returned function starts from a fresh object
 * that holds those locals under the call's own.
 * @private
 */
function bindOptionLocals(fn, options) {
  var optionLocals;
  if (!options || !options.locals) {
    return fn;
  }
  optionLocals = utils.extend({}, options.locals);
  function bound(locals, blocks, view) {
    return fn(utils.extend({}, optionLocals, locals), blocks, view);
  }
  return utils.extend(bound, fn);
}

/*!
 * A copy of an instance's default locals for one render, so what the render
 * writes ({% set %}, macros, loop names, cycle state) stays out of the object
 * every render of the instance shares. Copies the own enumerable keys and
 * keeps the prototype, as the copy of call locals does, so a null-prototype
 * defaults object and one with prototype members render as they did when
 * the object was used directly.
 * @private
 */
function copyLocals(obj) {
  // The copy keeps the defaults object's prototype, as the copy of call locals
  // does (utils.copyContext): a plain {} dropped the prototype, so default
  // locals that are a class instance lost their methods and getters in a
  // render without call locals, where the object used directly had them.
  // copyContext also handles a null prototype and an own "__proto__" key.
  // var out = {};
  // utils.each(utils.keys(obj), function (key) {
  //   if (key === '__proto__') {
  //     Object.defineProperty(out, key, { value: obj[key], writable: true, enumerable: true, configurable: true });
  //     return;
  //   }
  //   out[key] = obj[key];
  // });
  // return out;
  return utils.copyContext(obj);
}

/**
 * Runtime engine plumbing shared across @rhinostone/swig-family frontends.
 *
 * Owns the `extends`-chain walker and block-remap helpers.
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
 * Filename-aware code (utils.throwError wrapping, the engine's try/catch
 * that attaches a filename to compile errors) stays in the frontend.
 */

/*!
 * Deepest nesting one async render may reach: each include, import, from-import
 * and extends parent counts one level. Without a bound, a template that
 * includes or imports itself, or an extends cycle, loads templates until the
 * process runs out of memory.
 * @private
 */
var MAX_ASYNC_NESTING = 1000;

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
 * Build an `IRExtendsDeferred` node from a parsed child template.
 *
 * Walks `tokens.blocks` (the parser's map of every block-level tag that
 * appeared at top level — both `{% block %}` overrides and non-block
 * preludes like `{% set %}`, `{% import %}`, `{% macro %}`) and:
 *
 *   - For each `{% block %}` token: invokes its `.compile(...)` with an
 *     empty parents list to obtain an `IRBlock` (body is one `IRLegacyJS`
 *     wrapping the recursively-compiled JS source — same shape sync mode
 *     produces). The IRBlock is keyed under the block name in `childBlocks`.
 *   - For each non-`block` block-level token: invokes its `.compile(...)`
 *     and wraps any JS-string return in `IRLegacyJS`. The resulting IR
 *     node is pushed onto `childIRs` (the prelude list).
 *
 * The backend's `IRExtendsDeferred` emit branch handles runtime parent
 * resolution via `_swig.getTemplate` and the `_blocks` parameter contract
 * (see `packages/swig-core/lib/backend.js`).
 *
 * `tokens.parent` is lifted into an `IRLiteral('string', …)` so the
 * backend's `emitExpr` path produces a quoted JS string literal. The
 * native parser stashes `tokens.parent` as the literal text of the
 * extends argument after stripping enclosing quotes (lib/parser.js:273),
 * which works for `{% extends "layout.html" %}` but for a bare
 * identifier (`{% extends parent_var %}`) yields a pre-lowered JS
 * source fragment such as `((typeof _ctx.parent_var !== "undefined")
 * ? _ctx.parent_var : …)`. As a string literal that would become a
 * garbage template lookup at runtime
 * (`Template not found: /((typeof _ctx.parent_var …`). Closed: a
 * dynamic path is lowered to an IRExpr by the extends tag's `lowerExpr`
 * (lib/tags/extends.js) and stashed on the sibling `tokens.parentExpr`
 * slot — NOT `tokens.parent`, which the sync `getParents` chain still
 * reads as a string — then passed through `ir.extendsDeferred`'s
 * `path` slot below. A lone string-literal path keeps the
 * `ir.literal('string', tokens.parent)` path unchanged.
 *
 * @param  {object} tokens   Parsed child template (must have `.parent`).
 * @param  {object} options  Per-call Swig options; `options.filename` is
 *                           used as the deferred resolveFrom.
 * @return {object}          IRExtendsDeferred node.
 * @private
 */
function buildExtendsDeferred(tokens, options) {
  var childBlocks = {};
  var childIRs = [];
  utils.each(tokens.blocks, function (blockToken) {
    var args = blockToken.args ? blockToken.args.slice(0) : [];
    var content = blockToken.content ? blockToken.content.slice(0) : [];
    if (blockToken.name === 'block') {
      var blockName = args.join('');
      var blockIR = blockToken.compile(backend.compile, args, content, [], options, blockName, blockToken);
      if (blockIR && typeof blockIR === 'object' && typeof blockIR.type === 'string') {
        childBlocks[blockName] = blockIR;
      }
      return;
    }
    // A block nested in a macro or a set of an extending template is not an
    // override (nor on the sync path): compile such entries with hoisting off.
    var result;
    options.blockHoist.off = true;
    try {
      result = blockToken.compile(backend.compile, args, content, [], options, undefined, blockToken);
    } finally {
      options.blockHoist.off = false;
    }
    if (result === undefined || result === null || result === '') { return; }
    if (typeof result === 'string') {
      childIRs.push(ir.legacyJS(result));
      return;
    }
    if (utils.isArray(result)) {
      utils.each(result, function (n) { childIRs.push(n); });
      return;
    }
    if (typeof result === 'object' && typeof result.type === 'string') {
      childIRs.push(result);
    }
  });
  return ir.extendsDeferred(
    tokens.parentExpr || ir.literal('string', tokens.parent),
    childBlocks,
    childIRs,
    options.filename || ''
  );
}

/*!
 * Copy a parse tree held in the compile cache: the entry's own properties, its
 * token list and its blocks map, with every token object copied once, so a
 * token that the list and the blocks map share stays shared in the copy.
 * @private
 */
function copyParseTree(entry) {
  var copies = new Map(),
    out = utils.extend({}, entry);
  function copyToken(token) {
    if (!token || typeof token !== 'object' || utils.isArray(token)) {
      return token;
    }
    if (copies.has(token)) {
      return copies.get(token);
    }
    var copy = utils.extend({}, token);
    copies.set(token, copy);
    if (utils.isArray(token.content)) {
      copy.content = utils.map(token.content, copyToken);
    }
    return copy;
  }
  out.tokens = utils.map(entry.tokens, copyToken);
  out.blocks = {};
  utils.each(entry.blocks || {}, function (block, name) {
    out.blocks[name] = copyToken(block);
  });
  return out;
}

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
 * @return {array}            Parent templates, nearest first.
 */
exports.getParents = function (tokens, options, deps) {
  var parentName = tokens.parent,
    parentFiles = [],
    parents = [],
    parentFile,
    parent;

  while (parentName) {
    if (!options || !options.filename) {
      throw new Error('Cannot extend "' + parentName + '" because current template has no filename.');
    }

    parentFile = parentFile || options.filename;
    parentFile = deps.resolve(parentName, parentFile);
    // Only a compile-cached entry carries the parse tree (compile extends the
    // wrapper with the token properties); a registered template function does
    // not. Falling through to parseFile keeps a registration from shadowing a
    // loadable parent, which would otherwise resolve blocks against an undefined
    // token list and render an empty string with no error.
    parent = deps.cacheGet(parentFile, options);
    if (!parent || !parent.tokens) {
      parent = deps.parseFile(parentFile, utils.extend({}, options, { filename: parentFile }));
    } else {
      // A compile-cache entry gets a copy: nothing done with the parse tree may
      // reach the cache (a remap of the cached tree once carried one child's
      // block overrides into every child compiled after it), and the copy can
      // take the file name, which the cached function's read-only name cannot.
      parent = copyParseTree(parent);
      parent.name = parentFile;
    }
    parentName = parent.parent;

    if (parentFiles.indexOf(parentFile) !== -1) {
      throw new Error('Illegal circular extends of "' + parentFile + '".');
    }
    parentFiles.push(parentFile);

    parents.push(parent);
  }

  return parents;
};

/*!
 * A block tag's name, as the parser keys its block map.
 * @private
 */
function blockKey(token) {
  return token.args ? token.args.join('') : '';
}

/*!
 * Whether a token of a parse tree is a block tag.
 * @private
 */
function isBlockTag(token) {
  return !!token && token.name === 'block';
}

/*!
 * The block tags of one template. Each template defines a block name once: by
 * its top-level block tag of that name (the parser keeps the last one), else by
 * the first block tag of that name nested in its top-level block tags, at any
 * depth (in a root, anywhere in its token list). `defs` maps each name to its
 * definition ({ token, top }), `tags` lists the tags walked, and `selfNested`
 * holds those nested in a block of their own name.
 * @private
 */
function scanBlocks(tpl, isRoot) {
  var defs = new Map(), tags = [], selfNested = new Set(), tops = [];
  function walk(list, inside) {
    utils.each(list || [], function (token) {
      var name;
      if (!isBlockTag(token)) {
        if (token && token.content) {
          walk(token.content, inside);
        }
        return;
      }
      name = blockKey(token);
      if (!defs.has(name)) {
        defs.set(name, { token: token, top: false });
      }
      if (inside.indexOf(name) !== -1) {
        selfNested.add(token);
      }
      tags.push(token);
      walk(token.content, inside.concat(name));
    });
  }
  utils.each(tpl.blocks || {}, function (token) {
    if (isBlockTag(token)) {
      defs.set(blockKey(token), { token: token, top: true });
      tops.push(token);
    }
  });
  if (isRoot) {
    walk(tpl.tokens, []);
  } else {
    utils.each(tops, function (token) { walk(token.content, [blockKey(token)]); });
  }
  return { defs: defs, tags: tags, selfNested: selfNested };
}

/*!
 * Mark the block tags of a freshly parsed template that are not its definition
 * of their name, for the async render path, where a name has one function per
 * template (see hoistBlock in the backend): the mark ends up on the IRBlock the
 * tag compiles to.
 * @private
 */
function markBlockRoles(tokens) {
  var isRoot = !tokens.parent, scan = scanBlocks(tokens, isRoot);
  utils.each(scan.tags, function (token) {
    var def = scan.defs.get(blockKey(token)), compile = token.compile, role;
    if (scan.selfNested.has(token)) {
      role = 'inner';
    } else if (def.token !== token) {
      role = (def.top && !isRoot) ? 'replaced' : 'repeat';
    } else {
      return;
    }
    token.compile = function () {
      var node = compile.apply(this, arguments);
      if (node && node.type === 'Block') {
        node.blockRole = role;
      }
      return node;
    };
  });
}

/**
 * Build the token list a template renders when it extends others, on the sync
 * render path, without changing any parse tree. `chain` holds the template and
 * its parents, nearest first; the last entry is the root, whose token list is
 * the skeleton of the render.
 *
 * Each template defines a block name once (see scanBlocks). In the skeleton, a
 * block tag at any depth is replaced by a copy of the nearest definition of its
 * name in a nearer template, if there is one, whose content is resolved the same
 * way; in an extending template, a tag nested in its blocks is also replaced by
 * its own top-level definition of the name. A tag nested in a block of its own
 * name keeps its own content. The non-block block-level tags of every template
 * but the root (set, import, macro) are prepended, nearest template first; the
 * blocks they hold take only nearer definitions.
 *
 * A copy carries the farther definitions of its name as `parentChain`, in the
 * shape of `parents` entries ({ name, blocks: { <name>: copy } }), nearest
 * first, and its compile passes them as `parents` to the block tag, so that a
 * {% parent %} inside renders the next definition, and the blocks nested in
 * that definition take their own nearest nearer definitions in turn. Where this
 * leads a block back to itself the compile stops with a throw at that point, so
 * a render fails only if it gets there.
 *
 * @param  {array} chain  Parse trees: the extending template first, its root last.
 * @return {array}        The resolved token list.
 */
exports.resolveBlocks = function (chain) {
  var last = chain.length - 1,
    defs = new Map(),
    selfNested = new Set(),
    copies = new Map(),
    compiling = new Set(),
    out = [],
    level;

  utils.each(chain, function (tpl, lvl) {
    var scan = scanBlocks(tpl, lvl === last);
    scan.defs.forEach(function (def, name) {
      if (!defs.has(name)) {
        defs.set(name, []);
      }
      // The templates are read nearest first, so the levels come in increasing order.
      defs.get(name).push({ level: lvl, token: def.token, top: def.top });
    });
    scan.selfNested.forEach(function (token) { selfNested.add(token); });
  });

  function nearest(name, lvl, prelude) {
    var list = defs.get(name) || [], i;
    for (i = 0; i < list.length; i += 1) {
      if (list[i].level < lvl || (list[i].level === lvl && list[i].top && lvl < last && !prelude)) {
        return list[i];
      }
    }
    return null;
  }
  function farther(name, lvl) {
    var list = defs.get(name) || [], rest = [], i;
    for (i = 0; i < list.length; i += 1) {
      if (list[i].level > lvl) {
        rest.push(list[i]);
      }
    }
    return rest;
  }
  function copyBlock(token, lvl, prelude) {
    var copy = copies.get(token), name;
    if (copy) {
      return copy;
    }
    name = blockKey(token);
    copy = utils.extend({}, token);
    copies.set(token, copy);
    copy.content = resolve(token.content || [], lvl, prelude);
    copy.parentChain = utils.map(farther(name, lvl), function (d) {
      var entry = { name: chain[d.level].name, blocks: {} };
      entry.blocks[name] = copyBlock(d.token, d.level);
      return entry;
    });
    copy.compile = function (compiler, args, content, parents, options, blockName, tok) {
      if (compiling.has(copy)) {
        return ir.block(name, [ir.legacyJS('throw new Error(' + JSON.stringify('Block "' + name + '" renders itself through a nested block or {% parent %}.') + ');\n')]);
      }
      compiling.add(copy);
      try {
        return token.compile(compiler, args, content, copy.parentChain, options, blockName, tok);
      } finally {
        compiling.delete(copy);
      }
    };
    return copy;
  }
  // A token whose content holds no block is kept as it is; a list where no
  // token changed is kept too.
  function resolve(list, lvl, prelude) {
    var changed = false,
      out = utils.map(list, function (token) {
        var d, copy, content;
        if (!token || typeof token !== 'object') {
          return token;
        }
        if (isBlockTag(token)) {
          changed = true;
          d = selfNested.has(token) ? null : nearest(blockKey(token), lvl, prelude);
          return d ? copyBlock(d.token, d.level) : copyBlock(token, lvl, prelude);
        }
        if (token.content && token.content.length) {
          content = resolve(token.content, lvl, prelude);
          if (content === token.content) {
            return token;
          }
          changed = true;
          copy = utils.extend({}, token);
          copy.content = content;
          return copy;
        }
        return token;
      });
    return changed ? out : list;
  }

  for (level = 0; level < last; level += 1) {
    utils.each(chain[level].blocks || {}, function (token) {
      if (!isBlockTag(token)) {
        out.push(resolve([token], level, true)[0]);
      }
    });
  }
  return out.concat(resolve(chain[last].tokens, last));
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
 * When `options.codegenMode === 'async'` the body is wrapped with
 * AsyncFunction instead so the function returns a
 * `Promise<{output: string, exports: object}>`. The exports map collects
 * top-level macros so async importers (`IRImportDeferred` /
 * `IRFromImportDeferred`) can bind them under their alias at runtime
 * without parse-time pre-resolution. Async mode is also the consumer
 * of the deferred-resolution IR shapes (IRIncludeDeferred,
 * IRImportDeferred, IRFromImportDeferred, IRExtendsDeferred) which emit
 * `await` calls into the body. The async wrapper takes a 6th positional
 * `_blocks` parameter — an optional `{name: async fn(_ctx) -> string}`
 * map of block overrides supplied by an extending child template. The
 * IRBlock async-emit consults `_blocks[name]` first and falls back to
 * the parent's inline body when no override is registered. Sync mode
 * argument list is unchanged.
 *
 * Filename attribution on compile-time failures lives on the frontend
 * per the seam rule (the caller knows which template the body came from
 * and can attach that via options.filename in its own try/catch). This
 * helper only throws whatever the wrapper constructor throws — the
 * caller can catch and rewrap.
 *
 * @param  {object|array} tokens   Parsed token tree.
 * @param  {array}  [parents]      Parent tokens from getParents().
 * @param  {object} [options]      Swig options object.
 * @return {Function}              Template function (sync) or async template function (Promise-returning).
 */
exports.buildTemplateFunction = function (tokens, parents, options) {
  if (options && options.codegenMode === 'async') {
    var opts = utils.extend({}, options),
      compiled = backend.compile(tokens, parents, opts),
      hoist = opts.blockHoist || {},
      asyncBody = '  var _ext = _swig.extensions,\n' +
      '    _output = "",\n' +
      '    _exports = {}' +
      // The definitions from nearer templates, for a block tag that repeats a
      // name (see hoistBlock in the backend).
      (hoist.nearer ? ',\n    _nearer = _blocks' : '') +
      // A template with blocks: their functions, then every definition of a
      // name, this template's and the extending templates', folded into one
      // chain per name (nested blocks included).
      (hoist.js ? ',\n    _ownBlocks = Object.create(null);\n' + hoist.js + '  _blocks = _utils.chainBlocks(_ownBlocks, _blocks);\n' : ';\n') +
      compiled + '\n' +
      '  return { output: _output, exports: _exports };\n';
    return new AsyncFunction('_swig', '_ctx', '_filters', '_utils', '_fn', '_blocks', asyncBody);
  }
  var body = '  var _ext = _swig.extensions,\n' +
    '    _output = "";\n' +
    backend.compile(tokens, parents, options) + '\n' +
    '  return _output;\n';
  return new Function('_swig', '_ctx', '_filters', '_utils', '_fn', body);
};

/**
 * Install the swig-family runtime API on a Swig instance. Called by each
 * frontend's constructor after state init (options, cache, extensions).
 *
 * The frontend supplies its per-flavor parser, tag/filter maps, option
 * validator, and a filename-attribution error wrap. Install then attaches
 * the full instance API — setFilter, setTag, setExtension, parse,
 * parseFile, precompile, compile, compileFile, render, renderFile, run,
 * invalidateCache — to `self`.
 *
 * Frontend contract:
 *   frontend.parser           Module with a `.parse(swig, src, opts, tags, filters)` method.
 *   frontend.tags             Tag map mutated by setTag.
 *   frontend.filters          Filter map mutated by setFilter.
 *   frontend.validateOptions  Per-flavor options validator. Called at every parse/setDefaults entry point.
 *   frontend.onCompileError   Invoked with (err, options) when `new Function(body)` throws. Owns filename attribution per the seam rule.
 *
 * @param  {object} self      Swig instance. Must already have `options`,
 *                            `cache`, and `extensions` populated.
 * @param  {object} frontend  Per-flavor wiring. See above.
 * @return {undefined}
 */
exports.install = function (self, frontend) {
  var parser = frontend.parser,
    tags = utils.extend({}, frontend.tags),
    filters = utils.extend({}, frontend.filters),
    validateOptions = frontend.validateOptions,
    onCompileError = frontend.onCompileError;

  // Sync renders of this instance in progress. A template rendered while one
  // runs (an include, or a render a helper starts from inside a template)
  // works on the context it is given; a render started when none is in
  // progress works on a copy of the caller's locals.
  var syncDepth = 0;

  function getLocals(options) {
    if (!options || !options.locals) {
      return self.options.locals;
    }
    return utils.extend({}, self.options.locals, options.locals);
  }

  function cacheGet(key, options) {
    return cache.cacheGet(key, options, self.options.cache, self.cache);
  }

  function cacheSet(key, options, val) {
    cache.cacheSet(key, options, val, self.options.cache, self.cache);
  }

  /*!
   * A per-render view of the instance, which async template functions receive
   * as `_swig`. Its getTemplate counts the nesting and keeps the extends chain,
   * so a render that would never end (an extends cycle, a template that
   * includes or imports itself) fails with an error instead.
   * @private
   */
  function renderView(state, chain) {
    var view = Object.create(self);
    view.getTemplate = function (pathname, options) {
      var resolved;
      try {
        resolved = self.options.loader.resolve(pathname, (options || {}).resolveFrom);
      } catch (e) {
        return Promise.reject(e);
      }
      if (state.nesting >= MAX_ASYNC_NESTING) {
        return Promise.reject(new Error('Template "' + resolved + '" is nested more than ' + MAX_ASYNC_NESTING + ' levels deep: a template probably includes, imports or extends itself.'));
      }
      return self.getTemplate(pathname, options).then(function (fn) {
        return function (locals, blocks) {
          // An extending template passes its blocks; an include or an import does not.
          var extending = arguments.length > 1;
          if (extending && chain.indexOf(resolved) !== -1) {
            throw new Error('Illegal circular extends of "' + resolved + '".');
          }
          state.nesting += 1;
          // The count goes back down whether the template renders or fails.
          return Promise.resolve().then(function () {
            return fn(locals, blocks, renderView(state, extending ? chain.concat([resolved]) : []));
          }).then(function (result) {
            state.nesting -= 1;
            return result;
          }, function (err) {
            state.nesting -= 1;
            throw err;
          });
        };
      });
    };
    return view;
  }

  function getParentsInternal(tokens, options) {
    return exports.getParents(tokens, options, {
      resolve: function (to, from) { return self.options.loader.resolve(to, from); },
      parseFile: self.parseFile,
      cacheGet: cacheGet
    });
  }

  self.invalidateCache = function () {
    if (self.options.cache === 'memory') {
      self.cache = {};
    }
  };

  /*!
   * Wrap a pre-compiled template function in the locals-binding call shape
   * cached entries have — include-emitted code invokes them as
   * `(context)`, so the raw five-argument function is the wrong shape.
   * @private
   */
  function buildRegistered(fn) {
    var context = getLocals(),
      contextLength = utils.keys(context).length,
      asyncFn = fn instanceof AsyncFunction;

    return function registered(locals, blocks) {
      var lcls;
      if (locals && contextLength) {
        lcls = utils.extend({}, context, locals);
      } else if (locals && !contextLength) {
        // A copy at the top of a render: the names the render sets ({% set %},
        // macros, loop names) must not land in the caller's object, where a
        // later render given the same object would read them and two async
        // renders given one object would read each other's.
        // An include, rendered while its includer's sync render runs, shares
        // its includer's context.
        // lcls = locals;
        lcls = (!asyncFn && syncDepth) ? locals : utils.copyContext(locals);
      } else if (!locals && contextLength) {
        // A copy: the default locals object is shared by every render of this
        // instance, so a render's own writes ({% set %}, macros, loop names)
        // must not land in it.
        // lcls = context;
        lcls = copyLocals(context);
      } else {
        lcls = {};
      }
      if (asyncFn) {
        // A per-render view, as compiled() gives an async template, so the
        // templates it includes or imports belong to the same render.
        return fn(renderView({ nesting: 0 }, []), lcls, filters, utils, efn, blocks);
      }
      syncDepth += 1;
      try {
        return fn(self, lcls, filters, utils, efn, blocks);
      } finally {
        syncDepth -= 1;
      }
    };
  }

  /*!
   * Shared argument checks for register / registerBundle, so a bundle can be
   * validated in full before any entry is committed.
   * @private
   */
  function validateRegistration(path, fn) {
    if (typeof path !== 'string' || !path.length) {
      throw new Error('Template registration path must be a non-empty string.');
    }
    if (typeof fn !== 'function') {
      throw new Error('Registered template for "' + path + '" is not a function. Pass a pre-compiled template function.');
    }
    if (!self.options.cache) {
      throw new Error('Cannot register templates while caching is disabled (cache: ' + self.options.cache + '). The registry is the compile cache.');
    }
  }

  /**
   * Register a pre-compiled template function under a template path so
   * later `include` lookups and `compileFile` / `renderFile` calls are
   * served from the template cache without compiling. The path is
   * normalized through the active loader's `resolve` so a registration
   * and an include-site lookup agree on the cache key.
   *
   * The registered entry is stored as a locals-binding wrapper with the
   * same call contract as `compile`'s cached closure — `include`-emitted
   * code invokes cached entries as `(context)`, so caching the raw
   * five-argument template function (what `run`'s priming side effect
   * stores) breaks any partial that touches `_ctx` / `_filters`. The
   * wrapper closes over this instance's filters and default locals,
   * mirroring `compiled(locals, blocks)` below.
   *
   * Throws when caching is disabled on the instance (any falsy `cache`) —
   * the registry IS the compile cache, so nothing could retain the
   * registration. `invalidateCache()` therefore also drops every
   * registration made against the built-in memory cache.
   *
   * A registered entry cannot serve as an `{% extends %}` parent: it carries
   * no parse tree, so the parent's source must still be reachable through
   * the loader.
   *
   * @param  {string}   path  Template path to register under.
   * @param  {function} fn    Pre-compiled template function (CLI/AOT output).
   * @return {object}         The instance, for chaining.
   */
  self.register = function (path, fn) {
    validateRegistration(path, fn);

    cacheSet(self.options.loader.resolve(path), {}, buildRegistered(fn));
    return self;
  };

  /**
   * Register a map of pre-compiled template functions — the shape the
   * CLI's `--recursive --register` bundle produces.
   *
   * Every entry is validated before any is committed, so a malformed bundle
   * leaves the registry untouched instead of half-populated.
   *
   * @param  {object} map  `{ path: templateFn }` pairs.
   * @return {object}      The instance, for chaining.
   */
  self.registerBundle = function (map) {
    var entries = [];

    if (!map || typeof map !== 'object') {
      throw new Error('Template bundle must be an object of { path: templateFn } pairs.');
    }

    utils.each(map, function (fn, path) {
      entries.push([path, fn]);
      validateRegistration(path, fn);
    });

    utils.each(entries, function (entry) {
      self.register(entry[0], entry[1]);
    });
    return self;
  };

  self.setFilter = function (name, method) {
    if (typeof method !== "function") {
      throw new Error('Filter "' + name + '" is not a valid function.');
    }
    filters[name] = method;
  };

  self.setTag = function (name, parse, compile, ends, blockLevel) {
    if (typeof parse !== 'function') {
      throw new Error('Tag "' + name + '" parse method is not a valid function.');
    }
    if (typeof compile !== 'function') {
      throw new Error('Tag "' + name + '" compile method is not a valid function.');
    }
    tags[name] = {
      parse: parse,
      compile: compile,
      ends: ends || false,
      block: !!blockLevel
    };
  };

  self.setExtension = function (name, object) {
    self.extensions[name] = object;
  };

  self.parse = function (source, options) {
    validateOptions(options);

    var locals = getLocals(options),
      opts = {},
      k;

    for (k in options) {
      if (options.hasOwnProperty(k) && k !== 'locals') {
        opts[k] = options[k];
      }
    }

    options = utils.extend({}, self.options, opts);
    options.locals = locals;

    return parser.parse(self, source, options, tags, filters);
  };

  self.parseFile = function (pathname, options) {
    var src;

    if (!options) {
      options = {};
    }

    pathname = self.options.loader.resolve(pathname, options.resolveFrom);
    src = self.options.loader.load(pathname);

    if (!options.filename) {
      options = utils.extend({ filename: pathname }, options);
    }

    return self.parse(src, options);
  };

  self.precompile = function (source, options) {
    var tokens = self.parse(source, options),
      parents,
      tpl;

    if (options && options.codegenMode === 'async') {
      // The block functions the backend hoists while compiling this template
      // (backend hoistBlock); written at the top of the body below.
      options = utils.extend({}, options, { blockHoist: { js: '', nearer: false, off: false } });
      markBlockRoles(tokens);
    }
    if (options && options.codegenMode === 'async' && tokens.parent) {
      // Async extends — defer parent walking and block remapping to
      // runtime via the IRExtendsDeferred emit branch in backend.js.
      // The deferred node carries the child's blocks + non-block
      // preludes; the backend resolves the parent via _swig.getTemplate
      // and threads block overrides through the _blocks parameter
      // contract.
      parents = [];
      tokens.tokens = [buildExtendsDeferred(tokens, options)];
    } else {
      if (tokens.parentExpr) {
        // A dynamic {% extends %} path lowered to tokens.parentExpr can
        // only resolve at render time. The sync precompile path walks the
        // parent chain at compile time, before any runtime value exists,
        // so a dynamic parent is unresolvable here — fail with a pointer
        // to the async render path rather than a cryptic not-found.
        throw new Error('Dynamic {% extends %} requires the async render path — use renderFile(path, locals, cb) with a loader that sets loader.async === true.');
      }
      parents = getParentsInternal(tokens, options);
      if (parents.length) {
        tokens.tokens = exports.resolveBlocks([tokens].concat(parents));
      }
    }

    try {
      tpl = exports.buildTemplateFunction(tokens, parents, options);
    } catch (e) {
      onCompileError(e, options);
    }

    return { tpl: tpl, tokens: tokens };
  };

  self.compile = function (source, options) {
    var key = (options && options.filename) ? compileCacheKey(options.filename, options) : null,
      cached = key ? cacheGet(key, options) : null,
      context,
      contextLength,
      asyncTpl,
      pre;

    if (cached) {
      return bindOptionLocals(cached, options);
    }

    // The function this call caches serves every later call with the same
    // filename, so it takes only the instance's default locals; with the
    // locals of this call's options it rendered them for every later caller
    // (bindOptionLocals binds them to this call's function instead).
    // context = getLocals(options);
    context = self.options.locals;
    contextLength = utils.keys(context).length;
    pre = self.precompile(source, options);
    asyncTpl = !!(options && options.codegenMode === 'async');

    function compiled(locals, blocks, view) {
      var lcls;
      if (locals && contextLength) {
        lcls = utils.extend({}, context, locals);
      } else if (locals && !contextLength) {
        // A copy at the top of a render: the names the render sets ({% set %},
        // macros, loop names) must not land in the caller's object, where a
        // later render given the same object would read them and two async
        // renders given one object would read each other's.
        // A template of the same render (a sync include rendered while its
        // includer runs, or an async one given the render's view) shares the
        // context it is given.
        // lcls = locals;
        lcls = (asyncTpl ? view : syncDepth) ? locals : utils.copyContext(locals);
      } else if (!locals && contextLength) {
        // A copy: the default locals object is shared by every render of this
        // instance, so a render's own writes ({% set %}, macros, loop names)
        // must not land in it.
        // lcls = context;
        lcls = copyLocals(context);
      } else {
        lcls = {};
      }
      // `blocks` is the optional async-mode block-override map supplied
      // by an extending child template's IRExtendsDeferred-emitted
      // `_parent(_ctx, _blocks)` call. Sync templates ignore the
      // extra positional arg (regular Function discards unread args);
      // async wrapper picks it up as `_blocks` and consults it from
      // IRBlock emits.
      if (asyncTpl) {
        return pre.tpl(view || renderView({ nesting: 0 }, []), lcls, filters, utils, efn, blocks);
      }
      syncDepth += 1;
      try {
        return pre.tpl(self, lcls, filters, utils, efn, blocks);
      } finally {
        syncDepth -= 1;
      }
    }

    utils.extend(compiled, pre.tokens);

    if (key) {
      cacheSet(key, options, compiled);
    }

    return bindOptionLocals(compiled, options);
  };

  self.compileFile = function (pathname, options, cb) {
    var src, cached;

    if (!options) {
      options = {};
    }

    pathname = self.options.loader.resolve(pathname, options.resolveFrom);
    if (!options.filename) {
      options = utils.extend({ filename: pathname }, options);
    }
    cached = cacheGet(compileCacheKey(pathname, options), options);

    if (cached) {
      cached = bindOptionLocals(cached, options);
      if (cb) {
        cb(null, cached);
        return;
      }
      return cached;
    }

    if (cb) {
      self.options.loader.load(pathname, function (err, src) {
        if (err) {
          cb(err);
          return;
        }
        var compiled;

        try {
          compiled = self.compile(src, options);
        } catch (err2) {
          cb(err2);
          return;
        }

        cb(err, compiled);
      });
      return;
    }

    src = self.options.loader.load(pathname);
    return self.compile(src, options);
  };

  /**
   * Async-codegen runtime helper. Resolves a template path via the active
   * loader (cb-shape preferred when supported, sync fallback otherwise),
   * compiles the source in async-codegen mode, and returns a Promise that
   * resolves to the compiled async template function. The compiled
   * function, when called, returns a `Promise<{output: string, exports:
   * object}>` — `output` is the rendered text, `exports` is the
   * top-level-macro map used by `IRImportDeferred` /
   * `IRFromImportDeferred` callers.
   *
   * Called from compiled bodies emitted for `IRIncludeDeferred`,
   * `IRImportDeferred`, `IRFromImportDeferred` (and, in a subsequent
   * slice, `IRExtendsDeferred`) when an async-mode template needs to
   * load a child template at render time.
   *
   * Cache semantics — a compiled template is kept in the instance's cache
   * like any other, under the key of the async mode (see `compileCacheKey`),
   * so a template is loaded and compiled once and a compile in either mode is
   * never served the other mode's function. `cache: false` on the instance or
   * in `options` loads and compiles on every call.
   *
   * @param  {string} pathname    Template path; resolved via the active loader.
   * @param  {object} [options]   Per-call options. Honored: `resolveFrom`,
   *                              `filename`. Inherits `self.options` for the rest.
   * @return {Promise<Function>}  Resolves with the compiled async template fn.
   */
  self.getTemplate = function (pathname, options) {
    options = options || {};

    var resolved;
    try {
      resolved = self.options.loader.resolve(pathname, options.resolveFrom);
    } catch (e) {
      return Promise.reject(e);
    }

    var compileOpts = utils.extend({}, options, {
        filename: options.filename || resolved,
        codegenMode: 'async'
      }),
      cached = cacheGet(compileCacheKey(compileOpts.filename, compileOpts), compileOpts);

    if (cached) {
      return Promise.resolve(bindOptionLocals(cached, compileOpts));
    }

    return new Promise(function (resolve, reject) {
      function onLoaded(err, src) {
        if (err) {
          reject(err);
          return;
        }
        var compiled;
        try {
          compiled = self.compile(src, compileOpts);
        } catch (err2) {
          reject(err2);
          return;
        }
        resolve(compiled);
      }

      if (self.options.loader.load.length >= 2) {
        try {
          self.options.loader.load(resolved, onLoaded);
        } catch (e) {
          onLoaded(e);
        }
      } else {
        var src;
        try {
          src = self.options.loader.load(resolved);
        } catch (e) {
          onLoaded(e);
          return;
        }
        onLoaded(null, src);
      }
    });
  };

  self.render = function (source, options) {
    return self.compile(source, options)();
  };

  self.renderFile = function (pathName, locals, cb) {
    if (cb) {
      // Async loader opt-in: route through getTemplate when
      // loader.async === true. Explicit flag only — load.length is
      // not a dispatch signal (the built-in fs + memory loaders are
      // dual-mode with length 2 and must keep the sync-cb path).
      if (self.options.loader && self.options.loader.async === true) {
        self.getTemplate(pathName)
          .then(function (fn) { return fn(locals); })
          .then(function (result) { cb(null, result.output); })
          .catch(cb);
        return;
      }

      self.compileFile(pathName, {}, function (err, fn) {
        var result;

        if (err) {
          cb(err);
          return;
        }

        try {
          result = fn(locals);
        } catch (err2) {
          cb(err2);
          return;
        }

        cb(null, result);
      });
      return;
    }

    return self.compileFile(pathName)(locals);
  };

  self.run = function (tpl, locals, filepath) {
    // A copy when no locals are given: getLocals returns the shared default
    // locals object itself, and the template's writes must not land in it.
    // var context = getLocals({ locals: locals });
    var context = locals ? getLocals({ locals: locals }) : copyLocals(getLocals());
    if (filepath) {
      // Cache the same wrapper `register` stores, under the same resolved
      // key, so a template primed this way is actually usable by a later
      // include instead of crashing on the raw function's argument shape.
      cacheSet(self.options.loader.resolve(filepath), {}, buildRegistered(tpl));
    }
    if (tpl instanceof AsyncFunction) {
      // A per-render view, as compiled() gives an async template, so the
      // templates it includes or imports belong to the same render.
      return tpl(renderView({ nesting: 0 }, []), context, filters, utils, efn);
    }
    syncDepth += 1;
    try {
      return tpl(self, context, filters, utils, efn);
    } finally {
      syncDepth -= 1;
    }
  };
};
