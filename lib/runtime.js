var runtime = require('@rhinostone/swig-core/lib/runtime'),
  _filters = require('./filters'),
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
