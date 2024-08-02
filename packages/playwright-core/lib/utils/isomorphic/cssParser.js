"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.InvalidSelectorError = void 0;
exports.isInvalidSelectorError = isInvalidSelectorError;
exports.parseCSS = parseCSS;
exports.serializeSelector = serializeSelector;
var css = _interopRequireWildcard(require("./cssTokenizer"));
function _getRequireWildcardCache(e) { if ("function" != typeof WeakMap) return null; var r = new WeakMap(), t = new WeakMap(); return (_getRequireWildcardCache = function (e) { return e ? t : r; })(e); }
function _interopRequireWildcard(e, r) { if (!r && e && e.__esModule) return e; if (null === e || "object" != typeof e && "function" != typeof e) return { default: e }; var t = _getRequireWildcardCache(r); if (t && t.has(e)) return t.get(e); var n = { __proto__: null }, a = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var u in e) if ("default" !== u && Object.prototype.hasOwnProperty.call(e, u)) { var i = a ? Object.getOwnPropertyDescriptor(e, u) : null; i && (i.get || i.set) ? Object.defineProperty(n, u, i) : n[u] = e[u]; } return n.default = e, t && t.set(e, n), n; }
/**
 * Copyright (c) Microsoft Corporation.
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

class InvalidSelectorError extends Error {}
exports.InvalidSelectorError = InvalidSelectorError;
function isInvalidSelectorError(error) {
  return error instanceof InvalidSelectorError;
}

// Note: '>=' is used internally for text engine to preserve backwards compatibility.

// TODO: consider
//   - key=value
//   - operators like `=`, `|=`, `~=`, `*=`, `/`
//   - <empty>~=value
//   - argument modes: "parse all", "parse commas", "just a string"

function parseCSS(selector, customNames) {
  let tokens;
  try {
    tokens = css.tokenize(selector);
    if (!(tokens[tokens.length - 1] instanceof css.EOFToken)) tokens.push(new css.EOFToken());
  } catch (e) {
    const newMessage = e.message + ` while parsing selector "${selector}"`;
    const index = (e.stack || '').indexOf(e.message);
    if (index !== -1) e.stack = e.stack.substring(0, index) + newMessage + e.stack.substring(index + e.message.length);
    e.message = newMessage;
    throw e;
  }
  const unsupportedToken = tokens.find(token => {
    return token instanceof css.AtKeywordToken || token instanceof css.BadStringToken || token instanceof css.BadURLToken || token instanceof css.ColumnToken || token instanceof css.CDOToken || token instanceof css.CDCToken || token instanceof css.SemicolonToken ||
    // TODO: Consider using these for something, e.g. to escape complex strings.
    // For example :xpath{ (//div/bar[@attr="foo"])[2]/baz }
    // Or this way :xpath( {complex-xpath-goes-here("hello")} )
    token instanceof css.OpenCurlyToken || token instanceof css.CloseCurlyToken ||
    // TODO: Consider treating these as strings?
    token instanceof css.URLToken || token instanceof css.PercentageToken;
  });
  if (unsupportedToken) throw new InvalidSelectorError(`Unsupported token "${unsupportedToken.toSource()}" while parsing selector "${selector}"`);
  let pos = 0;
  const names = new Set();
  function unexpected() {
    return new InvalidSelectorError(`Unexpected token "${tokens[pos].toSource()}" while parsing selector "${selector}"`);
  }
  function skipWhitespace() {
    while (tokens[pos] instanceof css.WhitespaceToken) pos++;
  }
  function isIdent(p = pos) {
    return tokens[p] instanceof css.IdentToken;
  }
  function isString(p = pos) {
    return tokens[p] instanceof css.StringToken;
  }
  function isNumber(p = pos) {
    return tokens[p] instanceof css.NumberToken;
  }
  function isComma(p = pos) {
    return tokens[p] instanceof css.CommaToken;
  }
  function isOpenParen(p = pos) {
    return tokens[p] instanceof css.OpenParenToken;
  }
  function isCloseParen(p = pos) {
    return tokens[p] instanceof css.CloseParenToken;
  }
  function isFunction(p = pos) {
    return tokens[p] instanceof css.FunctionToken;
  }
  function isStar(p = pos) {
    return tokens[p] instanceof css.DelimToken && tokens[p].value === '*';
  }
  function isEOF(p = pos) {
    return tokens[p] instanceof css.EOFToken;
  }
  function isClauseCombinator(p = pos) {
    return tokens[p] instanceof css.DelimToken && ['>', '+', '~'].includes(tokens[p].value);
  }
  function isSelectorClauseEnd(p = pos) {
    return isComma(p) || isCloseParen(p) || isEOF(p) || isClauseCombinator(p) || tokens[p] instanceof css.WhitespaceToken;
  }
  function consumeFunctionArguments() {
    const result = [consumeArgument()];
    while (true) {
      skipWhitespace();
      if (!isComma()) break;
      pos++;
      result.push(consumeArgument());
    }
    return result;
  }
  function consumeArgument() {
    skipWhitespace();
    if (isNumber()) return tokens[pos++].value;
    if (isString()) return tokens[pos++].value;
    return consumeComplexSelector();
  }
  function consumeComplexSelector() {
    const result = {
      simples: []
    };
    skipWhitespace();
    if (isClauseCombinator()) {
      // Put implicit ":scope" at the start. https://drafts.csswg.org/selectors-4/#relative
      result.simples.push({
        selector: {
          functions: [{
            name: 'scope',
            args: []
          }]
        },
        combinator: ''
      });
    } else {
      result.simples.push({
        selector: consumeSimpleSelector(),
        combinator: ''
      });
    }
    while (true) {
      skipWhitespace();
      if (isClauseCombinator()) {
        result.simples[result.simples.length - 1].combinator = tokens[pos++].value;
        skipWhitespace();
      } else if (isSelectorClauseEnd()) {
        break;
      }
      result.simples.push({
        combinator: '',
        selector: consumeSimpleSelector()
      });
    }
    return result;
  }
  function consumeSimpleSelector() {
    let rawCSSString = '';
    const functions = [];
    while (!isSelectorClauseEnd()) {
      if (isIdent() || isStar()) {
        rawCSSString += tokens[pos++].toSource();
      } else if (tokens[pos] instanceof css.HashToken) {
        rawCSSString += tokens[pos++].toSource();
      } else if (tokens[pos] instanceof css.DelimToken && tokens[pos].value === '.') {
        pos++;
        if (isIdent()) rawCSSString += '.' + tokens[pos++].toSource();else throw unexpected();
      } else if (tokens[pos] instanceof css.ColonToken) {
        pos++;
        if (isIdent()) {
          if (!customNames.has(tokens[pos].value.toLowerCase())) {
            rawCSSString += ':' + tokens[pos++].toSource();
          } else {
            const name = tokens[pos++].value.toLowerCase();
            functions.push({
              name,
              args: []
            });
            names.add(name);
          }
        } else if (isFunction()) {
          const name = tokens[pos++].value.toLowerCase();
          if (!customNames.has(name)) {
            rawCSSString += `:${name}(${consumeBuiltinFunctionArguments()})`;
          } else {
            functions.push({
              name,
              args: consumeFunctionArguments()
            });
            names.add(name);
          }
          skipWhitespace();
          if (!isCloseParen()) throw unexpected();
          pos++;
        } else {
          throw unexpected();
        }
      } else if (tokens[pos] instanceof css.OpenSquareToken) {
        rawCSSString += '[';
        pos++;
        while (!(tokens[pos] instanceof css.CloseSquareToken) && !isEOF()) rawCSSString += tokens[pos++].toSource();
        if (!(tokens[pos] instanceof css.CloseSquareToken)) throw unexpected();
        rawCSSString += ']';
        pos++;
      } else {
        throw unexpected();
      }
    }
    if (!rawCSSString && !functions.length) throw unexpected();
    return {
      css: rawCSSString || undefined,
      functions
    };
  }
  function consumeBuiltinFunctionArguments() {
    let s = '';
    let balance = 1; // First open paren is a part of a function token.
    while (!isEOF()) {
      if (isOpenParen() || isFunction()) balance++;
      if (isCloseParen()) balance--;
      if (!balance) break;
      s += tokens[pos++].toSource();
    }
    return s;
  }
  const result = consumeFunctionArguments();
  if (!isEOF()) throw unexpected();
  if (result.some(arg => typeof arg !== 'object' || !('simples' in arg))) throw new InvalidSelectorError(`Error while parsing selector "${selector}"`);
  return {
    selector: result,
    names: Array.from(names)
  };
}
function serializeSelector(args) {
  return args.map(arg => {
    if (typeof arg === 'string') return `"${arg}"`;
    if (typeof arg === 'number') return String(arg);
    return arg.simples.map(({
      selector,
      combinator
    }) => {
      let s = selector.css || '';
      s = s + selector.functions.map(func => `:${func.name}(${serializeSelector(func.args)})`).join('');
      if (combinator) s += ' ' + combinator;
      return s;
    }).join(' ');
  }).join(', ');
}