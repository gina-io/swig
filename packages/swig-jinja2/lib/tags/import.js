/*!
 * Jinja2 `{% import %}` tag.
 *
 * Jinja2 import syntax:
 *
 *   {% import "partial.html" as form %}
 *
 * Loads a template and imports every `{% macro %}` it defines into a
 * namespace bound to `_ctx.<alias>`. Each imported macro is rendered
 * to JS via `backend.compile`; the compile step performs regex surgery
 * on that rendered JS to rewrite `_ctx.<macroName>` →
 * `_ctx.<alias>.<macroName>`, including sibling-macro references
 * (the `(?!<allMacros>)` negative lookahead).
 *
 * The regex surgery is swig-specific coupling on the exact JS source
 * shape a Macro IR emits — it fails the flavor-invariant test and stays
 * on `IRLegacyJS`. The tag returns a JS source string from `compile`; the
 * backend lifts it into `IRLegacyJS` at emit time. When the macro-name →
 * namespace rewrite moves into the emitter itself, the tag collapses to a
 * dedicated `IRImport` node.
 *
 * The plural `{% from "file" import a, b %}` shorthand is the sibling
 * `from` tag. Dynamic paths (`{% import dyn as ns %}`) are deferred.
 * Context modifiers (`with` / `without context`) are not honored here —
 * imported macros always see the caller context (swig's macro model;
 * a documented divergence from Jinja2's without-context import default).
 *
 * The alias is a bare identifier — dotted paths are rejected at parse
 * time, and CVE-2023-25345 prototype-chain names are rejected before
 * the namespace assignment. Single-name binding slots reject any `.`
 * in the match before the `_dangerousProps` check.
 */

var utils = require('@rhinostone/swig-core/lib/utils');
var ir = require('@rhinostone/swig-core/lib/ir');
var backend = require('@rhinostone/swig-core/lib/backend');
var _dangerousProps = require('@rhinostone/swig-core/lib/security').dangerousProps;

var lexer = require('../lexer');

exports.ends = false;
exports.block = true;

/**
 * Parse the `{% import %}` tag body. Extracts the STRING literal path,
 * the `as` keyword, and the bare-identifier alias; validates the alias
 * against the bare-identifier rule and the CVE-2023-25345
 * `_dangerousProps` blocklist.
 *
 * Walks the imported template's token list (via `swig.parseFile`). For
 * each `{% macro %}` token, invokes its `compile` to get the IRMacro node
 * and renders it to JS through `backend.compile`. For each nested
 * `{% import %}` / `{% from %}` token (the imported file's own imports),
 * carries its compiled setup through flagged `isImport` (with `boundNames`)
 * so macros defined here can reference it at call time. The resulting
 * entries + the alias string are stashed on `token.args` —
 * `exports.compile` pops the alias off the tail, re-homes any nested
 * imports under it, and performs the namespace-prefix rewrite on each
 * macro's compiled JS.
 *
 * @param  {string} str    Tag body.
 * @param  {number} line   Source line of the opening `{%`.
 * @param  {object} parser The Jinja2 parser module (unused — the body is
 *                         lexed locally).
 * @param  {object} types  Jinja2 lexer token-type enum.
 * @param  {Array}  stack  Open-tag stack (unused — import has no body).
 * @param  {object} opts   Per-call options. Honors `opts.filename` for
 *                         `resolveFrom` + filename-aware throws.
 * @param  {object} swig   Swig instance. Must expose `parseFile`.
 * @param  {object} token  In-progress TagToken. `token.args` gets the
 *                         `[{compiled, name}, ..., alias]` list.
 * @return {boolean}       Always `true` on success. Throws otherwise.
 */
