var utils = require('./utils'),
  _security = require('./security'),
  ir = require('./ir');

/**
 * JS-codegen backend shared across @rhinostone/swig-family frontends.
 *
 * The template-level walker dispatches on IR node shape. At
 * entry, each parse-tree token is lifted into an IR node: string tokens
 * become `IRText` (value carried verbatim, escaped at emit time);
 * VarToken / TagToken entries call `token.compile(...)` and the return
 * value is lifted according to its shape: a JS source string becomes
 * `IRLegacyJS` (userland `setTag` contract), a single IR node is spliced
 * in directly, and an array of IR nodes is flattened. The walker then
 * iterates the IR array and dispatches on node shape. Real IR emitters
 * (`Autoescape`, `If`, `For`, `Set`, etc.) were introduced alongside
 * their matching tag migrations, and each new shape gets its own
 * dispatch branch here.
 *
 * Userland tag `compile` functions keep returning JS source strings —
 * the `(compiler, args, content, parents, options, blockName)` contract
 * is unchanged. Built-in tags migrate by returning IR nodes
 * directly. The `new Function(...)` wrapper stays with the native
 * frontend (filename-aware error attribution, per the seam rule).
 */

/*!
 * JSON-escape a literal text chunk for embedding inside a JS
 * double-quoted string literal in the compiled template body.
 * @private
 */
