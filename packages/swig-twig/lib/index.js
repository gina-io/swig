/**
 * @rhinostone/swig-twig — Twig frontend for the @rhinostone/swig family.
 *
 * Phase 3 Session 17: end-to-end render wiring (Path A). The package now
 * exposes a Twig constructor + default instance via `engine.install(self,
 * frontend)` from @rhinostone/swig-core, so callers can `render(source,
 * locals)` / `renderFile(path, locals, cb)` directly against Twig syntax.
 *
 * See .claude/architecture/multi-flavor-ir.md § Phase 3 for the per-flavor
 * split decision.
 */

var utils = require('@rhinostone/swig-core/lib/utils'),
  engine = require('@rhinostone/swig-core/lib/engine'),
  loaders = require('@rhinostone/swig-core/lib/loaders'),
  dateformatter = require('@rhinostone/swig-core/lib/dateformatter'),
  parser = require('./parser'),
  _tags = require('./tags'),
  _filters = require('./filters');

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
exports.render = defaultInstance.render;
exports.renderFile = defaultInstance.renderFile;
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

/**
 * Parse a Twig source string into the parse-tree shape consumed by
 * swig-core's `engine.compile`: `{ name, parent, tokens, blocks }`.
 *
 * Retained from Path B for backward compat with callers that pass
 * `options.tags` / `options.filters` overrides. The full-instance path
 * (`defaultInstance.parse` via engine.install) uses closure-captured
 * maps and does not honor overrides — prefer `new exports.Twig(opts)`
 * for per-instance customisation. Scheduled for retirement once
 * dependents migrate (#T16 Session 17 C3).
 *
 * @param  {string} source     Twig template source.
 * @param  {object} [options]  Per-call options.
 * @return {object}            `{ name, parent, tokens, blocks }`.
 */
exports.parse = function (source, options) {
  options = options || {};
  var tags = options.tags || exports.tags;
  var filters = options.filters || exports.filters;
  return exports.parser.parse(undefined, source, options, tags, filters);
};
