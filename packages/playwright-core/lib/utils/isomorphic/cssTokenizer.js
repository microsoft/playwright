"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.WhitespaceToken = exports.URLToken = exports.SuffixMatchToken = exports.SubstringMatchToken = exports.StringValuedToken = exports.StringToken = exports.SemicolonToken = exports.PrefixMatchToken = exports.PercentageToken = exports.OpenSquareToken = exports.OpenParenToken = exports.OpenCurlyToken = exports.NumberToken = exports.InvalidCharacterError = exports.IncludeMatchToken = exports.IdentToken = exports.HashToken = exports.GroupingToken = exports.FunctionToken = exports.EOFToken = exports.DimensionToken = exports.DelimToken = exports.DashMatchToken = exports.CommaToken = exports.ColumnToken = exports.ColonToken = exports.CloseSquareToken = exports.CloseParenToken = exports.CloseCurlyToken = exports.CSSParserToken = exports.CDOToken = exports.CDCToken = exports.BadURLToken = exports.BadStringToken = exports.AtKeywordToken = void 0;
exports.tokenize = tokenize;
/* eslint-disable notice/notice */

/*
 * The code in this file is licensed under the CC0 license.
 * http://creativecommons.org/publicdomain/zero/1.0/
 * It is free to use for any purpose. No attribution, permission, or reproduction of this license is required.
 */

// Original at https://github.com/tabatkins/parse-css
// Changes:
//   - JS is replaced with TS.
//   - Universal Module Definition wrapper is removed.
//   - Everything not related to tokenizing - below the first exports block - is removed.

