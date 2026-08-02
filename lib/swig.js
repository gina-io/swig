var utils = require('./utils'),
  _tags = require('./tags'),
  _filters = require('./filters'),
  parser = require('./parser'),
  dateformatter = require('./dateformatter'),
  loaders = require('./loaders'),
  preWalker = require('./async/pre-walker'),
  engine = require('@rhinostone/swig-core/lib/engine');

/**
 * Swig version number as a string.
 * @example
 * if (swig.version === "2.4.1") { ... }
 *
 * @type {String}
 */
exports.version = "2.7.3";

/**
 * Swig Options Object. This object can be passed to many of the API-level Swig methods to control various aspects of the engine. All keys are optional.
 * @typedef {Object} SwigOpts
 * @property {boolean} autoescape  Controls whether or not variable output will automatically be escaped for safe HTML output. Defaults to <code data-language="js">true</code>. Functions executed in variable statements will not be auto-escaped. Your application/functions should take care of their own auto-escaping.
 * @property {array}   varControls Open and close controls for variables. Defaults to <code data-language="js">['{{', '}}']</code>.
 * @property {array}   tagControls Open and close controls for tags. Defaults to <code data-language="js">['{%', '%}']</code>.
 * @property {array}   cmtControls Open and close controls for comments. Defaults to <code data-language="js">['{#', '#}']</code>.
 * @property {object}  locals      Default variable context to be passed to <strong>all</strong> templates.
 * @property {CacheOptions} cache Cache control for templates. Defaults to saving in <code data-language="js">'memory'</code>. Send <code data-language="js">false</code> to disable. Send an object with <code data-language="js">get</code> and <code data-language="js">set</code> functions to customize.
 * @property {TemplateLoader} loader The method that Swig will use to load templates. Defaults to <var>swig.loaders.fs</var>.
 */
var defaultOptions = {
    autoescape: true,
    varControls: ['{{', '}}'],
    tagControls: ['{%', '%}'],
    cmtControls: ['{#', '#}'],
    locals: {},
    /**
     * Cache control for templates. Defaults to saving all templates into memory.
     * @typedef {boolean|string|object} CacheOptions
     * @example
     * // Default
     * swig.setDefaults({ cache: 'memory' });
     * @example
     * // Disables caching in Swig.
     * swig.setDefaults({ cache: false });
     * @example
     * // Custom cache storage and retrieval
     * swig.setDefaults({
     *   cache: {
     *     get: function (key) { ... },
     *     set: function (key, val) { ... }
     *   }
     * });
     */
    cache: 'memory',
    /**
     * Configure Swig to use either the <var>swig.loaders.fs</var> or <var>swig.loaders.memory</var> template loader. Or, you can write your own!
     * For more information, please see the <a href="../loaders/">Template Loaders documentation</a>.
     * @typedef {class} TemplateLoader
     * @example
     * // Default, FileSystem loader
     * swig.setDefaults({ loader: swig.loaders.fs() });
     * @example
     * // FileSystem loader allowing a base path
     * // With this, you don't use relative URLs in your template references
     * swig.setDefaults({ loader: swig.loaders.fs(__dirname + '/templates') });
     * @example
     * // Memory Loader
     * swig.setDefaults({ loader: swig.loaders.memory({
     *   layout: '{% block foo %}{% endblock %}',
     *   page1: '{% extends "layout" %}{% block foo %}Tacos!{% endblock %}'
     * })});
     */
    loader: loaders.fs()
  },
  defaultInstance;

/**
 * Validate the Swig options object.
 * @param  {?SwigOpts} options Swig options object.
 * @return {undefined}      This method will throw errors if anything is wrong.
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
 * Set defaults for the base and all new Swig environments.
 *
 * @example
 * swig.setDefaults({ cache: false });
 * // => Disables Cache
 *
 * @example
 * swig.setDefaults({ locals: { now: function () { return new Date(); } }});
 * // => sets a globally accessible method for all template
 * //    contexts, allowing you to print the current date
 * // => {{ now()|date('F jS, Y') }}
 *
 * @param  {SwigOpts} [options={}] Swig options object.
 * @return {undefined}
 */
exports.setDefaults = function (options) {
  validateOptions(options);
  defaultInstance.options = utils.extend(defaultInstance.options, options);
};

