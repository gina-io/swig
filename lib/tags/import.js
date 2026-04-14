// Phase 2 (#T15): the import tag stays on the IRLegacyJS escape hatch.
// The compile function performs regex surgery over the compiled body
// of each imported macro to rewrite `_ctx.<macroName>` into
// `_ctx.<namespace>.<macroName>`, including sibling-macro references
// (the `(?!' + allMacros + ')` negative lookahead). That rewrite is
// swig-specific coupling on the exact JS source shape of a compiled
// macro — it has no cross-flavor invariant and does not meet the
// flavor-invariant test for a dedicated IR node. When TokenParser
// migrates to IRExpr (Session 14+), the macro-name → namespace
// rewrite moves into the emitter itself, at which point the import
// tag collapses to an IRImport node. Until then, return a JS source
// string; the backend lifts it into IRLegacyJS at the emit-loop
// entry. See .claude/architecture/multi-flavor-ir.md § Flavor-
// invariant test.
var utils = require('../utils'),
  backend = require('@rhinostone/swig-core/lib/backend');

// CVE-2023-25345: prototype-chain properties that must not be used as import
// aliases. The import tag assigns a namespace object to _ctx, so dangerous
// names would pollute the prototype chain. Shared constant in
// @rhinostone/swig-core — see .claude/security.md.
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
exports.compile = function (compiler, args) {
  var ctx = args.pop(),
    allMacros = utils.map(args, function (arg) {
      return arg.name;
    }).join('|'),
    out = '_ctx.' + ctx + ' = {};\n  var _output = "";\n',
    replacements = utils.map(args, function (arg) {
      return {
        ex: new RegExp('_ctx.' + arg.name + '(\\W)(?!' + allMacros + ')', 'g'),
        re: '_ctx.' + ctx + '.' + arg.name + '$1'
      };
    });

  // Replace all occurrences of all macros in this file with
  // proper namespaced definitions and calls
  utils.each(args, function (arg) {
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
    tokens,
    ctx;

  parser.on(types.STRING, function (token) {
    var self = this;
    if (!tokens) {
      tokens = swig.parseFile(token.match.replace(/^("|')|("|')$/g, ''), parseOpts).tokens;
      utils.each(tokens, function (token) {
        var out = '',
          macroName;
        if (!token || token.name !== 'macro' || !token.compile) {
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
      return;
    }

    throw new Error('Unexpected string ' + token.match + ' on line ' + line + '.');
  });

  parser.on(types.VAR, function (token) {
    var self = this;
    if (!tokens || ctx) {
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
