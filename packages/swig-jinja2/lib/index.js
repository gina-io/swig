/**
 * @rhinostone/swig-jinja2 — Jinja2 frontend for the @rhinostone/swig family.
 *
 * Scaffold. The lexer, expression parser, tags, filters, and the
 * end-to-end render wiring (`engine.install(self, frontend)` from
 * @rhinostone/swig-core) land in subsequent commits. Until then the
 * package exposes its flavor name and a parse stub that throws so callers
 * get a clear "not implemented yet" signal rather than a silent miss.
 */

exports.name = 'jinja2';

/**
 * Parse a Jinja2 template source string into a swig-core token tree.
 *
 * Stub — the Jinja2 lexer + expression parser are not wired yet. Throws
 * until the parser surface lands.
 *
 * @example
 * var jinja2 = require('@rhinostone/swig-jinja2');
 * jinja2.parse('{{ name }}'); // throws until the parser lands
 *
 * @param  {string} source Template source string.
 * @return {object}        Token tree (once implemented).
 */
exports.parse = function (source) {
  throw new Error('@rhinostone/swig-jinja2 is not yet implemented.');
};
