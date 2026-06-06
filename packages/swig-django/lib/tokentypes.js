/**
 * Django lexer token type enum — the contract between the Django lexer and
 * the Django parser in @rhinostone/swig-django.
 *
 * Numeric IDs in the shared range (0–25, 100) mirror
 * @rhinostone/swig-core/lib/tokentypes by design: Django and native Swig
 * lower to the same swig-core IR, and aligning the IDs keeps shared
 * consumers (e.g. CVE-2023-25345 `_dangerousProps` enforcement) flavor-
 * agnostic. The Django parser is its own module — it does not inherit from
 * swig-core's TokenParser — but the cognitive overhead of re-mapping IDs
 * across flavors is not worth the freedom.
 *
 * Django-only IDs (30+) are reserved here. The Django Template Language has
 * none of Jinja2's `~` concat, `**` power, or `//` floor-division operators
 * (so those Jinja2-only IDs are absent), but it does have `is` / `is not` —
 * as an *identity* comparison, not Jinja2's test calls — so IS / ISNOT keep
 * the same IDs as the Jinja2 sibling for consistency. `None` lexes to its
 * own NONE token (Django's null literal), distinct from BOOL (`True` /
 * `False`).
 *
 * @readonly
 * @enum {number}
 */
module.exports = {
  /** Whitespace */
  WHITESPACE: 0,
  /** Plain string literal */
  STRING: 1,
  /** Variable filter call with arguments — `|name(...)` (unused by Django; kept for ID alignment) */
  FILTER: 2,
  /** Variable filter call — `|name` (Django filters grab an optional `:arg` in the parser) */
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
  /** Colon — object-literal key/value separator, slice subscript, and Django filter argument separator (`|date:"Y"`) */
  COLON: 19,
  /** JavaScript-valid comparator (==, !=, <=, etc.) */
  COMPARATOR: 20,
  /** Boolean logic (`and`, `or`, `&&`, `||`) */
  LOGIC: 21,
  /** Boolean negation (`not`, `!`) */
  NOT: 22,
  /** Boolean literal (`True`, `False`) */
  BOOL: 23,
  /** Variable assignment (`=`, `+=`, `-=`, `*=`, `/=`) */
  ASSIGNMENT: 24,
  /** Method call open — internal */
  METHODOPEN: 25,

  /* ---- Django-only token IDs ---- */

  /** Django identity operator — `is` (lowers to `===`, NOT a Jinja2-style test call) */
  IS: 33,
  /** Django negated identity operator — `is not` (lowers to `!==`) */
  ISNOT: 34,
  /** Django null literal — `None` (lowers to a JS `null` literal) */
  NONE: 35,

  /** Unknown token */
  UNKNOWN: 100
};
