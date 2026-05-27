/**
 * @rhinostone/swig-jinja2 — Jinja2 frontend for the @rhinostone/swig family.
 *
 * End-to-end render wiring (Path A): the package exposes a Jinja2
 * constructor + default instance via `engine.install(self, frontend)` from
 * @rhinostone/swig-core, so callers can `render(source, locals)` /
 * `renderFile(path, locals, cb)` directly against Jinja2 syntax.
 */

var utils = require('@rhinostone/swig-core/lib/utils'),
  engine = require('@rhinostone/swig-core/lib/engine'),
  loaders = require('@rhinostone/swig-core/lib/loaders'),
  dateformatter = require('@rhinostone/swig-core/lib/dateformatter'),
  parser = require('./parser'),
  _tags = require('./tags'),
  _filters = require('./filters'),
  _tests = require('./tests');

exports.name = 'jinja2';

/**
 * Expression-level parser — Pratt-style recursive descent that consumes
 * Jinja2 lexer tokens and returns swig-core IRExpr nodes, plus the
 * top-level `parse(swig, source, opts, tags, filters)` splitter.
 *
 * @type {object}
 */
exports.parser = parser;

/**
 * Built-in Jinja2 tag registry.
 *
 * @type {object}
 */
exports.tags = _tags;

/**
 * Built-in Jinja2 filter catalog.
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
 * Validate the Jinja2 options object.
 *
 * @param  {?object} options Jinja2 options object.
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
 * Set defaults for the base and all new Jinja2 environments.
 *
 * @param  {object} [options={}] Jinja2 options object.
 * @return {undefined}
 */
exports.setDefaults = function (options) {
  validateOptions(options);
  defaultInstance.options = utils.extend(defaultInstance.options, options);
};

/**
 * Set the default TimeZone offset for date formatting via the date filter.
 * Mutates the shared dateformatter's tzOffset — affects every frontend
 * (native swig + swig-jinja2) because both consume the same module instance.
 *
 * @param  {number} offset Offset from GMT, in minutes (west of GMT).
 * @return {undefined}
 */
exports.setDefaultTZOffset = function (offset) {
  dateformatter.tzOffset = offset;
};

/**
 * Create a new, separate Jinja2 compile/render environment.
 *
 * @example
 * var jinja2 = require('@rhinostone/swig-jinja2');
 * var myjinja2 = new jinja2.Jinja2({ autoescape: false });
 * myjinja2.render('Hello {{ name }}', { locals: { name: 'world' }});
 *
 * @param  {object} [opts={}] Jinja2 options object.
 * @return {object}           New Jinja2 environment.
 */
exports.Jinja2 = function (opts) {
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

  // Register Jinja2 `is <name>` runtime helpers as `_ext._test_<name>`.
  // setExtension attaches them to this instance's `extensions` map, so a
  // consumer can override any test per-instance with their own
  // `setExtension('_test_<name>', fn)` after construction.
  utils.each(_tests, function (fn, name) {
    self.setExtension('_test_' + name, fn);
  });
};

/*!
 * Export methods publicly via the default instance.
 */
defaultInstance = new exports.Jinja2();
exports.setFilter = defaultInstance.setFilter;
exports.setTag = defaultInstance.setTag;
exports.setExtension = defaultInstance.setExtension;
exports.parseFile = defaultInstance.parseFile;
exports.precompile = defaultInstance.precompile;
exports.compile = defaultInstance.compile;
exports.compileFile = defaultInstance.compileFile;
exports.render = defaultInstance.render;
exports.renderFile = defaultInstance.renderFile;
exports.run = defaultInstance.run;
exports.invalidateCache = defaultInstance.invalidateCache;

/**
 * Express 3/4 compatibility alias.
 *
 * @example
 * app.engine('jinja2', require('@rhinostone/swig-jinja2').__express);
 * app.set('view engine', 'jinja2');
 */
exports.__express = defaultInstance.renderFile;
