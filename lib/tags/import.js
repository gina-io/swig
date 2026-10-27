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
  // Async-codegen branch. Parse stashed `[{path}, alias]`
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
  // The imported file's own imports (flagged `isImport` by parse()) and its
  // macros run, unrewritten, in the scope function _utils.importScope calls:
  // they bind on the import's scope object and on closure variables, so
  // nothing lands in the caller's context, and a macro reaches a sibling or
  // one of the file's own imports through its closure variable (see
  // backend.syncImport). An import of the imported file binds on the
  // enclosing import's scope (`importTarget`). No _output declaration in this
  // emit: it runs in the caller's body (the template, a block, a loop or a
  // macro), where one reset or shadowed what was rendered before the tag.
  var ctx = args.pop(),
    body = '',
    names = [],
    refs = [],
    bound = [];
  utils.each(args, function (arg) {
    body += arg.compiled;
    if (arg.isImport) {
      bound = bound.concat(arg.bound || []);
    } else {
      names.push(arg.name);
      bound.push(arg.name);
      refs = refs.concat(arg.refs || []);
    }
  });
  return ((options && options.importTarget === '_scope') ? backend.scopeBinding(ctx) : '_ctx.' + ctx + ' = ') +
    backend.syncImport(body, names, refs, bound) + ';\n';
};

exports.parse = function (str, line, parser, types, stack, opts, swig) {
  var compiler = require('../parser').compile,
    parseOpts = { resolveFrom: opts.filename },
    compileOpts = utils.extend({}, opts, parseOpts),
    // The imported file's macros bind on the import's scope object, and its
    // own imports bind there too (see compile()).
    macroOpts = utils.extend({}, compileOpts, { macroScope: true }),
    nestedOpts = utils.extend({}, compileOpts, { importTarget: '_scope' }),
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
      var macroName, macroIR;
      if (!token || !token.compile) {
        return;
      }
      // Carry the imported file's own imports through so that macros defined
      // here which reference them resolve at call time. `token.args` is the
      // already-parsed `[{compiled, name, refs}, …, alias]`; slice() avoids
      // the pop() in compile() mutating the cached token.
      if (token.name === 'import') {
        self.out.push({
          compiled: token.compile(compiler, token.args.slice(), token.content, [], nestedOpts) + '\n',
          isImport: true,
          // The nested import binds one namespace alias (the tail of its
          // parsed args), on this import's scope object.
          bound: [token.args[token.args.length - 1]]
        });
        return;
      }
      if (token.name !== 'macro') {
        return;
      }
      // macro.compile returns an IRMacro node rather than a JS source
      // string; the shared backend renders it to JS that binds the macro on
      // the import's scope (macroOpts). Its body compiles with compileOpts,
      // so a macro defined inside it binds in the context as anywhere else,
      // never on an undeclared variable. The name is read first: the macro
      // tag's compile shifts it off token.args.
      macroName = token.args[0];
      macroIR = token.compile(compiler, token.args, token.content, [], compileOpts);
      self.out.push({
        compiled: backend.compile([macroIR], [], macroOpts) + '\n',
        name: macroName,
        refs: backend.macroRefs(macroIR, macroOpts)
      });
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
      throw new Error('Unsafe import alias "' + token.match + '" is not allowed (prototype-chain guard) on line ' + line + '.');
    }

    ctx = token.match;
    self.out.push(ctx);
    return false;
  });

  return true;
};

exports.block = true;
