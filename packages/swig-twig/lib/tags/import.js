/*!
 * Phase 3 Session 10 — Twig `{% import %}` tag.
 *
 * Twig import syntax:
 *
 *   {% import "partial.twig" as form %}
 *
 * Loads a template and imports every `{% macro %}` it defines into a
 * namespace bound to `_ctx.<alias>`. Each imported macro is rendered
 * to JS via `backend.compile`; the compile step performs regex surgery
 * on that rendered JS to rewrite `_ctx.<macroName>` →
 * `_ctx.<alias>.<macroName>`, including sibling-macro references
 * (the `(?!<allMacros>)` negative lookahead lifted from the native
 * `lib/tags/import.js`).
 *
 * The regex surgery is swig-specific coupling on the exact JS source
 * shape a Macro IR emits — it fails the flavor-invariant test and
 * stays on `IRLegacyJS`. The tag returns a JS source string from
 * `compile`; the backend lifts it into `IRLegacyJS` at emit time. When
 * the macro-name → namespace rewrite moves into the emitter itself, the
 * tag collapses to a dedicated `IRImport` node.
 *
 * Dynamic paths (`{% import dyn as ns %}`) and the plural
 * `{% from "file" import a, b %}` shorthand are deferred to a later
 * Twig-specific session.
 *
 * The alias is a bare identifier — dotted paths are rejected at parse
 * time, and CVE-2023-25345 prototype-chain names are rejected before
 * the namespace assignment. Lexer-folded-path bail per
 * `.claude/conventions.md § Lexer-folded-path bail`: single-name
 * binding slots reject any `.` in the match before the
 * `_dangerousProps` check.
 */

var utils = require('@rhinostone/swig-core/lib/utils');
var backend = require('@rhinostone/swig-core/lib/backend');
var _dangerousProps = require('@rhinostone/swig-core/lib/security').dangerousProps;

var lexer = require('../lexer');
var _t = require('../tokentypes');

exports.ends = false;
exports.block = true;

/**
 * Parse the `{% import %}` tag body. Extracts the STRING literal path,
 * the `as` keyword, and the bare-identifier alias; validates the alias
 * against the bare-identifier rule and the CVE-2023-25345
 * `_dangerousProps` blocklist.
 *
 * Walks the imported template's token list (via `swig.parseFile`) for
 * `{% macro %}` tokens; for each macro, invokes its `compile` to get
 * the IRMacro node and renders that node to JS through
 * `backend.compile`. The resulting `{compiled, name}` objects + the
 * alias string are stashed on `token.args` — `exports.compile` pops
 * the alias off the tail and performs the namespace-prefix rewrite on
 * each macro's compiled JS.
 *
 * @param  {string} str    Tag body.
 * @param  {number} line   Source line of the opening `{%`.
 * @param  {object} parser The Twig parser module (unused — the body is
 *                         lexed locally).
 * @param  {object} types  Twig lexer token-type enum.
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

  if (!swig || typeof swig.parseFile !== 'function') {
    utils.throwError('"import" tag requires an engine context with a loader', line, opts.filename);
  }

  var path = pathTok.match.replace(/^['"]|['"]$/g, '');
  var parseOpts = { resolveFrom: opts.filename };
  var compileOpts = utils.extend({}, opts, parseOpts);
  var parsed = swig.parseFile(path, parseOpts);
  var macros = [];

  utils.each(parsed.tokens, function (tk) {
    if (!tk || tk.name !== 'macro' || typeof tk.compile !== 'function') {
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
 * `args`, builds a `_ctx.<name>(\\W)(?!<allMacros>)` regex for each
 * imported macro, and rewrites every occurrence in each macro's
 * compiled JS to `_ctx.<alias>.<name>`. Concatenates the rewritten
 * bodies after the `_ctx.<alias> = {};` namespace-init line and
 * returns the result as a JS source string (the backend lifts it into
 * `IRLegacyJS`).
 *
 * @return {string} JS source that initialises `_ctx.<alias>` and
 *                  assigns every imported macro into it.
 */
exports.compile = function (compiler, args) {
  var ctx = args.pop();
  var allMacros = utils.map(args, function (arg) { return arg.name; }).join('|');
  var out = '_ctx.' + ctx + ' = {};\n  var _output = "";\n';
  var replacements = utils.map(args, function (arg) {
    return {
      ex: new RegExp('_ctx\\.' + arg.name + '(\\W)(?!' + allMacros + ')', 'g'),
      re: '_ctx.' + ctx + '.' + arg.name + '$1'
    };
  });

  utils.each(args, function (arg) {
    var c = arg.compiled;
    utils.each(replacements, function (re) {
      c = c.replace(re.ex, re.re);
    });
    out += c;
  });

  return out;
};
