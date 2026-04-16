/*!
 * Phase 3 Session 10 — Twig `{% macro %}` tag.
 *
 * Twig macro syntax:
 *
 *   {% macro name() %}…{% endmacro %}
 *   {% macro name(a, b, c) %}…{% endmacro %}
 *
 * Defines a reusable function bound to `_ctx.<name>`. Backend emits the
 * full IIFE (`_utils.extend` snapshot, shadow-delete of param names from
 * `_ctx`, body, restore) — see backend.js:236. Tag ships only semantic
 * IR: name, params (`IRMacroParam[]`), body.
 *
 * Param names and the macro name are bare identifiers — dotted paths
 * (`foo.bar`) and CVE-2023-25345 prototype-chain names (`__proto__`,
 * `constructor`, `prototype`) are rejected at parse time. Lexer-folded
 * dotted-path bail per `.claude/conventions.md § Lexer-folded-path bail`:
 * single-name binding slots reject any `.` in the match before the
 * `_dangerousProps` check.
 *
 * Twig kwargs (`{% macro foo(a=1, b="x") %}`) are deferred — Phase 4 with
 * the rest of the Twig-specific surface.
 */

var ir = require('@rhinostone/swig-core/lib/ir');
var utils = require('@rhinostone/swig-core/lib/utils');
var _dangerousProps = require('@rhinostone/swig-core/lib/security').dangerousProps;

var lexer = require('../lexer');
var _t = require('../tokentypes');

exports.ends = true;
exports.block = true;

/**
 * Parse the `{% macro %}` tag body. Extracts the macro name and the
 * optional comma-separated parameter list. Both name and params are
 * validated against the bare-identifier rule and the CVE-2023-25345
 * `_dangerousProps` blocklist.
 *
 * Accepts both shapes:
 *   `name` + FUNCTION/FUNCTIONEMPTY (Twig idiomatic)
 *   `name(a, b)` lexed as FUNCTION token whose `match` is the name
 *
 * Stashes `[name, {name: p1}, {name: p2}, ...]` on `token.args`. Compile
 * lifts the name off the head and passes the remaining param objects
 * straight to `ir.macro` — the backend handles the IIFE.
 *
 * @param  {string} str    Tag body.
 * @param  {number} line   Source line of the opening `{%`.
 * @param  {object} parser The Twig parser module (unused — macro body is
 *                         lexed locally).
 * @param  {object} types  Twig lexer token-type enum.
 * @param  {Array}  stack  Open-tag stack (unused — parser.js manages push).
 * @param  {object} opts   Per-call options (honors `opts.filename`).
 * @param  {object} swig   Swig instance (unused).
 * @param  {object} token  In-progress TagToken. `token.args` gets the
 *                         macro name + IRMacroParam objects.
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

  function checkName(name, role) {
    if (name.indexOf('.') !== -1) {
      utils.throwError(role + ' "' + name + '" must be a bare identifier in "macro" tag', line, opts.filename);
    }
    if (_dangerousProps.indexOf(name) !== -1) {
      utils.throwError('Unsafe ' + role.toLowerCase() + ' "' + name + '" is not allowed (CVE-2023-25345)', line, opts.filename);
    }
  }

  var head = consume();
  if (!head) {
    utils.throwError('Expected macro name in "macro" tag', line, opts.filename);
  }

  var name;
  var params = [];

  if (head.type === types.FUNCTIONEMPTY) {
    name = head.match;
    checkName(name, 'Macro name');
  } else if (head.type === types.FUNCTION) {
    name = head.match;
    checkName(name, 'Macro name');
    var first = true;
    while (true) {
      var tk = peek();
      if (!tk) {
        utils.throwError('Unclosed parameter list in "macro" tag', line, opts.filename);
      }
      if (tk.type === types.PARENCLOSE) {
        consume();
        break;
      }
      if (!first) {
        if (tk.type !== types.COMMA) {
          utils.throwError('Expected "," between parameters in "macro" tag', line, opts.filename);
        }
        consume();
      }
      first = false;
      var pTok = consume();
      if (!pTok || pTok.type !== types.VAR) {
        utils.throwError('Expected parameter name in "macro" tag', line, opts.filename);
      }
      checkName(pTok.match, 'Parameter');
      params.push(ir.macroParam(pTok.match));
    }
  } else if (head.type === types.VAR) {
    name = head.match;
    checkName(name, 'Macro name');
  } else {
    utils.throwError('Expected macro name in "macro" tag', line, opts.filename);
  }

  if (peek()) {
    utils.throwError('Unexpected token "' + peek().match + '" after macro signature in "macro" tag', line, opts.filename);
  }

  token.args = [name].concat(params);
  return true;
};

/**
 * Emit an IRMacro node. Backend's `Macro` branch owns the `_ctx.<name>
 * = function(...) { … }` IIFE + `_utils.extend` snapshot + shadow-delete
 * of param names from `_ctx`.
 *
 * @return {object} IRMacro node.
 */
exports.compile = function (compiler, args, content, parents, options, blockName) {
  var name = args[0];
  var params = args.slice(1);
  var bodyJS = compiler(content, parents, options, blockName);
  return ir.macro(name, params, [ir.legacyJS(bodyJS)]);
};
