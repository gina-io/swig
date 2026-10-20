/**
 * @rhinostone/swig-core — shared IR, backend, and runtime for the swig
 * family of template engines.
 *
 * Initial scaffold. Subsequent commits move security guards, loader
 * contract, filter infra, cache, and the JS-codegen backend in from
 * @rhinostone/swig.
 */

/**
 * Package version number as a string. The packages of the family are
 * released together, so they share one version.
 * @example
 * if (require('@rhinostone/swig-core').version === "2.8.2") { ... }
 *
 * @type {String}
 */
exports.version = "2.8.1";

exports.utils = require('./utils');
exports.security = require('./security');
exports.ir = require('./ir');
exports.tokentypes = require('./tokentypes');
exports.tokenparser = require('./tokenparser');
exports.loaders = require('./loaders');
exports.filters = require('./filters');
exports.dateformatter = require('./dateformatter');
exports.backend = require('./backend');
exports.cache = require('./cache');
exports.engine = require('./engine');
