/**
 * Lexer token type enum — the contract between a flavor-specific lexer
 * and the shared TokenParser in @rhinostone/swig-core.
 *
 * Every frontend (native Swig, future Twig / Jinja2 / Django) supplies
 * its own lexer with per-flavor regex rules. The TokenParser dispatches
 * on these numeric IDs, so the IDs themselves must be stable across
 * flavors. Flavor-specific extensions (e.g. Twig's `~` concatenation,
 * `??` null-coalescing) may add new IDs above the reserved range, but
 * must not re-use existing ones.
 *
 * Kept as a standalone module (rather than folded into the lexer) so
 * that TokenParser can consume the enum without reaching into any
 * frontend-specific code.
 *
 * @readonly
 * @enum {number}
 */
module.exports = {
  /** Whitespace */
  WHITESPACE: 0,
  /** Plain string */
  STRING: 1,
  /** Variable filter */
  FILTER: 2,
  /** Empty variable filter */
  FILTEREMPTY: 3,
  /** Function */
  FUNCTION: 4,
  /** Function with no arguments */
  FUNCTIONEMPTY: 5,
  /** Open parenthesis */
  PARENOPEN: 6,
  /** Close parenthesis */
  PARENCLOSE: 7,
  /** Comma */
  COMMA: 8,
  /** Variable */
  VAR: 9,
  /** Number */
  NUMBER: 10,
  /** Math operator */
  OPERATOR: 11,
  /** Open square bracket */
  BRACKETOPEN: 12,
  /** Close square bracket */
  BRACKETCLOSE: 13,
  /** Key on an object using dot-notation */
  DOTKEY: 14,
  /** Start of an array */
  ARRAYOPEN: 15,
  /** End of an array
   * Currently unused
  ARRAYCLOSE: 16, */
  /** Open curly brace */
  CURLYOPEN: 17,
  /** Close curly brace */
  CURLYCLOSE: 18,
  /** Colon (:) */
  COLON: 19,
  /** JavaScript-valid comparator */
  COMPARATOR: 20,
  /** Boolean logic */
  LOGIC: 21,
  /** Boolean logic "not" */
  NOT: 22,
  /** true or false */
  BOOL: 23,
  /** Variable assignment */
  ASSIGNMENT: 24,
  /** Start of a method */
  METHODOPEN: 25,
  /** End of a method
   * Currently unused
  METHODEND: 26, */
  /** Unknown type */
  UNKNOWN: 100
};