function escapeTextValue(value) {
  return value.replace(/\\/g, '\\\\').replace(/\n|\r/g, '\\n').replace(/"/g, '\\"');
}

/*!
 * True when JS emitted for a body in async codegen mode holds an `await` (a
 * deferred include, import or from, a block, or a {% parent %}), so the
 * function that wraps that body must be async and its call awaited. The word
 * `await` in template text or in a name also matches, which only makes that
 * wrapper async for nothing. @private
 */
function holdsAwait(js, options) {
  return !!(options && options.codegenMode === 'async' && /\bawait\b/.test(js));
}

/**
 * Wrap statements in a function expression that is called at once. In async
 * codegen mode, when the statements hold an `await`, the function is async and
 * its call is awaited, so a deferred include, import or block inside a loop,
 * a with, a filter tag or a set-block works on the async render path; in any
 * other case the emit is the plain function, unchanged.
 *
 * @param  {string} params    Parameter list of the function (`''`, `'_ctx'`).
 * @param  {string} body      JS of the function body.
 * @param  {string} args      JS of the call's arguments.
 * @param  {object} [options] Compile options; `codegenMode` is read.
 * @return {string}           A JS expression.
 *
 * @example
 * backend.iife('', '  var _output = "";\n' + bodyJS + '  return _output;\n', '', options);
 * // sync, or no await in bodyJS: '(function () {\n  var _output = "";\n…})()'
 * // async mode with an await:    '(await (async function () {\n  var _output = "";\n…})())'
 */
exports.iife = function (params, body, args, options) {
  if (holdsAwait(body, options)) {
    return '(await (async function (' + params + ') {\n' + body + '})(' + args + '))';
  }
  return '(function (' + params + ') {\n' + body + '})(' + args + ')';
};

/*!
 * Names that cannot be a closure variable of a sync import's scope function:
 * JS reserved words, the standard globals emitted code may use, and the
 * internal names emitted code declares or reads around template code (add
 * any new one here). A name starting with `__` is never one either: emitted
 * functions declare such locals (`__l`, `__len`, `__k`, `__ctx` …) around
 * template code, where they would hide the closure variable.
 * @private
 */
var NOT_CLOSURE = ('break case catch class const continue debugger default delete do else enum export extends ' +
  'false finally for function if import in instanceof new null return super switch this throw true try typeof ' +
  'var void while with yield let static implements interface package private protected public await arguments ' +
  'eval undefined NaN Infinity globalThis Object Function Array String Number Boolean Symbol BigInt Math JSON ' +
  'Date RegExp Error EvalError RangeError ReferenceError SyntaxError TypeError URIError Promise Proxy Reflect ' +
  'Map Set WeakMap WeakSet ArrayBuffer DataView parseInt parseFloat isNaN isFinite encodeURI encodeURIComponent ' +
  'decodeURI decodeURIComponent escape unescape console require module exports process Buffer window self ' +
  'document _swig _ctx _filters _utils _fn _ext _output _exports _blocks _parentBlock _scope _imp').split(' ');

/*!
 * Whether a name a sync import binds can be a closure variable of its scope
 * function (see NOT_CLOSURE).
 * @private
 */
function closureSafe(name) {
  return /^[A-Za-z_$][\w$]*$/.test(name) && name.slice(0, 2) !== '__' && NOT_CLOSURE.indexOf(name) === -1;
}

/**
 * Emit the setup of a sync `{% import %}` or `{% from %}`. The imported
 * file's own imports and its macros run, unrewritten, in a function that
 * _utils.importScope calls with a scope object of the import: they bind there
 * and on closure variables of that function (see scopeBinding), so they write
 * nothing in the importer's context, and a macro reaches a sibling, or one of
 * the file's own imports, through the closure fallback of its lookup
 * (`_ctx.<name>`, then `<name>`). A name that cannot be a closure variable,
 * or that the importer's context also holds, is put in the context while an
 * exported macro runs (see _utils.importScope).
 *
 * @param  {string}   body  JS binding the imported file's imports and macros on `_scope`.
 * @param  {string[]} names Names of the macros to export.
 * @param  {string[]} refs  Names the macros read or write in the context (see macroRefs).
 * @param  {string[]} bound Names `body` binds on `_scope`.
 * @return {string}         A JS expression whose value is the exports object.
 *
 * @example
 * backend.syncImport('_scope.a = a = function () {…};\n', ['a'], ['a'], ['a']);
 * // => '_utils.importScope(_ctx, function (_scope) {\nvar a;\n_scope.a = a = function () {…};\n}, ["a"], ["a"], ["a"])'
 */
exports.syncImport = function (body, names, refs, bound) {
  var list = [], used = [], vars = [];
  bound = bound || [];
  utils.each(names, function (n) {
    if (list.indexOf(n) === -1) {
      list.push(n);
    }
  });
  utils.each(bound, function (n) {
    if (closureSafe(n) && vars.indexOf(n) === -1) {
      vars.push(n);
    }
  });
  utils.each(refs || [], function (n) {
    if (bound.indexOf(n) !== -1 && used.indexOf(n) === -1) {
      used.push(n);
    }
  });
  return '_utils.importScope(_ctx, function (_scope) {\n' +
    (vars.length ? 'var ' + vars.join(', ') + ';\n' : '') +
    body + '}, ' + JSON.stringify(list) + ', ' + JSON.stringify(used) + ', ' + JSON.stringify(vars) + ')';
};

/**
 * JS that binds a name of a sync import's scope: `_scope.<name> = ` and,
 * when the name can be a closure variable of the scope function, `<name> = `
 * too.
 *
 * @param  {string} name The bound name.
 * @return {string}      The start of an assignment statement.
 *
 * @example
 * backend.scopeBinding('field');
 * // => '_scope.field = field = '
 * backend.scopeBinding('class');
 * // => '_scope.class = '
 */
exports.scopeBinding = function (name) {
  return '_scope.' + name + ' = ' + (closureSafe(name) ? name + ' = ' : '');
};

/*!
 * JS of the function a Macro node compiles to: its parameters, the defaults,
 * the context shadowing of the parameter names, and the body.
 *
 * `params` is IRMacroParam[], structured `{name, default?}` entries: the JS
 * parameter list is `names.join(', ')` and the _utils.each shadow-delete
 * indexOf list is `names.map(JSON.stringify).join(',')`. A string[] fallback
 * is preserved for userland setTag tags that may still hand in the legacy
 * raw-token slice (including the `, ` separator quirk). The frontend's macro
 * parse handler has already applied the CVE-2023-25345 guard on the macro
 * name (FUNCTION/FUNCTIONEMPTY) and every param name (VAR).
 * @private
 */
function emitMacroFn(node, options) {
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
    macroIndexOfJS,
    macroDefaultsJS = '';
  if (macroParams.length && typeof macroParams[0] === 'object' && macroParams[0] !== null && typeof macroParams[0].name === 'string') {
    var macroNames = [];
    utils.each(macroParams, function (p) {
      macroNames.push(p.name);
      // Parameter defaults — `{% macro foo(a, b='x') %}` carries an
      // IRExpr on `p.default`. Emit `if (b === undefined) { b = <expr>; }`
      // at the top of the macro body, before the _ctx shadow-delete, so a
      // default expression reads the incoming context (and earlier
      // parameters) consistently with the macro model. Missing args
      // arrive as `undefined`, so the guard applies the default while
      // leaving an explicit falsy value (`0`, `false`, `''`) alone.
      if (p['default']) {
        macroDefaultsJS += '  if (' + p.name + ' === undefined) { ' + p.name + ' = ' + exports.emitExpr(p['default']) + '; }\n';
      }
    });
    macroSigJS = macroNames.join(', ');
    var macroJsonNames = [];
    utils.each(macroNames, function (n) { macroJsonNames.push(JSON.stringify(n)); });
    macroIndexOfJS = macroJsonNames.join(',');
  } else {
    macroSigJS = macroParams.join('');
    macroIndexOfJS = '"' + macroParams.join('","') + '"';
  }
  var macroFnJS = 'function (' + macroSigJS + ') {\n' +
    '  var _output = "",\n' +
    '    __ctx = _utils.extend({}, _ctx);\n' +
    macroDefaultsJS +
    '  _utils.each(_ctx, function (v, k) {\n' +
    '    if ([' + macroIndexOfJS + '].indexOf(k) !== -1) { delete _ctx[k]; }\n' +
    '  });\n' +
    macroBodyJS + '\n' +
    ' _ctx = _utils.extend(_ctx, __ctx);\n' +
    '  return _output;\n' +
    '}';
  // A deferred include, import or block, or a {% parent %}, inside a macro
  // would need an async macro whose every call is awaited, which the async
  // render path does not support. There the macro is a function that throws
  // a clear error when it is called, so a template that only defines it
  // still renders; the message names {% parent %} when the macro holds one.
  if (holdsAwait(macroBodyJS, options)) {
    macroFnJS = 'function () {\n' +
      '  throw new Error("' + escapeTextValue('The macro "' + node.name + '"' + (options.filename ? ' in ' + options.filename : '') + ' holds an {% include %}, {% import %}, {% from %}' + (/\b_parentBlock\b/.test(macroBodyJS) ? ', {% block %} or {% parent %}' : ' or {% block %}') + ', which the async render path does not support inside a macro.') + '");\n' +
      '}';
  }
  return macroFnJS;
}

/**
 * Names a compiled macro reads or writes in the context: each `_ctx.<name>`
 * in the JS of its function. A sync import puts in place, while one of its
 * macros runs, only those of the names it binds (see syncImport).
 *
 * @param  {IRMacro} node      The Macro node.
 * @param  {object}  [options] Compile options.
 * @return {string[]}          The names, each once.
 *
 * @example
 * backend.macroRefs(ir.macro('a', [ir.macroParam('x')], [ir.legacyJS('_output += _ctx.b();\n')]), {});
 * // => ['b'] (the parameter shadowing reads names as _ctx[k], not as _ctx.<name>)
 */
exports.macroRefs = function (node, options) {
  return refsInJS(emitMacroFn(node, options || {}));
};

/*!
 * Each `_ctx.<name>` in a macro function's JS, each name once (see macroRefs).
 * @private
 */
function refsInJS(js) {
  var re = /_ctx\.([A-Za-z_$][\w$]*)/g, m, out = [];
  while ((m = re.exec(js)) !== null) {
    if (out.indexOf(m[1]) === -1) {
      out.push(m[1]);
    }
  }
  return out;
}

/*!
 * The uses of the context itself that emitMacroFn writes around a macro's
 * body: its copy of the context (`__ctx`), the parameter shadowing and the
 * copy put back. A macro defined in a macro carries its own.
 * @private
 */
var MACRO_CTX_USES = /__ctx = _utils\.extend\(\{\}, _ctx\);|_utils\.each\(_ctx, function \(v, k\) \{\n {4}if \(\[[^\]]*\]\.indexOf\(k\) !== -1\) \{ delete _ctx\[k\]; \}\n {2}\}\);|_ctx = _utils\.extend\(_ctx, __ctx\);/g;

