/**
 * Twig lexer token type enum — the contract between the Twig lexer and
 * the Twig parser in @rhinostone/swig-twig.
 *
 * Numeric IDs in the shared range (0–25, 100) mirror
 * @rhinostone/swig-core/lib/tokentypes by design: Twig and native Swig
 * lower to the same swig-core IR, and aligning the IDs keeps shared
 * consumers (e.g. backend.compile splice-through paths, CVE-2023-25345
 * `_dangerousProps` enforcement) flavor-agnostic. The Twig parser is
 * its own module — it does not inherit from swig-core's TokenParser —
 * but the cognitive overhead of re-mapping IDs across flavors is not
 * worth the freedom.
 *
 * Twig-only IDs (30–37) are reserved here so Session 3 can add lexer
 * rules without renumbering. Keeping the layout stable up front avoids
 * silent ID collisions across in-flight flavor work.
 *
 * See .claude/architecture/multi-flavor-ir.md § Phase 3 for the
 * per-flavor split decision.
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
  /** Colon — object literal key/value separator */
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

  /* ---- Twig-only token IDs (reserved; rules land in Session 3+) ---- */

  /** Twig string-concatenation operator — `~` */
  TILDE: 30,
  /** Twig range operator — `..` */
  RANGE: 31,
  /** Twig test operator — `is` */
  IS: 32,
  /** Twig negated test operator — `is not` */
  ISNOT: 33,
  /** Twig shorthand ternary — `?:` */
  QMARK: 34,
  /** Twig null-coalescing operator — `??` */
  NULLCOALESCE: 35,
  /** Twig string-interpolation open — `#{` inside double-quoted strings */
  INTERP_OPEN: 36,
  /** Twig string-interpolation close — `}` matching `#{` */
  INTERP_CLOSE: 37,

  /** Unknown token */
  UNKNOWN: 100
};