const between = function (num, first, last) {
  return num >= first && num <= last;
};
function digit(code) {
  return between(code, 0x30, 0x39);
}
function hexdigit(code) {
  return digit(code) || between(code, 0x41, 0x46) || between(code, 0x61, 0x66);
}
function uppercaseletter(code) {
  return between(code, 0x41, 0x5a);
}
function lowercaseletter(code) {
  return between(code, 0x61, 0x7a);
}
function letter(code) {
  return uppercaseletter(code) || lowercaseletter(code);
}
function nonascii(code) {
  return code >= 0x80;
}
function namestartchar(code) {
  return letter(code) || nonascii(code) || code === 0x5f;
}
function namechar(code) {
  return namestartchar(code) || digit(code) || code === 0x2d;
}
function nonprintable(code) {
  return between(code, 0, 8) || code === 0xb || between(code, 0xe, 0x1f) || code === 0x7f;
}
function newline(code) {
  return code === 0xa;
}
function whitespace(code) {
  return newline(code) || code === 9 || code === 0x20;
}
const maximumallowedcodepoint = 0x10ffff;
class InvalidCharacterError extends Error {
  constructor(message) {
    super(message);
    this.name = 'InvalidCharacterError';
  }
}
exports.InvalidCharacterError = InvalidCharacterError;
function preprocess(str) {
  // Turn a string into an array of code points,
  // following the preprocessing cleanup rules.
  const codepoints = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code === 0xd && str.charCodeAt(i + 1) === 0xa) {
      code = 0xa;
      i++;
    }
    if (code === 0xd || code === 0xc) code = 0xa;
    if (code === 0x0) code = 0xfffd;
    if (between(code, 0xd800, 0xdbff) && between(str.charCodeAt(i + 1), 0xdc00, 0xdfff)) {
      // Decode a surrogate pair into an astral codepoint.
      const lead = code - 0xd800;
      const trail = str.charCodeAt(i + 1) - 0xdc00;
      code = Math.pow(2, 16) + lead * Math.pow(2, 10) + trail;
      i++;
    }
    codepoints.push(code);
  }
  return codepoints;
}
function stringFromCode(code) {
  if (code <= 0xffff) return String.fromCharCode(code);
  // Otherwise, encode astral char as surrogate pair.
  code -= Math.pow(2, 16);
  const lead = Math.floor(code / Math.pow(2, 10)) + 0xd800;
  const trail = code % Math.pow(2, 10) + 0xdc00;
  return String.fromCharCode(lead) + String.fromCharCode(trail);
}
function tokenize(str1) {
  const str = preprocess(str1);
  let i = -1;
  const tokens = [];
  let code;

  // Line number information.
  let line = 0;
  let column = 0;
  // The only use of lastLineLength is in reconsume().
  let lastLineLength = 0;
  const incrLineno = function () {
    line += 1;
    lastLineLength = column;
    column = 0;
  };
  const locStart = {
    line: line,
    column: column
  };
  const codepoint = function (i) {
    if (i >= str.length) return -1;
    return str[i];
  };
  const next = function (num) {
    if (num === undefined) num = 1;
    if (num > 3) throw 'Spec Error: no more than three codepoints of lookahead.';
    return codepoint(i + num);
  };
  const consume = function (num) {
    if (num === undefined) num = 1;
    i += num;
    code = codepoint(i);
    if (newline(code)) incrLineno();else column += num;
    // console.log('Consume '+i+' '+String.fromCharCode(code) + ' 0x' + code.toString(16));
    return true;
  };
  const reconsume = function () {
    i -= 1;
    if (newline(code)) {
      line -= 1;
      column = lastLineLength;
    } else {
      column -= 1;
    }
    locStart.line = line;
    locStart.column = column;
    return true;
  };
  const eof = function (codepoint) {
    if (codepoint === undefined) codepoint = code;
    return codepoint === -1;
  };
  const donothing = function () {};
  const parseerror = function () {
    // Language bindings don't like writing to stdout!
    // console.log('Parse error at index ' + i + ', processing codepoint 0x' + code.toString(16) + '.'); return true;
  };
  const consumeAToken = function () {
    consumeComments();
    consume();
    if (whitespace(code)) {
      while (whitespace(next())) consume();
      return new WhitespaceToken();
    } else if (code === 0x22) {
      return consumeAStringToken();
    } else if (code === 0x23) {
      if (namechar(next()) || areAValidEscape(next(1), next(2))) {
        const token = new HashToken('');
        if (wouldStartAnIdentifier(next(1), next(2), next(3))) token.type = 'id';
        token.value = consumeAName();
        return token;
      } else {
        return new DelimToken(code);
      }
    } else if (code === 0x24) {
      if (next() === 0x3d) {
        consume();
        return new SuffixMatchToken();
      } else {
        return new DelimToken(code);
      }
    } else if (code === 0x27) {
      return consumeAStringToken();
    } else if (code === 0x28) {
      return new OpenParenToken();
    } else if (code === 0x29) {
      return new CloseParenToken();
    } else if (code === 0x2a) {
      if (next() === 0x3d) {
        consume();
        return new SubstringMatchToken();
      } else {
        return new DelimToken(code);
      }
    } else if (code === 0x2b) {
      if (startsWithANumber()) {
        reconsume();
        return consumeANumericToken();
      } else {
        return new DelimToken(code);
      }
    } else if (code === 0x2c) {
      return new CommaToken();
    } else if (code === 0x2d) {
      if (startsWithANumber()) {
        reconsume();
        return consumeANumericToken();
      } else if (next(1) === 0x2d && next(2) === 0x3e) {
        consume(2);
        return new CDCToken();
      } else if (startsWithAnIdentifier()) {
        reconsume();
        return consumeAnIdentlikeToken();
      } else {
        return new DelimToken(code);
      }
    } else if (code === 0x2e) {
      if (startsWithANumber()) {
        reconsume();
        return consumeANumericToken();
      } else {
        return new DelimToken(code);
      }
    } else if (code === 0x3a) {
      return new ColonToken();
    } else if (code === 0x3b) {
      return new SemicolonToken();
    } else if (code === 0x3c) {
      if (next(1) === 0x21 && next(2) === 0x2d && next(3) === 0x2d) {
        consume(3);
        return new CDOToken();
      } else {
        return new DelimToken(code);
      }
    } else if (code === 0x40) {
      if (wouldStartAnIdentifier(next(1), next(2), next(3))) return new AtKeywordToken(consumeAName());else return new DelimToken(code);
    } else if (code === 0x5b) {
      return new OpenSquareToken();
    } else if (code === 0x5c) {
      if (startsWithAValidEscape()) {
        reconsume();
        return consumeAnIdentlikeToken();
      } else {
        parseerror();
        return new DelimToken(code);
      }
    } else if (code === 0x5d) {
      return new CloseSquareToken();
    } else if (code === 0x5e) {
      if (next() === 0x3d) {
        consume();
        return new PrefixMatchToken();
      } else {
        return new DelimToken(code);
      }
    } else if (code === 0x7b) {
      return new OpenCurlyToken();
    } else if (code === 0x7c) {
      if (next() === 0x3d) {
        consume();
        return new DashMatchToken();
      } else if (next() === 0x7c) {
        consume();
        return new ColumnToken();
      } else {
        return new DelimToken(code);
      }
    } else if (code === 0x7d) {
      return new CloseCurlyToken();
    } else if (code === 0x7e) {
      if (next() === 0x3d) {
        consume();
        return new IncludeMatchToken();
      } else {
        return new DelimToken(code);
      }
    } else if (digit(code)) {
      reconsume();
      return consumeANumericToken();
    } else if (namestartchar(code)) {
      reconsume();
      return consumeAnIdentlikeToken();
    } else if (eof()) {
      return new EOFToken();
    } else {
      return new DelimToken(code);
    }
  };
  const consumeComments = function () {
    while (next(1) === 0x2f && next(2) === 0x2a) {
      consume(2);
      while (true) {
        consume();
        if (code === 0x2a && next() === 0x2f) {
          consume();
          break;
        } else if (eof()) {
          parseerror();
          return;
        }
      }
    }
  };
  const consumeANumericToken = function () {
    const num = consumeANumber();
    if (wouldStartAnIdentifier(next(1), next(2), next(3))) {
      const token = new DimensionToken();
      token.value = num.value;
      token.repr = num.repr;
      token.type = num.type;
      token.unit = consumeAName();
      return token;
    } else if (next() === 0x25) {
      consume();
      const token = new PercentageToken();
      token.value = num.value;
      token.repr = num.repr;
      return token;
    } else {
      const token = new NumberToken();
      token.value = num.value;
      token.repr = num.repr;
      token.type = num.type;
      return token;
    }
  };
  const consumeAnIdentlikeToken = function () {
    const str = consumeAName();
    if (str.toLowerCase() === 'url' && next() === 0x28) {
      consume();
      while (whitespace(next(1)) && whitespace(next(2))) consume();
      if (next() === 0x22 || next() === 0x27) return new FunctionToken(str);else if (whitespace(next()) && (next(2) === 0x22 || next(2) === 0x27)) return new FunctionToken(str);else return consumeAURLToken();
    } else if (next() === 0x28) {
      consume();
      return new FunctionToken(str);
    } else {
      return new IdentToken(str);
    }
  };
  const consumeAStringToken = function (endingCodePoint) {
    if (endingCodePoint === undefined) endingCodePoint = code;
    let string = '';
    while (consume()) {
      if (code === endingCodePoint || eof()) {
        return new StringToken(string);
      } else if (newline(code)) {
        parseerror();
        reconsume();
        return new BadStringToken();
      } else if (code === 0x5c) {
        if (eof(next())) donothing();else if (newline(next())) consume();else string += stringFromCode(consumeEscape());
      } else {
        string += stringFromCode(code);
      }
    }
    throw new Error('Internal error');
  };
  const consumeAURLToken = function () {
    const token = new URLToken('');
    while (whitespace(next())) consume();
    if (eof(next())) return token;
    while (consume()) {
      if (code === 0x29 || eof()) {
        return token;
      } else if (whitespace(code)) {
        while (whitespace(next())) consume();
        if (next() === 0x29 || eof(next())) {
          consume();
          return token;
        } else {
          consumeTheRemnantsOfABadURL();
          return new BadURLToken();
        }
      } else if (code === 0x22 || code === 0x27 || code === 0x28 || nonprintable(code)) {
        parseerror();
        consumeTheRemnantsOfABadURL();
        return new BadURLToken();
      } else if (code === 0x5c) {
        if (startsWithAValidEscape()) {
          token.value += stringFromCode(consumeEscape());
        } else {
          parseerror();
          consumeTheRemnantsOfABadURL();
          return new BadURLToken();
        }
      } else {
        token.value += stringFromCode(code);
      }
    }
    throw new Error('Internal error');
  };
  const consumeEscape = function () {
    // Assume the current character is the \
    // and the next code point is not a newline.
    consume();
    if (hexdigit(code)) {
      // Consume 1-6 hex digits
      const digits = [code];
      for (let total = 0; total < 5; total++) {
        if (hexdigit(next())) {
          consume();
          digits.push(code);
        } else {
          break;
        }
      }
      if (whitespace(next())) consume();
      let value = parseInt(digits.map(function (x) {
        return String.fromCharCode(x);
      }).join(''), 16);
      if (value > maximumallowedcodepoint) value = 0xfffd;
      return value;
    } else if (eof()) {
      return 0xfffd;
    } else {
      return code;
    }
  };
  const areAValidEscape = function (c1, c2) {
    if (c1 !== 0x5c) return false;
    if (newline(c2)) return false;
    return true;
  };
  const startsWithAValidEscape = function () {
    return areAValidEscape(code, next());
  };
  const wouldStartAnIdentifier = function (c1, c2, c3) {
    if (c1 === 0x2d) return namestartchar(c2) || c2 === 0x2d || areAValidEscape(c2, c3);else if (namestartchar(c1)) return true;else if (c1 === 0x5c) return areAValidEscape(c1, c2);else return false;
  };
  const startsWithAnIdentifier = function () {
    return wouldStartAnIdentifier(code, next(1), next(2));
  };
  const wouldStartANumber = function (c1, c2, c3) {
    if (c1 === 0x2b || c1 === 0x2d) {
      if (digit(c2)) return true;
      if (c2 === 0x2e && digit(c3)) return true;
      return false;
    } else if (c1 === 0x2e) {
      if (digit(c2)) return true;
      return false;
    } else if (digit(c1)) {
      return true;
    } else {
      return false;
    }
  };
  const startsWithANumber = function () {
    return wouldStartANumber(code, next(1), next(2));
  };
  const consumeAName = function () {
    let result = '';
    while (consume()) {
      if (namechar(code)) {
        result += stringFromCode(code);
      } else if (startsWithAValidEscape()) {
        result += stringFromCode(consumeEscape());
      } else {
        reconsume();
        return result;
      }
    }
    throw new Error('Internal parse error');
  };
  const consumeANumber = function () {
    let repr = '';
    let type = 'integer';
    if (next() === 0x2b || next() === 0x2d) {
      consume();
      repr += stringFromCode(code);
    }
    while (digit(next())) {
      consume();
      repr += stringFromCode(code);
    }
    if (next(1) === 0x2e && digit(next(2))) {
      consume();
      repr += stringFromCode(code);
      consume();
      repr += stringFromCode(code);
      type = 'number';
      while (digit(next())) {
        consume();
        repr += stringFromCode(code);
      }
    }
    const c1 = next(1),
      c2 = next(2),
      c3 = next(3);
    if ((c1 === 0x45 || c1 === 0x65) && digit(c2)) {
      consume();
      repr += stringFromCode(code);
      consume();
      repr += stringFromCode(code);
      type = 'number';
      while (digit(next())) {
        consume();
        repr += stringFromCode(code);
      }
    } else if ((c1 === 0x45 || c1 === 0x65) && (c2 === 0x2b || c2 === 0x2d) && digit(c3)) {
      consume();
      repr += stringFromCode(code);
      consume();
      repr += stringFromCode(code);
      consume();
      repr += stringFromCode(code);
      type = 'number';
      while (digit(next())) {
        consume();
        repr += stringFromCode(code);
      }
    }
    const value = convertAStringToANumber(repr);
    return {
      type: type,
      value: value,
      repr: repr
    };
  };
  const convertAStringToANumber = function (string) {
    // CSS's number rules are identical to JS, afaik.
    return +string;
  };
  const consumeTheRemnantsOfABadURL = function () {
    while (consume()) {
      if (code === 0x29 || eof()) {
        return;
      } else if (startsWithAValidEscape()) {
        consumeEscape();
        donothing();
      } else {
        donothing();
      }
    }
  };
  let iterationCount = 0;
  while (!eof(next())) {
    tokens.push(consumeAToken());
    iterationCount++;
    if (iterationCount > str.length * 2) throw new Error("I'm infinite-looping!");
  }
  return tokens;
}
class CSSParserToken {
  constructor() {
    this.tokenType = '';
    this.value = void 0;
  }
  toJSON() {
    return {
      token: this.tokenType
    };
  }
  toString() {
    return this.tokenType;
  }
  toSource() {
    return '' + this;
  }
}
exports.CSSParserToken = CSSParserToken;
class BadStringToken extends CSSParserToken {
  constructor(...args) {
    super(...args);
    this.tokenType = 'BADSTRING';
  }
}
exports.BadStringToken = BadStringToken;
class BadURLToken extends CSSParserToken {
  constructor(...args) {
    super(...args);
    this.tokenType = 'BADURL';
  }
}
exports.BadURLToken = BadURLToken;
class WhitespaceToken extends CSSParserToken {
  constructor(...args) {
    super(...args);
    this.tokenType = 'WHITESPACE';
  }
  toString() {
    return 'WS';
  }
  toSource() {
    return ' ';
  }
}
exports.WhitespaceToken = WhitespaceToken;
class CDOToken extends CSSParserToken {
  constructor(...args) {
    super(...args);
    this.tokenType = 'CDO';
  }
  toSource() {
    return '<!--';
  }
}
exports.CDOToken = CDOToken;
class CDCToken extends CSSParserToken {
  constructor(...args) {
    super(...args);
    this.tokenType = 'CDC';
  }
  toSource() {
    return '-->';
  }
}
exports.CDCToken = CDCToken;
class ColonToken extends CSSParserToken {
  constructor(...args) {
    super(...args);
    this.tokenType = ':';
  }
}
exports.ColonToken = ColonToken;
class SemicolonToken extends CSSParserToken {
  constructor(...args) {
    super(...args);
    this.tokenType = ';';
  }
}
exports.SemicolonToken = SemicolonToken;
class CommaToken extends CSSParserToken {
  constructor(...args) {
    super(...args);
    this.tokenType = ',';
  }
}
exports.CommaToken = CommaToken;
class GroupingToken extends CSSParserToken {
  constructor(...args) {
    super(...args);
    this.value = '';
    this.mirror = '';
  }
}
exports.GroupingToken = GroupingToken;
class OpenCurlyToken extends GroupingToken {
  constructor() {
    super();
    this.tokenType = '{';
    this.value = '{';
    this.mirror = '}';
  }
}
exports.OpenCurlyToken = OpenCurlyToken;
class CloseCurlyToken extends GroupingToken {
  constructor() {
    super();
    this.tokenType = '}';
    this.value = '}';
    this.mirror = '{';
  }
}
exports.CloseCurlyToken = CloseCurlyToken;
class OpenSquareToken extends GroupingToken {
  constructor() {
    super();
    this.tokenType = '[';
    this.value = '[';
    this.mirror = ']';
  }
}
exports.OpenSquareToken = OpenSquareToken;
class CloseSquareToken extends GroupingToken {
  constructor() {
    super();
    this.tokenType = ']';
    this.value = ']';
    this.mirror = '[';
  }
}
exports.CloseSquareToken = CloseSquareToken;
class OpenParenToken extends GroupingToken {
  constructor() {
    super();
    this.tokenType = '(';
    this.value = '(';
    this.mirror = ')';
  }
}
exports.OpenParenToken = OpenParenToken;
class CloseParenToken extends GroupingToken {
  constructor() {
    super();
    this.tokenType = ')';
    this.value = ')';
    this.mirror = '(';
  }
}
exports.CloseParenToken = CloseParenToken;
class IncludeMatchToken extends CSSParserToken {
  constructor(...args) {
    super(...args);
    this.tokenType = '~=';
  }
}
exports.IncludeMatchToken = IncludeMatchToken;
class DashMatchToken extends CSSParserToken {
  constructor(...args) {
    super(...args);
    this.tokenType = '|=';
  }
}
exports.DashMatchToken = DashMatchToken;
class PrefixMatchToken extends CSSParserToken {
  constructor(...args) {
    super(...args);
    this.tokenType = '^=';
  }
}
exports.PrefixMatchToken = PrefixMatchToken;
class SuffixMatchToken extends CSSParserToken {
  constructor(...args) {
    super(...args);
    this.tokenType = '$=';
  }
}
exports.SuffixMatchToken = SuffixMatchToken;
class SubstringMatchToken extends CSSParserToken {
  constructor(...args) {
    super(...args);
    this.tokenType = '*=';
  }
}
exports.SubstringMatchToken = SubstringMatchToken;
class ColumnToken extends CSSParserToken {
  constructor(...args) {
    super(...args);
    this.tokenType = '||';
  }
}
exports.ColumnToken = ColumnToken;
class EOFToken extends CSSParserToken {
  constructor(...args) {
    super(...args);
    this.tokenType = 'EOF';
  }
  toSource() {
    return '';
  }
}
exports.EOFToken = EOFToken;
class DelimToken extends CSSParserToken {
  constructor(code) {
    super();
    this.tokenType = 'DELIM';
    this.value = '';
    this.value = stringFromCode(code);
  }
  toString() {
    return 'DELIM(' + this.value + ')';
  }
  toJSON() {
    const json = this.constructor.prototype.constructor.prototype.toJSON.call(this);
    json.value = this.value;
    return json;
  }
  toSource() {
    if (this.value === '\\') return '\\\n';else return this.value;
  }
}
exports.DelimToken = DelimToken;
class StringValuedToken extends CSSParserToken {
  constructor(...args) {
    super(...args);
    this.value = '';
  }
  ASCIIMatch(str) {
    return this.value.toLowerCase() === str.toLowerCase();
  }
  toJSON() {
    const json = this.constructor.prototype.constructor.prototype.toJSON.call(this);
    json.value = this.value;
    return json;
  }
}
exports.StringValuedToken = StringValuedToken;
class IdentToken extends StringValuedToken {
  constructor(val) {
    super();
    this.tokenType = 'IDENT';
    this.value = val;
  }
  toString() {
    return 'IDENT(' + this.value + ')';
  }
  toSource() {
    return escapeIdent(this.value);
  }
}
exports.IdentToken = IdentToken;
class FunctionToken extends StringValuedToken {
  constructor(val) {
    super();
    this.tokenType = 'FUNCTION';
    this.mirror = void 0;
    this.value = val;
    this.mirror = ')';
  }
  toString() {
    return 'FUNCTION(' + this.value + ')';
  }
  toSource() {
    return escapeIdent(this.value) + '(';
  }
}
exports.FunctionToken = FunctionToken;
class AtKeywordToken extends StringValuedToken {
  constructor(val) {
    super();
    this.tokenType = 'AT-KEYWORD';
    this.value = val;
  }
  toString() {
    return 'AT(' + this.value + ')';
  }
  toSource() {
    return '@' + escapeIdent(this.value);
  }
}
exports.AtKeywordToken = AtKeywordToken;
class HashToken extends StringValuedToken {
  constructor(val) {
    super();
    this.tokenType = 'HASH';
    this.type = void 0;
    this.value = val;
    this.type = 'unrestricted';
  }
  toString() {
    return 'HASH(' + this.value + ')';
  }
  toJSON() {
    const json = this.constructor.prototype.constructor.prototype.toJSON.call(this);
    json.value = this.value;
    json.type = this.type;
    return json;
  }
  toSource() {
    if (this.type === 'id') return '#' + escapeIdent(this.value);else return '#' + escapeHash(this.value);
  }
}
exports.HashToken = HashToken;
class StringToken extends StringValuedToken {
  constructor(val) {
    super();
    this.tokenType = 'STRING';
    this.value = val;
  }
  toString() {
    return '"' + escapeString(this.value) + '"';
  }
}
exports.StringToken = StringToken;
class URLToken extends StringValuedToken {
  constructor(val) {
    super();
    this.tokenType = 'URL';
    this.value = val;
  }
  toString() {
    return 'URL(' + this.value + ')';
  }
  toSource() {
    return 'url("' + escapeString(this.value) + '")';
  }
}
exports.URLToken = URLToken;
class NumberToken extends CSSParserToken {
  constructor() {
    super();
    this.tokenType = 'NUMBER';
    this.type = void 0;
    this.repr = void 0;
    this.type = 'integer';
    this.repr = '';
  }
  toString() {
    if (this.type === 'integer') return 'INT(' + this.value + ')';
    return 'NUMBER(' + this.value + ')';
  }
  toJSON() {
    const json = super.toJSON();
    json.value = this.value;
    json.type = this.type;
    json.repr = this.repr;
    return json;
  }
  toSource() {
    return this.repr;
  }
}
exports.NumberToken = NumberToken;
class PercentageToken extends CSSParserToken {
  constructor() {
    super();
    this.tokenType = 'PERCENTAGE';
    this.repr = void 0;
    this.repr = '';
  }
  toString() {
    return 'PERCENTAGE(' + this.value + ')';
  }
  toJSON() {
    const json = this.constructor.prototype.constructor.prototype.toJSON.call(this);
    json.value = this.value;
    json.repr = this.repr;
    return json;
  }
  toSource() {
    return this.repr + '%';
  }
}
exports.PercentageToken = PercentageToken;
class DimensionToken extends CSSParserToken {
  constructor() {
    super();
    this.tokenType = 'DIMENSION';
    this.type = void 0;
    this.repr = void 0;
    this.unit = void 0;
    this.type = 'integer';
    this.repr = '';
    this.unit = '';
  }
  toString() {
    return 'DIM(' + this.value + ',' + this.unit + ')';
  }
  toJSON() {
    const json = this.constructor.prototype.constructor.prototype.toJSON.call(this);
    json.value = this.value;
    json.type = this.type;
    json.repr = this.repr;
    json.unit = this.unit;
    return json;
  }
  toSource() {
    const source = this.repr;
    let unit = escapeIdent(this.unit);
    if (unit[0].toLowerCase() === 'e' && (unit[1] === '-' || between(unit.charCodeAt(1), 0x30, 0x39))) {
      // Unit is ambiguous with scinot
      // Remove the leading "e", replace with escape.
      unit = '\\65 ' + unit.slice(1, unit.length);
    }
    return source + unit;
  }
}
exports.DimensionToken = DimensionToken;
function escapeIdent(string) {
  string = '' + string;
  let result = '';
  const firstcode = string.charCodeAt(0);
  for (let i = 0; i < string.length; i++) {
    const code = string.charCodeAt(i);
    if (code === 0x0) throw new InvalidCharacterError('Invalid character: the input contains U+0000.');
    if (between(code, 0x1, 0x1f) || code === 0x7f || i === 0 && between(code, 0x30, 0x39) || i === 1 && between(code, 0x30, 0x39) && firstcode === 0x2d) result += '\\' + code.toString(16) + ' ';else if (code >= 0x80 || code === 0x2d || code === 0x5f || between(code, 0x30, 0x39) || between(code, 0x41, 0x5a) || between(code, 0x61, 0x7a)) result += string[i];else result += '\\' + string[i];
  }
  return result;
}
function escapeHash(string) {
  // Escapes the contents of "unrestricted"-type hash tokens.
  // Won't preserve the ID-ness of "id"-type hash tokens;
  // use escapeIdent() for that.
  string = '' + string;
  let result = '';
  for (let i = 0; i < string.length; i++) {
    const code = string.charCodeAt(i);
    if (code === 0x0) throw new InvalidCharacterError('Invalid character: the input contains U+0000.');
    if (code >= 0x80 || code === 0x2d || code === 0x5f || between(code, 0x30, 0x39) || between(code, 0x41, 0x5a) || between(code, 0x61, 0x7a)) result += string[i];else result += '\\' + code.toString(16) + ' ';
  }
  return result;
}
function escapeString(string) {
  string = '' + string;
  let result = '';
  for (let i = 0; i < string.length; i++) {
    const code = string.charCodeAt(i);
    if (code === 0x0) throw new InvalidCharacterError('Invalid character: the input contains U+0000.');
    if (between(code, 0x1, 0x1f) || code === 0x7f) result += '\\' + code.toString(16) + ' ';else if (code === 0x22 || code === 0x5c) result += '\\' + string[i];else result += string[i];
  }
  return result;
}