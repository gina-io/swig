/*!
 * Jinja2 `{% from "file" import a, b as c %}` tag.
 *
 * Selective macro import syntax — binds a named subset of an imported
 * template's macros into the current context, optionally renaming each
 * via `as <alias>`:
 *
 *   {% from "forms.html" import input %}
 *   {% from "forms.html" import input, textarea %}
 *   {% from "forms.html" import input as field, textarea %}
 *
 * Differs from `{% import %}` in that each entry lands at top-level
 * `_ctx.<alias-or-name>` rather than inside a shared namespace object.
 * Macros not listed in the `import` clause are not bound in the caller's
 * context; the listed ones still reach them, and the file's own imports,
 * while they run, as on the async render path and in Jinja2.
 *
 * On the sync render path the imported file's macros and its own imports
 * run in the scope function `backend.syncImport` builds, bound on the
 * import's scope object instead of in the caller's context, and each
 * requested macro is then bound under its name or alias. The tag returns a
 * JS source string from `compile`; the backend lifts it into `IRLegacyJS`.
 *
 * Dynamic paths (`{% from dynPath import foo %}`) are rejected at parse
 * time — same rationale as `{% import %}` + `{% extends %}`. Context
 * modifiers (`with` / `without context`) are not honored — imported
 * macros always see the caller context (swig's macro model; a documented
 * divergence from Jinja2's without-context import default).
 *
 * Every requested macro name and every alias is a bare identifier —
 * dotted paths are rejected per the lexer-folded-path bail pattern, and
 * CVE-2023-25345 prototype-chain names are rejected on both slots before
 * the assignment lands on `_ctx`.
 */

var utils = require('@rhinostone/swig-core/lib/utils');
var ir = require('@rhinostone/swig-core/lib/ir');
var backend = require('@rhinostone/swig-core/lib/backend');
var _dangerousProps = require('@rhinostone/swig-core/lib/security').dangerousProps;

var lexer = require('../lexer');

exports.ends = false;
exports.block = true;

