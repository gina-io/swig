var runtime = require('@rhinostone/swig-core/lib/runtime'),
  _filters = require('./filters'),
  dateformatter = require('./dateformatter'),
  loaders = require('./loaders');

/**
 * Runtime-only entry for @rhinostone/swig.
 *
 * Executes pre-compiled templates (registered via `register` /
 * `registerBundle`, typically from a `swig compile --recursive
 * --register` bundle) with the native filter catalog, and ships no
 * lexer, parser, or code generator. The browser build of this module
 * (`dist/swig.runtime.min.js`) therefore contains no `new Function` and
 * runs on pages with a strict Content-Security-Policy (no
 * `unsafe-eval`). Any compiling entry point throws a clear error.
 */

/**
 * Swig version number as a string.
 * @type {String}
 */
exports.version = "2.7.3";

/*!
 * Default runtime instance backing the module-level exports.
 */
var defaultInstance = runtime.create({ filters: _filters });

/**
 * Create an isolated runtime-only instance with its own registration
 * cache, filters, and options.
 *
 * @example
 * var rt = new swig.Swig({ locals: { site: 'Acme' } });
 * rt.registerBundle(templates);
 * rt.renderFile('page.html', { user: 'Jane' });
 *
 * @param  {object} [opts={}] Option overrides (locals, cache, loader).
 * @return {object}           A runtime-only instance.
 */
exports.Swig = function (opts) {
  return runtime.create({ filters: _filters, defaults: opts });
};

exports.loaders = loaders;

/*!
 * Export methods publicly via the default instance.
 */
exports.register = defaultInstance.register;
exports.registerBundle = defaultInstance.registerBundle;
exports.run = defaultInstance.run;
exports.compileFile = defaultInstance.compileFile;
exports.renderFile = defaultInstance.renderFile;
exports.setFilter = defaultInstance.setFilter;
exports.setExtension = defaultInstance.setExtension;
exports.setDefaults = defaultInstance.setDefaults;
exports.invalidateCache = defaultInstance.invalidateCache;

/**
 * Set the global timezone offset used by the <var>date</var> filter —
 * the one compile-free knob the full build also exposes.
 *
 * @param  {number} offset  Offset from GMT, in minutes.
 * @return {undefined}
 */
exports.setDefaultTZOffset = function (offset) {
  dateformatter.tzOffset = offset;
};

/*!
 * Compiling entry points stay on the module surface as clear-error
 * stubs, so a drop-in swap from the full build fails with the
 * no-compiler explanation instead of a bare TypeError.
 */
exports.parse = defaultInstance.parse;
exports.parseFile = defaultInstance.parseFile;
exports.precompile = defaultInstance.precompile;
exports.compile = defaultInstance.compile;
exports.render = defaultInstance.render;
exports.setTag = defaultInstance.setTag;
exports.renderFileAsync = defaultInstance.renderFileAsync;
exports.compileFileAsync = defaultInstance.compileFileAsync;