exports.parse = function (str, line, parser, types, stack, opts, swig, token) {
  var tokens = lexer.read(utils.strip(str));
  var pos = 0;

  function peek() {
    while (pos < tokens.length && tokens[pos].type === types.WHITESPACE) { pos += 1; }
    return pos < tokens.length ? tokens[pos] : null;
  }
  function consume() {
    var t = peek();
    if (t) { pos += 1; }
    return t;
  }

  var pathTok = consume();
  if (!pathTok) {
    utils.throwError('Expected template path in "import" tag', line, opts.filename);
  }
  if (pathTok.type !== types.STRING) {
    utils.throwError('Dynamic "import" is not supported — path must be a string literal', line, opts.filename);
  }

  var asTok = consume();
  if (!asTok || asTok.type !== types.VAR || asTok.match !== 'as') {
    utils.throwError('Expected "as" keyword after path in "import" tag', line, opts.filename);
  }

  var aliasTok = consume();
  if (!aliasTok || aliasTok.type !== types.VAR) {
    utils.throwError('Expected namespace alias after "as" in "import" tag', line, opts.filename);
  }
  if (aliasTok.match.indexOf('.') !== -1) {
    utils.throwError('Import alias "' + aliasTok.match + '" must be a bare identifier in "import" tag', line, opts.filename);
  }
  if (_dangerousProps.indexOf(aliasTok.match) !== -1) {
    utils.throwError('Unsafe import alias "' + aliasTok.match + '" is not allowed (CVE-2023-25345)', line, opts.filename);
  }

  if (peek()) {
    utils.throwError('Unexpected token "' + peek().match + '" after alias in "import" tag', line, opts.filename);
  }

  var path = pathTok.match.replace(/^['"]|['"]$/g, '');

  if (opts && opts.codegenMode === 'async') {
    // Async mode skips the parse-time parseFile + macro pre-render.
    // compile() emits IRImportDeferred; runtime resolves the template via
    // _swig.getTemplate and binds .exports under the alias.
    token.args = [path, aliasTok.match];
    return true;
  }

  if (!swig || typeof swig.parseFile !== 'function') {
    utils.throwError('"import" tag requires an engine context with a loader', line, opts.filename);
  }

  var parseOpts = { resolveFrom: opts.filename };
  var compileOpts = utils.extend({}, opts, parseOpts);
  var parsed = swig.parseFile(path, parseOpts);
  var macros = [];

  utils.each(parsed.tokens, function (tk) {
    if (!tk || typeof tk.compile !== 'function') {
      return;
    }
    // The imported file may itself import macros, via `{% import "x" as y %}`
    // or `{% from "x" import a, b %}`. Carry those nested imports through so
    // a macro defined here that references a name they bind resolves at call
    // time — without them the call compiles against a namespace/binding that
    // was never set up, and silently renders empty.
    //
    // Imports stay local to their defining template: compile() re-homes
    // every bound name under THIS import's alias (`_ctx.<alias>.<boundName>`),
    // so none is visible bare in the parent scope. `tk.args` is already
    // parsed; slice() avoids the pop() in compile() mutating the cached token.
    if (tk.name === 'import' || tk.name === 'from') {
      // Names the nested import binds into _ctx: `{% import %}` binds one
      // namespace alias (the tail of args); `{% from %}` binds one per
      // requested entry (its alias name).
      var boundNames = (tk.name === 'import')
        ? [tk.args[tk.args.length - 1]]
        : utils.map(tk.args, function (a) { return a.aliasName; });
      macros.push({
        compiled: tk.compile(null, tk.args.slice(), tk.content, [], compileOpts) + '\n',
        isImport: true,
        boundNames: boundNames
      });
      return;
    }
    if (tk.name !== 'macro') {
      return;
    }
    var macroName = tk.args[0];
    var macroIR = tk.compile(backend.compile, tk.args, tk.content, [], compileOpts);
    var compiled = backend.compile([macroIR], [], compileOpts) + '\n';
    macros.push({ compiled: compiled, name: macroName });
  });

  token.args = macros.concat([aliasTok.match]);
  return true;
};

/**
 * Emit the namespace-prefix rewrite. Pops the alias off the tail of
 * `args` and splits the rest into macros and nested imports (flagged
 * `isImport` by parse()). Builds a `_ctx.<name>(\\W)(?!<allMacros>)`
 * regex for each imported macro and rewrites every occurrence in each
 * macro's compiled JS to `_ctx.<alias>.<name>`. Nested imports are
 * emitted first, re-homed under the alias (`_ctx.<boundName>` ->
 * `_ctx.<alias>.<boundName>`) so a file's own imports stay local and
 * never leak bare into the parent scope; the same re-homing is applied
 * to macro bodies that reference any bound name. Concatenates after the
 * `_ctx.<alias> = {};` namespace-init line and returns a JS source string
 * (the backend lifts it into `IRLegacyJS`).
 *
 * @return {string} JS source that initialises `_ctx.<alias>`, re-homes
 *                  any nested imports under it, and assigns every
 *                  imported macro into it.
 */
exports.compile = function (compiler, args, content, parents, options) {
  // Async-codegen branch. Parse stashed `[path, alias]` in async mode (no
  // macro pre-render); emit IRImportDeferred so the backend's
  // `_swig.getTemplate` + `.exports` bind happens at runtime.
  if (options && options.codegenMode === 'async') {
    return ir.importDeferred(
      ir.literal('string', args[0]),
      args[args.length - 1],
      options.filename || ''
    );
  }
  var ctx = args.pop();
  var macros = [];
  var nested = [];
  utils.each(args, function (a) {
    (a.isImport ? nested : macros).push(a);
  });
  var allMacros = utils.map(macros, function (arg) { return arg.name; }).join('|');
  var out = '_ctx.' + ctx + ' = {};\n  var _output = "";\n';
  var replacements = utils.map(macros, function (arg) {
    return {
      ex: new RegExp('_ctx\\.' + arg.name + '(\\W)(?!' + allMacros + ')', 'g'),
      re: '_ctx.' + ctx + '.' + arg.name + '$1'
    };
  });
  // Re-home every name a nested import binds under THIS alias so it stays
  // local to the imported file (Jinja2 scoping) and never leaks bare into the
  // parent: `_ctx.<boundName>` -> `_ctx.<alias>.<boundName>`, applied to both
  // the nested setup JS and every macro body below that references it.
  // Compounds across import depth (a 3-level chain re-homes at each layer
  // with no special-casing).
  var innerReplacements = [];
  utils.each(nested, function (a) {
    utils.each(a.boundNames, function (nm) {
      innerReplacements.push({
        ex: new RegExp('_ctx\\.' + nm + '(\\W)', 'g'),
        re: '_ctx.' + ctx + '.' + nm + '$1'
      });
    });
  });

  // Nested imports first, re-homed under the alias, so the macros defined
  // below resolve them at call time.
  utils.each(nested, function (a) {
    var c = a.compiled;
    utils.each(innerReplacements, function (re) { c = c.replace(re.ex, re.re); });
    out += c;
  });

  utils.each(macros, function (arg) {
    var c = arg.compiled;
    utils.each(replacements, function (re) { c = c.replace(re.ex, re.re); });
    utils.each(innerReplacements, function (re) { c = c.replace(re.ex, re.re); });
    out += c;
  });

  return out;
};
