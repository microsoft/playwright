/*
 * Original at https://github.com/tabatkins/parse-css
 * licensed under http://creativecommons.org/publicdomain/zero/1.0/
 *
 * Modifications copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Changes from https://github.com/tabatkins/parse-css
//   - Tabs are replaced with two spaces.
//   - Everything not related to tokenizing - below the first exports block - is removed.
//   - Exports are changed to typescript style.

// @ts-nocheck

var between = function (num, first, last) { return num >= first && num <= last; }
function digit(code) { return between(code, 0x30,0x39); }
function hexdigit(code) { return digit(code) || between(code, 0x41,0x46) || between(code, 0x61,0x66); }
function uppercaseletter(code) { return between(code, 0x41,0x5a); }
function lowercaseletter(code) { return between(code, 0x61,0x7a); }
function letter(code) { return uppercaseletter(code) || lowercaseletter(code); }
function nonascii(code) { return code >= 0x80; }
function namestartchar(code) { return letter(code) || nonascii(code) || code == 0x5f; }
function namechar(code) { return namestartchar(code) || digit(code) || code == 0x2d; }
function nonprintable(code) { return between(code, 0,8) || code == 0xb || between(code, 0xe,0x1f) || code == 0x7f; }
function newline(code) { return code == 0xa; }
function whitespace(code) { return newline(code) || code == 9 || code == 0x20; }
function badescape(code) { return newline(code) || isNaN(code); }

var maximumallowedcodepoint = 0x10ffff;

export class InvalidCharacterError extends Error {
  constructor (message) {
    this.message = message;
  }
}

function preprocess(str) {
  // Turn a string into an array of code points,
  // following the preprocessing cleanup rules.
  var codepoints = [];
  for(var i = 0; i < str.length; i++) {
    var code = str.charCodeAt(i);
    if(code == 0xd && str.charCodeAt(i+1) == 0xa) {
      code = 0xa; i++;
    }
    if(code == 0xd || code == 0xc) code = 0xa;
    if(code == 0x0) code = 0xfffd;
    if(between(code, 0xd800, 0xdbff) && between(str.charCodeAt(i+1), 0xdc00, 0xdfff)) {
      // Decode a surrogate pair into an astral codepoint.
      var lead = code - 0xd800;
      var trail = str.charCodeAt(i+1) - 0xdc00;
      code = Math.pow(2, 16) + lead * Math.pow(2, 10) + trail;
      i++;
    }
    codepoints.push(code);
  }
  return codepoints;
}

function stringFromCode(code) {
  if(code <= 0xffff) return String.fromCharCode(code);
  // Otherwise, encode astral char as surrogate pair.
  code -= Math.pow(2, 16);
  var lead = Math.floor(code/Math.pow(2, 10)) + 0xd800;
  var trail = code % Math.pow(2, 10) + 0xdc00;
  return String.fromCharCode(lead) + String.fromCharCode(trail);
}

export function tokenize(str: string): CSSParserToken[] {
  str = preprocess(str);
  var i = -1;
  var tokens = [];
  var code;

  // Line number information.
  var line = 0;
  var column = 0;
  // The only use of lastLineLength is in reconsume().
  var lastLineLength = 0;
  var incrLineno = function() {
    line += 1;
    lastLineLength = column;
    column = 0;
  };
  var locStart = {line:line, column:column};

  var codepoint = function(i) {
    if(i >= str.length) {
      return -1;
    }
    return str[i];
  }
  var next = function(num) {
    if(num === undefined)
      num = 1;
    if(num > 3)
      throw "Spec Error: no more than three codepoints of lookahead.";
    return codepoint(i+num);
  };
  var consume = function(num) {
    if(num === undefined)
      num = 1;
    i += num;
    code = codepoint(i);
    if(newline(code)) incrLineno();
    else column += num;
    //console.log('Consume '+i+' '+String.fromCharCode(code) + ' 0x' + code.toString(16));
    return true;
  };
  var reconsume = function() {
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
  var eof = function(codepoint) {
    if(codepoint === undefined) codepoint = code;
    return codepoint == -1;
  };
  var donothing = function() {};
  var parseerror = function() { console.log("Parse error at index " + i + ", processing codepoint 0x" + code.toString(16) + ".");return true; };

  var consumeAToken = function() {
    consumeComments();
    consume();
    if(whitespace(code)) {
      while(whitespace(next())) consume();
      return new WhitespaceToken;
    }
    else if(code == 0x22) return consumeAStringToken();
    else if(code == 0x23) {
      if(namechar(next()) || areAValidEscape(next(1), next(2))) {
        var token = new HashToken();
        if(wouldStartAnIdentifier(next(1), next(2), next(3))) token.type = "id";
        token.value = consumeAName();
        return token;
      } else {
        return new DelimToken(code);
      }
    }
    else if(code == 0x24) {
      if(next() == 0x3d) {
        consume();
        return new SuffixMatchToken();
      } else {
        return new DelimToken(code);
      }
    }
    else if(code == 0x27) return consumeAStringToken();
    else if(code == 0x28) return new OpenParenToken();
    else if(code == 0x29) return new CloseParenToken();
    else if(code == 0x2a) {
      if(next() == 0x3d) {
        consume();
        return new SubstringMatchToken();
      } else {
        return new DelimToken(code);
      }
    }
    else if(code == 0x2b) {
      if(startsWithANumber()) {
        reconsume();
        return consumeANumericToken();
      } else {
        return new DelimToken(code);
      }
    }
    else if(code == 0x2c) return new CommaToken();
    else if(code == 0x2d) {
      if(startsWithANumber()) {
        reconsume();
        return consumeANumericToken();
      } else if(next(1) == 0x2d && next(2) == 0x3e) {
        consume(2);
        return new CDCToken();
      } else if(startsWithAnIdentifier()) {
        reconsume();
        return consumeAnIdentlikeToken();
      } else {
        return new DelimToken(code);
      }
    }
    else if(code == 0x2e) {
      if(startsWithANumber()) {
        reconsume();
        return consumeANumericToken();
      } else {
        return new DelimToken(code);
      }
    }
    else if(code == 0x3a) return new ColonToken;
    else if(code == 0x3b) return new SemicolonToken;
    else if(code == 0x3c) {
      if(next(1) == 0x21 && next(2) == 0x2d && next(3) == 0x2d) {
        consume(3);
        return new CDOToken();
      } else {
        return new DelimToken(code);
      }
    }
    else if(code == 0x40) {
      if(wouldStartAnIdentifier(next(1), next(2), next(3))) {
        return new AtKeywordToken(consumeAName());
      } else {
        return new DelimToken(code);
      }
    }
    else if(code == 0x5b) return new OpenSquareToken();
    else if(code == 0x5c) {
      if(startsWithAValidEscape()) {
        reconsume();
        return consumeAnIdentlikeToken();
      } else {
        parseerror();
        return new DelimToken(code);
      }
    }
    else if(code == 0x5d) return new CloseSquareToken();
    else if(code == 0x5e) {
      if(next() == 0x3d) {
        consume();
        return new PrefixMatchToken();
      } else {
        return new DelimToken(code);
      }
    }
    else if(code == 0x7b) return new OpenCurlyToken();
    else if(code == 0x7c) {
      if(next() == 0x3d) {
        consume();
        return new DashMatchToken();
      } else if(next() == 0x7c) {
        consume();
        return new ColumnToken();
      } else {
        return new DelimToken(code);
      }
    }
    else if(code == 0x7d) return new CloseCurlyToken();
    else if(code == 0x7e) {
      if(next() == 0x3d) {
        consume();
        return new IncludeMatchToken();
      } else {
        return new DelimToken(code);
      }
    }
    else if(digit(code)) {
      reconsume();
      return consumeANumericToken();
    }
    else if(namestartchar(code)) {
      reconsume();
      return consumeAnIdentlikeToken();
    }
    else if(eof()) return new EOFToken();
    else return new DelimToken(code);
  };

  var consumeComments = function() {
    while(next(1) == 0x2f && next(2) == 0x2a) {
      consume(2);
      while(true) {
        consume();
        if(code == 0x2a && next() == 0x2f) {
          consume();
          break;
        } else if(eof()) {
          parseerror();
          return;
        }
      }
    }
  };

  var consumeANumericToken = function() {
    var num = consumeANumber();
    if(wouldStartAnIdentifier(next(1), next(2), next(3))) {
      var token = new DimensionToken();
      token.value = num.value;
      token.repr = num.repr;
      token.type = num.type;
      token.unit = consumeAName();
      return token;
    } else if(next() == 0x25) {
      consume();
      var token = new PercentageToken();
      token.value = num.value;
      token.repr = num.repr;
      return token;
    } else {
      var token = new NumberToken();
      token.value = num.value;
      token.repr = num.repr;
      token.type = num.type;
      return token;
    }
  };

  var consumeAnIdentlikeToken = function() {
    var str = consumeAName();
    if(str.toLowerCase() == "url" && next() == 0x28) {
      consume();
      while(whitespace(next(1)) && whitespace(next(2))) consume();
      if(next() == 0x22 || next() == 0x27) {
        return new FunctionToken(str);
      } else if(whitespace(next()) && (next(2) == 0x22 || next(2) == 0x27)) {
        return new FunctionToken(str);
      } else {
        return consumeAURLToken();
      }
    } else if(next() == 0x28) {
      consume();
      return new FunctionToken(str);
    } else {
      return new IdentToken(str);
    }
  };

  var consumeAStringToken = function(endingCodePoint) {
    if(endingCodePoint === undefined) endingCodePoint = code;
    var string = "";
    while(consume()) {
      if(code == endingCodePoint || eof()) {
        return new StringToken(string);
      } else if(newline(code)) {
        parseerror();
        reconsume();
        return new BadStringToken();
      } else if(code == 0x5c) {
        if(eof(next())) {
          donothing();
        } else if(newline(next())) {
          consume();
        } else {
          string += stringFromCode(consumeEscape())
        }
      } else {
        string += stringFromCode(code);
      }
    }
  };

  var consumeAURLToken = function() {
    var token = new URLToken("");
    while(whitespace(next())) consume();
    if(eof(next())) return token;
    while(consume()) {
      if(code == 0x29 || eof()) {
        return token;
      } else if(whitespace(code)) {
        while(whitespace(next())) consume();
        if(next() == 0x29 || eof(next())) {
          consume();
          return token;
        } else {
          consumeTheRemnantsOfABadURL();
          return new BadURLToken();
        }
      } else if(code == 0x22 || code == 0x27 || code == 0x28 || nonprintable(code)) {
        parseerror();
        consumeTheRemnantsOfABadURL();
        return new BadURLToken();
      } else if(code == 0x5c) {
        if(startsWithAValidEscape()) {
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
  };

  var consumeEscape = function() {
    // Assume the the current character is the \
    // and the next code point is not a newline.
    consume();
    if(hexdigit(code)) {
      // Consume 1-6 hex digits
      var digits = [code];
      for(var total = 0; total < 5; total++) {
        if(hexdigit(next())) {
          consume();
          digits.push(code);
        } else {
          break;
        }
      }
      if(whitespace(next())) consume();
      var value = parseInt(digits.map(function(x){return String.fromCharCode(x);}).join(''), 16);
      if( value > maximumallowedcodepoint ) value = 0xfffd;
      return value;
    } else if(eof()) {
      return 0xfffd;
    } else {
      return code;
    }
  };

  var areAValidEscape = function(c1, c2) {
    if(c1 != 0x5c) return false;
    if(newline(c2)) return false;
    return true;
  };
  var startsWithAValidEscape = function() {
    return areAValidEscape(code, next());
  };

  var wouldStartAnIdentifier = function(c1, c2, c3) {
    if(c1 == 0x2d) {
      return namestartchar(c2) || c2 == 0x2d || areAValidEscape(c2, c3);
    } else if(namestartchar(c1)) {
      return true;
    } else if(c1 == 0x5c) {
      return areAValidEscape(c1, c2);
    } else {
      return false;
    }
  };
  var startsWithAnIdentifier = function() {
    return wouldStartAnIdentifier(code, next(1), next(2));
  };

  var wouldStartANumber = function(c1, c2, c3) {
    if(c1 == 0x2b || c1 == 0x2d) {
      if(digit(c2)) return true;
      if(c2 == 0x2e && digit(c3)) return true;
      return false;
    } else if(c1 == 0x2e) {
      if(digit(c2)) return true;
      return false;
    } else if(digit(c1)) {
      return true;
    } else {
      return false;
    }
  };
  var startsWithANumber = function() {
    return wouldStartANumber(code, next(1), next(2));
  };

  var consumeAName = function() {
    var result = "";
    while(consume()) {
      if(namechar(code)) {
        result += stringFromCode(code);
      } else if(startsWithAValidEscape()) {
        result += stringFromCode(consumeEscape());
      } else {
        reconsume();
        return result;
      }
    }
  };

  var consumeANumber = function() {
    var repr = [];
    var type = "integer";
    if(next() == 0x2b || next() == 0x2d) {
      consume();
      repr += stringFromCode(code);
    }
    while(digit(next())) {
      consume();
      repr += stringFromCode(code);
    }
    if(next(1) == 0x2e && digit(next(2))) {
      consume();
      repr += stringFromCode(code);
      consume();
      repr += stringFromCode(code);
      type = "number";
      while(digit(next())) {
        consume();
        repr += stringFromCode(code);
      }
    }
    var c1 = next(1), c2 = next(2), c3 = next(3);
    if((c1 == 0x45 || c1 == 0x65) && digit(c2)) {
      consume();
      repr += stringFromCode(code);
      consume();
      repr += stringFromCode(code);
      type = "number";
      while(digit(next())) {
        consume();
        repr += stringFromCode(code);
      }
    } else if((c1 == 0x45 || c1 == 0x65) && (c2 == 0x2b || c2 == 0x2d) && digit(c3)) {
      consume();
      repr += stringFromCode(code);
      consume();
      repr += stringFromCode(code);
      consume();
      repr += stringFromCode(code);
      type = "number";
      while(digit(next())) {
        consume();
        repr += stringFromCode(code);
      }
    }
    var value = convertAStringToANumber(repr);
    return {type:type, value:value, repr:repr};
  };

  var convertAStringToANumber = function(string) {
    // CSS's number rules are identical to JS, afaik.
    return +string;
  };

  var consumeTheRemnantsOfABadURL = function() {
    while(consume()) {
      if(code == 0x29 || eof()) {
        return;
      } else if(startsWithAValidEscape()) {
        consumeEscape();
        donothing();
      } else {
        donothing();
      }
    }
  };



  var iterationCount = 0;
  while(!eof(next())) {
    tokens.push(consumeAToken());
    iterationCount++;
    if(iterationCount > str.length*2) return "I'm infinite-looping!";
  }
  return tokens;
}

export class CSSParserToken {
  value: string;
  mirror: string;
  tokenType: string;
  constructor() { this.value = ""; this.mirror = ""; this.tokenType = ""; }
  toJSON() { return {token: this.tokenType}; }
  toString() { return this.tokenType; }
  toSource() { return '' + this; }
}

export class BadStringToken extends CSSParserToken {
  constructor() { super(); this.tokenType = "BADSTRING"; }
}

export class BadURLToken extends CSSParserToken {
  constructor() { super(); this.tokenType = "BADURL"; }
}

export class WhitespaceToken extends CSSParserToken {
  constructor() { super(); this.tokenType = "WHITESPACE"; }
  toString() { return "WS"; }
  toSource() { return " "; }
}

export class CDOToken extends CSSParserToken {
  constructor() { super(); this.tokenType = "CDO"; }
  toSource() { return "<!--"; }
}

export class CDCToken extends CSSParserToken {
  constructor() { super(); this.tokenType = "CDC"; }
  toSource() { return "-->"; }
}

export class ColonToken extends CSSParserToken {
  constructor() { super(); this.tokenType = ":"; }
}

export class SemicolonToken extends CSSParserToken {
  constructor() { super(); this.tokenType = ";"; }
}

export class CommaToken extends CSSParserToken {
  constructor() { super(); this.tokenType = ","; }
}

export class GroupingToken extends CSSParserToken {
}

export class OpenCurlyToken extends GroupingToken {
  constructor() { super(); this.value = "{"; this.mirror = "}"; this.tokenType = "{"; }
}

export class CloseCurlyToken extends GroupingToken {
  constructor() { super(); this.value = "}"; this.mirror = "{"; this.tokenType = "}"; }
}

export class OpenSquareToken extends GroupingToken {
  constructor() { super(); this.value = "["; this.mirror = "]"; this.tokenType = "["; }
}

export class CloseSquareToken extends GroupingToken {
  constructor() { super(); this.value = "]"; this.mirror = "["; this.tokenType = "]"; }
}

export class OpenParenToken extends GroupingToken {
  constructor() { super(); this.value = "("; this.mirror = ")"; this.tokenType = "("; }
}

export class CloseParenToken extends GroupingToken {
  constructor() { super(); this.value = ")"; this.mirror = "("; this.tokenType = ")"; }
}

export class IncludeMatchToken extends CSSParserToken {
  constructor() { super(); this.tokenType = "~="; }
}

export class DashMatchToken extends CSSParserToken {
  constructor() { super(); this.tokenType = "|="; }
}

export class PrefixMatchToken extends CSSParserToken {
  constructor() { super(); this.tokenType = "^="; }
}

export class SuffixMatchToken extends CSSParserToken {
  constructor() { super(); this.tokenType = "$="; }
}

export class SubstringMatchToken extends CSSParserToken {
  constructor() { super(); this.tokenType = "*="; }
}

export class ColumnToken extends CSSParserToken {
  constructor() { super(); this.tokenType = "||"; }
}

export class EOFToken extends CSSParserToken {
  constructor() { super(); this.tokenType = "EOF"; }
  toSource() { return ""; }
}

export class DelimToken extends CSSParserToken {
  constructor(code) { super(); this.value = stringFromCode(code); this.tokenType = "DELIM"; }
  toString() { return "DELIM("+this.value+")"; }
  toJSON() {
    var json = this.constructor.prototype.constructor.prototype.toJSON.call(this);
    json.value = this.value;
    return json;
  }
  toSource() {
    if(this.value == "\\")
      return "\\\n";
    else
      return this.value;
  }
}

export class StringValuedToken extends CSSParserToken {
  ASCIIMatch(str) {
    return this.value.toLowerCase() == str.toLowerCase();
  }
  toJSON() {
    var json = this.constructor.prototype.constructor.prototype.toJSON.call(this);
    json.value = this.value;
    return json;
  }
}

export class IdentToken extends StringValuedToken {
  constructor(val) { super(); this.tokenType = "IDENT"; this.value = val; }
  toString() { return "IDENT("+this.value+")"; }
  toSource() {
    return escapeIdent(this.value);
  }
}

export class FunctionToken extends StringValuedToken {
  constructor(val) { super(); this.tokenType = "FUNCTION"; this.value = val; this.mirror = ")"; }
  toString() { return "FUNCTION("+this.value+")"; }
  toSource() {
    return escapeIdent(this.value) + "(";
  }
}

export class AtKeywordToken extends StringValuedToken {
  constructor(val) { super(); this.tokenType = "AT-KEYWORD"; this.value = val; }
  toString() { return "AT("+this.value+")"; }
  toSource() {
    return "@" + escapeIdent(this.value);
  }
}

export class HashToken extends StringValuedToken {
  constructor(val) { super(); this.tokenType = "HASH"; this.value = val; this.type = "unrestricted"; }
  toString() { return "HASH("+this.value+")"; }
  toJSON() {
    var json = this.constructor.prototype.constructor.prototype.toJSON.call(this);
    json.value = this.value;
    json.type = this.type;
    return json;
  }
  toSource() {
    if(this.type == "id") {
      return "#" + escapeIdent(this.value);
    } else {
      return "#" + escapeHash(this.value);
    }
  }
}

export class StringToken extends StringValuedToken {
  constructor(val) { super(); this.tokenType = "STRING"; this.value = val; }
  toString() {
    return '"' + escapeString(this.value) + '"';
  }
}

export class URLToken extends StringValuedToken {
  constructor(val) { super(); this.tokenType = "URL"; this.value = val; }
  toString() { return "URL("+this.value+")"; }
  toSource() {
    return 'url("' + escapeString(this.value) + '")';
  }
}

export class NumberToken extends CSSParserToken {
  constructor() {
    super();
    this.value = null;
    this.type = "integer";
    this.repr = "";
    this.tokenType = "NUMBER";
  }
  toString() {
    if(this.type == "integer")
      return "INT("+this.value+")";
    return "NUMBER("+this.value+")";
  }
  toJSON() {
    var json = this.constructor.prototype.constructor.prototype.toJSON.call(this);
    json.value = this.value;
    json.type = this.type;
    json.repr = this.repr;
    return json;
  }
  toSource() { return this.repr; }
}

export class PercentageToken extends CSSParserToken {
  constructor() {
    super();
    this.value = null;
    this.repr = "";
    this.tokenType = "PERCENTAGE";
  }
  toString() { return "PERCENTAGE("+this.value+")"; }
  toJSON() {
    var json = this.constructor.prototype.constructor.prototype.toJSON.call(this);
    json.value = this.value;
    json.repr = this.repr;
    return json;
  }
  toSource() { return this.repr + "%"; }
}

export class DimensionToken extends CSSParserToken {
  constructor() {
    super();
    this.value = null;
    this.type = "integer";
    this.repr = "";
    this.unit = "";
    this.tokenType = "DIMENSION";
  }
  toString() { return "DIM("+this.value+","+this.unit+")"; }
  toJSON() {
    var json = this.constructor.prototype.constructor.prototype.toJSON.call(this);
    json.value = this.value;
    json.type = this.type;
    json.repr = this.repr;
    json.unit = this.unit;
    return json;
  }
  toSource() {
    var source = this.repr;
    var unit = escapeIdent(this.unit);
    if(unit[0].toLowerCase() == "e" && (unit[1] == "-" || between(unit.charCodeAt(1), 0x30, 0x39))) {
      // Unit is ambiguous with scinot
      // Remove the leading "e", replace with escape.
      unit = "\\65 " + unit.slice(1, unit.length);
    }
    return source+unit;
  }
}

function escapeIdent(string) {
  string = ''+string;
  var result = '';
  var firstcode = string.charCodeAt(0);
  for(var i = 0; i < string.length; i++) {
    var code = string.charCodeAt(i);
    if(code == 0x0) {
      throw new InvalidCharacterError('Invalid character: the input contains U+0000.');
    }

    if(
      between(code, 0x1, 0x1f) || code == 0x7f ||
      (i == 0 && between(code, 0x30, 0x39)) ||
      (i == 1 && between(code, 0x30, 0x39) && firstcode == 0x2d)
    ) {
      result += '\\' + code.toString(16) + ' ';
    } else if(
      code >= 0x80 ||
      code == 0x2d ||
      code == 0x5f ||
      between(code, 0x30, 0x39) ||
      between(code, 0x41, 0x5a) ||
      between(code, 0x61, 0x7a)
    ) {
      result += string[i];
    } else {
      result += '\\' + string[i];
    }
  }
  return result;
}

function escapeHash(string) {
  // Escapes the contents of "unrestricted"-type hash tokens.
  // Won't preserve the ID-ness of "id"-type hash tokens;
  // use escapeIdent() for that.
  string = ''+string;
  var result = '';
  var firstcode = string.charCodeAt(0);
  for(var i = 0; i < string.length; i++) {
    var code = string.charCodeAt(i);
    if(code == 0x0) {
      throw new InvalidCharacterError('Invalid character: the input contains U+0000.');
    }

    if(
      code >= 0x80 ||
      code == 0x2d ||
      code == 0x5f ||
      between(code, 0x30, 0x39) ||
      between(code, 0x41, 0x5a) ||
      between(code, 0x61, 0x7a)
    ) {
      result += string[i];
    } else {
      result += '\\' + code.toString(16) + ' ';
    }
  }
  return result;
}

function escapeString(string) {
  string = ''+string;
  var result = '';
  for(var i = 0; i < string.length; i++) {
    var code = string.charCodeAt(i);

    if(code == 0x0) {
      throw new InvalidCharacterError('Invalid character: the input contains U+0000.');
    }

    if(between(code, 0x1, 0x1f) || code == 0x7f) {
      result += '\\' + code.toString(16) + ' ';
    } else if(code == 0x22 || code == 0x5c) {
      result += '\\' + string[i];
    } else {
      result += string[i];
    }
  }
  return result;
}
