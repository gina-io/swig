/**
 * @rhinostone/swig-django — Django frontend for the @rhinostone/swig family.
 *
 * End-to-end render wiring (Path A): the package exposes a Django
 * constructor + default instance via `engine.install(self, frontend)` from
 * @rhinostone/swig-core, so callers can `render(source, locals)` /
 * `renderFile(path, locals, cb)` directly against Django syntax.
 *
 * The async loader surface (`renderFileAsync` / `compileFileAsync` + the
 * pre-walker) pre-walks the `extends` / `include` dependency graph through an
 * async loader and runs the existing sync pipeline against a populated memory
 * map. The public `renderFile(path, locals, cb)` cb-dispatch (active when
 * `loader.async === true`) is inherited from swig-core's engine.
 */

var utils = require('@rhinostone/swig-core/lib/utils'),
  engine = require('@rhinostone/swig-core/lib/engine'),
  loaders = require('@rhinostone/swig-core/lib/loaders'),
  dateformatter = require('@rhinostone/swig-core/lib/dateformatter'),
  parser = require('./parser'),
  _tags = require('./tags'),
  _filters = require('./filters'),
  preWalker = require('./async/pre-walker');

exports.name = 'django';

/**
 * Expression-level parser — Pratt-style recursive descent that consumes
 * Django lexer tokens and returns swig-core IRExpr nodes, plus the top-level
 * `parse(swig, source, opts, tags, filters)` splitter.
 *
 * @type {object}
 */
exports.parser = parser;

/**
 * Built-in Django tag registry.
 *
 * @type {object}
 */
exports.tags = _tags;

/**
 * Built-in Django filter catalog.
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
 * Validate the Django options object.
 *
 * @param  {?object} options Django options object.
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
 * Set defaults for the base and all new Django environments.
 *
 * @param  {object} [options={}] Django options object.
 * @return {undefined}
 */
exports.setDefaults = function (options) {
  validateOptions(options);
  defaultInstance.options = utils.extend(defaultInstance.options, options);
};

/**
 * Set the default TimeZone offset for date formatting via the date filter.
 * Mutates the shared dateformatter's tzOffset — affects every frontend
 * (native swig + swig-django) because both consume the same module instance.
 *
 * @param  {number} offset Offset from GMT, in minutes (west of GMT).
 * @return {undefined}
 */
exports.setDefaultTZOffset = function (offset) {
  dateformatter.tzOffset = offset;
};

/**
 * Create a new, separate Django compile/render environment.
 *
 * @example
 * var django = require('@rhinostone/swig-django');
 * var mydjango = new django.Django({ autoescape: false });
 * mydjango.render('Hello {{ name }}', { locals: { name: 'world' }});
 *
 * @param  {object} [opts={}] Django options object.
 * @return {object}           New Django environment.
 */
exports.Django = function (opts) {
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

  /*!
   * Build the pre-walker scan options for this instance. Django's verbatim
   * region tag is `verbatim`, and the only template-loading tags with a
   * string-literal path argument are `extends` and `include` (Django has no
   * Python-style `import` / `from`). @private
   */
  function buildScanOpts() {
    return {
      varControls: self.options.varControls,
      tagControls: self.options.tagControls,
      cmtControls: self.options.cmtControls,
      rawTag: 'verbatim',
      keywords: ['extends', 'include']
    };
  }

  /**
   * Render a Django template file asynchronously, supporting async loaders.
   *
   * Pre-walks `extends` / `include` targets in parallel via the user loader,
   * populates an in-memory map, then runs the existing sync render pipeline
   * against the populated map. Dynamic paths (`{% extends parent_var %}`) are
   * not pre-resolved and will throw at render time as they would on the sync
   * path.
   *
   * @deprecated since 2.7.0 — use {@link Django#renderFile} with a loader that
   *   sets `loader.async === true`. The async-codegen dispatch handles dynamic
   *   include paths the pre-walker cannot. This method will be removed in 3.0.
   *
   * @example
   * django.setDefaults({ loader: myAsyncLoader });
   * django.renderFileAsync('page.html', { name: 'world' }, function (err, output) {
   *   if (err) { return done(err); }
   *   res.end(output);
   * });
   *
   * @param  {string}   pathName  Template path; resolved via the active loader.
   * @param  {object}   [locals]  Locals to render with.
   * @param  {Function} cb        Node-style callback `(err, output)`.
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
   * Compile a Django template file asynchronously, supporting async loaders.
   *
   * Same pre-walk / memory-wrapper / sync-pipeline shape as
   * {@link Django#renderFileAsync}. Returns the compiled function (via `cb`)
   * that takes a locals object and yields a rendered string. The returned
   * function captures the pre-walked memory map and temporarily swaps the
   * loader on each call, so subsequent runtime `include`s resolve correctly
   * without re-running the pre-walk.
   *
   * @deprecated since 2.7.0 — use {@link Django#compileFile} with
   *   `options.codegenMode === 'async'` on a loader that sets
   *   `loader.async === true`. The returned compiled function yields a
   *   `Promise<{output, exports}>` instead of a string. This method will be
   *   removed in 3.0.
   *
   * @example
   * django.compileFileAsync('page.html', {}, function (err, fn) {
   *   if (err) { return done(err); }
   *   res.end(fn({ name: 'world' }));
   * });
   *
   * @param  {string}   pathName  Template path.
   * @param  {object}   [options] Compilation options.
   * @param  {Function} cb        Node-style callback `(err, fn)`.
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
defaultInstance = new exports.Django();
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
exports.register = defaultInstance.register;
exports.registerBundle = defaultInstance.registerBundle;
exports.invalidateCache = defaultInstance.invalidateCache;

/**
 * Express 3/4 compatibility alias.
 *
 * @example
 * app.engine('html', require('@rhinostone/swig-django').__express);
 * app.set('view engine', 'html');
 */
exports.__express = defaultInstance.renderFile;
