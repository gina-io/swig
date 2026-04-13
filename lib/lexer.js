var utils = require('./utils');

// Token type enum lives in @rhinostone/swig-core so the shared
// TokenParser (expression-level codegen) and every frontend lexer
// agree on the numeric IDs. See .claude/architecture/multi-flavor-ir.md.
var TYPES = require('../packages/swig-core/lib/tokentypes');

/**
 * A lexer token.
 * @typedef {object} LexerToken
 * @property {string} match  The string that was matched.
 * @property {number} type   Lexer type enum.
 * @property {number} length Length of the original string processed.
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
        /^(===|==|\!==|\!=|<=|<|>=|>|in\s|gte\s|gt\s|lte\s|lt\s)\s*/
      ],
      idx: 1,
      replace: {
        'gte': '>=',
        'gt': '>',
        'lte': '<=',
        'lt': '<'
      }
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
      type: TYPES.OPERATOR,
      regex: [
        /^(\+|\-|\/|\*|%)/
      ]
    }
  ];

exports.types = TYPES;

/**
 * Return the token type object for a single chunk of a string.
 * @param  {string} str String chunk.
 * @return {LexerToken}     Defined type, potentially stripped or replaced with more suitable content.
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
    matched = {
      match: str,
      type: TYPES.UNKNOWN,
      length: str.length
    };
  }

  return matched;
}

/**
 * Read a string and break it into separate token types.
 * @param  {string} str
 * @return {Array.LexerToken}     Array of defined types, potentially stripped or replaced with more suitable content.
 * @private
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
