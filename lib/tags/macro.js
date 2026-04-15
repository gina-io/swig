/**
 * Create custom, reusable snippets within your templates.
 * Can be imported from one template to another using the <a href="#import"><code data-language="swig">{% import ... %}</code></a> tag.
 *
 * @alias macro
 *
 * @example
 * {% macro input(type, name, id, label, value, error) %}
 *   <label for="{{ name }}">{{ label }}</label>
 *   <input type="{{ type }}" name="{{ name }}" id="{{ id }}" value="{{ value }}"{% if error %} class="error"{% endif %}>
 * {% endmacro %}
 *
 * {{ input("text", "fname", "fname", "First Name", fname.value, fname.errors) }}
 * // => <label for="fname">First Name</label>
 * //    <input type="text" name="fname" id="fname" value="">
 *
 * @param {...arguments} arguments  User-defined arguments.
 */
var ir = require('@rhinostone/swig-core/lib/ir');

exports.compile = function (compiler, args, content, parents, options, blockName) {
  var fnName = args.shift();
  return ir.macro(fnName, args, [ir.legacyJS(compiler(content, parents, options, blockName))]);
};

// CVE-2023-25345: prototype-chain properties that must not be used as macro
// names. The macro tag assigns the compiled function to _ctx, so dangerous
// names would pollute the prototype chain. Shared constant in
// @rhinostone/swig-core — see .claude/security.md.
var _dangerousProps = require('@rhinostone/swig-core/lib/security').dangerousProps;

exports.parse = function (str, line, parser, types) {
  var name;

  parser.on(types.VAR, function (token) {
    if (token.match.indexOf('.') !== -1) {
      throw new Error('Unexpected dot in macro argument "' + token.match + '" on line ' + line + '.');
    }
    if (!name) {
      // No FUNCTION/FUNCTIONEMPTY token emitted (e.g. `{% macro foo %}` with
      // no parens): this VAR is the macro name. CVE-2023-25345: block
      // prototype-chain property names as macro names.
      if (_dangerousProps.indexOf(token.match) !== -1) {
        throw new Error('Unsafe macro name "' + token.match + '" is not allowed (CVE-2023-25345) on line ' + line + '.');
      }
      name = token.match;
      this.out.push(name);
      return;
    }
    // CVE-2023-25345: macros assign `_ctx.<paramName>` implicitly inside
    // the IIFE scaffolding, so a prototype-chain property name as a
    // parameter would pollute the prototype chain at invocation time.
    if (_dangerousProps.indexOf(token.match) !== -1) {
      throw new Error('Unsafe macro argument "' + token.match + '" is not allowed (CVE-2023-25345) on line ' + line + '.');
    }
    this.out.push({ name: token.match });
  });

  parser.on(types.FUNCTION, function (token) {
    if (!name) {
      // CVE-2023-25345: block prototype-chain property names as macro names
      if (_dangerousProps.indexOf(token.match) !== -1) {
        throw new Error('Unsafe macro name "' + token.match + '" is not allowed (CVE-2023-25345) on line ' + line + '.');
      }
      name = token.match;
      this.out.push(name);
      this.state.push(types.FUNCTION);
    }
  });

  parser.on(types.FUNCTIONEMPTY, function (token) {
    if (!name) {
      // CVE-2023-25345: block prototype-chain property names as macro names
      if (_dangerousProps.indexOf(token.match) !== -1) {
        throw new Error('Unsafe macro name "' + token.match + '" is not allowed (CVE-2023-25345) on line ' + line + '.');
      }
      name = token.match;
      this.out.push(name);
    }
  });

  parser.on(types.PARENCLOSE, function () {
    if (this.isLast) {
      return;
    }
    throw new Error('Unexpected parenthesis close on line ' + line + '.');
  });

  parser.on(types.COMMA, function () {
    return;
  });

  parser.on('*', function () {
    return;
  });

  return true;
};

exports.ends = true;
exports.block = true;
