var utils = require('./utils'),
  _security = require('./security'),
  ir = require('./ir');

/**
 * JS-codegen backend shared across @rhinostone/swig-family frontends.
 *
 * Phase 2 — the template-level walker dispatches on IR node shape. At
 * entry, each parse-tree token is lifted into an IR node: string tokens
 * become `IRText` (value carried verbatim, escaped at emit time);
 * VarToken / TagToken entries call `token.compile(...)` and the return
 * value is lifted according to its shape: a JS source string becomes
 * `IRLegacyJS` (userland `setTag` contract), a single IR node is spliced
 * in directly, and an array of IR nodes is flattened. The walker then
 * iterates the IR array and dispatches on node shape. Subsequent
 * sessions introduce further real IR emitters (`Autoescape`, `If`,
 * `For`, `Set`, etc.) alongside their matching tag migrations, and each
 * new shape gets its own dispatch branch here.
 *
 * Userland tag `compile` functions keep returning JS source strings —
 * the `(compiler, args, content, parents, options, blockName)` contract
 * is unchanged. Built-in tags migrate per session by returning IR nodes
 * directly. The `new Function(...)` wrapper stays with the native
 * frontend (filename-aware error attribution, per the seam rule).
 *
 * See .claude/architecture/multi-flavor-ir.md § Phase 2.
 */

/*!
 * JSON-escape a literal text chunk for embedding inside a JS
 * double-quoted string literal in the compiled template body.
 * @private
 */
