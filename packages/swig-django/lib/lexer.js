var utils = require('@rhinostone/swig-core/lib/utils');
var TYPES = require('./tokentypes');

/**
 * A Django lexer token.
 *
 * @typedef {object} LexerToken
 * @property {string} match  The string that was matched (post-replace).
 * @property {number} type   Django token type enum value.
 * @property {number} length Length of the input chunk consumed.
 */

/*!
 * Django lexer rule table — the swig-shared token subset plus the Django
 * literals.
 *
 * Departures from the Jinja2 sibling lexer:
 *
 *   - Filters are a single `|name` token (FILTEREMPTY). Django filters take
 *     at most one positional argument introduced by a colon (`|date:"Y"`),
 *     which the parser grabs as an optional `COLON + arg` in parsePostfix —
 *     there is no `|name(...)` paren-call filter form, so the Jinja2 FILTER
 *     rule is dropped.
 *   - BOOL matches `True` / `False` (Python casing) and normalizes to the
 *     JS `true` / `false` the parser expects.
 *   - `None` lexes to a dedicated NONE token (Django's null literal).
 *   - `is` / `is not` are kept (Django identity comparisons), but lower to
 *     `===` / `!==` in the parser, not to Jinja2 test calls.
 *   - No `~` concat, `**` power, or `//` floor-division — Django has none of
 *     them, so those Jinja2-only rules are absent.
 *   - Whitespace-control (`{{-` / `-%}`) is not Django syntax and is not
 *     stripped in the parser's splitter.
 *
 * Rule ordering constraints worth the call-out:
 *
 *   - FILTEREMPTY / FUNCTION above VAR — `|name` and `name(` must be
 *     consumed as filter / function tokens before VAR's `^[a-zA-Z_$]\w*`
 *     pattern gobbles the bare identifier.
 *   - LOGIC (`and` / `or`), NOT (`not`), BOOL (`True` / `False`), NONE
 *     (`None`), and the `is` / `is not` keywords above VAR — same reason:
 *     bake the keyword sequence into its own token rather than emit an
 *     identifier. The `\b` word boundary keeps identifiers like `Truthy`,
 *     `Nonexistent`, or `island` from matching.
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
    // `\b` (not `\s+|$`) so `True` / `False` are consumed correctly when
    // immediately followed by a non-word char — e.g. `(x == True)` — which
    // the inherited (lenient) parenthesis grammar allows. `True\b` still
    // rejects identifiers like `Truthy` (no word boundary before `t`).
    type: TYPES.BOOL,
    regex: [
      /^(True|False)\b/
    ],
    idx: 1,
    replace: {
      'True': 'true',
      'False': 'false'
    }
  },
  {
    // Django null literal. Above VAR so `None` isn't gobbled as an
    // identifier; `\b` keeps `Nonexistent` from matching.
    type: TYPES.NONE,
    regex: [
      /^None\b/
    ]
  },
  {
    // ISNOT above IS above VAR — the `is` keyword would otherwise be gobbled
    // by VAR's `^[a-zA-Z_$]\w*` pattern. ISNOT above IS because `is not`
    // must be consumed as a single token, not IS + NOT. The `\b` word
    // boundary keeps identifiers like `island` from matching.
    type: TYPES.ISNOT,
    regex: [
      /^is\s+not\b/
    ]
  },
  {
    type: TYPES.IS,
    regex: [
      /^is\b/
    ]
  },
  {
    // The dotted-path interior segment uses `\w+` (not `\w*`) so a future
    // operator whose first char is `.` cannot be absorbed as a zero-width
    // interior segment. Matches the Jinja2 / Twig sibling lexers.
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
 * Throws via utils.throwError when no rule matches. The throw is opaque (no
 * line / file info); the Django frontend's onCompileError callback attaches
 * filename + line per the swig-core / frontend seam rule.
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
    utils.throwError('Unexpected token "' + str.charAt(0) + '" in Django expression');
  }

  return matched;
}

/**
 * Tokenize a Django expression string.
 *
 * @param  {string}            str Expression source (the contents of
 *                                 `{{ … }}` or `{% … %}` minus the control
 *                                 delimiters and tag name).
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
