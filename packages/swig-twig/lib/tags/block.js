/*!
 * Phase 3 Session 9 — Twig `{% block %}` tag.
 *
 * Named override point for template inheritance:
 *
 *   {% block <name> %}…{% endblock %}
 *
 * The block name must be a bare identifier (dotted paths rejected) and
 * passes the CVE-2023-25345 `_dangerousProps` guard. The parser
 * captures the block in `template.blocks[name]` when it appears at the
 * top level (see `packages/swig-twig/lib/parser.js` — the block-keying
 * branch is triggered by `token.block && !stack.length`).
 *
 * Compile emits an `IRBlock` node with the body wrapped in IRLegacyJS.
 * The backend's `Block` branch emits the body verbatim — block-override
 * resolution happens at parse time via `engine.remapBlocks` /
 * `importNonBlocks`, which substitutes the child's block content into
 * the parent's token tree before backend emission.
 *
 * Native hardening gap flagged: `lib/tags/block.js` uses
 * `parser.on('*')` and does NOT guard the block name against
 * `_dangerousProps`. A `{% block __proto__ %}` in native Swig would
 * key the blocks map by that name; the override path does not currently
 * reach the prototype chain but the cross-layer invariant is to guard
 * anyway. See .claude/architecture/multi-flavor-ir.md § Phase 3 —
 * Session 9 native hardening follow-up.
 */

var ir = require('@rhinostone/swig-core/lib/ir');
var utils = require('@rhinostone/swig-core/lib/utils');
var _dangerousProps = require('@rhinostone/swig-core/lib/security').dangerousProps;

var lexer = require('../lexer');
var _t = require('../tokentypes');

exports.ends = true;
exports.block = true;

/**
 * Parse the `{% block %}` tag body. Extracts the bare-identifier name,
 * validates it against `_dangerousProps` and the dotted-path rule, and
 * stashes it on `token.args` so the parser's top-level block-keying
 * branch can pick it up via `token.args.join('')`.
 *
 * @param  {string} str    Tag body.
 * @param  {number} line   Source line of the opening `{%`.
 * @param  {object} parser The Twig parser module (unused here — block
 *                         names are plain identifiers).
 * @param  {object} types  Twig lexer token-type enum.
 * @param  {Array}  stack  Open-tag stack (parser.js manages the push).
 * @param  {object} opts   Per-call options (honors `opts.filename`).
 * @param  {object} swig   Swig instance (unused).
 * @param  {object} token  In-progress TagToken. `token.args` gets the
 *                         block name as its single element.
 * @return {boolean}       Always `true` on success. Throws otherwise.
 */
exports.parse = function (str, line, parser, types, stack, opts, swig, token) {
  var tokens = lexer.read(utils.strip(str));
  var pos = 0;

  while (pos < tokens.length && tokens[pos].type === types.WHITESPACE) { pos += 1; }
  var nameTok = pos < tokens.length ? tokens[pos] : null;
  if (!nameTok || nameTok.type !== types.VAR) {
    utils.throwError('Expected block name in "block" tag', line, opts.filename);
  }
  if (nameTok.match.indexOf('.') !== -1) {
    utils.throwError('Block name "' + nameTok.match + '" must be a bare identifier', line, opts.filename);
  }
  if (_dangerousProps.indexOf(nameTok.match) !== -1) {
    utils.throwError('Unsafe block name "' + nameTok.match + '" is not allowed (CVE-2023-25345)', line, opts.filename);
  }

  pos += 1;
  while (pos < tokens.length && tokens[pos].type === types.WHITESPACE) { pos += 1; }
  if (pos < tokens.length) {
    utils.throwError('Unexpected token "' + tokens[pos].match + '" after block name', line, opts.filename);
  }

  token.args = [nameTok.match];
  return true;
};

/**
 * Emit an IRBlock node. Body is the recursively-compiled content
 * wrapped in IRLegacyJS. Mirrors the native `lib/tags/block.js` compile
 * shape so the backend's `Block` branch treats both frontends the same.
 *
 * @return {object} IRBlock node.
 */
exports.compile = function (compiler, args, content, parents, options) {
  var name = args.join('');
  return ir.block(name, [ir.legacyJS(compiler(content, parents, options, name))]);
};
