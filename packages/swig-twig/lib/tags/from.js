/*!
 * Phase 3 Session 11 — Twig `{% from "file" import a, b as c %}` tag.
 *
 * Selective macro import syntax — binds a named subset of an imported
 * template's macros into the current context, optionally renaming each
 * via `as <alias>`:
 *
 *   {% from "forms.twig" import input %}
 *   {% from "forms.twig" import input, textarea %}
 *   {% from "forms.twig" import input as field, textarea %}
 *
 * Differs from `{% import %}` in that each entry lands at top-level
 * `_ctx.<alias-or-name>` rather than inside a shared namespace object.
 * Macros not listed in the `import` clause are not surfaced.
 *
 * Stays on `IRLegacyJS` per the same flavor-invariant test that keeps
 * `{% import %}` on IRLegacyJS — the regex-surgery rewrite of a compiled
 * macro body (`_ctx\.<origName>` → `_ctx\.<aliasName>`) is swig-specific
 * coupling on the exact JS source shape the Macro IR emits. When the
 * macro-name → alias rewrite moves into the IR emitter itself, this tag
 * collapses to a dedicated `IRFromImport` node.
 *
 * Dynamic paths (`{% from dynPath import foo %}`) are rejected at parse
 * time — same rationale as `{% import %}` + `{% extends %}`.
 *
 * Every requested macro name and every alias is a bare identifier —
 * dotted paths are rejected per the lexer-folded-path bail pattern, and
 * CVE-2023-25345 prototype-chain names are rejected on both slots before
 * the assignment lands on `_ctx`.
 */

var utils = require('@rhinostone/swig-core/lib/utils');
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
 * for each requested macro, invokes its `compile` to get the IRMacro
 * node and renders that node to JS through `backend.compile`. A
 * macro requested by name but not found in the imported template
 * raises a filename-aware throw. The resulting
 * `[{compiled, origName, aliasName}, ...]` list is stashed on
 * `token.args` for the compile step to rewrite.
 *
 * @param  {string} str    Tag body.
 * @param  {number} line   Source line of the opening `{%`.
 * @param  {object} parser The Twig parser module (unused — body is
 *                         lexed locally).
 * @param  {object} types  Twig lexer token-type enum.
 * @param  {Array}  stack  Open-tag stack (unused — from has no body).
 * @param  {object} opts   Per-call options. Honors `opts.filename` for
 *                         `resolveFrom` + filename-aware throws.
 * @param  {object} swig   Swig instance. Must expose `parseFile`.
 * @param  {object} token  In-progress TagToken. `token.args` gets the
 *                         `[{compiled, origName, aliasName}, ...]` list.
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
      utils.throwError('Unsafe ' + role.toLowerCase() + ' "' + name + '" is not allowed (CVE-2023-25345)', line, opts.filename);
    }
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

  if (!swig || typeof swig.parseFile !== 'function') {
    utils.throwError('"from" tag requires an engine context with a loader', line, opts.filename);
  }

  var path = pathTok.match.replace(/^['"]|['"]$/g, '');
  var parseOpts = { resolveFrom: opts.filename };
  var compileOpts = utils.extend({}, opts, parseOpts);
  var parsed = swig.parseFile(path, parseOpts);

  // Index the imported template's macros by name so we can look up
  // each requested entry once. Raises a filename-aware throw if an
  // entry names a macro that doesn't exist in the imported template.
  var macroIndex = {};
  utils.each(parsed.tokens, function (tk) {
    if (!tk || tk.name !== 'macro' || typeof tk.compile !== 'function') {
      return;
    }
    macroIndex[tk.args[0]] = tk;
  });

  var resolved = [];
  for (var i = 0; i < entries.length; i += 1) {
    var entry = entries[i];
    var macroTok = macroIndex[entry.origName];
    if (!macroTok) {
      utils.throwError('Macro "' + entry.origName + '" not found in "' + path + '"', line, opts.filename);
    }
    var macroIR = macroTok.compile(backend.compile, macroTok.args, macroTok.content, [], compileOpts);
    var compiled = backend.compile([macroIR], [], compileOpts) + '\n';
    resolved.push({
      compiled: compiled,
      origName: entry.origName,
      aliasName: entry.aliasName
    });
  }

  token.args = resolved;
  return true;
};

/**
 * Emit the selective-import rewrite. For each imported entry, rewrites
 * every occurrence of `_ctx.<origName>` in the compiled macro body to
 * `_ctx.<aliasName>`, including sibling-macro references to any other
 * imported name. The `(?!<allOrigNames>)` negative lookahead matches
 * `lib/tags/import.js` behaviour — guards against the edge case where
 * a rewritten `_ctx.<aliasName>` fragment would itself be re-matched by
 * a later replacement whose `origName` happens to be a prefix of the
 * alias tail.
 *
 * Sibling references to a macro that was NOT in the import list are
 * left as-is — those expand to `_ctx.<origName>` lookups at render time
 * and will either read a user-provided context value or evaluate to
 * `undefined`, matching Twig's "unimported macros are not available"
 * semantic.
 *
 * @return {string} JS source that assigns every imported macro into
 *                  `_ctx.<aliasName>`. Backend lifts it into
 *                  `IRLegacyJS`.
 */
exports.compile = function (compiler, args) {
  var allOrigNames = utils.map(args, function (arg) { return arg.origName; }).join('|');
  var replacements = utils.map(args, function (arg) {
    return {
      ex: new RegExp('_ctx\\.' + arg.origName + '(\\W)(?!' + allOrigNames + ')', 'g'),
      re: '_ctx.' + arg.aliasName + '$1'
    };
  });

  var out = '  var _output = "";\n';
  utils.each(args, function (arg) {
    var c = arg.compiled;
    utils.each(replacements, function (re) {
      c = c.replace(re.ex, re.re);
    });
    out += c;
  });

  return out;
};
