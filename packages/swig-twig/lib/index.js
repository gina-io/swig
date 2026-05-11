/**
 * @rhinostone/swig-twig — Twig frontend for the @rhinostone/swig family.
 *
 * Phase 3 Session 17: end-to-end render wiring (Path A). The package now
 * exposes a Twig constructor + default instance via `engine.install(self,
 * frontend)` from @rhinostone/swig-core, so callers can `render(source,
 * locals)` / `renderFile(path, locals, cb)` directly against Twig syntax.
 */

var utils = require('@rhinostone/swig-core/lib/utils'),
  engine = require('@rhinostone/swig-core/lib/engine'),
  loaders = require('@rhinostone/swig-core/lib/loaders'),
  dateformatter = require('@rhinostone/swig-core/lib/dateformatter'),
  parser = require('./parser'),
  _tags = require('./tags'),
  _filters = require('./filters'),
  _tests = require('./tests'),
  preWalker = require('./async/pre-walker');

exports.name = 'twig';

/**
 * Expression-level parser — Pratt-style recursive descent that consumes
 * Twig lexer tokens and returns swig-core IRExpr nodes.
 *
 * @type {object}
 */
exports.parser = parser;

/**
 * Built-in Twig tag registry.
 *
 * @type {object}
 */
exports.tags = _tags;

/**
 * Built-in Twig filter catalog.
 *
 * @type {object}
 */
exports.filters = _filters;

/**
 * Template loaders re-exported from swig-core.
 *
 * @type {object}
 */
exports.loaders = loaders;

var defaultOptions = {
    autoescape: true,
    varControls: ['{{', '}}'],
    tagControls: ['{%', '%}'],
    cmtControls: ['{#', '#}'],
    locals: {},
    cache: 'memory',
    loader: loaders.fs()
  },
  defaultInstance;

/**
 * Validate the Twig options object.
 *
 * @param  {?object} options Twig options object.
 * @return {undefined}      Throws on malformed input.
 * @private
 */
function validateOptions(options) {
  if (!options) {
    return;
  }

  utils.each(['varControls', 'tagControls', 'cmtControls'], function (key) {
    if (!options.hasOwnProperty(key)) {
      return;
    }
    if (!utils.isArray(options[key]) || options[key].length !== 2) {
      throw new Error('Option "' + key + '" must be an array containing 2 different control strings.');
    }
    if (options[key][0] === options[key][1]) {
      throw new Error('Option "' + key + '" open and close controls must not be the same.');
    }
    utils.each(options[key], function (a, i) {
      if (a.length < 2) {
        throw new Error('Option "' + key + '" ' + ((i) ? 'open ' : 'close ') + 'control must be at least 2 characters. Saw "' + a + '" instead.');
      }
    });
  });

  if (options.hasOwnProperty('cache')) {
    if (options.cache && options.cache !== 'memory') {
      if (!options.cache.get || !options.cache.set) {
        throw new Error('Invalid cache option ' + JSON.stringify(options.cache) + ' found. Expected "memory" or { get: function (key) { ... }, set: function (key, value) { ... } }.');
      }
    }
  }
  if (options.hasOwnProperty('loader')) {
    if (options.loader) {
      if (!options.loader.load || !options.loader.resolve) {
        throw new Error('Invalid loader option ' + JSON.stringify(options.loader) + ' found. Expected { load: function (pathname, cb) { ... }, resolve: function (to, from) { ... } }.');
      }
    }
  }
}

/**
 * Set defaults for the base and all new Twig environments.
 *
 * @param  {object} [options={}] Twig options object.
 * @return {undefined}
 */
exports.setDefaults = function (options) {
  validateOptions(options);
  defaultInstance.options = utils.extend(defaultInstance.options, options);
};

/**
 * Set the default TimeZone offset for date formatting via the date filter.
 * Mutates the shared dateformatter's tzOffset — affects every frontend
 * (native swig + swig-twig) because both consume the same module instance.
 *
 * @param  {number} offset Offset from GMT, in minutes (west of GMT).
 * @return {undefined}
 */
exports.setDefaultTZOffset = function (offset) {
  dateformatter.tzOffset = offset;
};

/**
 * Create a new, separate Twig compile/render environment.
 *
 * @example
 * var twig = require('@rhinostone/swig-twig');
 * var mytwig = new twig.Twig({ autoescape: false });
 * mytwig.render('Hello {{ name }}', { locals: { name: 'world' }});
 *
 * @param  {object} [opts={}] Twig options object.
 * @return {object}           New Twig environment.
 */
