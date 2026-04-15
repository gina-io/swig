/**
 * Set a variable for re-use in the current context. This will over-write any value already set to the context for the given <var>varname</var>.
 *
 * @alias set
 *
 * @example
 * {% set foo = "anything!" %}
 * {{ foo }}
 * // => anything!
 *
 * @example
 * // index = 2;
 * {% set bar = 1 %}
 * {% set bar += index|default(3) %}
 * // => 3
 *
 * @example
 * // foods = {};
 * // food = 'chili';
 * {% set foods[food] = "con queso" %}
 * {{ foods.chili }}
 * // => con queso
 *
 * @example
 * // foods = { chili: 'chili con queso' }
 * {% set foods.chili = "guatamalan insanity pepper" %}
 * {{ foods.chili }}
 * // => guatamalan insanity pepper
 *
 * @param {literal} varname   The variable name to assign the value to.
 * @param {literal} assignement   Any valid JavaScript assignement. <code data-language="js">=, +=, *=, /=, -=</code>
 * @param {*}   value     Valid variable output.
 */
var ir = require('@rhinostone/swig-core/lib/ir'),
  _t = require('@rhinostone/swig-core/lib/tokentypes');

exports.compile = function (compiler, args, content, parents, options, blockName, token) {
  // Target stays a transitional string fragment (IRVarRef lowering lands
  // with the TokenParser → IRExpr flip). Value prefers the lowered IRExpr
  // carried on the token when lowerExpr produced one; otherwise fall back
  // to the joined JS-source fragments the parse handler emitted.
  var value = (token && token.irExpr) ? token.irExpr : args.slice(2).join(' ');
  return ir.set(args[0], args[1], value);
};

// CVE-2023-25345: prototype-chain properties that must not be assignable.
// Shared constant in @rhinostone/swig-core — see .claude/security.md.
var _dangerousProps = require('@rhinostone/swig-core/lib/security').dangerousProps;

exports.lowerExpr = function (parser, tokens) {
  // The set tag's parse handler consumes LHS VAR / BRACKETOPEN / STRING /
  // BRACKETCLOSE / DOTKEY / ASSIGNMENT tokens up to (and including) the
  // assignment operator; lowerExpr only concerns itself with the RHS.
  // Locate the first ASSIGNMENT, slice the tail, and hand it to parseExpr.
  // Fall back (return undefined) if the tail contains FILTER / FILTEREMPTY
  // (filter pipes are not part of the expression grammar yet — Session
  // 14+ Output-site work) or a nested ASSIGNMENT (parseExpr does not
  // lower assignments, and bracket-write-as-assignment on the RHS would
  // misparse silently).
  var assignIdx = -1, i;
  for (i = 0; i < tokens.length; i++) {
    if (tokens[i].type === _t.ASSIGNMENT) {
      assignIdx = i;
      break;
    }
  }
  if (assignIdx === -1) { return undefined; }
  var rhsTokens = tokens.slice(assignIdx + 1);
  for (i = 0; i < rhsTokens.length; i++) {
    if (rhsTokens[i].type === _t.FILTER ||
        rhsTokens[i].type === _t.FILTEREMPTY ||
        rhsTokens[i].type === _t.ASSIGNMENT) {
      return undefined;
    }
  }
  return parser.parseExpr(rhsTokens);
};

exports.parse = function (str, line, parser, types) {
  var nameSet = '',
    propertyName;

  parser.on(types.VAR, function (token) {
    if (propertyName) {
      // Tell the parser where to find the variable
      propertyName += '_ctx.' + token.match;
      return;
    }

    if (!parser.out.length) {
      // CVE-2023-25345: block prototype-chain property assignment.
      // The LHS VAR token may contain dot-separated segments (the lexer
      // captures foo.__proto__ as a single VAR match), so check each one.
      var segments = token.match.split('.');
      for (var i = 0; i < segments.length; i++) {
        if (_dangerousProps.indexOf(segments[i]) !== -1) {
          throw new Error('Unsafe assignment to "' + segments[i] + '" is not allowed (CVE-2023-25345) on line ' + line + '.');
        }
      }
      nameSet += token.match;
      return;
    }

    return true;
  });

  parser.on(types.BRACKETOPEN, function (token) {
    if (!propertyName && !this.out.length) {
      propertyName = token.match;
      return;
    }

    return true;
  });

  parser.on(types.STRING, function (token) {
    if (propertyName && !this.out.length) {
      // CVE-2023-25345: block prototype-chain property assignment via bracket notation
      var stripped = token.match.replace(/^['"]|['"]$/g, '');
      if (_dangerousProps.indexOf(stripped) !== -1) {
        throw new Error('Unsafe assignment to "' + stripped + '" via bracket notation is not allowed (CVE-2023-25345) on line ' + line + '.');
      }
      propertyName += token.match;
      return;
    }

    return true;
  });

  parser.on(types.BRACKETCLOSE, function (token) {
    if (propertyName && !this.out.length) {
      nameSet += propertyName + token.match;
      propertyName = undefined;
      return;
    }

    return true;
  });

  parser.on(types.DOTKEY, function (token) {
    if (!propertyName && !nameSet) {
      return true;
    }
    // CVE-2023-25345: block prototype-chain property assignment via dot notation
    if (_dangerousProps.indexOf(token.match) !== -1) {
      throw new Error('Unsafe assignment to "' + token.match + '" is not allowed (CVE-2023-25345) on line ' + line + '.');
    }
    nameSet += '.' + token.match;
    return;
  });

  parser.on(types.ASSIGNMENT, function (token) {
    if (this.out.length || !nameSet) {
      throw new Error('Unexpected assignment "' + token.match + '" on line ' + line + '.');
    }

    this.out.push(
      // Prevent the set from spilling into global scope
      '_ctx.' + nameSet
    );
    this.out.push(token.match);
    this.filterApplyIdx.push(this.out.length);
  });

  return true;
};

exports.block = true;
