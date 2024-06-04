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

export interface CSSTokenInterface {
  toSource(): string;
  value: string | number | undefined;
}

const between = function(num: number, first: number, last: number) { return num >= first && num <= last; };
function digit(code: number) { return between(code, 0x30, 0x39); }
function hexdigit(code: number) { return digit(code) || between(code, 0x41, 0x46) || between(code, 0x61, 0x66); }
function uppercaseletter(code: number) { return between(code, 0x41, 0x5a); }
function lowercaseletter(code: number) { return between(code, 0x61, 0x7a); }
function letter(code: number) { return uppercaseletter(code) || lowercaseletter(code); }
function nonascii(code: number) { return code >= 0x80; }
function namestartchar(code: number) { return letter(code) || nonascii(code) || code === 0x5f; }
function namechar(code: number) { return namestartchar(code) || digit(code) || code === 0x2d; }
function nonprintable(code: number) { return between(code, 0, 8) || code === 0xb || between(code, 0xe, 0x1f) || code === 0x7f; }
function newline(code: number) { return code === 0xa; }
function whitespace(code: number) { return newline(code) || code === 9 || code === 0x20; }

const maximumallowedcodepoint = 0x10ffff;

export class InvalidCharacterError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidCharacterError';
  }
}

function preprocess(str: string): number[] {
  // Turn a string into an array of code points,
  // following the preprocessing cleanup rules.
  const codepoints = [];
  for (let i = 0; i < str.length; i++) {
    let code = str.charCodeAt(i);
    if (code === 0xd && str.charCodeAt(i + 1) === 0xa) {
      code = 0xa; i++;
    }
    if (code === 0xd || code === 0xc)
      code = 0xa;
    if (code === 0x0)
      code = 0xfffd;
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

function stringFromCode(code: number) {
  if (code <= 0xffff)
    return String.fromCharCode(code);
  // Otherwise, encode astral char as surrogate pair.
  code -= Math.pow(2, 16);
  const lead = Math.floor(code / Math.pow(2, 10)) + 0xd800;
  const trail = code % Math.pow(2, 10) + 0xdc00;
  return String.fromCharCode(lead) + String.fromCharCode(trail);
}

export function tokenize(str1: string): CSSTokenInterface[] {
  const str = preprocess(str1);
  let i = -1;
  const tokens: CSSTokenInterface[] = [];
  let code: number;

  // Line number information.
  let line = 0;
  let column = 0;
  // The only use of lastLineLength is in reconsume().
  let lastLineLength = 0;
  const incrLineno = function() {
    line += 1;
    lastLineLength = column;
    column = 0;
  };
  const locStart = { line: line, column: column };

  const codepoint = function(i: number): number {
    if (i >= str.length)
      return -1;

    return str[i];
  };
  const next = function(num?: number) {
    if (num === undefined)
      num = 1;
    if (num > 3)
      throw 'Spec Error: no more than three codepoints of lookahead.';
    return codepoint(i + num);
  };
  const consume = function(num?: number): boolean {
    if (num === undefined)
      num = 1;
    i += num;
    code = codepoint(i);
    if (newline(code))
      incrLineno();
    else
      column += num;
    // console.log('Consume '+i+' '+String.fromCharCode(code) + ' 0x' + code.toString(16));
    return true;
  };
  const reconsume = function() {
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
  const eof = function(codepoint?: number): boolean {
    if (codepoint === undefined)
      codepoint = code;
    return codepoint === -1;
  };
  const donothing = function() { };
  const parseerror = function() {
    // Language bindings don't like writing to stdout!
    // console.log('Parse error at index ' + i + ', processing codepoint 0x' + code.toString(16) + '.'); return true;
  };

  const consumeAToken = function(): CSSTokenInterface {
    consumeComments();
    consume();
    if (whitespace(code)) {
      while (whitespace(next()))
        consume();
      return new WhitespaceToken();
    } else if (code === 0x22) {return consumeAStringToken();} else if (code === 0x23) {
      if (namechar(next()) || areAValidEscape(next(1), next(2))) {
        const token = new HashToken('');
        if (wouldStartAnIdentifier(next(1), next(2), next(3)))
          token.type = 'id';
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
    } else if (code === 0x27) {return consumeAStringToken();} else if (code === 0x28) {return new OpenParenToken();} else if (code === 0x29) {return new CloseParenToken();} else if (code === 0x2a) {
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
    } else if (code === 0x2c) {return new CommaToken();} else if (code === 0x2d) {
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
    } else if (code === 0x3a) {return new ColonToken();} else if (code === 0x3b) {return new SemicolonToken();} else if (code === 0x3c) {
      if (next(1) === 0x21 && next(2) === 0x2d && next(3) === 0x2d) {
        consume(3);
        return new CDOToken();
      } else {
        return new DelimToken(code);
      }
    } else if (code === 0x40) {
      if (wouldStartAnIdentifier(next(1), next(2), next(3)))
        return new AtKeywordToken(consumeAName());
      else
        return new DelimToken(code);

    } else if (code === 0x5b) {return new OpenSquareToken();} else if (code === 0x5c) {
      if (startsWithAValidEscape()) {
        reconsume();
        return consumeAnIdentlikeToken();
      } else {
        parseerror();
        return new DelimToken(code);
      }
    } else if (code === 0x5d) {return new CloseSquareToken();} else if (code === 0x5e) {
      if (next() === 0x3d) {
        consume();
        return new PrefixMatchToken();
      } else {
        return new DelimToken(code);
      }
    } else if (code === 0x7b) {return new OpenCurlyToken();} else if (code === 0x7c) {
      if (next() === 0x3d) {
        consume();
        return new DashMatchToken();
      } else if (next() === 0x7c) {
        consume();
        return new ColumnToken();
      } else {
        return new DelimToken(code);
      }
    } else if (code === 0x7d) {return new CloseCurlyToken();} else if (code === 0x7e) {
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
    } else if (eof()) {return new EOFToken();} else {return new DelimToken(code);}
  };

  const consumeComments = function() {
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

  const consumeANumericToken = function() {
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

  const consumeAnIdentlikeToken = function(): CSSTokenInterface {
    const str = consumeAName();
    if (str.toLowerCase() === 'url' && next() === 0x28) {
      consume();
      while (whitespace(next(1)) && whitespace(next(2)))
        consume();
      if (next() === 0x22 || next() === 0x27)
        return new FunctionToken(str);
      else if (whitespace(next()) && (next(2) === 0x22 || next(2) === 0x27))
        return new FunctionToken(str);
      else
        return consumeAURLToken();

    } else if (next() === 0x28) {
      consume();
      return new FunctionToken(str);
    } else {
      return new IdentToken(str);
    }
  };

  const consumeAStringToken = function(endingCodePoint?: number): CSSParserToken {
    if (endingCodePoint === undefined)
      endingCodePoint = code;
    let string = '';
    while (consume()) {
      if (code === endingCodePoint || eof()) {
        return new StringToken(string);
      } else if (newline(code)) {
        parseerror();
        reconsume();
        return new BadStringToken();
      } else if (code === 0x5c) {
        if (eof(next()))
          donothing();
        else if (newline(next()))
          consume();
        else
          string += stringFromCode(consumeEscape());

      } else {
        string += stringFromCode(code);
      }
    }
    throw new Error('Internal error');
  };

  const consumeAURLToken = function(): CSSTokenInterface {
    const token = new URLToken('');
    while (whitespace(next()))
      consume();
    if (eof(next()))
      return token;
    while (consume()) {
      if (code === 0x29 || eof()) {
        return token;
      } else if (whitespace(code)) {
        while (whitespace(next()))
          consume();
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

  const consumeEscape = function() {
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
      if (whitespace(next()))
        consume();
      let value = parseInt(digits.map(function(x) { return String.fromCharCode(x); }).join(''), 16);
      if (value > maximumallowedcodepoint)
        value = 0xfffd;
      return value;
    } else if (eof()) {
      return 0xfffd;
    } else {
      return code;
    }
  };

  const areAValidEscape = function(c1: number, c2: number) {
    if (c1 !== 0x5c)
      return false;
    if (newline(c2))
      return false;
    return true;
  };
  const startsWithAValidEscape = function() {
    return areAValidEscape(code, next());
  };

  const wouldStartAnIdentifier = function(c1: number, c2: number, c3: number) {
    if (c1 === 0x2d)
      return namestartchar(c2) || c2 === 0x2d || areAValidEscape(c2, c3);
    else if (namestartchar(c1))
      return true;
    else if (c1 === 0x5c)
      return areAValidEscape(c1, c2);
    else
      return false;

  };
  const startsWithAnIdentifier = function() {
    return wouldStartAnIdentifier(code, next(1), next(2));
  };

  const wouldStartANumber = function(c1: number, c2: number, c3: number) {
    if (c1 === 0x2b || c1 === 0x2d) {
      if (digit(c2))
        return true;
      if (c2 === 0x2e && digit(c3))
        return true;
      return false;
    } else if (c1 === 0x2e) {
      if (digit(c2))
        return true;
      return false;
    } else if (digit(c1)) {
      return true;
    } else {
      return false;
    }
  };
  const startsWithANumber = function() {
    return wouldStartANumber(code, next(1), next(2));
  };

  const consumeAName = function(): string {
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

  const consumeANumber = function() {
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
    const c1 = next(1), c2 = next(2), c3 = next(3);
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
    return { type: type, value: value, repr: repr };
  };

  const convertAStringToANumber = function(string: string): number {
    // CSS's number rules are identical to JS, afaik.
    return +string;
  };

  const consumeTheRemnantsOfABadURL = function() {
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
    if (iterationCount > str.length * 2)
      throw new Error("I'm infinite-looping!");
  }
  return tokens;
}

export class CSSParserToken implements CSSTokenInterface {
  tokenType = '';
  value: string | number | undefined;
  toJSON(): any {
    return { token: this.tokenType };
  }
  toString() { return this.tokenType; }
  toSource() { return '' + this; }
}

export class BadStringToken extends CSSParserToken {
  override tokenType = 'BADSTRING';
}

export class BadURLToken extends CSSParserToken {
  override tokenType = 'BADURL';
}

export class WhitespaceToken extends CSSParserToken {
  override tokenType = 'WHITESPACE';
  override toString() { return 'WS'; }
  override toSource() { return ' '; }
}

export class CDOToken extends CSSParserToken {
  override tokenType = 'CDO';
  override toSource() { return '<!--'; }
}

export class CDCToken extends CSSParserToken {
  override tokenType = 'CDC';
  override toSource() { return '-->'; }
}

export class ColonToken extends CSSParserToken {
  override tokenType = ':';
}

export class SemicolonToken extends CSSParserToken {
  override tokenType = ';';
}

export class CommaToken extends CSSParserToken {
  override tokenType = ',';
}

export class GroupingToken extends CSSParserToken {
  override value = '';
  mirror = '';
}

export class OpenCurlyToken extends GroupingToken {
  override tokenType = '{';
  constructor() {
    super();
    this.value = '{';
    this.mirror = '}';
  }
}

export class CloseCurlyToken extends GroupingToken {
  override tokenType = '}';
  constructor() {
    super();
    this.value = '}';
    this.mirror = '{';
  }
}

export class OpenSquareToken extends GroupingToken {
  override tokenType = '[';
  constructor() {
    super();
    this.value = '[';
    this.mirror = ']';
  }
}

export class CloseSquareToken extends GroupingToken {
  override tokenType = ']';
  constructor() {
    super();
    this.value = ']';
    this.mirror = '[';
  }
}

export class OpenParenToken extends GroupingToken {
  override tokenType = '(';
  constructor() {
    super();
    this.value = '(';
    this.mirror = ')';
  }
}

export class CloseParenToken extends GroupingToken {
  override   tokenType = ')';
  constructor() {
    super();
    this.value = ')';
    this.mirror = '(';
  }
}

export class IncludeMatchToken extends CSSParserToken {
  override tokenType = '~=';
}

export class DashMatchToken extends CSSParserToken {
  override tokenType = '|=';
}

export class PrefixMatchToken extends CSSParserToken {
  override tokenType = '^=';
}

export class SuffixMatchToken extends CSSParserToken {
  override tokenType = '$=';
}

export class SubstringMatchToken extends CSSParserToken {
  override tokenType = '*=';
}

export class ColumnToken extends CSSParserToken {
  override tokenType = '||';
}

export class EOFToken extends CSSParserToken {
  override tokenType = 'EOF';
  override toSource() { return ''; }
}

export class DelimToken extends CSSParserToken {
  override tokenType = 'DELIM';
  override value: string = '';

  constructor(code: number) {
    super();
    this.value = stringFromCode(code);
  }

  override toString() { return 'DELIM(' + this.value + ')'; }

  override toJSON() {
    const json = this.constructor.prototype.constructor.prototype.toJSON.call(this);
    json.value = this.value;
    return json;
  }

  override toSource() {
    if (this.value === '\\')
      return '\\\n';
    else
      return this.value;
  }
}

export abstract class StringValuedToken extends CSSParserToken {
  override value: string = '';
  ASCIIMatch(str: string) {
    return this.value.toLowerCase() === str.toLowerCase();
  }

  override toJSON() {
    const json = this.constructor.prototype.constructor.prototype.toJSON.call(this);
    json.value = this.value;
    return json;
  }
}

export class IdentToken extends StringValuedToken {
  constructor(val: string) {
    super();
    this.value = val;
  }

  override tokenType = 'IDENT';
  override toString() { return 'IDENT(' + this.value + ')'; }
  override toSource() {
    return escapeIdent(this.value);
  }
}

export class FunctionToken extends StringValuedToken {
  override tokenType = 'FUNCTION';
  mirror: string;
  constructor(val: string) {
    super();
    this.value = val;
    this.mirror = ')';
  }

  override toString() { return 'FUNCTION(' + this.value + ')'; }

  override toSource() {
    return escapeIdent(this.value) + '(';
  }
}

export class AtKeywordToken extends StringValuedToken {
  override tokenType = 'AT-KEYWORD';
  constructor(val: string) {
    super();
    this.value = val;
  }
  override toString() { return 'AT(' + this.value + ')'; }
  override toSource() {
    return '@' + escapeIdent(this.value);
  }
}

export class HashToken extends StringValuedToken {
  override tokenType = 'HASH';
  type: string;
  constructor(val: string) {
    super();
    this.value = val;
    this.type = 'unrestricted';
  }

  override toString() { return 'HASH(' + this.value + ')'; }

  override toJSON() {
    const json = this.constructor.prototype.constructor.prototype.toJSON.call(this);
    json.value = this.value;
    json.type = this.type;
    return json;
  }

  override toSource() {
    if (this.type === 'id')
      return '#' + escapeIdent(this.value);
    else
      return '#' + escapeHash(this.value);

  }
}

export class StringToken extends StringValuedToken {
  override tokenType = 'STRING';
  constructor(val: string) {
    super();
    this.value = val;
  }

  override toString() {
    return '"' + escapeString(this.value) + '"';
  }
}

export class URLToken extends StringValuedToken {
  override tokenType = 'URL';
  constructor(val: string) {
    super();
    this.value = val;
  }
  override toString() { return 'URL(' + this.value + ')'; }
  override toSource() {
    return 'url("' + escapeString(this.value) + '")';
  }
}

export class NumberToken extends CSSParserToken {
  override tokenType = 'NUMBER';
  type: string;
  repr: string;

  constructor() {
    super();
    this.type = 'integer';
    this.repr = '';
  }

  override toString() {
    if (this.type === 'integer')
      return 'INT(' + this.value + ')';
    return 'NUMBER(' + this.value + ')';
  }
  override toJSON() {
    const json = super.toJSON();
    json.value = this.value;
    json.type = this.type;
    json.repr = this.repr;
    return json;
  }
  override toSource() { return this.repr; }
}


export class PercentageToken extends CSSParserToken {
  override tokenType = 'PERCENTAGE';
  repr: string;
  constructor() {
    super();
    this.repr = '';
  }
  override toString() { return 'PERCENTAGE(' + this.value + ')'; }
  override toJSON() {
    const json = this.constructor.prototype.constructor.prototype.toJSON.call(this);
    json.value = this.value;
    json.repr = this.repr;
    return json;
  }
  override toSource() { return this.repr + '%'; }
}

export class DimensionToken extends CSSParserToken {
  override tokenType = 'DIMENSION';
  type: string;
  repr: string;
  unit: string;

  constructor() {
    super();
    this.type = 'integer';
    this.repr = '';
    this.unit = '';
  }

  override toString() { return 'DIM(' + this.value + ',' + this.unit + ')'; }
  override toJSON() {
    const json = this.constructor.prototype.constructor.prototype.toJSON.call(this);
    json.value = this.value;
    json.type = this.type;
    json.repr = this.repr;
    json.unit = this.unit;
    return json;
  }
  override toSource() {
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

function escapeIdent(string: string) {
  string = '' + string;
  let result = '';
  const firstcode = string.charCodeAt(0);
  for (let i = 0; i < string.length; i++) {
    const code = string.charCodeAt(i);
    if (code === 0x0)
      throw new InvalidCharacterError('Invalid character: the input contains U+0000.');

    if (
      between(code, 0x1, 0x1f) || code === 0x7f ||
      (i === 0 && between(code, 0x30, 0x39)) ||
      (i === 1 && between(code, 0x30, 0x39) && firstcode === 0x2d)
    )
      result += '\\' + code.toString(16) + ' ';
    else if (
      code >= 0x80 ||
      code === 0x2d ||
      code === 0x5f ||
      between(code, 0x30, 0x39) ||
      between(code, 0x41, 0x5a) ||
      between(code, 0x61, 0x7a)
    )
      result += string[i];
    else
      result += '\\' + string[i];

  }
  return result;
}

function escapeHash(string: string) {
  // Escapes the contents of "unrestricted"-type hash tokens.
  // Won't preserve the ID-ness of "id"-type hash tokens;
  // use escapeIdent() for that.
  string = '' + string;
  let result = '';
  for (let i = 0; i < string.length; i++) {
    const code = string.charCodeAt(i);
    if (code === 0x0)
      throw new InvalidCharacterError('Invalid character: the input contains U+0000.');

    if (
      code >= 0x80 ||
      code === 0x2d ||
      code === 0x5f ||
      between(code, 0x30, 0x39) ||
      between(code, 0x41, 0x5a) ||
      between(code, 0x61, 0x7a)
    )
      result += string[i];
    else
      result += '\\' + code.toString(16) + ' ';

  }
  return result;
}

function escapeString(string: string) {
  string = '' + string;
  let result = '';
  for (let i = 0; i < string.length; i++) {
    const code = string.charCodeAt(i);

    if (code === 0x0)
      throw new InvalidCharacterError('Invalid character: the input contains U+0000.');

    if (between(code, 0x1, 0x1f) || code === 0x7f)
      result += '\\' + code.toString(16) + ' ';
    else if (code === 0x22 || code === 0x5c)
      result += '\\' + string[i];
    else
      result += string[i];

  }
  return result;
}
