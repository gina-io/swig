var utils = require('./utils'),
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
    var result = token.compile(exports.compile, token.args ? token.args.slice(0) : [], token.content ? token.content.slice(0) : [], parents, options, blockName);
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
      // Phase 2: single-branch shape. The if tag's content still carries
      // else/elseif as embedded LegacyJS fragments that close and reopen
      // the chain inline; multi-branch IR lowering is Session 14+ work
      // (when TokenParser migrates to IRExpr). The backend emits byte-
      // identical output to the pre-migration `if (cond) { ... }` form.
      var ifBranch = node.branches[0],
        ifBodyJS = '';
      utils.each(ifBranch.body, function (b) {
        if (b.type === 'LegacyJS') { ifBodyJS += b.js; return; }
        if (b.type === 'Text' || b.type === 'Raw') {
          ifBodyJS += '_output += "' + escapeTextValue(b.value) + '";\n';
          return;
        }
      });
      out += 'if (' + ifBranch.test + ') { \n' + ifBodyJS + '\n' + '}';
      return;
    }
    if (node.type === 'Set') {
      // Phase 2: target and value are transitional string fragments
      // (see IRSet typedef); the frontend's set-tag parse handler has
      // already applied the CVE-2023-25345 guards on the target path
      // segments. Emits `<target> <op> <value>;` verbatim.
      out += node.target + ' ' + node.op + ' ' + node.value + ';\n';
      return;
    }
    if (node.type === 'For') {
      // Phase 2: the full loopcache + _utils.each IIFE scaffolding is
      // emitted here; the frontend tag surfaces only (value, key,
      // iterable, body) and the backend owns all JS plumbing. `iterable`
      // is a transitional string fragment (see IRFor typedef) carrying
      // the TokenParser-emitted checkMatch expression verbatim. The
      // loopcache identifier uses `Math.random()` per-occurrence to keep
      // nested loops from clobbering each other's cache (gh-433).
      var forVal = node.value,
        forKey = node.key,
        forIterable = node.iterable,
        forBodyJS = '',
        ctxloopcache = ('_ctx.__loopcache' + Math.random()).replace(/\./g, ''),
        ctx = '_ctx.',
        ctxloop = '_ctx.loop';
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
      // Phase 2: `params` is a transitional string[] carrying the raw
      // token slice emitted by the frontend macro parser (including
      // `, ` separator tokens). Backend joins with `''` for the JS
      // function param list and with `'","'` for the _utils.each
      // shadow-delete indexOf check — preserves byte-identity with
      // the pre-Phase-2 JS-string compile. The frontend's macro parse
      // handler has already applied the CVE-2023-25345 guard on the
      // macro name via the FUNCTION/FUNCTIONEMPTY branches.
      var macroBodyJS = '';
      utils.each(node.body, function (b) {
        if (b.type === 'LegacyJS') { macroBodyJS += b.js; return; }
        if (b.type === 'Text' || b.type === 'Raw') {
          macroBodyJS += '_output += "' + escapeTextValue(b.value) + '";\n';
          return;
        }
      });
      var macroParams = node.params || [];
      out += '_ctx.' + node.name + ' = function (' + macroParams.join('') + ') {\n' +
        '  var _output = "",\n' +
        '    __ctx = _utils.extend({}, _ctx);\n' +
        '  _utils.each(_ctx, function (v, k) {\n' +
        '    if (["' + macroParams.join('","') + '"].indexOf(k) !== -1) { delete _ctx[k]; }\n' +
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
      // Phase 2: `path` and `context` are transitional string fragments
      // (see IRInclude typedef) carrying the TokenParser-emitted
      // expressions verbatim. `resolveFrom` is a plain filesystem path
      // that must be JSON-escaped into a string literal — the frontend's
      // include-tag parse handler has already applied a `\\` → `\\\\`
      // backslash escape before handing it off. `ignoreMissing` wraps the
      // emission in `try { ... } catch (e) {}` so missing-file errors
      // collapse to the empty string.
      var incCtx = node.context,
        incSelector;
      if (node.isolated && incCtx) {
        incSelector = incCtx;
      } else if (!incCtx) {
        incSelector = '_ctx';
      } else {
        incSelector = '_utils.extend({}, _ctx, ' + incCtx + ')';
      }
      out += (node.ignoreMissing ? '  try {\n' : '') +
        '_output += _swig.compileFile(' + node.path + ', {' +
        'resolveFrom: "' + node.resolveFrom + '"' +
        '})(' + incSelector + ');\n' +
        (node.ignoreMissing ? '} catch (e) {}\n' : '');
      return;
    }
    if (node.type === 'Filter') {
      var bodyJS = '';
      utils.each(node.body, function (b) {
        if (b.type === 'LegacyJS') { bodyJS += b.js; return; }
        if (b.type === 'Text' || b.type === 'Raw') {
          bodyJS += '_output += "' + escapeTextValue(b.value) + '";\n';
          return;
        }
      });
      var val = '(function () {\n  var _output = "";\n' + bodyJS + '  return _output;\n})()',
        argsJS = (node.args && node.args.length) ? ', ' + node.args.join('') : '';
      out += '_output += _filters["' + node.name + '"](' + val + argsJS + ');\n';
      return;
    }
  });

  return out;
};
