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
 * Phase 3 Session 2–4 — Twig lexer rule table.
 *
 * Covers the swig-shared token subset plus all Twig-only operators
 * including string interpolation (`~` concat, `..` range, `??`
 * null-coalescing, `?` ternary, `is` / `is not` test, `#{}` inside
 * double-quoted strings).
 *
 * Rule ordering constraints worth the call-out:
 *
 *   - ISNOT above IS above VAR — the `is` keyword would otherwise be
 *     gobbled by VAR's `^[a-zA-Z_$]\w*` pattern. ISNOT above IS because
 *     `is not` must be consumed as a single token, not IS + NOT.
 *     Precedent: swig-core's `in\s` rule bakes the keyword sequence
 *     into COMPARATOR rather than emitting a separate identifier;
 *     similarly, the NOT rule bakes `not\s+`.
 *   - NULLCOALESCE above QMARK — `??` must win over two bare `?` via
 *     first-match-wins.
 *
 * Rules are tried in order; first match wins. Patterns are anchored
 * at start-of-string because the consumer slices `str` before each
 * dispatch.
 *
 * String interpolation (`#{...}` inside double-quoted strings) is
 * handled by a bypass branch at the top of exports.read rather than a
 * rule-table entry — it's a string sub-mode change, not a single-token
 * match. See readInterpolatedString() below. Single-quoted strings
 * stay literal (no interpolation). Escape syntax `\#{` suppresses
 * interpolation and keeps the two characters verbatim in the STRING
 * fragment's match.
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
    type: TYPES.QMARK,
    regex: [
      /^\?/
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
 * Scan a double-quoted string at str[0] and, if it contains an
 * unescaped `#{` before its closing quote, emit the interpolated token
 * sequence: `STRING(pre) INTERP_OPEN <inner tokens> INTERP_CLOSE
 * STRING(mid) ... STRING(tail)`.
 *
 * Returns `null` when the string is not double-quoted, has no
 * interpolation, or is unterminated — the caller falls through to the
 * existing STRING rule (which either matches or throws via reader()).
 *
 * Brace-depth tracking is used to find the matching `}` for each
 * `#{`: nested `{`/`}` pairs (object literals, nested interpolation
 * inside an inner double-quoted string) increment/decrement the
 * depth. Inner quoted strings are skipped over as opaque spans so
 * their own braces do not affect the depth. The captured inner
 * expression is then handed back to exports.read recursively, which
 * re-enters this bypass if the inner expression contains a further
 * interpolated string.
 *
 * Throws `Empty interpolation in Twig string` on `"#{}"` (or
 * whitespace-only interpolation, e.g. `"#{ }"`) — caught at lex time
 * rather than producing a degenerate token pair the Twig parser would
 * have to re-reject.
 *
 * @param  {string} str Input slice starting at `"`.
 * @return {?object}    `{ tokens: LexerToken[], length: number }` or `null`.
 * @throws {Error}      On empty interpolation or unterminated `#{`.
 * @private
 */
function readInterpolatedString(str) {
  var len = str.length,
    i = 1,
    pieceStart = 1,
    pieces = [],
    sawInterp = false,
    ch,
    interpStart,
    j,
    depth,
    cj,
    quote,
    cq;

  while (i < len) {
    ch = str.charAt(i);

    if (ch === '\\') {
      i += 2;
      continue;
    }

    if (ch === '"') {
      if (!sawInterp) {
        return null;
      }
      pieces.push({ type: 'str', start: pieceStart, end: i });
      return {
        tokens: assembleInterpolatedTokens(str, pieces),
        length: i + 1
      };
    }

    if (ch === '#' && str.charAt(i + 1) === '{') {
      sawInterp = true;
      pieces.push({ type: 'str', start: pieceStart, end: i });

      interpStart = i + 2;
      j = interpStart;
      depth = 1;
      while (j < len && depth > 0) {
        cj = str.charAt(j);
        if (cj === '\\') { j += 2; continue; }
        if (cj === '{') { depth += 1; j += 1; continue; }
        if (cj === '}') {
          depth -= 1;
          if (depth === 0) { break; }
          j += 1;
          continue;
        }
        if (cj === '"' || cj === "'") {
          quote = cj;
          j += 1;
          while (j < len) {
            cq = str.charAt(j);
            if (cq === '\\') { j += 2; continue; }
            if (cq === quote) { j += 1; break; }
            j += 1;
          }
          continue;
        }
        j += 1;
      }

      if (depth !== 0) {
        utils.throwError('Unterminated interpolation in Twig string');
      }
      if (/^\s*$/.test(str.substring(interpStart, j))) {
        utils.throwError('Empty interpolation in Twig string');
      }

      pieces.push({ type: 'interp', start: interpStart, end: j });
      i = j + 1;
      pieceStart = i;
      continue;
    }

    i += 1;
  }

  return null;
}

/**
 * @private
 */
function assembleInterpolatedTokens(str, pieces) {
  var tokens = [],
    i,
    p,
    content,
    match,
    innerTokens,
    k;

  for (i = 0; i < pieces.length; i += 1) {
    p = pieces[i];
    if (p.type === 'str') {
      content = str.substring(p.start, p.end);
      match = '"' + content + '"';
      tokens.push({
        type: TYPES.STRING,
        match: match,
        length: match.length
      });
    } else {
      tokens.push({ type: TYPES.INTERP_OPEN, match: '#{', length: 2 });
      innerTokens = exports.read(str.substring(p.start, p.end));
      for (k = 0; k < innerTokens.length; k += 1) {
        tokens.push(innerTokens[k]);
      }
      tokens.push({ type: TYPES.INTERP_CLOSE, match: '}', length: 1 });
    }
  }
  return tokens;
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
    interp,
    match,
    t;
  while (offset < str.length) {
    substr = str.substring(offset);
    if (substr.charAt(0) === '"') {
      interp = readInterpolatedString(substr);
      if (interp) {
        for (t = 0; t < interp.tokens.length; t += 1) {
          tokens.push(interp.tokens[t]);
        }
        offset += interp.length;
        continue;
      }
    }
    match = reader(substr);
    offset += match.length;
    tokens.push(match);
  }
  return tokens;
};
