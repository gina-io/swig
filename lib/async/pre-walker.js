var utils = require('../utils');

/*!
 * Makes a string safe for a regular expression. Mirrors lib/parser.js.
 * @private
 */
function escapeRegExp(str) {
  return str.replace(/[\-\/\\\^$*+?.()|\[\]{}]/g, '\\$&');
}

/*!
 * Build the splitter regex from the controls trio. Mirrors the regex that
 * parser.parse() builds at parse-time so the pre-walker chunks the same
 * way the real parser would.
 * @private
 */
function buildSplitter(controls) {
  var anyChar = '[\\s\\S]*?',
    varOpen = escapeRegExp(controls.varControls[0]),
    varClose = escapeRegExp(controls.varControls[1]),
    tagOpen = escapeRegExp(controls.tagControls[0]),
    tagClose = escapeRegExp(controls.tagControls[1]),
    cmtOpen = escapeRegExp(controls.cmtControls[0]),
    cmtClose = escapeRegExp(controls.cmtControls[1]);
  return new RegExp(
    '(' +
      tagOpen + anyChar + tagClose + '|' +
      varOpen + anyChar + varClose + '|' +
      cmtOpen + anyChar + cmtClose +
    ')'
  );
}

/*!
 * Strip tag controls and optional whitespace-control markers from a tag
 * chunk, returning the trimmed tag body (e.g. `extends "x.html"`).
 * @private
 */
function stripTagBody(chunk, tagOpen, tagClose) {
  var body = chunk.substr(tagOpen.length, chunk.length - tagOpen.length - tagClose.length);
  if (body.charAt(0) === '-') {
    body = body.substr(1);
  }
  if (body.charAt(body.length - 1) === '-') {
    body = body.substr(0, body.length - 1);
  }
  return body.replace(/^\s+|\s+$/g, '');
}

/**
 * Scan template source for static `{% extends|include|import|from "..." %}`
 * targets. Pure function; performs no I/O.
 *
 * The scanner mirrors the real parser's chunk-splitter so it agrees on
 * chunk boundaries even under non-default control characters. Dynamic
 * paths (`{% extends parent_var %}`) and tag bodies whose first token
 * isn't a string literal are silently skipped — they remain on the sync
 * path, which throws appropriately at parse time.
 *
 * @example
 * preWalker.scan('{% extends "layout.html" %}{% include "x" %}', {
 *   varControls: ['{{', '}}'],
 *   tagControls: ['{%', '%}'],
 *   cmtControls: ['{#', '#}'],
 *   rawTag: 'raw',
 *   keywords: ['extends', 'include', 'import']
 * });
 * // => [
 * //   { kind: 'extends', path: 'layout.html' },
 * //   { kind: 'include', path: 'x' }
 * // ]
 *
 * @param  {string} source
 * @param  {object} opts
 * @param  {array}  opts.varControls  e.g. <code>['{{', '}}']</code>.
 * @param  {array}  opts.tagControls  e.g. <code>['{%', '%}']</code>.
 * @param  {array}  opts.cmtControls  e.g. <code>['{#', '#}']</code>.
 * @param  {string} opts.rawTag       Tag name that opens verbatim regions
 *                                    (<code>raw</code> for native swig).
 * @param  {array}  opts.keywords     Keywords whose first quoted argument is
 *                                    a template path. Native swig:
 *                                    <code>['extends', 'include', 'import']</code>.
 * @return {array}                    List of <code>{ kind, path }</code> entries.
 */
exports.scan = function (source, opts) {
  source = source.replace(/\r\n/g, '\n');

  var splitter = buildSplitter(opts),
    tagOpen = opts.tagControls[0],
    tagClose = opts.tagControls[1],
    rawTag = opts.rawTag,
    endRawTag = 'end' + rawTag,
    keywordRegex = new RegExp(
      '^(' + opts.keywords.join('|') + ')\\s+["\\\']([^"\\\']+)["\\\']'
    ),
    chunks = source.split(splitter),
    results = [],
    inRaw = false,
    i,
    chunk,
    body,
    name,
    m;

  for (i = 0; i < chunks.length; i += 1) {
    chunk = chunks[i];
    if (typeof chunk !== 'string' || !chunk) {
      continue;
    }

    if (!utils.startsWith(chunk, tagOpen) || !utils.endsWith(chunk, tagClose)) {
      continue;
    }

    body = stripTagBody(chunk, tagOpen, tagClose);
    name = body.split(/\s+/)[0];

    if (name === rawTag) {
      inRaw = true;
      continue;
    }
    if (name === endRawTag) {
      inRaw = false;
      continue;
    }
    if (inRaw) {
      continue;
    }

    m = keywordRegex.exec(body);
    if (m) {
      results.push({ kind: m[1], path: m[2] });
    }
  }

  return results;
};

