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
 * During the Phase 2 migration, `test` may transitionally carry a raw JS
 * source fragment (`string`) emitted by the frontend's TokenParser —
 * parallels the {@link IRFilter} `args` transitional shape. The target
 * shape is `IRExpr | null` and is reached once TokenParser migrates to
 * IRExpr emission (Session 14+). Backends that consume real `IRExpr`
 * values must tolerate the transitional string form or defer to the
 * emitted frontend JS. `test` is `null` for the trailing else branch.
 *
 * @typedef {Object} IRIfBranch
 * @property {IRExpr|string|null} test
 * @property {IRStatement[]} body
 */

/**
 * For-loop. `emptyBody` supports Twig/Django `{% for … %}{% else %}`.
 *
 * During the Phase 2 migration, `iterable` may transitionally carry a raw
 * JS source fragment (`string`) emitted by the frontend's TokenParser —
 * parallels the {@link IRFilter} `args` and {@link IRIfBranch} `test`
 * transitional shapes. The target shape is `IRExpr` and is reached once
 * TokenParser migrates to IRExpr emission (Session 14+). Backends that
 * consume real `IRExpr` values must tolerate the transitional string form
 * or defer to the emitted frontend JS.
 *
 * @typedef {Object} IRFor
 * @property {'For'} type
 * @property {string} [key]                   Loop key var (second binding).
 * @property {string} value                   Loop value var (first binding).
 * @property {IRExpr|string} iterable
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
 * During the Phase 2 migration, `path` and `context` may transitionally
 * carry raw JS source fragments (`string`) emitted by the frontend's
 * TokenParser — parallels the {@link IRSet} `target`/`value` transitional
 * shapes. The target shape is `IRExpr` and is reached once TokenParser
 * migrates to IRExpr emission (Session 14+). Backends that consume real
 * `IRExpr` values must tolerate the transitional string form.
 *
 * `ignoreMissing` maps to swig's `ignore missing` modifier (silently swallow
 * a compile-time load error from the included file). `resolveFrom` carries
 * the including template's filename so the loader can resolve relative
 * paths from the right anchor; empty string means "no anchor" (consumers
 * must treat it as a JS-safe double-quoted-string fragment).
 *
 * @typedef {Object} IRInclude
 * @property {'Include'} type
 * @property {IRExpr|string} path             Usually a string literal, but any expression is allowed.
 * @property {IRExpr|string} [context]        Explicit locals for the included template.
 * @property {boolean} [isolated]             Maps to Twig's `only`.
 * @property {boolean} [ignoreMissing]        Swallow loader errors when the file is missing.
 * @property {string} [resolveFrom]           Including template's filename (backslash-escaped) for loader-relative resolution.
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
 * During the Phase 2 migration, `target` and `value` may transitionally
 * carry raw JS source fragments (`string`) emitted by the frontend's
 * TokenParser — parallels the {@link IRFilter} `args`, {@link IRIfBranch}
 * `test`, and {@link IRFor} `iterable` transitional shapes. The target
 * shapes are `IRVarRef` and `IRExpr` respectively, reached once
 * TokenParser migrates to IRExpr emission (Session 14+). Backends that
 * consume real `IRVarRef` / `IRExpr` values must tolerate the transitional
 * string form or defer to the emitted frontend JS.
 *
 * `op` carries the assignment operator (`=`, `+=`, `-=`, `*=`, `/=`) so
 * the backend can emit `<target> <op> <value>;` without re-parsing.
 *
 * @typedef {Object} IRSet
 * @property {'Set'} type
 * @property {IRVarRef|string} target         MUST pass the dangerousProps guard at every path segment.
 * @property {string} op                      Assignment operator.
 * @property {IRExpr|string} value
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
 * During the Phase 2 migration, `args` may transitionally carry raw JS
 * source fragments (`string[]`) emitted by the frontend's TokenParser —
 * parallels the {@link IRLegacyJS} escape-hatch shape. The target shape is
 * `IRExpr[]` and is reached once TokenParser migrates to IRExpr emission
 * (Session 14+). Backends that consume real `IRExpr` values must tolerate
 * the transitional string form or defer to the emitted frontend JS.
 *
 * @typedef {Object} IRFilter
 * @property {'Filter'} type
 * @property {string} name
 * @property {(IRExpr|string)[]} [args]
 * @property {IRStatement[]} body
 * @property {IRLoc} [loc]
 */