/**
 * Set the default TimeZone offset for date formatting via the date filter. This is a global setting and will affect all Swig environments, old or new.
 * @param  {number} offset Offset from GMT, in minutes.
 * @return {undefined}
 */
exports.setDefaultTZOffset = function (offset) {
  dateformatter.tzOffset = offset;
};

/**
 * Create a new, separate Swig compile/render environment.
 *
 * @example
 * var swig = require('@rhinostone/swig');
 * var myswig = new swig.Swig({varControls: ['<%=', '%>']});
 * myswig.render('Tacos are <%= tacos =>!', { locals: { tacos: 'delicious' }});
 * // => Tacos are delicious!
 * swig.render('Tacos are <%= tacos =>!', { locals: { tacos: 'delicious' }});
 * // => 'Tacos are <%= tacos =>!'
 *
 * @param  {SwigOpts} [opts={}] Swig options object.
 * @return {object}      New Swig environment.
 */
exports.Swig = function (opts) {
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

  var self = this;

  function buildScanOpts() {
    return {
      varControls: self.options.varControls,
      tagControls: self.options.tagControls,
      cmtControls: self.options.cmtControls,
      rawTag: 'raw',
      keywords: ['extends', 'include', 'import']
    };
  }

  /**
   * Render a template file asynchronously, supporting async loaders.
   *
   * Pre-walks <var>extends</var> / <var>include</var> / <var>import</var>
   * targets in parallel via the user loader, populates an in-memory map,
   * then runs the existing sync render pipeline against the populated map.
   * Dynamic paths (e.g. <code>{% extends parent_var %}</code>) are not
   * pre-resolved and will throw at render time as they would on the sync
   * path.
   *
   * @deprecated since 2.2.0 — use {@link Swig#renderFile} with a loader that
   *   sets <code>loader.async === true</code>. The async-codegen dispatch
   *   handles dynamic include paths the pre-walker cannot. This method will
   *   be removed in 3.0.
   *
   * @example
   * swig.setDefaults({ loader: myAsyncLoader });
   * swig.renderFileAsync('page.html', { name: 'world' }, function (err, output) {
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
   * Compile a template file asynchronously, supporting async loaders.
   *
   * Same pre-walk / memory-wrapper / sync-pipeline shape as
   * {@link Swig#renderFileAsync}. Returns the compiled function (via
   * <var>cb</var>) that takes a locals object and yields a rendered
   * string. The returned function captures the pre-walked memory map and
   * temporarily swaps the loader on each call, so subsequent runtime
   * <var>include</var>s resolve correctly without re-running the pre-walk.
   *
   * @deprecated since 2.2.0 — use {@link Swig#compileFile} with
   *   <code>options.codegenMode === 'async'</code> on a loader that sets
   *   <code>loader.async === true</code>. The returned compiled function
   *   yields a <code>Promise&lt;{output, exports}&gt;</code> instead of a
   *   string. This method will be removed in 3.0.
   *
   * @example
   * swig.compileFileAsync('page.html', {}, function (err, fn) {
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
 * Export methods publicly
 */
defaultInstance = new exports.Swig();
/**
 * Add a custom filter for swig variables.
 *
 * @example
 * function replaceMs(input) { return input.replace(/m/g, 'f'); }
 * swig.setFilter('replaceMs', replaceMs);
 * // => {{ "onomatopoeia"|replaceMs }}
 * // => onofatopeia
 *
 * @param {string}    name    Name of filter, used in templates. <strong>Will</strong> overwrite previously defined filters, if using the same name.
 * @param {function}  method  Function that acts against the input. See <a href="/docs/filters/#custom">Custom Filters</a> for more information.
 * @return {undefined}
 */
exports.setFilter = defaultInstance.setFilter;
/**
 * Add a custom tag. To expose your own extensions to compiled template code, see <code data-language="js">swig.setExtension</code>.
 *
 * For a more in-depth explanation of writing custom tags, see <a href="../extending/#tags">Custom Tags</a>.
 *
 * @example
 * var tacotag = require('./tacotag');
 * swig.setTag('tacos', tacotag.parse, tacotag.compile, tacotag.ends, tacotag.blockLevel);
 * // => {% tacos %}Make this be tacos.{% endtacos %}
 * // => Tacos tacos tacos tacos.
 *
 * @param  {string} name      Tag name.
 * @param  {function} parse   Method for parsing tokens.
 * @param  {function} compile Method for compiling renderable output.
 * @param  {boolean} [ends=false]     Whether or not this tag requires an <i>end</i> tag.
 * @param  {boolean} [blockLevel=false] If false, this tag will not be compiled outside of <code>block</code> tags when extending a parent template.
 * @return {undefined}
 */
exports.setTag = defaultInstance.setTag;
/**
 * Add extensions for custom tags. This allows any custom tag to access a globally available methods via a special globally available object, <var>_ext</var>, in templates.
 *
 * @example
 * swig.setExtension('trans', function (v) { return translate(v); });
 * function compileTrans(compiler, args, content, parent, options) {
 *   return '_output += _ext.trans(' + args[0] + ');'
 * };
 * swig.setTag('trans', parseTrans, compileTrans, true);
 *
 * @param  {string} name   Key name of the extension. Accessed via <code data-language="js">_ext[name]</code>.
 * @param  {*}      object The method, value, or object that should be available via the given name.
 * @return {undefined}
 */
exports.setExtension = defaultInstance.setExtension;
/**
 * Parse a given file into tokens.
 * @param  {string} pathname  Full path to file to parse.
 * @param  {SwigOpts} [options={}]   Swig options object.
 * @return {object} parsed    Template tokens object.
 * @private
 */
exports.parseFile = defaultInstance.parseFile;
/**
 * Pre-compile a source string into a cache-able template function.
 *
 * @example
 * swig.precompile('{{ tacos }}');
 * // => {
 * //      tpl: function (_swig, _locals, _filters, _utils, _fn) { ... },
 * //      tokens: {
 * //        name: undefined,
 * //        parent: null,
 * //        tokens: [...],
 * //        blocks: {}
 * //      }
 * //    }
 *
 * In order to render a pre-compiled template, you must have access to filters and utils from Swig. <var>efn</var> is simply an empty function that does nothing.
 *
 * @param  {string} source  Swig template source string.
 * @param  {SwigOpts} [options={}] Swig options object.
 * @return {object}         Renderable function and tokens object.
 */
exports.precompile = defaultInstance.precompile;
/**
 * Compile string source into a renderable template function.
 *
 * @example
 * var tpl = swig.compile('{{ tacos }}');
 * // => {
 * //      [Function: compiled]
 * //      parent: null,
 * //      tokens: [{ compile: [Function] }],
 * //      blocks: {}
 * //    }
 * tpl({ tacos: 'Tacos!!!!' });
 * // => Tacos!!!!
 *
 * When compiling a source string, a file path should be specified in the options object in order for <var>extends</var>, <var>include</var>, and <var>import</var> to work properly. Do this by adding <code data-language="js">{ filename: '/absolute/path/to/mytpl.html' }</code> to the options argument.
 *
 * @param  {string} source    Swig template source string.
 * @param  {SwigOpts} [options={}] Swig options object.
 * @return {function}         Renderable function with keys for parent, blocks, and tokens.
 */
exports.compile = defaultInstance.compile;
/**
 * Compile a source file into a renderable template function.
 *
 * @example
 * var tpl = swig.compileFile('./mytpl.html');
 * // => {
 * //      [Function: compiled]
 * //      parent: null,
 * //      tokens: [{ compile: [Function] }],
 * //      blocks: {}
 * //    }
 * tpl({ tacos: 'Tacos!!!!' });
 * // => Tacos!!!!
 *
 * @example
 * swig.compileFile('/myfile.txt', { varControls: ['<%=', '=%>'], tagControls: ['<%', '%>']});
 * // => will compile 'myfile.txt' using the var and tag controls as specified.
 *
 * @param  {string} pathname  File location.
 * @param  {SwigOpts} [options={}] Swig options object.
 * @param  {Function} [cb] Asynchronous callback function. If not provided, <var>compileFile</var> will run synchronously.
 * @return {function}         Renderable function with keys for parent, blocks, and tokens.
 */
exports.compileFile = defaultInstance.compileFile;
exports.compileFileAsync = defaultInstance.compileFileAsync;
/**
 * Compile and render a template string for final output.
 *
 * When rendering a source string, a file path should be specified in the options object in order for <var>extends</var>, <var>include</var>, and <var>import</var> to work properly. Do this by adding <code data-language="js">{ filename: '/absolute/path/to/mytpl.html' }</code> to the options argument.
 *
 * @example
 * swig.render('{{ tacos }}', { locals: { tacos: 'Tacos!!!!' }});
 * // => Tacos!!!!
 *
 * @param  {string} source    Swig template source string.
 * @param  {SwigOpts} [options={}] Swig options object.
 * @return {string}           Rendered output.
 */
exports.render = defaultInstance.render;
/**
 * Compile and render a template file for final output. This is most useful for libraries like Express.js.
 *
 * When the active loader sets <code>loader.async === true</code> and a callback is provided, this method routes to the async-codegen dispatch path (added in v2.2.0) which supports dynamic <var>include</var> paths the sync path cannot. Otherwise it runs synchronously.
 *
 * @example
 * swig.renderFile('./template.html', {}, function (err, output) {
 *   if (err) {
 *     throw err;
 *   }
 *   console.log(output);
 * });
 *
 * @example
 * swig.renderFile('./template.html', {});
 * // => output
 *
 * @param  {string}   pathName    File location.
 * @param  {object}   [locals={}] Template variable context.
 * @param  {Function} [cb] Asynchronous callback function. If not provided, <var>renderFile</var> will run synchronously.
 * @return {string}             Rendered output.
 */
exports.renderFile = defaultInstance.renderFile;
exports.renderFileAsync = defaultInstance.renderFileAsync;
/**
 * Run a pre-compiled template function. This is most useful in the browser when you've pre-compiled your templates with the Swig command-line tool.
 *
 * @example
 * $ swig compile ./mytpl.html --wrap-start="var mytpl = " > mytpl.js
 * @example
 * <script src="mytpl.js"></script>
 * <script>
 *   swig.run(mytpl, {});
 *   // => "rendered template..."
 * </script>
 *
 * @param  {function} tpl       Pre-compiled Swig template function. Use the Swig CLI to compile your templates.
 * @param  {object} [locals={}] Template variable context.
 * @param  {string} [filepath]  Filename used for caching the template.
 * @return {string}             Rendered output.
 */
exports.run = defaultInstance.run;
/**
 * Register a pre-compiled template function under a template path, so later <var>include</var> lookups and <var>compileFile</var> / <var>renderFile</var> calls are served from the template cache without compiling.
 * This is the ahead-of-time companion to <var>run</var>: where <var>run</var> renders a pre-compiled template (and caches the raw function as a side effect — only safe for partials that use no variables or filters), <var>register</var> stores a locals-binding wrapper with the exact call shape <var>include</var> expects, so registered partials may use variables, filters, and extensions freely.
 *
 * The path is normalized through the active loader's <var>resolve</var>, so registering <code data-language="js">'partials/nav.html'</code> and writing <code data-language="js">{% include "partials/nav.html" %}</code> agree on the cache key.
 *
 * @example
 * // Browser: register an AOT-compiled partial, then render a page that includes it.
 * swig.register('partials/nav.html', navTpl);
 * swig.render('{% include "partials/nav.html" %}', { filename: '/page.html', locals: { user: 'Jane' } });
 *
 * @param  {string}   path  Template path to register under.
 * @param  {function} fn    Pre-compiled Swig template function (Swig CLI output).
 * @return {object}         The Swig instance, for chaining.
 */
exports.register = defaultInstance.register;
/**
 * Register a map of pre-compiled template functions in one call — the shape produced by <code data-language="shell">swig compile --recursive --register &lt;dir&gt;</code> (whose bundle also self-registers when a global <var>swig</var> is present).
 *
 * @example
 * swig.registerBundle({ 'page.html': pageTpl, 'partials/nav.html': navTpl });
 *
 * @param  {object} map  Object of template-path → pre-compiled function pairs.
 * @return {object}      The Swig instance, for chaining.
 */
exports.registerBundle = defaultInstance.registerBundle;
/**
 * Clears the in-memory template cache.
 *
 * @example
 * swig.invalidateCache();
 *
 * @return {undefined}
 */
exports.invalidateCache = defaultInstance.invalidateCache;
exports.loaders = loaders;
