var utils = require('@rhinostone/swig-core/lib/utils');
var TYPES = require('./tokentypes');

/**
 * A Twig lexer token.
 *
 * @typedef {object} LexerToken
 * @property {string} match  The string that was matched (post-replace).
 * @property {number} type   Twig token type enum value.
 * @property {number} length Length of the input chunk consumed.
 */

/*!
 * Phase 3 Session 2–3 — Twig lexer rule table.
 *
 * Covers the swig-shared token subset plus `~` concat, `..` range,
 * and `??` null-coalescing operators landed in Session 3. Remaining
 * Twig-only operators (`is`/`is not` test, `?` ternary, `#{}` string
 * interpolation) deliberately do not have rules here — they will fall
 * through to the unknown-token throw at the bottom of `reader()`.
 * Session 3 lands them across separate commits; `#{}` is a string
 * sub-mode change and stays deferred to Session 4+.
 *
 * Rules are tried in order; first match wins. Patterns are anchored
 * at start-of-string because the consumer slices `str` before each
 * dispatch.
 *
 * Mirrors lib/lexer.js's shape so a future Twig parser session can
 * adopt either swig-core's TokenParser (with a per-flavor adapter) or
 * a Twig-native parser without re-deriving the rule semantics.
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
    type: TYPES.VAR,
    regex: [
      /^[a-zA-Z_$]\w*((\.\$?\w*)+)?/,
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
    type: TYPES.RANGE,
    regex: [
      /^\.\./
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
      /^[+\-]?\d+(\.\d+)?/
    ]
  },
  {
    type: TYPES.NULLCOALESCE,
    regex: [
      /^\?\?/
    ]
  },
  {
    type: TYPES.TILDE,
    regex: [
      /^~/
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
 * Twig-only operator until Session 3 adds its rules. The throw is
 * opaque (no line / file info); the Twig frontend's onCompileError
 * callback attaches filename + line per the swig-core / frontend seam
 * rule.
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
    utils.throwError('Unexpected token "' + str.charAt(0) + '" in Twig expression');
  }

  return matched;
}

/**
 * Tokenize a Twig expression string.
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
    substr,
    match;
  while (offset < str.length) {
    substr = str.substring(offset);
    match = reader(substr);
    offset += match.length;
    tokens.push(match);
  }
  return tokens;
};