exports.Twig = function (opts) {
  var self = this;
  validateOptions(opts);
  this.options = utils.extend({}, defaultOptions, opts || {});
  this.cache = {};
  this.extensions = {};

  engine.install(this, {
    parser: parser,
    tags: _tags,
    filters: _filters,
    validateOptions: validateOptions,
    onCompileError: function (err, options) {
      utils.throwError(err, null, options.filename);
    }
  });

  // Register Twig `is <name>` runtime helpers as `_ext._test_<name>`. The
  // parser lowers `foo is odd` to a two-segment VarRef + FnCall pointing
  // at this slot, so the helpers must be installed on every Twig
  // instance (including the default one). `setExtension` attaches to the
  // per-instance `extensions` map — consumers can still override a test
  // with their own `setExtension('_test_<name>', fn)` after construction.
  utils.each(_tests, function (fn, name) {
    self.setExtension('_test_' + name, fn);
  });

  function buildScanOpts() {
    return {
      varControls: self.options.varControls,
      tagControls: self.options.tagControls,
      cmtControls: self.options.cmtControls,
      rawTag: 'verbatim',
      keywords: ['extends', 'include', 'import', 'from']
    };
  }

  /**
   * Render a Twig template file asynchronously, supporting async loaders.
   *
   * Pre-walks <code>extends</code> / <code>include</code> /
   * <code>import</code> / <code>from</code> targets in parallel via the
   * user loader, populates an in-memory map, then runs the existing sync
   * render pipeline against the populated map. Dynamic paths
   * (<code>{% extends parent_var %}</code>) are not pre-resolved and will
   * throw at render time as they would on the sync path.
   *
   * @deprecated since 2.2.0 — use {@link Twig#renderFile} with a loader that
   *   sets <code>loader.async === true</code>. The async-codegen dispatch
   *   handles dynamic include paths the pre-walker cannot. This method will
   *   be removed in 3.0.
   *
   * @example
   * twig.setDefaults({ loader: myAsyncLoader });
   * twig.renderFileAsync('page.twig', { name: 'world' }, function (err, output) {
   *   if (err) { return done(err); }
   *   res.end(output);
   * });
   *
   * @param  {string}   pathName  Template path; resolved via the active loader.
   * @param  {object}   [locals]  Locals to render with.
   * @param  {Function} cb        Node-style callback <code>(err, output)</code>.
   * @return {undefined}
   */
  this.renderFileAsync = function (pathName, locals, cb) {
    if (typeof locals === 'function') {
      cb = locals;
      locals = undefined;
    }

    var loader = self.options.loader;
    var entry;

    try {
      entry = loader.resolve(pathName);
    } catch (e) {
      cb(e);
      return;
    }

    preWalker.walk(entry, loader, buildScanOpts()).then(function (memMap) {
      var memWrapper = preWalker.makeMemoryWrapper(loader, memMap);
      var origLoader = self.options.loader;
      self.options.loader = memWrapper;
      var output, error;
      try {
        output = self.renderFile(entry, locals);
      } catch (e) {
        error = e;
      }
      self.options.loader = origLoader;
      if (error) {
        cb(error);
        return;
      }
      cb(null, output);
    }, function (err) {
      cb(err);
    });
  };

  /**
   * Compile a Twig template file asynchronously, supporting async loaders.
   *
   * Same pre-walk / memory-wrapper / sync-pipeline shape as
   * {@link Twig#renderFileAsync}. Returns the compiled function (via
   * <var>cb</var>) that takes a locals object and yields a rendered
   * string. The returned function captures the pre-walked memory map and
   * temporarily swaps the loader on each call, so subsequent runtime
   * <code>include</code>s resolve correctly without re-running the
   * pre-walk.
   *
   * @deprecated since 2.2.0 — use {@link Twig#compileFile} with
   *   <code>options.codegenMode === 'async'</code> on a loader that sets
   *   <code>loader.async === true</code>. The returned compiled function
   *   yields a <code>Promise&lt;{output, exports}&gt;</code> instead of a
   *   string. This method will be removed in 3.0.
   *
   * @example
   * twig.compileFileAsync('page.twig', {}, function (err, fn) {
   *   if (err) { return done(err); }
   *   res.end(fn({ name: 'world' }));
   * });
   *
   * @param  {string}   pathName  Template path.
   * @param  {object}   [options] Compilation options.
   * @param  {Function} cb        Node-style callback <code>(err, fn)</code>.
   * @return {undefined}
   */
  this.compileFileAsync = function (pathName, options, cb) {
    if (typeof options === 'function') {
      cb = options;
      options = {};
    }

    var loader = self.options.loader;
    var entry;

    try {
      entry = loader.resolve(pathName);
    } catch (e) {
      cb(e);
      return;
    }

    preWalker.walk(entry, loader, buildScanOpts()).then(function (memMap) {
      var memWrapper = preWalker.makeMemoryWrapper(loader, memMap);
      var origLoader = self.options.loader;
      self.options.loader = memWrapper;
      var compiled, error;
      try {
        compiled = self.compileFile(entry, options);
      } catch (e) {
        error = e;
      }
      self.options.loader = origLoader;
      if (error) {
        cb(error);
        return;
      }
      var wrapped = function (locals) {
        var origInner = self.options.loader;
        self.options.loader = memWrapper;
        try {
          var output = compiled(locals);
          self.options.loader = origInner;
          return output;
        } catch (e) {
          self.options.loader = origInner;
          throw e;
        }
      };
      cb(null, wrapped);
    }, function (err) {
      cb(err);
    });
  };
};

/*!
 * Export methods publicly via the default instance.
 */
defaultInstance = new exports.Twig();
exports.setFilter = defaultInstance.setFilter;
exports.setTag = defaultInstance.setTag;
exports.setExtension = defaultInstance.setExtension;
exports.parseFile = defaultInstance.parseFile;
exports.precompile = defaultInstance.precompile;
exports.compile = defaultInstance.compile;
exports.compileFile = defaultInstance.compileFile;
exports.compileFileAsync = defaultInstance.compileFileAsync;
exports.render = defaultInstance.render;
exports.renderFile = defaultInstance.renderFile;
exports.renderFileAsync = defaultInstance.renderFileAsync;
exports.run = defaultInstance.run;
exports.invalidateCache = defaultInstance.invalidateCache;

/**
 * Express 3/4 compatibility alias.
 *
 * @example
 * app.engine('twig', require('@rhinostone/swig-twig').__express);
 * app.set('view engine', 'twig');
 */
exports.__express = defaultInstance.renderFile;