function escapeTextValue(value) {
  return value.replace(/\\/g, '\\\\').replace(/\n|\r/g, '\\n').replace(/"/g, '\\"');
}

/**
 * Walk a parsed token tree and emit the JS source body for the compiled
 * template function. Each token is lifted into an IR node (`IRText` for
 * string chunks, `IRLegacyJS` for VarToken / TagToken) and the walker
 * dispatches on node shape to produce JS source.
 *
 * @param  {object|array} template Parsed token object (with `.tokens`) or a bare token array.
 * @param  {array}  [parents]      Parsed parent templates for extends/block resolution.
 * @param  {object} [options]      Swig options object.
 * @param  {string} [blockName]    Name of the enclosing `{% block %}`, if any.
 * @return {string}                JS source body. Does not include the `new Function(...)` wrapper.
 */
exports.compile = function (template, parents, options, blockName) {
  var out = '',
    tokens = utils.isArray(template) ? template : template.tokens,
    nodes = [];

  utils.each(tokens, function (token) {
    if (typeof token === 'string') {
      nodes.push(ir.text(token));
      return;
    }
    if (token && typeof token === 'object' && typeof token.type === 'string' && typeof token.compile !== 'function') {
      // Pre-built IR node handed in directly (e.g. the import tag
      // renders an isolated macro IR to JS via this pathway). Splice
      // in without a second compile pass.
      nodes.push(token);
      return;
    }
    var result = token.compile(exports.compile, token.args ? token.args.slice(0) : [], token.content ? token.content.slice(0) : [], parents, options, blockName, token);
    if (result === undefined || result === null || result === '') {
      return;
    }
    if (typeof result === 'string') {
      nodes.push(ir.legacyJS(result));
      return;
    }
    if (utils.isArray(result)) {
      utils.each(result, function (n) { nodes.push(n); });
      return;
    }
    if (typeof result === 'object' && typeof result.type === 'string') {
      nodes.push(result);
      return;
    }
    nodes.push(ir.legacyJS(String(result)));
  });

  utils.each(nodes, function (node) {
    if (node.type === 'Text' || node.type === 'Raw') {
      out += '_output += "' + escapeTextValue(node.value) + '";\n';
      return;
    }
    if (node.type === 'LegacyJS') {
      out += node.js;
      return;
    }
    if (node.type === 'Autoescape') {
      utils.each(node.body, function (b) {
        if (b.type === 'LegacyJS') { out += b.js; return; }
        if (b.type === 'Text' || b.type === 'Raw') {
          out += '_output += "' + escapeTextValue(b.value) + '";\n';
          return;
        }
      });
      return;
    }
    if (node.type === 'If') {
      // Phase 2 Session 14c: multi-branch shape. The native if tag owns
      // content scanning and splits at else/elseif marker tokens so each
      // IRIfBranch carries its own test + body. Session 14b Commit 11
      // widened `test` to `IRExpr | IRLegacyJS | null`: `IRExpr` for
      // clean expressions, `null` for the trailing else, `IRLegacyJS`
      // for the filter-in-test fallback (`if.lowerExpr` bails on
      // FILTER/FILTEREMPTY because per-operand filter precedence can't
      // be represented in flat IR — same pattern as `IROutput.expr`).
      // Raw JS strings stay supported for userland `setTag` compile
      // functions that may still hand in a string.
      //
      // Emission shape matches the pre-carve `} else if (...) {` /
      // `} else {` fragments that else.js and elseif.js used to return
      // inline — byte-identity held on the session baseline (see
      // Session 14c notes in roadmap).
      var ifOut = '';
      utils.each(node.branches, function (br, bi) {
        var bodyJS = '',
          testJS;
        utils.each(br.body, function (b) {
          if (b.type === 'LegacyJS') { bodyJS += b.js; return; }
          if (b.type === 'Text' || b.type === 'Raw') {
            bodyJS += '_output += "' + escapeTextValue(b.value) + '";\n';
            return;
          }
        });
        if (br.test === null) {
          ifOut += '} else {\n' + bodyJS;
          return;
        }
        if (br.test && typeof br.test === 'object' && br.test.type === 'LegacyJS') {
          testJS = br.test.js;
        } else if (typeof br.test === 'object' && typeof br.test.type === 'string') {
          testJS = exports.emitExpr(br.test);
        } else {
          testJS = br.test;
        }
        if (bi === 0) {
          ifOut += 'if (' + testJS + ') { \n' + bodyJS;
        } else {
          ifOut += '} else if (' + testJS + ') {\n' + bodyJS;
        }
      });
      out += ifOut + '\n' + '}';
      return;
    }
    if (node.type === 'Set') {
      // Phase 2 Session 14b Commit 10: target is structured IRVarRef
      // for pure-dot LHS shapes (`foo`, `foo.bar.baz`), emitted as a
      // bare `_ctx.<dot.path>` lvalue with a per-segment _dangerousProps
      // guard. Bracket-touched targets (`foo[bar]`, `foo["bar"]`, mixed
      // dot+bracket) stay on the transitional string fragment — the
      // bracket-lvalue contract is a cross-flavor design call and is
      // deferred. The frontend's set-tag parse handler retains its own
      // _dangerousProps guards on every LHS path segment per the
      // duplication invariant in .claude/security.md.
      // `value` is an IRExpr node (Session 14b) — backward-compat string
      // fallback preserved for userland setTag tags that may still hand
      // in a raw JS fragment. Emits `<target> <op> <value>;`.
      var setTargetJS;
      if (node.target && typeof node.target === 'object' && node.target.type === 'VarRef') {
        var setDeps = resolveDeps();
        if (!utils.isArray(node.target.path) || node.target.path.length === 0) {
          setDeps.throwError('Set: target VarRef must have a non-empty path');
        }
        utils.each(node.target.path, function (segment) {
          checkDangerousSegment(segment, setDeps, node.target);
        });
        setTargetJS = '_ctx.' + node.target.path.join('.');
      } else {
        setTargetJS = node.target;
      }
      var setValueJS;
      if (node.value && typeof node.value === 'object' && typeof node.value.type === 'string') {
        setValueJS = exports.emitExpr(node.value);
      } else {
        setValueJS = node.value;
      }
      out += setTargetJS + ' ' + node.op + ' ' + setValueJS + ';\n';
      return;
    }
    if (node.type === 'For') {
      // Phase 2: the full loopcache + _utils.each IIFE scaffolding is
      // emitted here; the frontend tag surfaces only (value, key,
      // iterable, body) and the backend owns all JS plumbing. `iterable`
      // is an IRExpr node (Session 14b) — backward-compat string fallback
      // preserved for userland setTag tags that may still hand in a raw
      // JS fragment. The loopcache identifier uses `Math.random()`
      // per-occurrence to keep nested loops from clobbering each other's
      // cache (gh-433).
      var forVal = node.value,
        forKey = node.key,
        forIterable,
        forBodyJS = '',
        ctxloopcache = ('_ctx.__loopcache' + Math.random()).replace(/\./g, ''),
        ctx = '_ctx.',
        ctxloop = '_ctx.loop';
      if (node.iterable && typeof node.iterable === 'object' && typeof node.iterable.type === 'string') {
        forIterable = exports.emitExpr(node.iterable);
      } else {
        forIterable = node.iterable;
      }
      utils.each(node.body, function (b) {
        if (b.type === 'LegacyJS') { forBodyJS += b.js; return; }
        if (b.type === 'Text' || b.type === 'Raw') {
          forBodyJS += '_output += "' + escapeTextValue(b.value) + '";\n';
          return;
        }
      });
      out += '(function () {\n' +
        '  var __l = ' + forIterable + ', __len = (_utils.isArray(__l) || typeof __l === "string") ? __l.length : _utils.keys(__l).length;\n' +
        '  if (!__l) { return; }\n' +
        '    var ' + ctxloopcache + ' = { loop: ' + ctxloop + ', ' + forVal + ': ' + ctx + forVal + ', ' + forKey + ': ' + ctx + forKey + ' };\n' +
        '    ' + ctxloop + ' = { first: false, index: 1, index0: 0, revindex: __len, revindex0: __len - 1, length: __len, last: false };\n' +
        '  _utils.each(__l, function (' + forVal + ', ' + forKey + ') {\n' +
        '    ' + ctx + forVal + ' = ' + forVal + ';\n' +
        '    ' + ctx + forKey + ' = ' + forKey + ';\n' +
        '    ' + ctxloop + '.key = ' + forKey + ';\n' +
        '    ' + ctxloop + '.first = (' + ctxloop + '.index0 === 0);\n' +
        '    ' + ctxloop + '.last = (' + ctxloop + '.revindex0 === 0);\n' +
        '    ' + forBodyJS +
        '    ' + ctxloop + '.index += 1; ' + ctxloop + '.index0 += 1; ' + ctxloop + '.revindex -= 1; ' + ctxloop + '.revindex0 -= 1;\n' +
        '  });\n' +
        '  ' + ctxloop + ' = ' + ctxloopcache + '.loop;\n' +
        '  ' + ctx + forVal + ' = ' + ctxloopcache + '.' + forVal + ';\n' +
        '  ' + ctx + forKey + ' = ' + ctxloopcache + '.' + forKey + ';\n' +
        '  ' + ctxloopcache + ' = undefined;\n' +
        '})();\n';
      return;
    }
    if (node.type === 'Macro') {
      // Phase 2: `params` is IRMacroParam[] (Session 14b Commit 8) —
      // structured `{name, default?}` entries. Backend builds the JS
      // function param list via `names.join(', ')` and the _utils.each
      // shadow-delete indexOf list via `names.map(JSON.stringify).join(',')`.
      // A string[] fallback is preserved for userland setTag tags that
      // may still hand in the pre-Phase-2 raw-token slice (including
      // the `, ` separator quirk). The frontend's macro parse handler
      // has already applied the CVE-2023-25345 guard on the macro name
      // (FUNCTION/FUNCTIONEMPTY) and every param name (VAR).
      var macroBodyJS = '';
      utils.each(node.body, function (b) {
        if (b.type === 'LegacyJS') { macroBodyJS += b.js; return; }
        if (b.type === 'Text' || b.type === 'Raw') {
          macroBodyJS += '_output += "' + escapeTextValue(b.value) + '";\n';
          return;
        }
      });
      var macroParams = node.params || [],
        macroSigJS,
        macroIndexOfJS;
      if (macroParams.length && typeof macroParams[0] === 'object' && macroParams[0] !== null && typeof macroParams[0].name === 'string') {
        var macroNames = [];
        utils.each(macroParams, function (p) { macroNames.push(p.name); });
        macroSigJS = macroNames.join(', ');
        var macroJsonNames = [];
        utils.each(macroNames, function (n) { macroJsonNames.push(JSON.stringify(n)); });
        macroIndexOfJS = macroJsonNames.join(',');
      } else {
        macroSigJS = macroParams.join('');
        macroIndexOfJS = '"' + macroParams.join('","') + '"';
      }
      out += '_ctx.' + node.name + ' = function (' + macroSigJS + ') {\n' +
        '  var _output = "",\n' +
        '    __ctx = _utils.extend({}, _ctx);\n' +
        '  _utils.each(_ctx, function (v, k) {\n' +
        '    if ([' + macroIndexOfJS + '].indexOf(k) !== -1) { delete _ctx[k]; }\n' +
        '  });\n' +
        macroBodyJS + '\n' +
        ' _ctx = _utils.extend(_ctx, __ctx);\n' +
        '  return _output;\n' +
        '};\n' +
        '_ctx.' + node.name + '.safe = true;\n';
      return;
    }
    if (node.type === 'Parent') {
      // Phase 2: the parent tag walks the parents chain at compile time
      // and splices the matched block's pre-resolved body into this node.
      // Emit the body verbatim; no wrapper, no `super()`-style runtime
      // plumbing is needed (the lookup is fully resolved at parse time).
      utils.each(node.body || [], function (b) {
        if (b.type === 'LegacyJS') { out += b.js; return; }
        if (b.type === 'Text' || b.type === 'Raw') {
          out += '_output += "' + escapeTextValue(b.value) + '";\n';
          return;
        }
      });
      return;
    }
    if (node.type === 'Block') {
      // Phase 2: block tokens are resolved at parse time by the engine's
      // remapBlocks / importNonBlocks — by the time the backend walks a
      // block, its body carries whichever generation's content is active.
      // Emit the body verbatim; the block name is carried as metadata for
      // downstream tooling (parent-chain walks happen in the parent tag).
      utils.each(node.body, function (b) {
        if (b.type === 'LegacyJS') { out += b.js; return; }
        if (b.type === 'Text' || b.type === 'Raw') {
          out += '_output += "' + escapeTextValue(b.value) + '";\n';
          return;
        }
      });
      return;
    }
    if (node.type === 'Include') {
      // Phase 2: `path` and `context` are IRExpr nodes (Session 14b
      // Commit 7) — per-slot dispatch on object-with-.type → emitExpr,
      // else verbatim string fallback preserves the userland setTag
      // path (compile functions that still hand in raw JS-source
      // fragments). `resolveFrom` is a plain filesystem path that must
      // be JSON-escaped into a string literal — the frontend's
      // include-tag parse handler has already applied a `\\` → `\\\\`
      // backslash escape before handing it off. `ignoreMissing` wraps
      // the emission in `try { ... } catch (e) {}` so missing-file
      // errors collapse to the empty string.
      var incPathJS, incCtxJS;
      if (node.path && typeof node.path === 'object' && typeof node.path.type === 'string') {
        incPathJS = exports.emitExpr(node.path);
      } else {
        incPathJS = node.path;
      }
      if (node.context !== undefined) {
        if (typeof node.context === 'object' && typeof node.context.type === 'string') {
          incCtxJS = exports.emitExpr(node.context);
        } else {
          incCtxJS = node.context;
        }
      }
      var incSelector;
      if (node.isolated && incCtxJS) {
        incSelector = incCtxJS;
      } else if (!incCtxJS) {
        incSelector = '_ctx';
      } else {
        incSelector = '_utils.extend({}, _ctx, ' + incCtxJS + ')';
      }
      out += (node.ignoreMissing ? '  try {\n' : '') +
        '_output += _swig.compileFile(' + incPathJS + ', {' +
        'resolveFrom: "' + node.resolveFrom + '"' +
        '})(' + incSelector + ');\n' +
        (node.ignoreMissing ? '} catch (e) {}\n' : '');
      return;
    }
    if (node.type === 'With') {
      // Phase 3 Session 12: scoped-context region (Twig's `{% with %}`).
      // Emits an IIFE that shadows `_ctx` for the body's lexical scope;
      // `_output` stays in the outer scope and is mutated via closure, so
      // body writes still flow to the compiled template's output.
      //
      // Selector shapes:
      //   bare    → _utils.extend({}, _ctx)           (shallow copy, no leak)
      //   ctx     → _utils.extend({}, _ctx, <ctx>)    (merge)
      //   only    → {}                                (isolated, no ctx)
      //   ctx+only → <ctx>                            (isolated, ctx is context)
      //
      // `context` is IRExpr — per-slot dispatch on object-with-.type →
      // emitExpr, else verbatim string fallback preserves the userland
      // setTag path for any future compile functions that hand in a raw
      // JS-source fragment.
      var withCtxJS;
      if (node.context !== undefined) {
        if (node.context && typeof node.context === 'object' && typeof node.context.type === 'string') {
          withCtxJS = exports.emitExpr(node.context);
        } else {
          withCtxJS = node.context;
        }
      }
      var withBodyJS = '';
      utils.each(node.body, function (b) {
        if (b.type === 'LegacyJS') { withBodyJS += b.js; return; }
        if (b.type === 'Text' || b.type === 'Raw') {
          withBodyJS += '_output += "' + escapeTextValue(b.value) + '";\n';
          return;
        }
      });
      var withSelector;
      if (node.isolated) {
        withSelector = (withCtxJS !== undefined) ? withCtxJS : '{}';
      } else if (withCtxJS !== undefined) {
        withSelector = '_utils.extend({}, _ctx, ' + withCtxJS + ')';
      } else {
        withSelector = '_utils.extend({}, _ctx)';
      }
      out += '(function (_ctx) {\n' + withBodyJS + '})(' + withSelector + ');\n';
      return;
    }
    if (node.type === 'Output') {
      // Phase 2: `expr` is typed IRExpr | IRLegacyJS (Session 14b
      // Commit 9). The frontend's parseVariable falls back to LegacyJS
      // for shapes the flat IROutput.filters chain can't represent
      // (per-operand filter precedence, deep filters, partial consumes,
      // string-valued autoescape). LegacyJS carries the complete
      // `_output += …;` envelope already wrapped by the legacy
      // TokenParser pass — emit verbatim. IR path emits
      // `_output += <filters wrapping emitted expr>;`.
      if (node.expr && node.expr.type === 'LegacyJS') {
        out += node.expr.js;
        return;
      }
      var outExprJS = exports.emitExpr(node.expr);
      if (node.filters && node.filters.length) {
        utils.each(node.filters, function (fc) {
          var fcArgsJS = '';
          if (fc.args && fc.args.length) {
            var fcParts = [];
            utils.each(fc.args, function (a) { fcParts.push(exports.emitExpr(a)); });
            fcArgsJS = ', ' + fcParts.join(', ');
          }
          outExprJS = '_filters["' + fc.name + '"](' + outExprJS + fcArgsJS + ')';
        });
      }
      out += '_output += ' + outExprJS + ';\n';
      return;
    }
    if (node.type === 'Filter') {
      // Phase 2: `args` is IRExpr[] (Session 14b Commit 6) — per-arg
      // dispatch on object-with-.type → emitExpr, else verbatim string
      // fallback preserves the userland setTag path (compile functions
      // that still hand in raw JS-source fragments).
      var bodyJS = '';
      utils.each(node.body, function (b) {
        if (b.type === 'LegacyJS') { bodyJS += b.js; return; }
        if (b.type === 'Text' || b.type === 'Raw') {
          bodyJS += '_output += "' + escapeTextValue(b.value) + '";\n';
          return;
        }
      });
      var val = '(function () {\n  var _output = "";\n' + bodyJS + '  return _output;\n})()',
        argsJS = '';
      if (node.args && node.args.length) {
        var parts = [];
        utils.each(node.args, function (a) {
          if (a && typeof a === 'object' && typeof a.type === 'string') {
            parts.push(exports.emitExpr(a));
          } else {
            parts.push(a);
          }
        });
        argsJS = ', ' + parts.join(', ');
      }
      out += '_output += _filters["' + node.name + '"](' + val + argsJS + ');\n';
      return;
    }
  });

  return out;
};

/**
 * Emit a JS-source fragment for a single IR expression node. Round-trip
 * target for the TokenParser → IRExpr migration (#T15 Session 14+): once
 * the frontend produces real {@link IRExpr} values, every transitional
 * `IRExpr | string` slot in the statement IR (IRFilter.args,
 * IRIfBranch.test, IRFor.iterable, IRSet.target/value, IRInclude.path/
 * context, IRMacro.params) is lowered to a plain string via this
 * function before the statement emitter splices it into the body.
 *
 * The emitter enforces the CVE-2023-25345 blocklist on every {@link
 * IRVarRef} path segment and every string-literal {@link IRAccess} key,
 * mirroring the guards on the frontend's TokenParser + tag-parse paths.
 * The frontend-side guards stay live per `.claude/security.md`; the
 * duplicate is intentional defense-in-depth during the migration.
 *
 * `deps` is an optional injection hook:
 *   - `deps.dangerousProps` — override the security blocklist. Defaults
 *     to `require('./security').dangerousProps`.
 *   - `deps.throwError(msg, line, filename)` — override the throw shape.
 *     Defaults to `utils.throwError`, matching the seam rule for
 *     filename-opaque attribution (see
 *     .claude/architecture/multi-flavor-ir.md § Filename-awareness seam).
 *
 * @param  {object} node    IR expression node (any IRExpr shape).
 * @param  {object} [deps]  Optional dependency overrides.
 * @return {string}         JS-source fragment.
 */
exports.emitExpr = function (node, deps) {
  return emitExpr(node, resolveDeps(deps));
};

/*!
 * Resolve an optional `deps` bag into a fully populated one. @private
 */
function resolveDeps(deps) {
  deps = deps || {};
  return {
    dangerousProps: deps.dangerousProps || _security.dangerousProps,
    throwError: deps.throwError || utils.throwError
  };
}

/*!
 * Central dispatch — pick the emitter for this IR node's `type`. @private
 */
function emitExpr(node, d) {
  if (!node || typeof node.type !== 'string') {
    d.throwError('emitExpr: expected an IR expression node');
  }
  switch (node.type) {
  case 'Literal':       return emitLiteral(node, d);
  case 'VarRef':        return emitVarRef(node, d);
  case 'VarRefExists':  return emitVarRefExists(node, d);
  case 'Access':        return emitAccess(node, d);
  case 'BinaryOp':      return emitBinaryOp(node, d);
  case 'UnaryOp':       return emitUnaryOp(node, d);
  case 'Conditional':   return emitConditional(node, d);
  case 'ArrayLiteral':  return emitArrayLiteral(node, d);
  case 'ObjectLiteral': return emitObjectLiteral(node, d);
  case 'FnCall':        return emitFnCall(node, d);
  case 'FilterCall':    return emitFilterCall(node, d);
  }
  d.throwError('emitExpr: unknown IR expression type "' + node.type + '"');
}

/*!
 * Fire a CVE-2023-25345 guard if `segment` resolves to a prototype-chain
 * property. Attaches loc-derived line/filename when the source node
 * carries them. @private
 */
function checkDangerousSegment(segment, d, node) {
  if (d.dangerousProps.indexOf(segment) !== -1) {
    var line = (node && node.loc && node.loc.line) || undefined;
    var filename = (node && node.loc && node.loc.filename) || undefined;
    d.throwError('Unsafe access to "' + segment + '" is not allowed in templates (CVE-2023-25345)', line, filename);
  }
}

/*!
 * Emit a literal value. Strings go through JSON.stringify so embedded
 * quotes / backslashes / newlines land correctly inside the compiled
 * function body. @private
 */
function emitLiteral(node, d) {
  switch (node.kind) {
  case 'string':    return JSON.stringify(node.value);
  case 'number':    return String(node.value);
  case 'bool':      return node.value ? 'true' : 'false';
  case 'null':      return 'null';
  case 'undefined': return 'undefined';
  }
  d.throwError('emitLiteral: unknown literal kind "' + node.kind + '"');
}

/*!
 * Emit a dot-path variable reference. Byte-identical to
 * TokenParser.prototype.checkMatch — any divergence breaks the
 * Commit 3+ migration gates. @private
 */
function emitVarRef(node, d) {
  if (!utils.isArray(node.path) || node.path.length === 0) {
    d.throwError('emitVarRef: path must be a non-empty array');
  }
  utils.each(node.path, function (segment) {
    checkDangerousSegment(segment, d, node);
  });
  return checkMatchExpr(node.path);
}

/*!
 * Emit an existence-only check for a dot-path variable. Result is a JS
 * boolean expression — truthy when every segment of `node.path` resolves
 * defined and non-null in either `_ctx` or the surrounding closure
 * scope, falsy otherwise. Distinct from {@link emitVarRef}, which
 * coerces a missing or null result to `""` and so loses the
 * defined/undefined signal that Twig's `is defined` test and `??`
 * undefined-fallback need to preserve. @private
 */
function emitVarRefExists(node, d) {
  if (!utils.isArray(node.path) || node.path.length === 0) {
    d.throwError('emitVarRefExists: path must be a non-empty array');
  }
  utils.each(node.path, function (segment) {
    checkDangerousSegment(segment, d, node);
  });
  return '(' + checkDotExpr(node.path, '_ctx.') + ' || ' + checkDotExpr(node.path, '') + ')';
}

/*!
 * Build a `(typeof <head> !== "undefined" && <head> !== null && ...)`
 * expression that is truthy when every segment of `path` is defined and
 * non-null under the given lookup prefix (`'_ctx.'` for the dotted-ctx
 * walk, `''` for the bare-closure walk).
 *
 * Hoisted out of {@link checkMatchExpr}'s inline `checkDot` closure so
 * {@link emitVarRefExists} can reuse the same shape for Twig's
 * `is defined` / `is null` tests and `??` undefined-fallback. The output
 * MUST stay byte-identical to the pre-extraction inline form, since
 * {@link checkMatchExpr}'s downstream concatenation is what every
 * compiled VarRef body relies on. @private
 */
function checkDotExpr(path, ctxPrefix) {
  var c = ctxPrefix + path[0],
    build = '';

  build = '(typeof ' + c + ' !== "undefined" && ' + c + ' !== null';
  utils.each(path, function (v, i) {
    if (i === 0) {
      return;
    }
    build += ' && ' + c + '.' + v + ' !== undefined && ' + c + '.' + v + ' !== null';
    c += '.' + v;
  });
  build += ')';

  return build;
}

/*!
 * Replica of `TokenParser.prototype.checkMatch`. Kept as a local private
 * helper rather than imported from tokenparser.js because (a) it is a
 * pure function of its argument and (b) the backend must not acquire a
 * runtime dependency on the TokenParser module (which is a specific
 * frontend concern, not a shared-backend one). @private
 */
function checkMatchExpr(match) {
  var result;

  function buildDot(ctx) {
    return '(' + checkDotExpr(match, ctx) + ' ? ' + ctx + match.join('.') + ' : "")';
  }
  result = '(' + checkDotExpr(match, '_ctx.') + ' ? ' + buildDot('_ctx.') + ' : ' + buildDot('') + ')';
  return '(' + result + ' !== null ? ' + result + ' : ' + '"" )';
}

/*!
 * Emit a dynamic bracket access. When the key is a string literal, guard
 * it against prototype-chain pollution — mirrors the STRING-in-
 * BRACKETOPEN check in TokenParser. @private
 */
function emitAccess(node, d) {
  if (node.key && node.key.type === 'Literal' && node.key.kind === 'string') {
    checkDangerousSegment(node.key.value, d, node);
  }
  return emitExpr(node.object, d) + '[' + emitExpr(node.key, d) + ']';
}

/*!
 * Arithmetic ops get surrounding spaces (`a + b`); logic / comparator
 * ops are emitted bare (`a&&b`) to match TokenParser's LOGIC /
 * COMPARATOR output shape. `in` needs trailing space so the keyword
 * detokenises — `(a)in(b)` parses but `ain(b)` does not. @private
 */
function isArithmeticOp(op) {
  return op === '+' || op === '-' || op === '*' || op === '/' || op === '%';
}

function emitBinaryOp(node, d) {
  var left = emitExpr(node.left, d),
    right = emitExpr(node.right, d);
  if (isArithmeticOp(node.op)) {
    return left + ' ' + node.op + ' ' + right;
  }
  if (node.op === 'in') {
    return left + ' in ' + right;
  }
  // Twig/Jinja2 `~` is explicit string-concat: both sides coerce to
  // string before `+` runs. A bare `<left>~<right>` emission would be
  // JS unary bitwise-NOT and SyntaxError.
  if (node.op === '~') {
    return '(String(' + left + ') + String(' + right + '))';
  }
  // Twig `??` undefined-fallback: when LHS is a VarRef, route through
  // IRVarRefExists to preserve the defined/undefined signal. emitVarRef
  // coerces missing/null lookups to "", and "" is defined — a bare
  // `<left>??<right>` emission would never take the fallback branch.
  // Non-VarRef LHS (FnCall, FilterCall, Literal) doesn't coerce that
  // way, so falling through to bare `left??right` is correct there.
  if (node.op === '??' && node.left && node.left.type === 'VarRef') {
    var existsNode = ir.varRefExists(node.left.path, node.left.loc);
    return '(' + emitVarRefExists(existsNode, d) + ' ? ' + left + ' : ' + right + ')';
  }
  return left + node.op + right;
}

function emitUnaryOp(node, d) {
  var operandJS = emitExpr(node.operand, d);
  if (node.operand && node.operand.type === 'BinaryOp') {
    operandJS = '(' + operandJS + ')';
  }
  return node.op + operandJS;
}

function emitConditional(node, d) {
  return '(' + emitExpr(node.test, d) + ' ? ' + emitExpr(node.then, d) + ' : ' + emitExpr(node['else'], d) + ')';
}

function emitArrayLiteral(node, d) {
  var elements = [];
  utils.each(node.elements, function (el) {
    elements.push(emitExpr(el, d));
  });
  return '[' + elements.join(', ') + ']';
}

function emitObjectLiteral(node, d) {
  var props = [];
  utils.each(node.properties, function (p) {
    props.push(emitExpr(p.key, d) + ':' + emitExpr(p.value, d));
  });
  return '{' + props.join(', ') + '}';
}

/*!
 * Emit a function / method invocation. Three callee shapes:
 *   1. Single-segment VarRef (`foo(...)`) — FUNCTION-token pattern with
 *      the `_ctx.foo || foo || _fn` fallback ladder.
 *   2. Multi-segment VarRef (`foo.bar(...)`) — method-call pattern with
 *      `.call(<receiver>, ...)` so `this` binds to the receiver object,
 *      matching TokenParser's PARENOPEN-after-VAR METHODOPEN branch.
 *   3. Any other callee expression — plain `(<callee>)(args)`.
 * @private
 */
function emitFnCall(node, d) {
  var args = [],
    callee = node.callee,
    name,
    receiver,
    argsJS;

  utils.each(node.args, function (a) {
    args.push(emitExpr(a, d));
  });
  argsJS = args.join(', ');

  if (callee && callee.type === 'VarRef' && utils.isArray(callee.path)) {
    utils.each(callee.path, function (segment) {
      checkDangerousSegment(segment, d, callee);
    });

    if (callee.path.length === 1) {
      name = callee.path[0];
      return '((typeof _ctx.' + name + ' !== "undefined") ? _ctx.' + name +
        ' : ((typeof ' + name + ' !== "undefined") ? ' + name +
        ' : _fn))(' + argsJS + ')';
    }

    receiver = callee.path.slice(0, -1);
    return '(' + checkMatchExpr(callee.path) + ' || _fn).call(' +
      checkMatchExpr(receiver) +
      (argsJS ? ', ' + argsJS : '') +
      ')';
  }

  return '(' + emitExpr(callee, d) + ')(' + argsJS + ')';
}

/*!
 * Emit an expression-position filter invocation —
 * `_filters["<name>"](<input>[, <args>])`. Mirrors the top-level drain
 * in the Output emitter, but reads its input from `node.input` (a real
 * {@link IRExpr}) rather than accumulating positionally. @private
 */
function emitFilterCall(node, d) {
  var inputJS = emitExpr(node.input, d),
    argsJS = '';
  if (node.args && node.args.length) {
    var parts = [];
    utils.each(node.args, function (a) { parts.push(emitExpr(a, d)); });
    argsJS = ', ' + parts.join(', ');
  }
  return '_filters["' + node.name + '"](' + inputJS + argsJS + ')';
}
