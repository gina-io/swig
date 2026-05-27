var utils = require('@rhinostone/swig-core/lib/utils');
var TYPES = require('./tokentypes');

/**
 * A Jinja2 lexer token.
 *
 * @typedef {object} LexerToken
 * @property {string} match  The string that was matched (post-replace).
 * @property {number} type   Jinja2 token type enum value.
 * @property {number} length Length of the input chunk consumed.
 */

/*!
 * Jinja2 lexer rule table — the swig-shared token subset.
 *
 * The Jinja2-only operators (`~` concat, `**` power, `//` floor-division,
 * `is` / `is not` tests) land in subsequent commits; until then they fall
 * through to the unknown-token throw (fail-close). Jinja2 has no range
 * (`..`), null-coalescing (`??`), ternary (`?:`), or `#{}` string-
 * interpolation operators, so this table will never grow those rules.
 *
 * Rule ordering constraints worth the call-out:
 *
 *   - FILTER / FILTEREMPTY / FUNCTION above VAR — `|name(` and `name(`
 *     must be consumed as filter / function tokens before VAR's
 *     `^[a-zA-Z_$]\w*` pattern gobbles the bare identifier.
 *   - LOGIC (`and` / `or`), NOT (`not`), BOOL (`true` / `false`), and the
 *     COMPARATOR `in\s` keyword above VAR — same reason: bake the keyword
 *     sequence into the operator token rather than emit an identifier.
 *
 * Rules are tried in order; first match wins. Patterns are anchored at
 * start-of-string because the consumer slices `str` before each dispatch.
 */
var rules = [
  {
    type: TYPES.WHITESPACE,
    regex: [
      /^\s+/
    ]
  },
  {
    type: TYPES.STRING,
    regex: [
      /^""/,
      /^".*?[^\\]"/,
      /^''/,
      /^'.*?[^\\]'/
    ]
  },
  {
    type: TYPES.FILTER,
    regex: [
      /^\|\s*(\w+)\(/
    ],
    idx: 1
  },
  {
    type: TYPES.FILTEREMPTY,
    regex: [
      /^\|\s*(\w+)/
    ],
    idx: 1
  },
  {
    type: TYPES.FUNCTIONEMPTY,
    regex: [
      /^\s*(\w+)\(\)/
    ],
    idx: 1
  },
  {
    type: TYPES.FUNCTION,
    regex: [
      /^\s*(\w+)\(/
    ],
    idx: 1
  },
  {
    type: TYPES.PARENOPEN,
    regex: [
      /^\(/
    ]
  },
  {
    type: TYPES.PARENCLOSE,
    regex: [
      /^\)/
    ]
  },
  {
    type: TYPES.COMMA,
    regex: [
      /^,/
    ]
  },
  {
    type: TYPES.LOGIC,
    regex: [
      /^(&&|\|\|)\s*/,
      /^(and|or)\s+/
    ],
    idx: 1,
    replace: {
      'and': '&&',
      'or': '||'
    }
  },
  {
    type: TYPES.COMPARATOR,
    regex: [
      /^(===|==|\!==|\!=|<=|<|>=|>|in\s)\s*/
    ],
    idx: 1
  },
  {
    type: TYPES.ASSIGNMENT,
    regex: [
      /^(=|\+=|-=|\*=|\/=)/
    ]
  },
  {
    type: TYPES.NOT,
    regex: [
      /^\!\s*/,
      /^not\s+/
    ],
    replace: {
      'not': '!'
    }
  },
  {
    type: TYPES.BOOL,
    regex: [
      /^(true|false)\s+/,
      /^(true|false)$/
    ],
    idx: 1
  },
  {
    // The dotted-path interior segment uses `\w+` (not `\w*`) so a future
    // operator whose first char is `.` cannot be absorbed as a zero-width
    // interior segment. Jinja2 has no `..` range today, but the tighter
    // form is the defensive default and matches the Twig sibling lexer.
    type: TYPES.VAR,
    regex: [
      /^[a-zA-Z_$]\w*((\.\$?\w+)+)?/,
      /^[a-zA-Z_$]\w*/
    ]
  },
  {
    type: TYPES.BRACKETOPEN,
    regex: [
      /^\[/
    ]
  },
  {
    type: TYPES.BRACKETCLOSE,
    regex: [
      /^\]/
    ]
  },
  {
    type: TYPES.CURLYOPEN,
    regex: [
      /^\{/
    ]
  },
  {
    type: TYPES.COLON,
    regex: [
      /^\:/
    ]
  },
  {
    type: TYPES.CURLYCLOSE,
    regex: [
      /^\}/
    ]
  },
  {
    type: TYPES.DOTKEY,
    regex: [
      /^\.(\w+)/
    ],
    idx: 1
  },
  {
    type: TYPES.NUMBER,
    regex: [
      /^\d+(\.\d+)?/
    ]
  },
  {
    type: TYPES.OPERATOR,
    regex: [
      /^(\+|\-|\/|\*|%)/
    ]
  }
];

exports.types = TYPES;

/**
 * Match the next token at the start of `str`.
 *
 * Throws via utils.throwError when no rule matches — including every
 * Jinja2-only operator until its rule lands. The throw is opaque (no
 * line / file info); the Jinja2 frontend's onCompileError callback
 * attaches filename + line per the swig-core / frontend seam rule.
 *
 * @param  {string}     str Input slice starting at the unconsumed offset.
 * @return {LexerToken}     Matched token.
 * @throws {Error}          When no rule matches.
 * @private
 */
function reader(str) {
  var matched;

  utils.some(rules, function (rule) {
    return utils.some(rule.regex, function (regex) {
      var match = str.match(regex),
        normalized;

      if (!match) {
        return;
      }

      normalized = match[rule.idx || 0].replace(/\s*$/, '');
      normalized = (rule.hasOwnProperty('replace') && rule.replace.hasOwnProperty(normalized)) ? rule.replace[normalized] : normalized;

      matched = {
        match: normalized,
        type: rule.type,
        length: match[0].length
      };
      return true;
    });
  });

  if (!matched) {
    utils.throwError('Unexpected token "' + str.charAt(0) + '" in Jinja2 expression');
  }

  return matched;
}

/**
 * Tokenize a Jinja2 expression string.
 *
 * @param  {string}            str Expression source (the contents of
 *                                 `{{ … }}` or `{% … %}` minus the
 *                                 control delimiters and tag name).
 * @return {Array.<LexerToken>}    Sequence of matched tokens.
 * @throws {Error}                 On the first unrecognised character.
 */
exports.read = function (str) {
  var offset = 0,
    tokens = [],
    match;
  while (offset < str.length) {
    match = reader(str.substring(offset));
    offset += match.length;
    tokens.push(match);
  }
  return tokens;
};
