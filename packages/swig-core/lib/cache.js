/**
 * Template cache primitives — shared across @rhinostone/swig-family engines.
 *
 * Each helper is pure: state (the memory cache object, the engine's options)
 * is passed in explicitly so the same helpers can serve multiple frontends
 * without closure state. The native Swig constructor wires its inline
 * `self.cache` + `self.options.cache` through these at each call site.
 *
 * See .claude/architecture/multi-flavor-ir.md — cache keys are opaque
 * strings; the cache layer has no filename awareness.
 */

/**
 * Determine whether caching is disabled via the per-call options or the
 * engine's default options.
 *
 * Match semantics of the previous inline closure in lib/swig.js:
 *   return (options.hasOwnProperty('cache') && !options.cache) ||
 *     !engineCache;
 *
 * @param  {object} [options]    Per-call Swig options. May have a `cache` key.
 * @param  {*}      engineCache  The engine's default `options.cache` value.
 * @return {boolean}             True if caching should be skipped.
 */
exports.shouldCache = function (options, engineCache) {
  options = options || {};
  return (options.hasOwnProperty('cache') && !options.cache) || !engineCache;
};

/**
 * Read a compiled template from the cache.
 *
 * @param  {string} key          Resolved template identifier.
 * @param  {object} [options]    Per-call Swig options.
 * @param  {*}      engineCache  The engine's default `options.cache` value
 *                               (`'memory'`, `false`, or a `{ get, set }` object).
 * @param  {object} memoryStore  The engine's in-memory cache map
 *                               (used only when engineCache === 'memory').
 * @return {object|undefined}    Cached compiled template, or undefined on miss.
 */
exports.cacheGet = function (key, options, engineCache, memoryStore) {
  if (exports.shouldCache(options, engineCache)) {
    return;
  }

  if (engineCache === 'memory') {
    return memoryStore[key];
  }

  return engineCache.get(key);
};

/**
 * Store a compiled template in the cache.
 *
 * @param  {string} key          Resolved template identifier.
 * @param  {object} [options]    Per-call Swig options.
 * @param  {*}      val          Compiled template to cache.
 * @param  {*}      engineCache  The engine's default `options.cache` value.
 * @param  {object} memoryStore  The engine's in-memory cache map
 *                               (used only when engineCache === 'memory').
 * @return {undefined}
 */
exports.cacheSet = function (key, options, val, engineCache, memoryStore) {
  if (exports.shouldCache(options, engineCache)) {
    return;
  }

  if (engineCache === 'memory') {
    memoryStore[key] = val;
    return;
  }

  engineCache.set(key, val);
};
