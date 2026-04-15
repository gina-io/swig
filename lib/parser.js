var utils = require('./utils'),
  lexer = require('./lexer');

var _t = lexer.types;

// TokenParser (expression-level codegen, including the .safe autoescape
// bypass check and CVE-2023-25345 prototype-chain guards) now lives in
// @rhinostone/swig-core (packages/swig-core/lib/tokenparser.js). It
// receives filters + filename as per-call arguments so each flavor
// frontend (native Swig, future Twig / Jinja2 / Django) plugs in its
// own catalog. See .claude/architecture/multi-flavor-ir.md.
var TokenParser = require('@rhinostone/swig-core/lib/tokenparser').TokenParser;


/**
 * Filters are simply functions that perform transformations on their first input argument.
 * Filters are run at render time, so they may not directly modify the compiled template structure in any way.
 * All of Swig's built-in filters are written in this same way. For more examples, reference the `filters.js` file in Swig's source.
 *
 * To disable auto-escaping on a custom filter, simply add a property to the filter method `safe = true;` and the output from this will not be escaped, no matter what the global settings are for Swig.
 *
 * @typedef {function} Filter
 *
 * @example
 * // This filter will return 'bazbop' if the idx on the input is not 'foobar'
 * swig.setFilter('foobar', function (input, idx) {
 *   return input[idx] === 'foobar' ? input[idx] : 'bazbop';
 * });
 * // myvar = ['foo', 'bar', 'baz', 'bop'];
 * // => {{ myvar|foobar(3) }}
 * // Since myvar[3] !== 'foobar', we render:
 * // => bazbop
 *
 * @example
 * // This filter will disable auto-escaping on its output:
 * function bazbop (input) { return input; }
 * bazbop.safe = true;
 * swig.setFilter('bazbop', bazbop);
 * // => {{ "<p>"|bazbop }}
 * // => <p>
 *
 * @param {*} input Input argument, automatically sent from Swig's built-in parser.
 * @param {...*} [args] All other arguments are defined by the Filter author.
 * @return {*}
 */

/*!
 * Makes a string safe for a regular expression.
 * @param  {string} str
 * @return {string}
 * @private
 */
function escapeRegExp(str) {
  return str.replace(/[\-\/\\\^$*+?.()|\[\]{}]/g, '\\$&');
}


/**
 * Parse a source string into tokens that are ready for compilation.
 *
 * @example
 * exports.parse('{{ tacos }}', {}, tags, filters);
 * // => [{ compile: [Function], ... }]
 *
 * @params {object} swig    The current Swig instance
 * @param  {string} source  Swig template source.
 * @param  {object} opts    Swig options object.
 * @param  {object} tags    Keyed object of tags that can be parsed and compiled.
 * @param  {object} filters Keyed object of filters that may be applied to variables.
 * @return {array}          List of tokens ready for compilation.
 */