/**
 * Parse the `{% from %}` tag body. Extracts the STRING literal path,
 * the `import` keyword, and the comma-separated entry list (each entry
 * is `<name>` or `<name> as <alias>`); validates every name and alias
 * against the bare-identifier rule and the CVE-2023-25345
 * `_dangerousProps` blocklist.
 *
 * Walks the imported template's token list (via `swig.parseFile`) and
 * for each macro, invokes its `compile` to get the IRMacro node and
 * renders that node to JS through `backend.compile`, bound on the
 * import's scope (`macroScope`), with the names it reads
 * (`backend.macroRefs`). Every macro of the file is compiled, so a
 * requested macro reaches an unrequested sibling. A macro requested by
 * name but not found in the imported template raises a filename-aware
 * throw. The imported file's own nested `{% import %}` / `{% from %}`
 * tokens are carried through, compiled to bind on the import's scope
 * (`importTarget`), so the macros can reference them at call time. The
 * result, `[{body, names, refs, bound, entries}]`, is stashed on
 * `token.args` for the compile step.
 *
 * @param  {string} str    Tag body.
 * @param  {number} line   Source line of the opening `{%`.
 * @param  {object} parser The Jinja2 parser module (unused — body is
 *                         lexed locally).
 * @param  {object} types  Jinja2 lexer token-type enum.
 * @param  {Array}  stack  Open-tag stack (unused — from has no body).
 * @param  {object} opts   Per-call options. Honors `opts.filename` for
 *                         `resolveFrom` + filename-aware throws.
 * @param  {object} swig   Swig instance. Must expose `parseFile`.
 * @param  {object} token  In-progress TagToken. `token.args` gets the
 *                         `[{body, names, refs, bound, entries}]` list.
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
  function guardName(name, role) {
    if (name.indexOf('.') !== -1) {
      utils.throwError(role + ' "' + name + '" must be a bare identifier in "from" tag', line, opts.filename);
    }
    if (_dangerousProps.indexOf(name) !== -1) {
      utils.throwError('Unsafe ' + role.toLowerCase() + ' "' + name + '" is not allowed (prototype-chain guard)', line, opts.filename);
    }
    parser.guardConstantName(name, 'from', line, opts.filename);
  }

  var pathTok = consume();
  if (!pathTok) {
    utils.throwError('Expected template path in "from" tag', line, opts.filename);
  }
  if (pathTok.type !== types.STRING) {
    utils.throwError('Dynamic "from" is not supported — path must be a string literal', line, opts.filename);
  }

  var importTok = consume();
  if (!importTok || importTok.type !== types.VAR || importTok.match !== 'import') {
    utils.throwError('Expected "import" keyword after path in "from" tag', line, opts.filename);
  }

  // Collect requested macro entries — each is `<name>` or
  // `<name> as <alias>`. At least one entry is required.
  var entries = [];
  while (true) {
    var nameTok = consume();
    if (!nameTok || nameTok.type !== types.VAR) {
      utils.throwError('Expected macro name in "from" tag', line, opts.filename);
    }
    guardName(nameTok.match, 'Macro name');

    var origName = nameTok.match;
    var aliasName = origName;

    var next = peek();
    if (next && next.type === types.VAR && next.match === 'as') {
      consume();
      var aliasTok = consume();
      if (!aliasTok || aliasTok.type !== types.VAR) {
        utils.throwError('Expected alias after "as" in "from" tag', line, opts.filename);
      }
      guardName(aliasTok.match, 'Import alias');
      aliasName = aliasTok.match;
      next = peek();
    }

    entries.push({ origName: origName, aliasName: aliasName });

    if (!next) { break; }
    if (next.type !== types.COMMA) {
      utils.throwError('Unexpected token "' + next.match + '" in "from" tag import list', line, opts.filename);
    }
    consume();
  }

  var path = pathTok.match.replace(/^['"]|['"]$/g, '');

  if (opts && opts.codegenMode === 'async') {
    // Async mode skips parse-time parseFile + macro pre-render. compile()
    // emits IRFromImportDeferred; runtime resolves the template via
    // _swig.getTemplate and binds each entry on _ctx.
    token.args = [{ path: path, entries: entries }];
    return true;
  }

  if (!swig || typeof swig.parseFile !== 'function') {
    utils.throwError('"from" tag requires an engine context with a loader', line, opts.filename);
  }

  var parseOpts = { resolveFrom: opts.filename };
  var compileOpts = utils.extend({}, opts, parseOpts);
  // The imported file's macros bind on the import's scope object, and its
  // own imports bind there too (see compile()).
  var macroOpts = utils.extend({}, compileOpts, { macroScope: true });
  var nestedOpts = utils.extend({}, compileOpts, { importTarget: '_scope' });
  var parsed = swig.parseFile(path, parseOpts);

  // Compile the imported file's own imports and all of its macros, in file
  // order: compile() runs them in the scope function backend.syncImport
  // builds, so a requested macro reaches its siblings and the file's own
  // imports while it runs, and none of them lands in the parent's bare
  // scope. A macro body compiles with compileOpts, so a macro defined
  // inside it binds in the context as anywhere else.
  var body = '';
  var names = [];
  var refs = [];
  var bound = [];
  utils.each(parsed.tokens, function (tk) {
    if (!tk || typeof tk.compile !== 'function') {
      return;
    }
    if (tk.name === 'import' || tk.name === 'from') {
      body += tk.compile(null, tk.args.slice(), tk.content, [], nestedOpts) + '\n';
      bound = bound.concat((tk.name === 'import') ? [tk.args[tk.args.length - 1]] : utils.map(tk.args[0].entries, function (e) { return e.aliasName; }));
      return;
    }
    if (tk.name !== 'macro') {
      return;
    }
    var macroName = tk.args[0];
    var macroIR = tk.compile(backend.compile, tk.args, tk.content, [], compileOpts);
    body += backend.compile([macroIR], [], macroOpts) + '\n';
    names.push(macroName);
    bound.push(macroName);
    refs = refs.concat(backend.macroRefs(macroIR, macroOpts));
  });

  // Raise a filename-aware throw if an entry names a macro that doesn't
  // exist in the imported template.
  for (var i = 0; i < entries.length; i += 1) {
    if (names.indexOf(entries[i].origName) === -1) {
      utils.throwError('Macro "' + entries[i].origName + '" not found in "' + path + '"', line, opts.filename);
    }
  }

  token.args = [{ body: body, names: names, refs: refs, bound: bound, entries: entries }];
  return true;
};

/**
 * Emit the selective import. The imported file's own imports and its
 * macros run in the scope function `backend.syncImport` builds, and each
 * requested entry is then bound at `_ctx.<aliasName>`, or on the enclosing
 * import's scope when this tag sits in an imported file
 * (`options.importTarget`).
 *
 * A macro that was NOT in the import list is not bound in the caller's
 * context, but the requested macros reach it while they run, as on the
 * async render path and in Jinja2.
 *
 * @return {string} JS source that binds every requested macro under its
 *                  alias. Backend lifts it into `IRLegacyJS`.
 */
exports.compile = function (compiler, args, content, parents, options) {
  // Async-codegen branch. Parse stashed a single bundle
  // `[{path, entries: [{origName, aliasName}, ...]}]` in async mode (no
  // macro pre-render); emit IRFromImportDeferred so the backend's
  // `_swig.getTemplate` + per-entry `_ctx.<bind>` assignment happens at
  // runtime.
  if (options && options.codegenMode === 'async') {
    var bundle = args[0];
    var imports = utils.map(bundle.entries, function (e) {
      return {
        name: e.origName,
        alias: e.aliasName === e.origName ? null : e.aliasName
      };
    });
    return ir.fromImportDeferred(
      ir.literal('string', bundle.path),
      imports,
      options.filename || ''
    );
  }
  // The exports land in a local of a function called at once, `_imp`, and
  // each requested one is bound under its alias. No _output declaration in
  // this emit: it runs in the caller's body (the template, a block, a loop
  // or a macro), where one reset or shadowed what was rendered before.
  var spec = args[0];
  var toScope = !!(options && options.importTarget === '_scope');
  var bindings = '';
  utils.each(spec.entries, function (e) {
    bindings += '  ' + (toScope ? backend.scopeBinding(e.aliasName) : '_ctx.' + e.aliasName + ' = ') + '_imp[' + JSON.stringify(e.origName) + '];\n';
  });
  return '(function () {\n  var _imp = ' + backend.syncImport(spec.body, spec.names, spec.refs, spec.bound) + ';\n' + bindings + '})();\n';
};
