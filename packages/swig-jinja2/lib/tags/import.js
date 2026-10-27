/*!
 * Jinja2 `{% import %}` tag.
 *
 * Jinja2 import syntax:
 *
 *   {% import "partial.html" as form %}
 *
 * Loads a template and imports every `{% macro %}` it defines into a
 * namespace bound to `_ctx.<alias>`. On the sync render path each imported
 * macro is rendered to JS via `backend.compile`, bound on the import's
 * scope object and on a closure variable of its scope function instead of
 * in the caller's context; `_utils.importScope` runs that function and
 * returns the namespace (see `backend.syncImport`), so a macro reaches its
 * siblings and the file's own imports with no rewrite of its JS. The async
 * render path loads the template at run time (IRImportDeferred).
 *
 * The tag returns a JS source string from `compile`; the backend lifts it
 * into `IRLegacyJS` at emit time.
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
 * and renders it to JS through `backend.compile`, bound on the import's
 * scope (`macroScope`), with the names it reads (`backend.macroRefs`). For
 * each nested `{% import %}` / `{% from %}` token (the imported file's own
 * imports), carries its compiled setup through flagged `isImport`, compiled
 * to bind on this import's scope (`importTarget`), with the names it binds
 * (`bound`), so macros defined here can reference it at call time. The
 * resulting entries + the alias string are stashed on `token.args` —
 * `exports.compile` pops the alias off the tail and emits the import
 * through `backend.syncImport`.
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
 *                         `[{compiled, name, refs}, ..., alias]` list.
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
    utils.throwError('Unsafe import alias "' + aliasTok.match + '" is not allowed (prototype-chain guard)', line, opts.filename);
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
  // The imported file's macros bind on the import's scope object, and its
  // own imports bind there too (see compile()).
  var macroOpts = utils.extend({}, compileOpts, { macroScope: true });
  var nestedOpts = utils.extend({}, compileOpts, { importTarget: '_scope' });
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
    // was never set up, and silently renders empty. They bind on this
    // import's scope object (nestedOpts), so none is visible bare in the
    // parent. `tk.args` is already parsed; slice() avoids the pop() in
    // compile() mutating the cached token.
    if (tk.name === 'import' || tk.name === 'from') {
      macros.push({
        compiled: tk.compile(null, tk.args.slice(), tk.content, [], nestedOpts) + '\n',
        isImport: true,
        // Names the nested import binds: `{% import %}` one namespace alias
        // (the tail of args); `{% from %}` one per requested entry.
        bound: (tk.name === 'import') ? [tk.args[tk.args.length - 1]] : utils.map(tk.args[0].entries, function (e) { return e.aliasName; })
      });
      return;
    }
    if (tk.name !== 'macro') {
      return;
    }
    // The body compiles with compileOpts, so a macro defined inside it binds
    // in the context as anywhere else; the macro itself binds on the
    // import's scope (macroOpts).
    var macroName = tk.args[0];
    var macroIR = tk.compile(backend.compile, tk.args, tk.content, [], compileOpts);
    var compiled = backend.compile([macroIR], [], macroOpts) + '\n';
    macros.push({ compiled: compiled, name: macroName, refs: backend.macroRefs(macroIR, macroOpts) });
  });

  token.args = macros.concat([aliasTok.match]);
  return true;
};

/**
 * Emit the import. Pops the alias off the tail of `args`; the rest, the
 * imported file's macros and its own imports (flagged `isImport` by
 * parse()), run in file order in the scope function `backend.syncImport`
 * builds, and the namespace `_utils.importScope` returns is bound to
 * `_ctx.<alias>`, or to the enclosing import's scope when this import sits
 * in an imported file (`options.importTarget`). Returns a JS source string
 * (the backend lifts it into `IRLegacyJS`).
 *
 * @return {string} JS source that binds the namespace of the imported
 *                  macros under the alias.
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
  // No _output declaration in this emit: it runs in the caller's body (the
  // template, a block, a loop or a macro), where one reset or shadowed what
  // was rendered before the tag.
  var ctx = args.pop();
  var body = '';
  var names = [];
  var refs = [];
  var bound = [];
  utils.each(args, function (a) {
    body += a.compiled;
    if (a.isImport) {
      bound = bound.concat(a.bound || []);
    } else {
      names.push(a.name);
      bound.push(a.name);
      refs = refs.concat(a.refs || []);
    }
  });
  return ((options && options.importTarget === '_scope') ? backend.scopeBinding(ctx) : '_ctx.' + ctx + ' = ') +
    backend.syncImport(body, names, refs, bound) + ';\n';
};