/**
 * Legacy JS-string escape hatch for constructs whose codegen still lives
 * outside the IR emitters — userland `setTag`-registered tag `compile`
 * functions, and built-in tags not yet migrated to real IR nodes. The
 * backend concatenates `js` verbatim into the compiled template body.
 *
 * Transitional per the Phase 2 layering decision (hybrid / option iii);
 * see .claude/architecture/multi-flavor-ir.md.
 *
 * @typedef {Object} IRLegacyJS
 * @property {'LegacyJS'} type
 * @property {string} js
 * @property {IRLoc} [loc]
 */

/**
 * Any body-level IR node.
 *
 * @typedef {(
 *   IRText | IROutput | IRIf | IRFor | IRBlock | IRInclude | IRImport |
 *   IRMacro | IRCall | IRSet | IRRaw | IRParent | IRAutoescape | IRFilter |
 *   IRLegacyJS
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
 * Runtime node factories — Phase 2 scaffold (Session 7, 2026-04-14).
 *
 * Each factory returns a plain JSON-serialisable object matching one
 * of the typedefs above. `loc` is always optional; when omitted it is
 * not set on the returned node (consumers can distinguish via
 * `'loc' in node`). All other parameters are required unless documented
 * otherwise on the corresponding typedef.
 *
 * No consumers yet — this commit introduces the schema surface only.
 * Subsequent sessions will migrate the native frontend's token-tree
 * production over to these shapes. See the Phase 2 layering notes in
 * .claude/architecture/multi-flavor-ir.md.
 * ------------------------------------------------------------------ */

/*!
 * Attach `loc` to the node if provided, skipping the assignment otherwise
 * so consumers can tell "no source location available" from
 * "source location is the default IRLoc".
 * @private
 */
function withLoc(node, loc) {
  if (loc !== undefined) {
    node.loc = loc;
  }
  return node;
}

/* -- Statement factories ------------------------------------------- */

/**
 * Build a {@link IRTemplate} root node.
 * @param  {IRStatement[]} body
 * @param  {string}        [parent]
 * @param  {Object<string, IRBlock>} [blocks]
 * @param  {IRLoc}         [loc]
 * @return {IRTemplate}
 */
exports.template = function (body, parent, blocks, loc) {
  var node = { type: 'Template', body: body };
  if (parent !== undefined) { node.parent = parent; }
  if (blocks !== undefined) { node.blocks = blocks; }
  return withLoc(node, loc);
};

/**
 * Build an {@link IRText} literal-text node.
 * @param  {string} value
 * @param  {IRLoc}  [loc]
 * @return {IRText}
 */
exports.text = function (value, loc) {
  return withLoc({ type: 'Text', value: value }, loc);
};

/**
 * Build an {@link IROutput} node.
 * @param  {IRExpr}          expr
 * @param  {IRFilterCall[]}  [filters]
 * @param  {boolean}         [safe]
 * @param  {IRLoc}           [loc]
 * @return {IROutput}
 */
exports.output = function (expr, filters, safe, loc) {
  var node = { type: 'Output', expr: expr };
  if (filters !== undefined) { node.filters = filters; }
  if (safe !== undefined) { node.safe = safe; }
  return withLoc(node, loc);
};

/**
 * Build an {@link IRFilterCall}. Used inside `Output.filters` and as
 * the tag-level filter invocation carried by {@link IRFilter}.
 * Note: not a statement — helper shape.
 * @param  {string}    name
 * @param  {IRExpr[]}  [args]
 * @return {IRFilterCall}
 */
