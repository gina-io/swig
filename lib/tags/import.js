var utils = require('../utils'),
  ir = require('@rhinostone/swig-core/lib/ir'),
  backend = require('@rhinostone/swig-core/lib/backend');

// CVE-2023-25345: prototype-chain properties that must not be used as import
// aliases. The import tag assigns a namespace object to _ctx, so dangerous
// names would pollute the prototype chain.
var _dangerousProps = require('@rhinostone/swig-core/lib/security').dangerousProps;

/**
 * Allows you to import macros from another file directly into your current context.
 * The import tag is specifically designed for importing macros into your template with a specific context scope. This is very useful for keeping your macros from overriding template context that is being injected by your server-side page generation.
 *
 * @alias import
 *
 * @example
 * {% import './formmacros.html' as form %}
 * {{ form.input("text", "name") }}
 * // => <input type="text" name="name">
 *
 * @example
 * {% import "../shared/tags.html" as tags %}
 * {{ tags.stylesheet('global') }}
 * // => <link rel="stylesheet" href="/global.css">
 *
 * @param {string|var}  file      Relative path from the current template file to the file to import macros from.
 * @param {literal}     as        Literally, "as".
 * @param {literal}     varname   Local-accessible object name to assign the macros to.
 */
exports.compile = function (compiler, args, content, parents, options) {
  // Phase 2 (#T22): async-codegen branch. Parse stashed `[{path}, alias]`
  // (no macro pre-render in async mode); emit IRImportDeferred so the
  // backend's `_swig.getTemplate` + `.exports` bind happens at runtime.
  if (options && options.codegenMode === 'async') {
    var asyncAlias = args[args.length - 1];
    var asyncPath = args[0].path;
    return ir.importDeferred(
      ir.literal('string', asyncPath),
      asyncAlias,
      options.filename || ''
    );
  }
  var ctx = args.pop(),
    macros = [],
    nestedImports = [];

  // The imported file may itself import macros (`{% import "x" as y %}`).
  // Those entries are flagged `isImport` by parse() and must be emitted as-is,
  // before — and kept out of — the macro namespace-prefixing pass below.
  utils.each(args, function (arg) {
    (arg.isImport ? nestedImports : macros).push(arg);
  });

  var allMacros = utils.map(macros, function (arg) {
      return arg.name;
    }).join('|'),
    out = '_ctx.' + ctx + ' = {};\n  var _output = "";\n',
    replacements = utils.map(macros, function (arg) {
      return {
        ex: new RegExp('_ctx.' + arg.name + '(\\W)(?!' + allMacros + ')', 'g'),
        re: '_ctx.' + ctx + '.' + arg.name + '$1'
      };
    });

  // Emit the imported file's own (nested) imports first, un-namespaced, so the
  // macros defined below can reference them by their original alias at call
  // time. Without this, file-level imports are invisible inside macro bodies
  // and such calls silently render empty.
  utils.each(nestedImports, function (arg) {
    out += arg.compiled;
  });

  // Replace all occurrences of all macros in this file with
  // proper namespaced definitions and calls
  utils.each(macros, function (arg) {
    var c = arg.compiled;
    utils.each(replacements, function (re) {
      c = c.replace(re.ex, re.re);
    });
    out += c;
  });

  return out;
};

exports.parse = function (str, line, parser, types, stack, opts, swig) {
  var compiler = require('../parser').compile,
    parseOpts = { resolveFrom: opts.filename },
    compileOpts = utils.extend({}, opts, parseOpts),
    isAsync = !!(opts && opts.codegenMode === 'async'),
    importPath,
    ctx;

  parser.on(types.STRING, function (token) {
    var self = this;
    if (importPath !== undefined) {
      throw new Error('Unexpected string ' + token.match + ' on line ' + line + '.');
    }
    importPath = token.match.replace(/^("|')|("|')$/g, '');

    if (isAsync) {
      // Async mode: skip the sync parseFile + macro pre-render. Stash
      // just the path; compile() emits IRImportDeferred.
      self.out.push({ path: importPath });
      return;
    }

    var tokens = swig.parseFile(importPath, parseOpts).tokens;
    utils.each(tokens, function (token) {
      var out = '',
        macroName;
      if (!token || !token.compile) {
        return;
      }
      // Carry the imported file's own imports through so that macros defined
      // here which reference them resolve at call time. `token.args` is the
      // already-parsed `[{compiled, name}, …, alias]`; slice() avoids the
      // pop() in compile() mutating the cached token.
      if (token.name === 'import') {
        self.out.push({
          compiled: token.compile(compiler, token.args.slice(), token.content, [], compileOpts) + '\n',
          isImport: true
        });
        return;
      }
      if (token.name !== 'macro') {
        return;
      }
      macroName = token.args[0];
      // Phase 2 (#T15): macro.compile now returns an IRMacro node
      // rather than a JS source string. Render it through the shared
      // backend so import.js still gets the JS source it performs
      // regex-surgery on for namespace-prefixing. The +'\n' trailing
      // newline matches the pre-Phase-2 compile output exactly.
      out += backend.compile([token.compile(compiler, token.args, token.content, [], compileOpts)], [], compileOpts) + '\n';
      self.out.push({compiled: out, name: macroName});
    });
  });

  parser.on(types.VAR, function (token) {
    var self = this;
    if (importPath === undefined || ctx) {
      throw new Error('Unexpected variable "' + token.match + '" on line ' + line + '.');
    }

    if (token.match === 'as') {
      return;
    }

    // CVE-2023-25345: block prototype-chain property names as import aliases
    if (_dangerousProps.indexOf(token.match) !== -1) {
      throw new Error('Unsafe import alias "' + token.match + '" is not allowed (CVE-2023-25345) on line ' + line + '.');
    }

    ctx = token.match;
    self.out.push(ctx);
    return false;
  });

  return true;
};

exports.block = true;
