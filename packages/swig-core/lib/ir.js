/**
 * Swig IR — intermediate representation for the shared backend.
 *
 * Phase 1: typedef stubs only. No runtime code here — Phase 1 keeps the
 * native frontend emitting JS source directly. Phase 2 ports the native
 * frontend to emit IR, at which point `@rhinostone/swig-core/lib/backend.js`
 * walks an IRTemplate and produces the compiled `new Function(...)` body.
 *
 * Every frontend (native Swig, Twig, Jinja2, Django) must lower its
 * parse tree into these shapes. Constructs that cannot lower cleanly
 * must throw at parse time — no silent partial behavior.
 *
 * See .claude/architecture/multi-flavor-ir.md for the full design doc,
 * trade-offs considered, and open questions.
 */

/**
 * Source-location metadata carried by every IR node so backend errors
 * surface the original line/column/filename unchanged.
 *
 * @typedef {Object} IRLoc
 * @property {number} line
 * @property {number} [column]
 * @property {string} [filename]
 */

/* ------------------------------------------------------------------ *
 * Statement nodes — body-level.
 * ------------------------------------------------------------------ */

/**
 * Root of every compiled template.
 *
 * @typedef {Object} IRTemplate
 * @property {'Template'} type
 * @property {IRStatement[]} body
 * @property {string} [parent]                Resolved path of the parent template (from `extends`).
 * @property {Object<string, IRBlock>} [blocks]  Block-name → Block IR subtree.
 * @property {IRLoc} [loc]
 */

/**
 * Literal text chunk. Value is JSON-escaped at backend emit time.
 *
 * @typedef {Object} IRText
 * @property {'Text'} type
 * @property {string} value
 * @property {IRLoc} [loc]
 */

/**
 * Output an expression with optional filter chain.
 * `safe: true` bypasses autoescape.
 *
 * @typedef {Object} IROutput
 * @property {'Output'} type
 * @property {IRExpr} expr
 * @property {IRFilterCall[]} [filters]
 * @property {boolean} [safe]
 * @property {IRLoc} [loc]
 */

/**
 * Filter invocation inside an Output or Filter region.
 * Distinct from statement-level {@link IRFilter} (region pipe).
 *
 * @typedef {Object} IRFilterCall
 * @property {string} name
 * @property {IRExpr[]} [args]
 */

/**
 * if / elif / else chain. Each branch's `test` is `null` for the
 * trailing else.
 *
 * @typedef {Object} IRIf
 * @property {'If'} type
 * @property {IRIfBranch[]} branches
 * @property {IRLoc} [loc]
 */

/**
 * @typedef {Object} IRIfBranch
 * @property {IRExpr|null} test
 * @property {IRStatement[]} body
 */

/**
 * For-loop. `emptyBody` supports Twig/Django `{% for … %}{% else %}`.
 *
 * @typedef {Object} IRFor
 * @property {'For'} type
 * @property {string} [key]                   Loop key var (second binding).
 * @property {string} value                   Loop value var (first binding).
 * @property {IRExpr} iterable
 * @property {IRStatement[]} body
 * @property {IRStatement[]} [emptyBody]
 * @property {IRLoc} [loc]
 */

/**
 * Named override point for template inheritance.
 *
 * @typedef {Object} IRBlock
 * @property {'Block'} type
 * @property {string} name
 * @property {IRStatement[]} body
 * @property {IRLoc} [loc]
 */

/**
 * @typedef {Object} IRInclude
 * @property {'Include'} type
 * @property {IRExpr} path                    Usually a string literal, but any expression is allowed.
 * @property {IRExpr} [context]               Explicit locals for the included template.
 * @property {boolean} [isolated]             Maps to Twig's `only`.
 * @property {IRLoc} [loc]
 */

/**
 * @typedef {Object} IRImport
 * @property {'Import'} type
 * @property {IRExpr} path
 * @property {string} alias                   Namespace name. MUST pass the dangerousProps guard.
 * @property {IRLoc} [loc]
 */

/**
 * Macro definition. Params are bare identifier names.
 *
 * @typedef {Object} IRMacro
 * @property {'Macro'} type
 * @property {string} name                    MUST pass the dangerousProps guard.
 * @property {IRMacroParam[]} params
 * @property {IRStatement[]} body
 * @property {IRLoc} [loc]
 */

/**
 * @typedef {Object} IRMacroParam
 * @property {string} name
 * @property {IRExpr} [default]
 */

/**
 * Statement-level function / macro invocation (no output capture).
 *
 * @typedef {Object} IRCall
 * @property {'Call'} type
 * @property {IRExpr} callee
 * @property {IRExpr[]} args
 * @property {IRLoc} [loc]
 */

/**
 * @typedef {Object} IRSet
 * @property {'Set'} type
 * @property {IRVarRef} target                MUST pass the dangerousProps guard at every path segment.
 * @property {IRExpr} value
 * @property {IRLoc} [loc]
 */