/**
 * Walk the dependency graph asynchronously starting from <var>entryPath</var>.
 *
 * Repeatedly loads, scans, and resolves child template paths in parallel
 * via the user's async loader, until the dep graph closes. Returns a
 * Promise resolving to a populated <code>{ resolvedPath: source }</code>
 * map suitable for backing a memory loader.
 *
 * Cycles in the graph are tolerated — once a path is in the map or
 * pending, subsequent enqueue requests are dropped. The synchronous
 * renderer's existing circular-extends guard handles cycles at parse
 * time on the second pass.
 *
 * @example
 * preWalker.walk('/abs/entry.html', userLoader, scanOpts).then(function (memMap) {
 *   // memMap = { '/abs/entry.html': '...', '/abs/layout.html': '...', ... }
 * });
 *
 * @param  {string}  entryPath  Resolved path of the entry template.
 * @param  {object}  loader     User loader. Must expose:
 *                              <code>resolve(to, from)</code> (sync, returns
 *                              string) and
 *                              <code>load(id, cb)</code> (async, calls
 *                              <code>cb(err, source)</code>).
 * @param  {object}  scanOpts   Pass-through to {@link scan}.
 * @return {Promise}            Resolves to the populated memory map.
 */
exports.walk = function (entryPath, loader, scanOpts) {
  var memMap = {};
  var pending = {};

  return new Promise(function (resolve, reject) {
    var inFlight = 0;
    var queue = [];
    var hasError = false;

    function enqueue(path) {
      if (memMap.hasOwnProperty(path) || pending[path]) {
        return;
      }
      pending[path] = true;
      queue.push(path);
    }

    function drain() {
      while (queue.length > 0 && !hasError) {
        var path = queue.shift();
        inFlight += 1;
        startLoad(path);
      }
      if (inFlight === 0 && !hasError && queue.length === 0) {
        resolve(memMap);
      }
    }

    function startLoad(resolvedPath) {
      loader.load(resolvedPath, function (err, src) {
        if (hasError) {
          return;
        }
        if (err) {
          hasError = true;
          reject(err);
          return;
        }
        if (typeof src !== 'string') {
          hasError = true;
          reject(new Error('Async loader returned non-string source for "' + resolvedPath + '"'));
          return;
        }
        memMap[resolvedPath] = src;

        var targets;
        try {
          targets = exports.scan(src, scanOpts);
        } catch (e) {
          hasError = true;
          reject(e);
          return;
        }

        var i, resolvedChild;
        for (i = 0; i < targets.length; i += 1) {
          try {
            resolvedChild = loader.resolve(targets[i].path, resolvedPath);
          } catch (e) {
            hasError = true;
            reject(e);
            return;
          }
          enqueue(resolvedChild);
        }

        inFlight -= 1;
        drain();
      });
    }

    enqueue(entryPath);
    drain();
  });
};

/**
 * Build a sync memory wrapper around a pre-populated
 * <code>{ resolvedPath: source }</code> map. Delegates <code>resolve</code>
 * to the user loader so cache keys match what the pre-walker produced.
 *
 * @example
 * var mem = preWalker.makeMemoryWrapper(userLoader, memMap);
 * swig.options.loader = mem;
 * swig.renderFile('/abs/entry.html', locals);  // sync, hits memMap
 *
 * @param  {object} userLoader  Original async loader (used for resolve).
 * @param  {object} memMap      Pre-populated source map.
 * @return {object}             A loader exposing <code>resolve</code> and
 *                              <code>load</code>.
 */
exports.makeMemoryWrapper = function (userLoader, memMap) {
  return {
    resolve: function (to, from) {
      return userLoader.resolve(to, from);
    },
    load: function (id, cb) {
      var src = memMap[id];
      if (typeof src !== 'string') {
        var err = new Error('Pre-walked map missing path: "' + id + '"');
        if (cb) {
          cb(err);
          return;
        }
        throw err;
      }
      if (cb) {
        cb(null, src);
        return;
      }
      return src;
    }
  };
};
