var utils = require('./utils'),
  backend = require('./backend'),
  cache = require('./cache');

/**
 * Empty function used as a fallback in compiled template code.
 * @return {string} Empty string.
 * @private
 */
function efn() { return ''; }

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
      parents = getParentsInternal(tokens, options),
      tpl;

    if (parents.length) {
      tokens.tokens = exports.remapBlocks(tokens.blocks, parents[0].tokens);
      exports.importNonBlocks(tokens.blocks, tokens.tokens);
    }

    try {
      tpl = exports.buildTemplateFunction(tokens, parents, options);
    } catch (e) {
      onCompileError(e, options);
    }

    return { tpl: tpl, tokens: tokens };
  };

  self.compile = function (source, options) {
    var key = options ? options.filename : null,
      cached = key ? cacheGet(key, options) : null,
      context,
      contextLength,
      pre;

    if (cached) {
      return cached;
    }

    context = getLocals(options);
    contextLength = utils.keys(context).length;
    pre = self.precompile(source, options);

    function compiled(locals) {
      var lcls;
      if (locals && contextLength) {
        lcls = utils.extend({}, context, locals);
      } else if (locals && !contextLength) {
        lcls = locals;
      } else if (!locals && contextLength) {
        lcls = context;
      } else {
        lcls = {};
      }
      return pre.tpl(self, lcls, filters, utils, efn);
    }

    utils.extend(compiled, pre.tokens);

    if (key) {
      cacheSet(key, options, compiled);
    }

    return compiled;
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
    cached = cacheGet(pathname, options);

    if (cached) {
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

  self.render = function (source, options) {
    return self.compile(source, options)();
  };

  self.renderFile = function (pathName, locals, cb) {
    if (cb) {
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
    var context = getLocals({ locals: locals });
    if (filepath) {
      cacheSet(filepath, {}, tpl);
    }
    return tpl(self, context, filters, utils, efn);
  };
};
