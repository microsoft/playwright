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

import * as css from './cssTokenizer';

// TODO: Consider giving more information, e.g. whether the argument was a quoted string or not.
type ParsedSelectorLiteral = string;
type ClauseCombinator = '' | '>' | '+' | '~';
export type ParsedSelectorClause = ParsedSelectorLiteral | { css?: string, funcs: { name: string, args: ParsedSelectorList }[] };
export type ParsedSelector = { clauses: { clause: ParsedSelectorClause, combinator: ClauseCombinator }[] };
export type ParsedSelectorList = (ParsedSelectorLiteral | ParsedSelector)[];

export function parseCSS(selector: string): ParsedSelectorList {
  let tokens: css.CSSTokenInterface[];
  try {
    tokens = css.tokenize(selector);
    if (!(tokens[tokens.length - 1] instanceof css.EOFToken))
      tokens.push(new css.EOFToken());
  } catch (e) {
    const newMessage = e.message + ` while parsing selector "${selector}"`;
    const index = (e.stack || '').indexOf(e.message);
    if (index !== -1)
      e.stack = e.stack.substring(0, index) + newMessage + e.stack.substring(index + e.message.length);
    e.message = newMessage;
    throw e;
  }
  const unsupportedToken = tokens.find(token => {
    return (token instanceof css.AtKeywordToken) ||
      (token instanceof css.BadStringToken) ||
      (token instanceof css.BadURLToken) ||
      (token instanceof css.ColumnToken) ||
      (token instanceof css.CDOToken) ||
      (token instanceof css.CDCToken) ||
      (token instanceof css.SemicolonToken) ||
      // TODO: Consider using these for something, e.g. to escape complex strings.
      // For example :xpath{ (//div/bar[@attr="foo"])[2]/baz }
      // Or this way :xpath( {complex-xpath-goes-here("hello")} )
      (token instanceof css.OpenCurlyToken) ||
      (token instanceof css.CloseCurlyToken) ||
      // TODO: Consider treating these as strings?
      (token instanceof css.URLToken) ||
      (token instanceof css.PercentageToken);
  });
  if (unsupportedToken)
    throw new Error(`Unsupported token "${unsupportedToken.toSource()}" while parsing selector "${selector}"`);

  let pos = 0;

  function unexpected() {
    return new Error(`Unexpected token "${tokens[pos].toSource()}" while parsing selector "${selector}"`);
  }

  function skipWhitespace() {
    while (tokens[pos] instanceof css.WhitespaceToken)
      pos++;
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

  function isCloseParen(p = pos) {
    return tokens[p] instanceof css.CloseParenToken;
  }

  function isStar(p = pos) {
    return (tokens[p] instanceof css.DelimToken) && tokens[p].value === '*';
  }

  function isEOF(p = pos) {
    return tokens[p] instanceof css.EOFToken;
  }

  function isClauseCombinator(p = pos) {
    return (tokens[p] instanceof css.DelimToken) && (['>', '+', '~'].includes(tokens[p].value));
  }

  function isSelectorClauseEnd(p = pos) {
    return isComma(p) || isCloseParen(p) || isEOF(p) || isClauseCombinator(p) || (tokens[p] instanceof css.WhitespaceToken);
  }

  function consumeSelectorList(): ParsedSelectorList {
    const result = [consumeSelector()];
    while (true) {
      skipWhitespace();
      if (!isComma())
        break;
      pos++;
      result.push(consumeSelector());
    }
    return result;
  }

  function consumeSelector(): ParsedSelector | ParsedSelectorLiteral {
    skipWhitespace();
    const result = { clauses: [{ clause: consumeSelectorClause(), combinator: '' as ClauseCombinator }] };
    while (true) {
      skipWhitespace();
      if (isClauseCombinator()) {
        result.clauses[result.clauses.length - 1].combinator = tokens[pos++].value as ClauseCombinator;
        skipWhitespace();
      } else if (isSelectorClauseEnd()) {
        break;
      }
      result.clauses.push({ combinator: '', clause: consumeSelectorClause() });
    }
    if (result.clauses.length === 1 && typeof result.clauses[0].clause === 'string')
      return result.clauses[0].clause;
    return result;
  }

  function consumeSelectorClause(): ParsedSelectorClause {
    // TODO: Consider symbols like `=`, `|=`, `~=`, `*=`, `/` and convert them to strings.
    if ((isNumber() || isString() || isStar() || isIdent()) && isSelectorClauseEnd(pos + 1))
      return isString() ? tokens[pos++].value : tokens[pos++].toSource();

    let rawCSSString = '';
    const funcs: { name: string, args: ParsedSelectorList }[] = [];

    while (!isSelectorClauseEnd()) {
      if (isIdent() || isStar()) {
        rawCSSString += tokens[pos++].toSource();
      } else if (tokens[pos] instanceof css.HashToken) {
        rawCSSString += tokens[pos++].toSource();
      } else if ((tokens[pos] instanceof css.DelimToken) && tokens[pos].value === '.') {
        pos++;
        if (isIdent())
          rawCSSString += '.' + tokens[pos++].toSource();
        else
          throw unexpected();
      } else if (tokens[pos] instanceof css.ColonToken) {
        pos++;
        if (isIdent()) {
          if (cssFilters.has(tokens[pos].value))
            rawCSSString += ':' + tokens[pos++].toSource();
          else
            funcs.push({ name: tokens[pos++].value, args: [] });
        } else if (tokens[pos] instanceof css.FunctionToken) {
          const name = tokens[pos++].value;
          if (cssFunctions.has(name))
            rawCSSString += `:${name}(${consumeCSSFunctionArgs()})`;
          else
            funcs.push({ name, args: consumeSelectorList() });
          skipWhitespace();
          if (!isCloseParen())
            throw unexpected();
          pos++;
        } else {
          throw unexpected();
        }
      } else if (tokens[pos] instanceof css.OpenSquareToken) {
        rawCSSString += '[';
        pos++;
        while (!(tokens[pos] instanceof css.CloseSquareToken) && !isEOF())
          rawCSSString += tokens[pos++].toSource();
        if (!(tokens[pos] instanceof css.CloseSquareToken))
          throw unexpected();
        rawCSSString += ']';
        pos++;
      } else {
        throw unexpected();
      }
    }
    if (!rawCSSString && !funcs.length)
      throw unexpected();
    return { css: rawCSSString || undefined, funcs };
  }

  function consumeCSSFunctionArgs(): string {
    let s = '';
    while (!isCloseParen() && !isEOF())
      s += tokens[pos++].toSource();
    return s;
  }

  const result = consumeSelectorList();
  if (!isEOF())
    throw new Error(`Error while parsing selector "${selector}"`);
  return result;
}

export function serializeSelector(selectorList: ParsedSelectorList) {
  return selectorList.map(selector => {
    if (typeof selector === 'string')
      return selector;
    return selector.clauses.map(({ clause, combinator }) => {
      let s = '';
      if (typeof clause === 'string') {
        s = clause;
      } else {
        if (clause.css)
          s = clause.css;
        s = s + clause.funcs.map(func => `:${func.name}(${serializeSelector(func.args)})`).join('');
      }
      if (combinator)
        s += ' ' + combinator;
      return s;
    }).join(' ');
  }).join(', ');
}

const cssFilters = new Set([
  'active', 'any-link', 'checked', 'blank', 'default', 'defined',
  'disabled', 'empty', 'enabled', 'first', 'first-child', 'first-of-type',
  'fullscreen', 'focus', 'focus-visible', 'focus-within', 'hover',
  'indeterminate', 'in-range', 'invalid', 'last-child', 'last-of-type',
  'link', 'only-child', 'only-of-type', 'optional', 'out-of-range', 'placeholder-shown',
  'read-only', 'read-write', 'required', 'root', 'target', 'valid', 'visited',
]);

const cssFunctions = new Set([
  'dir', 'lang', 'nth-child', 'nth-last-child', 'nth-last-of-type', 'nth-of-type',
]);
