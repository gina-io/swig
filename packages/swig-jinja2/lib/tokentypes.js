/**
 * Jinja2 lexer token type enum — the contract between the Jinja2 lexer and
 * the Jinja2 parser in @rhinostone/swig-jinja2.
 *
 * Numeric IDs in the shared range (0–25, 100) mirror
 * @rhinostone/swig-core/lib/tokentypes by design: Jinja2 and native Swig
 * lower to the same swig-core IR, and aligning the IDs keeps shared
 * consumers (e.g. CVE-2023-25345 `_dangerousProps` enforcement) flavor-
 * agnostic. The Jinja2 parser is its own module — it does not inherit
 * from swig-core's TokenParser — but the cognitive overhead of re-mapping
 * IDs across flavors is not worth the freedom.
 *
 * Jinja2-only IDs (30+) are reserved here so later commits can add lexer
 * rules without renumbering. Jinja2 has no range (`..`), null-coalescing
 * (`??`), ternary (`?:`), or `#{}` string interpolation operators, so the
 * Jinja2-only block is smaller than Twig's: `~` concat, `**` power, `//`
 * floor-division, and the `is` / `is not` test keywords.
 *
 * @readonly
 * @enum {number}
 */
module.exports = {
  /** Whitespace */
  WHITESPACE: 0,
  /** Plain string literal */
  STRING: 1,
  /** Variable filter call with arguments — `|name(...)` */
  FILTER: 2,
  /** Variable filter call with no arguments — `|name` */
  FILTEREMPTY: 3,
  /** Function call with arguments — `name(...)` */
  FUNCTION: 4,
  /** Function call with no arguments — `name()` */
  FUNCTIONEMPTY: 5,
  /** Open parenthesis */
  PARENOPEN: 6,
  /** Close parenthesis */
  PARENCLOSE: 7,
  /** Comma */
  COMMA: 8,
  /** Variable identifier */
  VAR: 9,
  /** Numeric literal */
  NUMBER: 10,
  /** Math operator (+, -, *, /, %) */
  OPERATOR: 11,
  /** Open square bracket */
  BRACKETOPEN: 12,
  /** Close square bracket */
  BRACKETCLOSE: 13,
  /** Dot-key accessor — `.key` */
  DOTKEY: 14,
  /** Open square bracket at the start of an array literal */
  ARRAYOPEN: 15,
  /** Open curly brace */
  CURLYOPEN: 17,
  /** Close curly brace */
  CURLYCLOSE: 18,
  /** Colon — object-literal key/value separator, and slice subscript */
  COLON: 19,
  /** JavaScript-valid comparator (==, !=, <=, etc.) */
  COMPARATOR: 20,
  /** Boolean logic (`and`, `or`, `&&`, `||`) */
  LOGIC: 21,
  /** Boolean negation (`not`, `!`) */
  NOT: 22,
  /** Boolean literal (`true`, `false`) */
  BOOL: 23,
  /** Variable assignment (`=`, `+=`, `-=`, `*=`, `/=`) */
  ASSIGNMENT: 24,
  /** Method call open — internal */
  METHODOPEN: 25,

  /* ---- Jinja2-only token IDs (reserved; rules land in later commits) ---- */

  /** Jinja2 string-concatenation operator — `~` */
  TILDE: 30,
  /** Jinja2 exponentiation operator — `**` */
  POWER: 31,
  /** Jinja2 floor-division operator — `//` */
  FLOORDIV: 32,
  /** Jinja2 test operator — `is` */
  IS: 33,
  /** Jinja2 negated test operator — `is not` */
  ISNOT: 34,

  /** Unknown token */
  UNKNOWN: 100
};