exports.filterCall = function (name, args) {
  var node = { name: name };
  if (args !== undefined) { node.args = args; }
  return node;
};

/**
 * Build an {@link IRIf} node from a sequence of branches.
 * @param  {IRIfBranch[]} branches
 * @param  {IRLoc}        [loc]
 * @return {IRIf}
 */
exports.ifStmt = function (branches, loc) {
  return withLoc({ type: 'If', branches: branches }, loc);
};

/**
 * Build an {@link IRIfBranch}. `test` is null for the trailing else.
 *
 * `test` is typed `IRExpr | string | null` for Phase 2 — see the
 * IRIfBranch typedef for the transitional shape. The factory stores
 * `test` opaquely and does not inspect it.
 *
 * @param  {IRExpr|string|null} test
 * @param  {IRStatement[]}      body
 * @return {IRIfBranch}
 */
exports.ifBranch = function (test, body) {
  return { test: test, body: body };
};

/**
 * Build an {@link IRFor} node.
 *
 * `iterable` is typed `IRExpr | string` for Phase 2 — see the IRFor typedef
 * for the transitional shape. The factory stores `iterable` opaquely and
 * does not inspect it.
 *
 * @param  {string}            value       Loop value identifier (first binding).
 * @param  {IRExpr|string}     iterable
 * @param  {IRStatement[]}     body
 * @param  {string}            [key]       Loop key identifier (second binding).
 * @param  {IRStatement[]}     [emptyBody]
 * @param  {IRLoc}             [loc]
 * @return {IRFor}
 */
exports.forStmt = function (value, iterable, body, key, emptyBody, loc) {
  var node = { type: 'For', value: value, iterable: iterable, body: body };
  if (key !== undefined) { node.key = key; }
  if (emptyBody !== undefined) { node.emptyBody = emptyBody; }
  return withLoc(node, loc);
};

/**
 * Build an {@link IRBlock} override point.
 * @param  {string}         name
 * @param  {IRStatement[]}  body
 * @param  {IRLoc}          [loc]
 * @return {IRBlock}
 */
exports.block = function (name, body, loc) {
  return withLoc({ type: 'Block', name: name, body: body }, loc);
};

/**
 * Build an {@link IRInclude} node.
 *
 * `path` and `context` are typed `IRExpr | string` for Phase 2 — see the
 * IRInclude typedef for the transitional shape. The factory stores both
 * opaquely and does not inspect them. `ignoreMissing` and `resolveFrom`
 * are swig-native modifiers carried through so the backend can build
 * the `_swig.compileFile(...)` emission.
 *
 * @param  {IRExpr|string} path
 * @param  {IRExpr|string} [context]
 * @param  {boolean}       [isolated]
 * @param  {boolean}       [ignoreMissing]
 * @param  {string}        [resolveFrom]
 * @param  {IRLoc}         [loc]
 * @return {IRInclude}
 */
exports.include = function (path, context, isolated, ignoreMissing, resolveFrom, loc) {
  var node = { type: 'Include', path: path };
  if (context !== undefined) { node.context = context; }
  if (isolated !== undefined) { node.isolated = isolated; }
  if (ignoreMissing !== undefined) { node.ignoreMissing = ignoreMissing; }
  if (resolveFrom !== undefined) { node.resolveFrom = resolveFrom; }
  return withLoc(node, loc);
};

/**
 * Build an {@link IRImport} node. `alias` MUST pass the dangerousProps
 * guard at backend emit time.
 * @param  {IRExpr}  path
 * @param  {string}  alias
 * @param  {IRLoc}   [loc]
 * @return {IRImport}
 */
exports.importStmt = function (path, alias, loc) {
  return withLoc({ type: 'Import', path: path, alias: alias }, loc);
};

