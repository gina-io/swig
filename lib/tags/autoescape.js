var utils = require('../utils'),
  ir = require('@rhinostone/swig-core/lib/ir'),
  strings = ['html', 'js'];

/*!
 * Lower the frontend's raw autoescape-strategy token match into the
 * typed shape IRAutoescape.strategy expects. The parser captures
 * `token.match` verbatim (BOOL: 'true'/'false'; STRING: quoted like
 * "'js'"). The native backend is a no-op on strategy (parser already
 * baked escape behavior into the variable tokens at parse time), but
 * a tight IR keeps the shape honest for future flavor backends.
 * @private
 */
function lowerStrategy(raw) {
  if (raw === 'true') { return true; }
  if (raw === 'false') { return false; }
  if (typeof raw === 'string' && raw.length >= 2) {
    var first = raw.charAt(0), last = raw.charAt(raw.length - 1);
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return raw.slice(1, -1);
    }
  }
  return raw;
}

/**
 * Control auto-escaping of variable output from within your templates.
 *
 * @alias autoescape
 *
 * @example
 * // myvar = '<foo>';
 * {% autoescape true %}{{ myvar }}{% endautoescape %}
 * // => &lt;foo&gt;
 * {% autoescape false %}{{ myvar }}{% endautoescape %}
 * // => <foo>
 *
 * @param {boolean|string} control One of `true`, `false`, `"js"` or `"html"`.
 */
exports.compile = function (compiler, args, content, parents, options, blockName) {
  var bodyJS = compiler(content, parents, options, blockName);
  return ir.autoescape(lowerStrategy(args[0]), [ir.legacyJS(bodyJS)]);
};
exports.parse = function (str, line, parser, types, stack, opts) {
  var matched;
  parser.on('*', function (token) {
    // A string token keeps its quotes (`"js"` or `'js'`), so the check reads
    // its value: only html and js are escape strategies. The original check
    // compared the quoted token with the bare names, which never matched,
    // and accepted every string.
    // if (!matched &&
    //     (token.type === types.BOOL ||
    //       (token.type === types.STRING && strings.indexOf(token.match) === -1))
    //     ) {
    if (!matched &&
        (token.type === types.BOOL ||
          (token.type === types.STRING && strings.indexOf(lowerStrategy(token.match)) !== -1))
        ) {
      this.out.push(token.match);
      matched = true;
      return;
    }
    utils.throwError('Unexpected token "' + token.match + '" in autoescape tag', line, opts.filename);
  });
  // A tag with no argument fires no token, and used to turn escaping off.
  parser.on('end', function () {
    if (!matched) {
      utils.throwError('Expected true, false, "html" or "js" in autoescape tag', line, opts.filename);
    }
  });

  return true;
};
exports.ends = true;