exports.parse = function (swig, source, opts, tags, filters) {
  source = source.replace(/\r\n/g, '\n');
  var escape = opts.autoescape,
    tagOpen = opts.tagControls[0],
    tagClose = opts.tagControls[1],
    varOpen = opts.varControls[0],
    varClose = opts.varControls[1],
    escapedTagOpen = escapeRegExp(tagOpen),
    escapedTagClose = escapeRegExp(tagClose),
    escapedVarOpen = escapeRegExp(varOpen),
    escapedVarClose = escapeRegExp(varClose),
    tagStrip = new RegExp('^' + escapedTagOpen + '-?\\s*-?|-?\\s*-?' + escapedTagClose + '$', 'g'),
    tagStripBefore = new RegExp('^' + escapedTagOpen + '-'),
    tagStripAfter = new RegExp('-' + escapedTagClose + '$'),
    varStrip = new RegExp('^' + escapedVarOpen + '-?\\s*-?|-?\\s*-?' + escapedVarClose + '$', 'g'),
    varStripBefore = new RegExp('^' + escapedVarOpen + '-'),
    varStripAfter = new RegExp('-' + escapedVarClose + '$'),
    cmtOpen = opts.cmtControls[0],
    cmtClose = opts.cmtControls[1],
    anyChar = '[\\s\\S]*?',
    // Split the template source based on variable, tag, and comment blocks
    // /(\{%[\s\S]*?%\}|\{\{[\s\S]*?\}\}|\{#[\s\S]*?#\})/
    splitter = new RegExp(
      '(' +
        escapedTagOpen + anyChar + escapedTagClose + '|' +
        escapedVarOpen + anyChar + escapedVarClose + '|' +
        escapeRegExp(cmtOpen) + anyChar + escapeRegExp(cmtClose) +
        ')'
    ),
    line = 1,
    stack = [],
    parent = null,
    tokens = [],
    blocks = {},
    inRaw = false,
    stripNext;

  /**
   * Parse a variable.
   * @param  {string} str  String contents of the variable, between <i>{{</i> and <i>}}</i>
   * @param  {number} line The line number that this variable starts on.
   * @return {VarToken}      Parsed variable token object.
   * @private
   */
  function parseVariable(str, line) {
    var tokens = lexer.read(utils.strip(str)),
      parser,
      node;

    parser = new TokenParser(tokens, filters, escape, line, opts.filename);
    node = parser.parseOutput(tokens);

    if (parser.state.length) {
      utils.throwError('Unable to parse "' + str + '"', line, opts.filename);
    }

    // Pre-built IR node. The backend walker detects the missing
    // `.compile` and splices the node in directly (no second compile
    // pass). See packages/swig-core/lib/backend.js § pre-built IR
    // detection.
    return node;
  }
  exports.parseVariable = parseVariable;

  /**
   * Parse a tag.
   * @param  {string} str  String contents of the tag, between <i>{%</i> and <i>%}</i>
   * @param  {number} line The line number that this tag starts on.
   * @return {TagToken}      Parsed token object.
   * @private
   */
  function parseTag(str, line) {
    var tokens, parser, chunks, tagName, tag, args, last;

    if (utils.startsWith(str, 'end')) {
      last = stack[stack.length - 1];
      if (last && last.name === str.split(/\s+/)[0].replace(/^end/, '') && last.ends) {
        switch (last.name) {
        case 'autoescape':
          escape = opts.autoescape;
          break;
        case 'raw':
          inRaw = false;
          break;
        }
        stack.pop();
        return;
      }

      if (!inRaw) {
        utils.throwError('Unexpected end of tag "' + str.replace(/^end/, '') + '"', line, opts.filename);
      }
    }

    if (inRaw) {
      return;
    }

    chunks = str.split(/\s+(.+)?/);
    tagName = chunks.shift();

    if (!tags.hasOwnProperty(tagName)) {
      utils.throwError('Unexpected tag "' + str + '"', line, opts.filename);
    }

    tokens = lexer.read(utils.strip(chunks.join(' ')));
    parser = new TokenParser(tokens, filters, false, line, opts.filename);
    tag = tags[tagName];

    /**
     * Define custom parsing methods for your tag.
     * @callback parse
     *
     * @example
     * exports.parse = function (str, line, parser, types, options, swig) {
     *   parser.on('start', function () {
     *     // ...
     *   });
     *   parser.on(types.STRING, function (token) {
     *     // ...
     *   });
     * };
     *
     * @param {string} str The full token string of the tag.
     * @param {number} line The line number that this tag appears on.
     * @param {TokenParser} parser A TokenParser instance.
     * @param {TYPES} types Lexer token type enum.
     * @param {TagToken[]} stack The current stack of open tags.
     * @param {SwigOpts} options Swig Options Object.
     * @param {object} swig The Swig instance (gives acces to loaders, parsers, etc)
     */
    if (!tag.parse(chunks[1], line, parser, _t, stack, opts, swig)) {
      utils.throwError('Unexpected tag "' + tagName + '"', line, opts.filename);
    }

    parser.parse();
    args = parser.out;

    switch (tagName) {
    case 'autoescape':
      escape = (args[0] !== 'false') ? args[0] : false;
      break;
    case 'raw':
      inRaw = true;
      break;
    }

    var irExpr;
    if (typeof tag.lowerExpr === 'function') {
      irExpr = tag.lowerExpr(parser, tokens, chunks[1], line);
    }

    /**
     * A parsed tag token.
     * @typedef {Object} TagToken
     * @property {compile} [compile] Method for compiling this token.
     * @property {array} [args] Array of arguments for the tag.
     * @property {Token[]} [content=[]] An array of tokens that are children of this Token.
     * @property {boolean} [ends] Whether or not this tag requires an end tag.
     * @property {string} name The name of this tag.
     */
    return {
      block: !!tags[tagName].block,
      compile: tag.compile,
      args: args,
      content: [],
      ends: tag.ends,
      name: tagName,
      irExpr: irExpr
    };
  }

  /**
   * Strip the whitespace from the previous token, if it is a string.
   * @param  {object} token Parsed token.
   * @return {object}       If the token was a string, trailing whitespace will be stripped.
   */
  function stripPrevToken(token) {
    if (typeof token === 'string') {
      token = token.replace(/\s*$/, '');
    }
    return token;
  }

  /*!
   * Loop over the source, split via the tag/var/comment regular expression splitter.
   * Send each chunk to the appropriate parser.
   */
  utils.each(source.split(splitter), function (chunk) {
    var token, lines, stripPrev, prevToken, prevChildToken;

    if (!chunk) {
      return;
    }

    // Is a variable?
    if (!inRaw && utils.startsWith(chunk, varOpen) && utils.endsWith(chunk, varClose)) {
      stripPrev = varStripBefore.test(chunk);
      stripNext = varStripAfter.test(chunk);
      token = parseVariable(chunk.replace(varStrip, ''), line);
    // Is a tag?
    } else if (utils.startsWith(chunk, tagOpen) && utils.endsWith(chunk, tagClose)) {
      stripPrev = tagStripBefore.test(chunk);
      stripNext = tagStripAfter.test(chunk);
      token = parseTag(chunk.replace(tagStrip, ''), line);
      if (token) {
        if (token.name === 'extends') {
          parent = token.args.join('').replace(/^\'|\'$/g, '').replace(/^\"|\"$/g, '');
        } else if (token.block && !stack.length) {
          blocks[token.args.join('')] = token;
        }
      }
      if (inRaw && !token) {
        token = chunk;
      }
    // Is a content string?
    } else if (inRaw || (!utils.startsWith(chunk, cmtOpen) && !utils.endsWith(chunk, cmtClose))) {
      token = (stripNext) ? chunk.replace(/^\s*/, '') : chunk;
      stripNext = false;
    } else if (utils.startsWith(chunk, cmtOpen) && utils.endsWith(chunk, cmtClose)) {
      return;
    }

    // Did this tag ask to strip previous whitespace? <code>{%- ... %}</code> or <code>{{- ... }}</code>
    if (stripPrev && tokens.length) {
      prevToken = tokens.pop();
      if (typeof prevToken === 'string') {
        prevToken = stripPrevToken(prevToken);
      } else if (prevToken.content && prevToken.content.length) {
        prevChildToken = stripPrevToken(prevToken.content.pop());
        prevToken.content.push(prevChildToken);
      }
      tokens.push(prevToken);
    }

    // This was a comment, so let's just keep going.
    if (!token) {
      return;
    }

    // If there's an open item in the stack, add this to its content.
    if (stack.length) {
      stack[stack.length - 1].content.push(token);
    } else {
      tokens.push(token);
    }

    // If the token is a tag that requires an end tag, open it on the stack.
    if (token.name && token.ends) {
      stack.push(token);
    }

    lines = chunk.match(/\n/g);
    line += (lines) ? lines.length : 0;
  });

  return {
    name: opts.filename,
    parent: parent,
    tokens: tokens,
    blocks: blocks
  };
};


/**
 * Compile an array of tokens.
 * @param  {Token[]} template     An array of template tokens.
 * @param  {Templates[]} parents  Array of parent templates.
 * @param  {SwigOpts} [options]   Swig options object.
 * @param  {string} [blockName]   Name of the current block context.
 * @return {string}               Partial for a compiled JavaScript method that will output a rendered template.
 */
/**
 * Compile callback for VarToken and TagToken objects.
 * @callback compile
 *
 * @example
 * exports.compile = function (compiler, args, content, parents, options, blockName) {
 *   if (args[0] === 'foo') {
 *     return compiler(content, parents, options, blockName) + '\n';
 *   }
 *   return '_output += "fallback";\n';
 * };
 *
 * @param {parserCompiler} compiler
 * @param {array} [args] Array of parsed arguments on the for the token.
 * @param {array} [content] Array of content within the token.
 * @param {array} [parents] Array of parent templates for the current template context.
 * @param {SwigOpts} [options] Swig Options Object
 * @param {string} [blockName] Name of the direct block parent, if any.
 */

// The template-level token walker now lives in @rhinostone/swig-core
// (packages/swig-core/lib/backend.js). Re-exported here so lib/swig.js
// and lib/tags/import.js keep resolving `parser.compile` through the
// same module path. See .claude/architecture/multi-flavor-ir.md.
exports.compile = require('@rhinostone/swig-core/lib/backend').compile;