/**
 * Build an {@link IRMacro} definition. `name` MUST pass the
 * dangerousProps guard at backend emit time.
 * @param  {string}         name
 * @param  {IRMacroParam[]} params
 * @param  {IRStatement[]}  body
 * @param  {IRLoc}          [loc]
 * @return {IRMacro}
 */
exports.macro = function (name, params, body, loc) {
  return withLoc({ type: 'Macro', name: name, params: params, body: body }, loc);
};

/**
 * Build an {@link IRMacroParam}.
 * @param  {string}  name
 * @param  {IRExpr}  [defaultValue]
 * @return {IRMacroParam}
 */
exports.macroParam = function (name, defaultValue) {
  var node = { name: name };
  if (defaultValue !== undefined) { node['default'] = defaultValue; }
  return node;
};

/**
 * Build an {@link IRCall} statement-level invocation.
 * @param  {IRExpr}   callee
 * @param  {IRExpr[]} args
 * @param  {IRLoc}    [loc]
 * @return {IRCall}
 */
exports.call = function (callee, args, loc) {
  return withLoc({ type: 'Call', callee: callee, args: args }, loc);
};

/**
 * Build an {@link IRSet} node. `target` MUST pass the dangerousProps
 * guard at every path segment at backend emit time.
 *
 * `target` and `value` are typed `IRVarRef | string` and `IRExpr | string`
 * for Phase 2 — see the IRSet typedef for the transitional shape. The
 * factory stores both opaquely and does not inspect them. `op` is the
 * JS assignment operator (`=`, `+=`, etc.).
 *
 * @param  {IRVarRef|string} target
 * @param  {string}          op
 * @param  {IRExpr|string}   value
 * @param  {IRLoc}           [loc]
 * @return {IRSet}
 */
exports.set = function (target, op, value, loc) {
  return withLoc({ type: 'Set', target: target, op: op, value: value }, loc);
};

/**
 * Build an {@link IRRaw} verbatim-text node.
 * @param  {string} value
 * @param  {IRLoc}  [loc]
 * @return {IRRaw}
 */
exports.raw = function (value, loc) {
  return withLoc({ type: 'Raw', value: value }, loc);
};

/**
 * Build an {@link IRParent} super()-equivalent node.
 * @param  {IRLoc} [loc]
 * @return {IRParent}
 */
exports.parent = function (loc) {
  return withLoc({ type: 'Parent' }, loc);
};

/**
 * Build an {@link IRAutoescape} region.
 * @param  {true|false|'html'|'js'} strategy
 * @param  {IRStatement[]}          body
 * @param  {IRLoc}                  [loc]
 * @return {IRAutoescape}
 */
exports.autoescape = function (strategy, body, loc) {
  return withLoc({ type: 'Autoescape', strategy: strategy, body: body }, loc);
};

/**
 * Build an {@link IRFilter} region-level filter pipe.
 *
 * `args` is typed `(IRExpr|string)[]` for Phase 2 — see the IRFilter
 * typedef for the transitional shape. The factory stores `args` opaquely
 * and does not inspect its elements.
 *
 * @param  {string}              name
 * @param  {IRStatement[]}       body
 * @param  {(IRExpr|string)[]}   [args]
 * @param  {IRLoc}               [loc]
 * @return {IRFilter}
 */
exports.filter = function (name, body, args, loc) {
  var node = { type: 'Filter', name: name, body: body };
  if (args !== undefined) { node.args = args; }
  return withLoc(node, loc);
};

/**
 * Build an {@link IRLegacyJS} escape-hatch node. Wraps a raw JS-source
 * fragment so the backend walker can splice it into the compiled body
 * without a dedicated emitter. The first consumer is `backend.compile`,
 * which wraps every current parse-tree token (string, VarToken, TagToken)
 * as an `IRLegacyJS` before emission; further built-in tags migrate to
 * real IR shapes in subsequent sessions.
 * @param  {string} js
 * @param  {IRLoc}  [loc]
 * @return {IRLegacyJS}
 */
