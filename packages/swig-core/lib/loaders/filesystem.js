var fs = require('fs'),
  path = require('path');

/**
 * Loads templates from the file system.
 * @alias swig.loaders.fs
 * @example
 * swig.setDefaults({ loader: swig.loaders.fs() });
 * @example
 * // Load Templates from a specific directory (does not require using relative paths in your templates)
 * swig.setDefaults({ loader: swig.loaders.fs(__dirname + '/templates' )});
 * @param {string}   [basepath='']     Path to the templates as string. Assigning this value allows you to use semi-absolute paths to templates instead of relative paths.
 * @param {string}   [encoding='utf8']   Template encoding
 * @param {boolean}  [allowOutsideRoot=false] When false (default) and a <var>basepath</var> is set, template paths that resolve outside the basepath root are rejected (CVE-2023-25345 path-traversal hardening). Set true to permit includes / extends that intentionally read files from outside the template root.
 */
module.exports = function (basepath, encoding, allowOutsideRoot) {
  var ret = {};

  encoding = encoding || 'utf8';
  // Resolve (not merely normalize) basepath to an absolute path. The root
  // check in resolve() compares it against path.resolve()'d template paths,
  // which are always absolute, so a relative basepath must be made absolute
  // too -- otherwise every in-root path is wrongly rejected (CVE-2023-25345
  // confinement must not break the legitimate relative-basepath mode).
  basepath = (basepath) ? path.resolve(basepath) : null;

  /**
   * Resolves <var>to</var> to an absolute path or unique identifier. This is used for building correct, normalized, and absolute paths to a given template.
   * @alias resolve
   * @param  {string} to        Non-absolute identifier or pathname to a file.
   * @param  {string} [from]    If given, should attempt to find the <var>to</var> path in relation to this given, known path.
   * @return {string}
   */
  ret.resolve = function (to, from) {
    var resolved, rootWithSep;
    if (basepath) {
      from = basepath;
    } else {
      from = (from) ? path.dirname(from) : process.cwd();
    }
    resolved = path.resolve(from, to);

    // CVE-2023-25345: reject include / extends / import paths that resolve
    // outside the configured loader root (e.g. "../../../etc/passwd"),
    // including when the path is supplied by an untrusted runtime variable
    // ({% include userVar %}). Enforced only when a basepath defines the
    // root; pass allowOutsideRoot === true to opt out for the rare case of
    // legitimately including files from outside the template root.
    if (basepath && !allowOutsideRoot) {
      rootWithSep = path.normalize(basepath + path.sep);
      if (resolved !== basepath && resolved.indexOf(rootWithSep) !== 0) {
        throw new Error('Template "' + to + '" resolves outside the loader root "' + basepath + '" (CVE-2023-25345).');
      }
    }
    return resolved;
  };

  /**
   * Loads a single template. Given a unique <var>identifier</var> found by the <var>resolve</var> method this should return the given template.
   * @alias load
   * @param  {string}   identifier  Unique identifier of a template (possibly an absolute path).
   * @param  {function} [cb]        Asynchronous callback function. If not provided, this method should run synchronously.
   * @return {string}               Template source string.
   */
  ret.load = function (identifier, cb) {
    if (!fs || (cb && !fs.readFile) || !fs.readFileSync) {
      throw new Error('Unable to find file ' + identifier + ' because there is no filesystem to read from.');
    }

    identifier = ret.resolve(identifier);

    if (cb) {
      fs.readFile(identifier, encoding, cb);
      return;
    }
    return fs.readFileSync(identifier, encoding);
  };

  return ret;
};