/**
 * Verbatim text. Never autoescaped, never re-parsed by the frontend.
 *
 * @typedef {Object} IRRaw
 * @property {'Raw'} type
 * @property {string} value
 * @property {IRLoc} [loc]
 */

/**
 * Emit the parent block's compiled content (super() / block.super).
 *
 * @typedef {Object} IRParent
 * @property {'Parent'} type
 * @property {IRLoc} [loc]
 */

/**
 * Push/pop an autoescape strategy for a body region.
 *
 * @typedef {Object} IRAutoescape
 * @property {'Autoescape'} type
 * @property {true|false|'html'|'js'} strategy
 * @property {IRStatement[]} body
 * @property {IRLoc} [loc]
 */

/**
 * Region-level filter pipe (Swig's `{% filter %}`, Twig's `{% apply %}`).
 *
 * @typedef {Object} IRFilter
 * @property {'Filter'} type
 * @property {string} name
 * @property {IRExpr[]} [args]
 * @property {IRStatement[]} body
 * @property {IRLoc} [loc]
 */

/**
 * Any body-level IR node.
 *
 * @typedef {(
 *   IRText | IROutput | IRIf | IRFor | IRBlock | IRInclude | IRImport |
 *   IRMacro | IRCall | IRSet | IRRaw | IRParent | IRAutoescape | IRFilter
 * )} IRStatement
 */

/* ------------------------------------------------------------------ *
 * Expression nodes.
 * ------------------------------------------------------------------ */

/**
 * @typedef {Object} IRLiteral
 * @property {'Literal'} type
 * @property {'string'|'number'|'bool'|'null'|'undefined'} kind
 * @property {string|number|boolean|null|undefined} value
 * @property {IRLoc} [loc]
 */

/**
 * Dot-path variable reference: `user.profile.name` → `{ path: ['user', 'profile', 'name'] }`.
 * Every path segment MUST pass the dangerousProps guard at backend emit time.
 *
 * @typedef {Object} IRVarRef
 * @property {'VarRef'} type
 * @property {string[]} path
 * @property {IRLoc} [loc]
 */

/**
 * Dynamic (bracket) property access: `obj[key]`. `key` is any expression.
 * When `key` is an {@link IRLiteral} of kind `'string'`, the backend
 * applies the dangerousProps guard.
 *
 * @typedef {Object} IRAccess
 * @property {'Access'} type
 * @property {IRExpr} object
 * @property {IRExpr} key
 * @property {IRLoc} [loc]
 */

/**
 * Binary operation. Frontends normalize aliases into canonical ops:
 * `gt` → `>`, `and` → `&&`, `is` → `===` (with sentinel-RHS lowering
 * for `is defined`, `is divisibleby(3)`, etc.).
 *
 * @typedef {Object} IRBinaryOp
 * @property {'BinaryOp'} type
 * @property {string} op
 * @property {IRExpr} left
 * @property {IRExpr} right
 * @property {IRLoc} [loc]
 */

/**
 * @typedef {Object} IRUnaryOp
 * @property {'UnaryOp'} type
 * @property {'!'|'-'|'+'} op
 * @property {IRExpr} operand
 * @property {IRLoc} [loc]
 */

/**
 * Ternary.
 *
 * @typedef {Object} IRConditional
 * @property {'Conditional'} type
 * @property {IRExpr} test
 * @property {IRExpr} then
 * @property {IRExpr} else
 * @property {IRLoc} [loc]
 */

/**
 * @typedef {Object} IRArrayLiteral
 * @property {'ArrayLiteral'} type
 * @property {IRExpr[]} elements
 * @property {IRLoc} [loc]
 */

/**
 * @typedef {Object} IRObjectLiteral
 * @property {'ObjectLiteral'} type
 * @property {IRObjectProperty[]} properties
 * @property {IRLoc} [loc]
 */

/**
 * @typedef {Object} IRObjectProperty
 * @property {IRExpr} key                     Usually an IRLiteral of kind 'string', but any expression is allowed.
 * @property {IRExpr} value
 */

/**
 * Function / method invocation at expression position.
 *
 * @typedef {Object} IRFnCall
 * @property {'FnCall'} type
 * @property {IRExpr} callee
 * @property {IRExpr[]} args
 * @property {IRLoc} [loc]
 */

/**
 * Any expression-position IR node.
 *
 * @typedef {(
 *   IRLiteral | IRVarRef | IRAccess | IRBinaryOp | IRUnaryOp |
 *   IRConditional | IRArrayLiteral | IRObjectLiteral | IRFnCall
 * )} IRExpr
 */

/* ------------------------------------------------------------------ *
 * No runtime exports in Phase 1. The module shape is kept consistent
 * with the rest of swig-core so future backend code can
 * `require('@rhinostone/swig-core/lib/ir')` for a shared type-only
 * surface under JSDoc tooling.
 * ------------------------------------------------------------------ */

module.exports = {};