exports.legacyJS = function (js, loc) {
  return withLoc({ type: 'LegacyJS', js: js }, loc);
};

/* -- Expression factories ------------------------------------------ */

/**
 * Build an {@link IRLiteral}.
 * @param  {'string'|'number'|'bool'|'null'|'undefined'} kind
 * @param  {string|number|boolean|null|undefined}        value
 * @param  {IRLoc}                                       [loc]
 * @return {IRLiteral}
 */
exports.literal = function (kind, value, loc) {
  return withLoc({ type: 'Literal', kind: kind, value: value }, loc);
};

/**
 * Build an {@link IRVarRef} dot-path variable reference. Every path
 * segment MUST pass the dangerousProps guard at backend emit time.
 * @param  {string[]} path
 * @param  {IRLoc}    [loc]
 * @return {IRVarRef}
 */
exports.varRef = function (path, loc) {
  return withLoc({ type: 'VarRef', path: path }, loc);
};

/**
 * Build an {@link IRAccess} dynamic-bracket property access.
 * @param  {IRExpr} object
 * @param  {IRExpr} key
 * @param  {IRLoc}  [loc]
 * @return {IRAccess}
 */
exports.access = function (object, key, loc) {
  return withLoc({ type: 'Access', object: object, key: key }, loc);
};

/**
 * Build an {@link IRBinaryOp}.
 * @param  {string} op
 * @param  {IRExpr} left
 * @param  {IRExpr} right
 * @param  {IRLoc}  [loc]
 * @return {IRBinaryOp}
 */
exports.binaryOp = function (op, left, right, loc) {
  return withLoc({ type: 'BinaryOp', op: op, left: left, right: right }, loc);
};

/**
 * Build an {@link IRUnaryOp}.
 * @param  {'!'|'-'|'+'} op
 * @param  {IRExpr}      operand
 * @param  {IRLoc}       [loc]
 * @return {IRUnaryOp}
 */
exports.unaryOp = function (op, operand, loc) {
  return withLoc({ type: 'UnaryOp', op: op, operand: operand }, loc);
};

/**
 * Build an {@link IRConditional} ternary. The parameter is named
 * `els` to avoid shadowing the reserved-word `else`; the produced
 * object uses `else` as a string key per the typedef.
 * @param  {IRExpr} test
 * @param  {IRExpr} then
 * @param  {IRExpr} els
 * @param  {IRLoc}  [loc]
 * @return {IRConditional}
 */
exports.conditional = function (test, then, els, loc) {
  var node = { type: 'Conditional', test: test, then: then };
  node['else'] = els;
  return withLoc(node, loc);
};

/**
 * Build an {@link IRArrayLiteral}.
 * @param  {IRExpr[]} elements
 * @param  {IRLoc}    [loc]
 * @return {IRArrayLiteral}
 */
exports.arrayLiteral = function (elements, loc) {
  return withLoc({ type: 'ArrayLiteral', elements: elements }, loc);
};

/**
 * Build an {@link IRObjectLiteral}.
 * @param  {IRObjectProperty[]} properties
 * @param  {IRLoc}              [loc]
 * @return {IRObjectLiteral}
 */
exports.objectLiteral = function (properties, loc) {
  return withLoc({ type: 'ObjectLiteral', properties: properties }, loc);
};

/**
 * Build an {@link IRObjectProperty}.
 * @param  {IRExpr} key
 * @param  {IRExpr} value
 * @return {IRObjectProperty}
 */
exports.objectProperty = function (key, value) {
  return { key: key, value: value };
};

/**
 * Build an {@link IRFnCall} expression-position invocation.
 * @param  {IRExpr}   callee
 * @param  {IRExpr[]} args
 * @param  {IRLoc}    [loc]
 * @return {IRFnCall}
 */
exports.fnCall = function (callee, args, loc) {
  return withLoc({ type: 'FnCall', callee: callee, args: args }, loc);
};