/*!
 * True when a macro function's JS uses the context object itself (`_ctx`,
 * or the macro's copy `__ctx`), not one of its names, outside the forms
 * emitMacroFn writes (MACRO_CTX_USES). Such JS can hand the context, or a
 * copy of it, to other code (a custom tag passing it to an extension,
 * `{{ fn(_ctx) }}`), which can read names the JS does not show, so refsInJS
 * cannot list them. A {% with %} in the macro counts too (its function takes
 * a copy of the context), and so does template text holding "_ctx"; such a
 * macro only keeps the cost of having every name in place.
 * @private
 */
function passesCtx(js) {
  return /(^|[^\w$.])__?ctx(?![\w$]|\.[A-Za-z_$])/.test(js.replace(MACRO_CTX_USES, ''));
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
/*!
 * Statements that bind one loop item to the loop names, shared by the For
 * body and its loop filter's pass so that a test sees the names the body
 * sees: the item and its index or key by default, each key of a mapping
 * with `mapKeys`, each item's first and second values with `unpack` (see
 * the IRFor typedef).
 *
 * @param  {IRFor}  node   The For node (its binding flags).
 * @param  {string} target JS of the loop value's context slot (`_ctx.x`).
 * @param  {string} keyTarget JS of the loop key's context slot.
 * @param  {string} indent Leading whitespace of each statement.
 * @param  {string} value  Name of the variable holding the item.
 * @param  {string} key    Name of the variable holding its index or key.
 * @param  {string} [seq]  Name of the variable that is true for a list or
 *                         a string, read with a binding flag.
 * @return {string}        The binding statements.
 * @private
 */
function bindLoopItem(node, target, keyTarget, indent, value, key, seq) {
  if (node.unpack) {
    return indent + 'var __pair = ' + seq + ' ? _utils.unpack(' + value + ') : [' + key + ', ' + value + '];\n' +
      indent + target + ' = __pair[1];\n' +
      indent + keyTarget + ' = __pair[0];\n';
  }
  if (node.mapKeys) {
    return indent + target + ' = ' + seq + ' ? ' + value + ' : ' + key + ';\n' +
      indent + keyTarget + ' = ' + key + ';\n';
  }
  return indent + target + ' = ' + value + ';\n' +
    indent + keyTarget + ' = ' + key + ';\n';
}

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
      // Multi-branch shape. The native if tag owns
      // content scanning and splits at else/elseif marker tokens so each
      // IRIfBranch carries its own test + body. The IR migration
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
      // inline — byte-identity held on the baseline.
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
      // Target is structured IRVarRef
      // for pure-dot LHS shapes (`foo`, `foo.bar.baz`), emitted as a
      // bare `_ctx.<dot.path>` lvalue with a per-segment _dangerousProps
      // guard. Bracket-touched targets (`foo[bar]`, `foo["bar"]`, mixed
      // dot+bracket) stay on the transitional string fragment — the
      // bracket-lvalue contract is a cross-flavor design call and is
      // deferred. The frontend's set-tag parse handler retains its own
      // _dangerousProps guards on every LHS path segment.
      // `value` is an IRExpr node — backward-compat string
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
      // The full loopcache + _utils.each IIFE scaffolding is
      // emitted here; the frontend tag surfaces only (value, key,
      // iterable, body) and the backend owns all JS plumbing. `iterable`
      // is an IRExpr node — backward-compat string fallback
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
        // Opt-in loop-context naming. A frontend may rename the loop
        // variable (Django uses `forloop`), rename the counter fields, and
        // expose the enclosing loop as `parentloop`. All three default to
        // swig's own names, so an absent flag emits byte-identical JS — the
        // native / Twig / Jinja2 frontends never set them and are untouched.
        // The Django `for` tag sets all three on the IRFor node.
        loopName = node.loopName || 'loop',
        ctxloop = '_ctx.' + loopName,
        loopFields = node.loopFields || {},
        fIndex = loopFields.index || 'index',
        fIndex0 = loopFields.index0 || 'index0',
        fRevindex = loopFields.revindex || 'revindex',
        fRevindex0 = loopFields.revindex0 || 'revindex0',
        parentloopJS = node.loopParent ? ', parentloop: ' + ctxloopcache + '.' + loopName : '';
      if (node.iterable && typeof node.iterable === 'object' && typeof node.iterable.type === 'string') {
        forIterable = exports.emitExpr(node.iterable);
      } else {
        forIterable = node.iterable;
      }
      // Opt-in dict iteration (`dictIter`, set by the Django frontend when a
      // loop's iterable ends in .keys, .values or .items; the iterable is then
      // the mapping): _utils.dictIter reads the mapping's own key of that name
      // first, as Django's lookup does, and otherwise applies the dict method.
      // The helper is called through the closure, never looked up in the
      // template context. Absent the flag the emit is unchanged.
      if (node.dictIter) {
        forIterable = '_utils.dictIter(' + forIterable + ', ' + JSON.stringify(node.dictIter.name) + (node.dictIter.pairs ? ', true' : '') + ')';
      }
      utils.each(node.body, function (b) {
        if (b.type === 'LegacyJS') { forBodyJS += b.js; return; }
        if (b.type === 'Text' || b.type === 'Raw') {
          forBodyJS += '_output += "' + escapeTextValue(b.value) + '";\n';
          return;
        }
      });
      // `emptyBody` (Jinja2 `{% for … %}{% else %}`, Django `{% empty %}`) runs when
      // the iterable is absent or has no items. When unset, the early-return
      // guard stays byte-identical to the no-else shape.
      var forEmptyCheck = '  if (!__l) { return; }\n';
      if (node.emptyBody) {
        var forEmptyJS = '';
        utils.each(node.emptyBody, function (b) {
          if (b.type === 'LegacyJS') { forEmptyJS += b.js; return; }
          if (b.type === 'Text' || b.type === 'Raw') {
            forEmptyJS += '_output += "' + escapeTextValue(b.value) + '";\n';
            return;
          }
        });
        forEmptyCheck = '  if (!__l || !__len) {\n' + forEmptyJS + '  return;\n  }\n';
      }
      // Opt-in binding rules. A frontend sets `mapKeys` (one name over a
      // mapping binds each key, as Jinja2 and Django do) or `unpack` (two
      // names over a list or string unpack each item into its first and
      // second values, as Python does; over a mapping they keep the key and
      // the value). The callback parameters are renamed so that a bound value
      // left undefined cannot fall back to the item through the closure name.
      // Absent both flags the emit is unchanged: native swig and Twig never
      // set them.
      // In async codegen mode a body that awaits (an include in the loop) runs
      // in an async callback that eachAsync awaits item after item, so the
      // counters and the output keep their order; other loops keep each.
      var forEach = holdsAwait(forBodyJS, options) ? 'await _utils.eachAsync(__l, async function (' : '_utils.each(__l, function (',
        forEachHead = '  ' + forEach + forVal + ', ' + forKey + ') {\n',
        forBindJS = bindLoopItem(node, ctx + forVal, ctx + forKey, '    ', forVal, forKey) +
          '    ' + ctxloop + '.key = ' + forKey + ';\n';
      if (node.mapKeys || node.unpack) {
        forEachHead = '  var __seq = _utils.isArray(__l) || typeof __l === "string";\n' +
          '  ' + forEach + '__value, __key) {\n';
        forBindJS = bindLoopItem(node, ctx + forVal, ctx + forKey, '    ', '__value', '__key', '__seq') +
          '    ' + ctxloop + '.key = __key;\n';
      }
      // Opt-in loop filter (`test`, set by the Jinja2 frontend for
      // `{% for x in xs if cond %}`). The test runs once per item, with the
      // loop names bound as in the body and before this loop's context
      // exists, so `loop` in it is the enclosing loop. The kept items
      // replace __l (a list or a string gives a list, a mapping keeps its
      // keys), so the counters, `last` and the empty branch count only
      // them; the loop names are restored before the loop saves them.
      // Absent a test the emit is unchanged.
      var forLength = '(_utils.isArray(__l) || typeof __l === "string") ? __l.length : _utils.keys(__l).length',
        forHead = '  var __l = ' + forIterable + ', __len = ' + forLength + ';\n';
      if (node.test) {
        forHead = '  var __l = ' + forIterable + ';\n' +
          '  if (__l) {\n' +
          '    var __fseq = _utils.isArray(__l) || typeof __l === "string", __fout = __fseq ? [] : {}, __fval = ' + ctx + forVal + ', __fkey = ' + ctx + forKey + ';\n' +
          '    _utils.each(__l, function (__value, __key) {\n' +
          bindLoopItem(node, ctx + forVal, ctx + forKey, '      ', '__value', '__key', '__fseq') +
          '      if (' + exports.emitExpr(node.test) + ') { if (__fseq) { __fout.push(__value); } else { __fout[__key] = __value; } }\n' +
          '    });\n' +
          '    ' + ctx + forVal + ' = __fval;\n' +
          '    ' + ctx + forKey + ' = __fkey;\n' +
          '    __l = __fout;\n' +
          '  }\n' +
          '  var __len = ' + forLength + ';\n';
      }
      out += exports.iife('', forHead +
        forEmptyCheck +
        '    var ' + ctxloopcache + ' = { ' + loopName + ': ' + ctxloop + ', ' + forVal + ': ' + ctx + forVal + ', ' + forKey + ': ' + ctx + forKey + ' };\n' +
        '    ' + ctxloop + ' = { first: false, ' + fIndex + ': 1, ' + fIndex0 + ': 0, ' + fRevindex + ': __len, ' + fRevindex0 + ': __len - 1, length: __len, last: false' + parentloopJS + ' };\n' +
        forEachHead +
        forBindJS +
        '    ' + ctxloop + '.first = (' + ctxloop + '.' + fIndex0 + ' === 0);\n' +
        '    ' + ctxloop + '.last = (' + ctxloop + '.' + fRevindex0 + ' === 0);\n' +
        '    ' + forBodyJS +
        '    ' + ctxloop + '.' + fIndex + ' += 1; ' + ctxloop + '.' + fIndex0 + ' += 1; ' + ctxloop + '.' + fRevindex + ' -= 1; ' + ctxloop + '.' + fRevindex0 + ' -= 1;\n' +
        '  });\n' +
        '  ' + ctxloop + ' = ' + ctxloopcache + '.' + loopName + ';\n' +
        '  ' + ctx + forVal + ' = ' + ctxloopcache + '.' + forVal + ';\n' +
        '  ' + ctx + forKey + ' = ' + ctxloopcache + '.' + forKey + ';\n' +
        '  ' + ctxloopcache + ' = undefined;\n', '', options) + ';\n';
      return;
    }
    if (node.type === 'Macro') {
      // The function's JS comes from emitMacroFn. A macro of a file a sync
      // import carries (`options.macroScope`) binds on that import's scope
      // object and its closure variable (see syncImport), not in the context.
      var macroJS = emitMacroFn(node, options);
      if (options && options.macroScope) {
        out += exports.scopeBinding(node.name) + macroJS + ';\n' +
          '_scope.' + node.name + '.safe = true;\n';
      } else {
        out += '_ctx.' + node.name + ' = ' + macroJS + ';\n' +
          '_ctx.' + node.name + '.safe = true;\n';
      }
      // Async-codegen mirrors the macro into _exports so
      // {% import %} / Twig's {% from %} can bind macros across templates
      // at runtime. The macro's closure still references _ctx (not
      // _exports) for outer-ctx lookups — sync-semantics-preserving.
      // Top-level filter is implicit: the macro body walker (emitMacroFn)
      // only handles Text/Raw/LegacyJS children, so nested IRMacro never
      // reaches this branch.
      if (options && options.codegenMode === 'async') {
        if (_security.dangerousProps.indexOf(node.name) !== -1) {
          throw new Error('Macro name "' + node.name + '" is reserved.');
        }
        out += '_exports.' + node.name + ' = _ctx.' + node.name + ';\n';
        // The names the macro reads or writes in the context, so that an
        // async import puts in place, while its macros run, only those of
        // the names the imported template bound (see utils.importIsolated).
        // A macro that hands the context itself to other code records none,
        // so its import puts all those names in place (see passesCtx).
        if (!passesCtx(macroJS)) {
          out += '_utils.exportRefs(_exports.' + node.name + ', ' + JSON.stringify(refsInJS(macroJS)) + ');\n';
        }
      }
      return;
    }
    if (node.type === 'Parent') {
      // A bare Parent comes from {% parent %} on the async render path, where
      // the parent template loads at render time: render the parent block that
      // the enclosing block function receives as _parentBlock (outside a block,
      // or with no parent block above, it renders nothing).
      if (!node.body && options && options.codegenMode === 'async') {
        out += 'if (typeof _parentBlock === "function") { _output += await _parentBlock(_ctx); }\n';
        return;
      }
      // The parent tag walks the parents chain at compile time
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
      // Block tokens are resolved at parse time by the engine's
      // remapBlocks / importNonBlocks — by the time the backend walks a
      // block, its body carries whichever generation's content is active.
      // Emit the body verbatim; the block name is carried as metadata for
      // downstream tooling (parent-chain walks happen in the parent tag).
      //
      // Async mode: block remapping happens at runtime instead of parse
      // time. The block's body becomes an async function (_ctx, _parentBlock)
      // that returns its own output, and _utils.callBlock renders the block:
      // through the override an extending child passed in _blocks (its
      // IRExtendsDeferred emit calls `_parentTpl(_ctx, _mergedBlocks)`), with
      // this function as the override's parent block, or through this
      // function when there is none (matches sync behavior). A {% parent %}
      // in the body renders _parentBlock. The override closes over its own
      // template's _swig / _filters / _utils / _ext, returns its own string,
      // and the `_output += await ...` here appends it.
      if (options && options.codegenMode === 'async') {
        var blockNameJS = JSON.stringify(node.name);
        out += '_output += await _utils.callBlock(_blocks, ' + blockNameJS + ', _ctx, async function (_ctx, _parentBlock) {\n';
        out += '  var _output = "";\n';
        utils.each(node.body, function (b) {
          if (b.type === 'LegacyJS') { out += b.js; return; }
          if (b.type === 'Text' || b.type === 'Raw') {
            out += '_output += "' + escapeTextValue(b.value) + '";\n';
            return;
          }
        });
        out += '  return _output;\n';
        out += '});\n';
        return;
      }
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
      // `path` and `context` are IRExpr nodes — per-slot dispatch on
      // object-with-.type → emitExpr,
      // else verbatim string fallback preserves the userland setTag
      // path (compile functions that still hand in raw JS-source
      // fragments). `resolveFrom` is a plain filesystem path that must
      // be escaped into a string literal (a number is converted to a
      // string first) — escapeTextValue below (backslash,
      // newline, double-quote) is the single chokepoint that does it for all
      // five node types, every flavor and userland setTag, so no unescaped
      // filename can break out of the literal (GHSA-q89c). `ignoreMissing` wraps
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
        'resolveFrom: "' + escapeTextValue(String(node.resolveFrom || '')) + '"' +
        '})(' + incSelector + ');\n' +
        (node.ignoreMissing ? '} catch (e) {}\n' : '');
      return;
    }
    if (node.type === 'IncludeDeferred') {
      // Async-codegen counterpart to Include. Resolves the
      // path via `_swig.getTemplate(...)` at render time (Promise<TemplateFn>),
      // then awaits the resolved template fn's call. The double-await flows
      // correctly whether the loaded tpl is sync (returns string) or async-
      // compiled (returns Promise<string>) — `await <non-Promise>` resolves
      // to the value unchanged. Mirrors the Include branch's path/context/
      // isolated/ignoreMissing dispatch; only the runtime call shape differs.
      var incdPathJS, incdCtxJS;
      if (node.path && typeof node.path === 'object' && typeof node.path.type === 'string') {
        incdPathJS = exports.emitExpr(node.path);
      } else {
        incdPathJS = node.path;
      }
      if (node.context !== undefined) {
        if (typeof node.context === 'object' && typeof node.context.type === 'string') {
          incdCtxJS = exports.emitExpr(node.context);
        } else {
          incdCtxJS = node.context;
        }
      }
      var incdSelector;
      if (node.isolated && incdCtxJS) {
        incdSelector = incdCtxJS;
      } else if (!incdCtxJS) {
        incdSelector = '_ctx';
      } else {
        incdSelector = '_utils.extend({}, _ctx, ' + incdCtxJS + ')';
      }
      var incdOpts = '{resolveFrom: "' + escapeTextValue(String(node.resolveFrom || '')) + '"}';
      out += (node.ignoreMissing ? '  try {\n' : '') +
        '_output += (await (await _swig.getTemplate(' + incdPathJS + ', ' + incdOpts + '))(' + incdSelector + ')).output;\n' +
        (node.ignoreMissing ? '} catch (e) {}\n' : '');
      return;
    }
    if (node.type === 'ImportDeferred') {
      // Async-codegen counterpart to the parse-time
      // import flow. The imported template is loaded via _swig.getTemplate
      // and called with the parent's _ctx so its body's compiled JS
      // closes over outer-ctx vars (sync-semantics-preserving). Only
      // the resolved value's `.exports` is bound; the imported body's
      // `.output` is discarded — import doesn't render. The call runs
      // through _utils.importIsolated, so what the imported template binds
      // in that context (its macros, its sets, its own imports) is taken
      // back out, as the sync path keeps it out of the importer.
      if (_security.dangerousProps.indexOf(node.alias) !== -1) {
        throw new Error('Import alias "' + node.alias + '" is reserved.');
      }
      var impdPathJS;
      if (node.path && typeof node.path === 'object' && typeof node.path.type === 'string') {
        impdPathJS = exports.emitExpr(node.path);
      } else {
        impdPathJS = node.path;
      }
      var impdOpts = '{resolveFrom: "' + escapeTextValue(String(node.resolveFrom || '')) + '"}';
      out += '_ctx.' + node.alias + ' = await _utils.importIsolated(_ctx, async function () { return (await (await _swig.getTemplate(' + impdPathJS + ', ' + impdOpts + '))(_ctx)).exports; });\n';
      return;
    }
    if (node.type === 'FromImportDeferred') {
      // Async-codegen counterpart to Twig's `{% from
      // "file" import a, b as c %}`. Single getTemplate call, then
      // per-entry bind onto _ctx. Async IIFE keeps `_imp` local so
      // multiple from-imports in the same template don't collide; the
      // call runs through _utils.importIsolated, as the import emit does.
      var fromdImports = node.imports || [];
      utils.each(fromdImports, function (entry) {
        if (_security.dangerousProps.indexOf(entry.name) !== -1) {
          throw new Error('From-import name "' + entry.name + '" is reserved.');
        }
        var bindName = entry.alias || entry.name;
        if (_security.dangerousProps.indexOf(bindName) !== -1) {
          throw new Error('From-import binding "' + bindName + '" is reserved.');
        }
      });
      var fromdPathJS;
      if (node.path && typeof node.path === 'object' && typeof node.path.type === 'string') {
        fromdPathJS = exports.emitExpr(node.path);
      } else {
        fromdPathJS = node.path;
      }
      var fromdOpts = '{resolveFrom: "' + escapeTextValue(String(node.resolveFrom || '')) + '"}';
      var fromdBindings = '';
      utils.each(fromdImports, function (entry) {
        var bindName = entry.alias || entry.name;
        fromdBindings += '  _ctx.' + bindName + ' = _imp["' + entry.name + '"];\n';
      });
      out += 'await (async function () {\n' +
        '  var _imp = await _utils.importIsolated(_ctx, async function () { return (await (await _swig.getTemplate(' + fromdPathJS + ', ' + fromdOpts + '))(_ctx)).exports; });\n' +
        fromdBindings +
        '})();\n';
      return;
    }
    if (node.type === 'ExtendsDeferred') {
      // Async-codegen counterpart to engine.getParents +
      // engine.precompile's parse-time block remap. Inverts at runtime
      // via the _blocks parameter contract:
      //
      //   1. childIRs preludes (set / import / macros) emit via recursive
      //      backend.compile so they populate _ctx and _exports with the
      //      child's own bindings before the parent runs.
      //   2. Build _localChildBlocks — each block in node.childBlocks
      //      becomes an `async function (_ctx, _parentBlock) ->
      //      Promise<string>` that shadows _output to a local accumulator
      //      and returns it; a {% parent %} in it renders _parentBlock. The
      //      block body uses the same shallow Text/Raw/LegacyJS walker as
      //      the IRBlock branch above.
      //   3. Merge: _mergedBlocks = _utils.chainBlocks(_localChildBlocks,
      //      _blocks). An inherited override from a deeper child wins per
      //      name (matches sync's remapBlocks) and gets this template's
      //      version as its parent block. Multi-level chain (child →
      //      middle → grandparent) propagates correctly: middle merges
      //      its own block bodies with the inherited child overrides,
      //      and grandparent sees the merged map.
      //   4. Resolve parent via _swig.getTemplate (Promise<TemplateFn>),
      //      then await _parent(_ctx, _mergedBlocks). Parent's body's
      //      IRBlock branch renders each block through _utils.callBlock:
      //      the override where present, with the parent's own version as
      //      its parent block, and the parent's own version otherwise.
      //   5. _output = _parentResult.output. Parent's _exports is
      //      DISCARDED — _exports stays as the child's own preludes-
      //      populated map. Matches sync where {% import "child" %}
      //      exposes child's own top-level macros only and never
      //      traverses extends. One semantic across sync and async.
      if (node.childIRs && node.childIRs.length) {
        out += exports.compile(node.childIRs, parents, options);
      }
      out += 'var _localChildBlocks = {};\n';
      if (node.childBlocks) {
        utils.each(node.childBlocks, function (block, name) {
          var blockBodyJS = '';
          utils.each(block.body, function (b) {
            if (b.type === 'LegacyJS') { blockBodyJS += b.js; return; }
            if (b.type === 'Text' || b.type === 'Raw') {
              blockBodyJS += '_output += "' + escapeTextValue(b.value) + '";\n';
              return;
            }
          });
          out += '_localChildBlocks[' + JSON.stringify(name) + '] = async function (_ctx, _parentBlock) {\n' +
            '  var _output = "";\n' +
            blockBodyJS +
            '  return _output;\n' +
            '};\n';
        });
      }
      out += 'var _mergedBlocks = _utils.chainBlocks(_localChildBlocks, _blocks);\n';
      var extPathJS;
      if (node.path && typeof node.path === 'object' && typeof node.path.type === 'string') {
        extPathJS = exports.emitExpr(node.path);
      } else {
        extPathJS = node.path;
      }
      var extOpts = '{resolveFrom: "' + escapeTextValue(String(node.resolveFrom || '')) + '"}';
      out += 'var _parentTpl = await _swig.getTemplate(' + extPathJS + ', ' + extOpts + ');\n';
      out += 'var _parentResult = await _parentTpl(_ctx, _mergedBlocks);\n';
      out += '_output = _parentResult.output;\n';
      return;
    }
    if (node.type === 'With') {
      // Scoped-context region (Twig's `{% with %}`).
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
      out += exports.iife('_ctx', withBodyJS, withSelector, options) + ';\n';
      return;
    }
    if (node.type === 'Output') {
      // `expr` is typed IRExpr | IRLegacyJS. The frontend's parseVariable
      // falls back to LegacyJS
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
        outExprJS = asValue(node.expr, outExprJS);
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
      // Opt-in null/undefined output coercion. A frontend sets
      // `node.coerce` on outputs whose expression is not a VarRef (VarRef
      // already coerces in emitVarRef), so an expression that evaluates to
      // null / undefined renders as "" instead of the literal word. When
      // the flag is absent the emit is unchanged.
      if (node.coerce) {
        out += '_output += _utils.coerceOutput(' + outExprJS + ');\n';
      } else {
        out += '_output += ' + outExprJS + ';\n';
      }
      return;
    }
    if (node.type === 'Filter') {
      // `args` is IRExpr[] — per-arg
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
      var val = exports.iife('', '  var _output = "";\n' + bodyJS + '  return _output;\n', '', options),
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
 * target for the TokenParser → IRExpr migration: once
 * the frontend produces real {@link IRExpr} values, every transitional
 * `IRExpr | string` slot in the statement IR (IRFilter.args,
 * IRIfBranch.test, IRFor.iterable / test, IRSet.target/value, IRInclude.path/
 * context, IRMacro.params) is lowered to a plain string via this
 * function before the statement emitter splices it into the body.
 *
 * The emitter enforces the CVE-2023-25345 blocklist on every {@link
 * IRVarRef} path segment and every string-literal {@link IRAccess} key,
 * mirroring the guards on the frontend's TokenParser + tag-parse paths.
 * The frontend-side guards stay live; the duplicate is intentional
 * defense-in-depth during the migration.
 *
 * `deps` is an optional injection hook:
 *   - `deps.dangerousProps` — override the security blocklist. Defaults
 *     to `require('./security').dangerousProps`.
 *   - `deps.throwError(msg, line, filename)` — override the throw shape.
 *     Defaults to `utils.throwError`, matching the seam rule for
 *     filename-opaque attribution.
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
    d.throwError('Unsafe access to "' + segment + '" is not allowed in templates (prototype-chain guard)', line, filename);
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
  // Opt-in Django-style runtime resolution: dict / attribute / method
  // lookup, numeric index access ({{ list.0 }}), and auto-call of callable
  // leaves, via _utils.resolve. A frontend sets node.resolve; absent it,
  // emit the unchanged static dot-path so the other flavors stay
  // byte-identical. The parse-time _dangerousProps guard above still runs
  // either way; _utils.resolve adds a matching runtime guard. The opt-in
  // node.missingAsEmpty makes a failed lookup give "" (Django's
  // string_if_invalid) through resolve's third argument.
  if (node.resolve) {
    return '_utils.resolve(_ctx, ' + JSON.stringify(node.path) + (node.missingAsEmpty ? ', ""' : '') + ')';
  }
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
 * Build the dot-path emit. `(checkDot_ctx ? _ctx.<path> : (checkDot_closure
 * ? <path> : ""))` — checks the `_ctx.<path>` walk first, falls back to a
 * bare-closure walk (covers macro params, host-globals like `Math`), and
 * coerces a missing path to `""` for safe interpolation. Kept as a local
 * private helper rather than imported from tokenparser.js because (a) it
 * is a pure function of its argument and (b) the backend must not acquire
 * a runtime dependency on the TokenParser module (which is a specific
 * frontend concern, not a shared-backend one). @private
 */
function checkMatchExpr(match) {
  var leaf = match.join('.');
  return '(' + checkDotExpr(match, '_ctx.') + ' ? _ctx.' + leaf
    + ' : (' + checkDotExpr(match, '') + ' ? ' + leaf + ' : ""))';
}

/*!
 * Emit a dynamic bracket access. When the key is a string literal, guard
 * it against prototype-chain pollution — mirrors the STRING-in-
 * BRACKETOPEN check in TokenParser. The read goes through `_utils.access`,
 * so a subscript of a null or undefined value gives undefined instead of
 * throwing. @private
 */
function emitAccess(node, d) {
  if (node.key && node.key.type === 'Literal' && node.key.kind === 'string') {
    checkDangerousSegment(node.key.value, d, node);
  }
  return '_utils.access(' + emitExpr(node.object, d) + ', ' + emitExpr(node.key, d) + ')';
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

/*!
 * Parenthesize an operand whose emitted JS could regroup. The IR tree
 * carries the grouping (`(a + b) * c` parses to a `*` node whose left
 * operand is the `+` node), so a nested binary node is wrapped or JS
 * precedence and associativity regroup it (`a + b * c`). `unary` also
 * wraps a unary operand, for the positions where its prefix would bind
 * differently (`-(-x)`, `(-x)[0]`). @private
 */
function groupOperand(node, js, unary) {
  if (node && (node.type === 'BinaryOp' || (unary && node.type === 'UnaryOp'))) {
    return '(' + js + ')';
  }
  return js;
}

/*!
 * An undefined or null subscript or member result reads as "" where it
 * enters a filter, an arithmetic operand or a `~` operand, as a missing
 * variable does in emitVarRef. Other positions keep the raw value, so
 * `??`, comparisons and tests still see undefined. @private
 */
function asValue(node, js) {
  return (node && node.type === 'Access') ? '_utils.coerceOutput(' + js + ')' : js;
}

/*!
 * The flavor name `emitBinaryOp` writes into an `_utils.isIn` call: one of
 * the three names `isIn` knows, never the flag's own text. @private
 */
function membershipMode(flag) {
  return (flag === 'twig' || flag === 'django') ? flag : 'jinja2';
}

function emitBinaryOp(node, d) {
  var left = groupOperand(node.left, emitExpr(node.left, d)),
    right = groupOperand(node.right, emitExpr(node.right, d));
  if (isArithmeticOp(node.op) || node.op === '~') {
    left = asValue(node.left, left);
    right = asValue(node.right, right);
  }
  if (isArithmeticOp(node.op)) {
    return left + ' ' + node.op + ' ' + right;
  }
  if (node.op === 'in') {
    // A Twig, Jinja2 or Django `in` carries its flavor name in
    // `membership` and calls that engine's membership test, which `negate`
    // turns into `not in`; native swig keeps the JavaScript `in` operator,
    // which tests keys.
    if (node.membership) {
      return '_utils.isIn(' + left + ', ' + right + ', "' + membershipMode(node.membership) + '"' + (node.negate ? ', true' : '') + ')';
    }
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
  var operand = groupOperand(node.operand, emitExpr(node.operand, d), true);
  if (node.op === '-' || node.op === '+') { operand = asValue(node.operand, operand); }
  return node.op + operand;
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

    // Opt-in `node.closure`, set by the frontends on calls to the engine's
    // own helpers (`_ext._test_<name>`, `_utils.range`, `_utils.slice`,
    // `Math.pow`, `Math.floor`): read the callee from the compiled
    // template's scope only, never from `_ctx`, where a locals key such as
    // `_ext` would replace it. An unregistered test still falls back to _fn.
    if (node.closure && callee.path.length > 1) {
      return '(' + callee.path.join('.') + ' || _fn).call(' + callee.path.slice(0, -1).join('.') +
        (argsJS ? ', ' + argsJS : '') + ')';
    }

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

  // A call on a subscript or member keeps its receiver, and gives "" when
  // the object is null or undefined or the member is not a function.
  if (callee && callee.type === 'Access') {
    if (callee.key && callee.key.type === 'Literal' && callee.key.kind === 'string') {
      checkDangerousSegment(callee.key.value, d, callee);
    }
    return '_utils.callAccess(' + emitExpr(callee.object, d) + ', ' + emitExpr(callee.key, d) + ', [' + argsJS + '])';
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
  var inputJS = asValue(node.input, emitExpr(node.input, d)),
    argsJS = '';
  if (node.args && node.args.length) {
    var parts = [];
    utils.each(node.args, function (a) { parts.push(emitExpr(a, d)); });
    argsJS = ', ' + parts.join(', ');
  }
  return '_filters["' + node.name + '"](' + inputJS + argsJS + ')';
}
