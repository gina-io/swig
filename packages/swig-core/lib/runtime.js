var utils = require('./utils'),
  cache = require('./cache'),
  memoryLoader = require('./loaders/memory');

/**
 * Runtime-only engine factory for the @rhinostone/swig family.
 *
 * Builds an instance that EXECUTES pre-compiled templates against a
 * registration cache and contains no lexer, parser, or code generator —
 * a browser bundle built from this module ships no `new Function`, so
 * pages under a strict Content-Security-Policy (no `unsafe-eval`) can
 * render AOT-compiled templates. Every compiling entry point is a stub
 * that throws a clear error pointing at the CLI-plus-register workflow.
 *
 * Mirrors the relevant engine.js contracts:
 *   - `register` stores the same locals-binding wrapper shape that
 *     `compile`'s cached closure has (what include-emitted code calls).
 *   - `compileFile` resolves through the active loader, then serves the
 *     cache; a miss throws instead of falling through to a compiler.
 *   - `run(tpl, locals, filepath)` matches engine semantics.
 *
 * The default loader is a memory loader rooted at "/", so registration
 * keys and include lookups both flatten to root-relative paths — the
 * exact keys a `swig compile --recursive --register` bundle carries.
 */

/*!
 * Empty function used as a fallback in compiled template code.
 */
function efn() { return ''; }

/*!
 * Build the error every unavailable compiling entry point throws.
 */
function noCompiler(what) {
  return new Error(what + ' — the runtime-only build has no compiler. Precompile with the swig CLI (swig compile --recursive --register) and register the output, or load the full swig bundle instead.');
}

/**
 * Create a runtime-only instance.
 *
 * @param  {object} frontend            Per-flavor wiring.
 * @param  {object} frontend.filters    The flavor's filter catalog.
 * @param  {object} [frontend.defaults] Option overrides (locals, cache, loader).
 * @return {object}                     The runtime instance.
 */
exports.create = function (frontend) {
  var filters = utils.extend({}, frontend.filters),
    self = {};

  function validateRuntimeOptions(options) {
    if (!options) {
      return;
    }
    if (options.hasOwnProperty('loader') && options.loader) {
      if (!options.loader.load || !options.loader.resolve) {
        throw new Error('Invalid loader option ' + JSON.stringify(options.loader) + ' found. Expected { load: function (pathname, cb) { ... }, resolve: function (to, from) { ... } }.');
      }
    }
    if (options.hasOwnProperty('cache') && options.cache && options.cache !== 'memory') {
      if (!options.cache.get || !options.cache.set) {
        throw new Error('Invalid cache option ' + JSON.stringify(options.cache) + ' found. Expected "memory" or { get: function (key) { ... }, set: function (key, value) { ... } }.');
      }
    }
  }

  validateRuntimeOptions(frontend.defaults);

  self.options = utils.extend({
    autoescape: true,
    locals: {},
    cache: 'memory',
    loader: memoryLoader({}, '/')
  }, frontend.defaults || {});

  self.cache = {};
  self.extensions = {};

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

  self.setDefaults = function (options) {
    validateRuntimeOptions(options);
    self.options = utils.extend(self.options, options || {});
  };

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

  self.setExtension = function (name, object) {
    self.extensions[name] = object;
  };

  /**
   * Register a pre-compiled template function under a template path.
   * Mirrors the engine.js register contract — see that JSDoc for the
   * key-normalization and wrapper-shape rationale.
   *
   * @param  {string}   path  Template path to register under.
   * @param  {function} fn    Pre-compiled template function (CLI/AOT output).
   * @return {object}         The instance, for chaining.
   */
  self.register = function (path, fn) {
    if (typeof path !== 'string' || !path.length) {
      throw new Error('Template registration path must be a non-empty string.');
    }
    if (typeof fn !== 'function') {
      throw new Error('Registered template for "' + path + '" is not a function. Pass a pre-compiled template function.');
    }
    if (self.options.cache === false) {
      throw new Error('Cannot register templates while caching is disabled (cache: false).');
    }

    var context = getLocals(),
      contextLength = utils.keys(context).length;

    function registered(locals, blocks) {
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
      return fn(self, lcls, filters, utils, efn, blocks);
    }

    cacheSet(self.options.loader.resolve(path), {}, registered);
    return self;
  };

  /**
   * Register a map of pre-compiled template functions — the shape the
   * CLI's `--recursive --register` bundle produces.
   *
   * @param  {object} map  `{ path: templateFn }` pairs.
   * @return {object}      The instance, for chaining.
   */
  self.registerBundle = function (map) {
    utils.each(map, function (fn, path) {
      self.register(path, fn);
    });
    return self;
  };

  self.run = function (tpl, locals, filepath) {
    var context = getLocals({ locals: locals });
    if (filepath) {
      cacheSet(filepath, {}, tpl);
    }
    return tpl(self, context, filters, utils, efn);
  };

  self.compileFile = function (pathname, options, cb) {
    var resolved, cached, err;

    if (!options) {
      options = {};
    }

    resolved = self.options.loader.resolve(pathname, options.resolveFrom);
    cached = cacheGet(resolved, options);

    if (cached) {
      if (cb) {
        cb(null, cached);
        return;
      }
      return cached;
    }

    err = noCompiler('Template "' + pathname + '" is not registered');
    if (cb) {
      cb(err);
      return;
    }
    throw err;
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

  self.getTemplate = function (pathname) {
    return Promise.reject(noCompiler('Async template loading of "' + pathname + '" is unavailable'));
  };

  self.parse = function () { throw noCompiler('parse() is unavailable'); };
  self.parseFile = function () { throw noCompiler('parseFile() is unavailable'); };
  self.precompile = function () { throw noCompiler('precompile() is unavailable'); };
  self.compile = function () { throw noCompiler('compile() is unavailable'); };
  self.render = function () { throw noCompiler('render(source) is unavailable'); };
  self.setTag = function () { throw noCompiler('setTag() is parse-time machinery and is unavailable'); };

  return self;
};
