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

import { InvalidSelectorError, parseCSS } from './cssParser';

import type { CSSComplexSelectorList } from './cssParser';
export { InvalidSelectorError, isInvalidSelectorError } from './cssParser';

export type NestedSelectorBody = { parsed: ParsedSelector, distance?: number };
const kNestedSelectorNames = new Set(['internal:has', 'internal:has-not', 'internal:and', 'internal:or', 'internal:chain', 'left-of', 'right-of', 'above', 'below', 'near']);
const kNestedSelectorNamesWithDistance = new Set(['left-of', 'right-of', 'above', 'below', 'near']);

export type ParsedSelectorPart = {
  name: string,
  body: string | CSSComplexSelectorList | NestedSelectorBody,
  source: string,
};

export type ParsedSelector = {
  parts: ParsedSelectorPart[],
  capture?: number,
};

type ParsedSelectorStrings = {
  parts: { name: string, body: string }[],
  capture?: number,
};

export const customCSSNames = new Set(['not', 'is', 'where', 'has', 'scope', 'light', 'visible', 'text', 'text-matches', 'text-is', 'has-text', 'above', 'below', 'right-of', 'left-of', 'near', 'nth-match']);

export function parseSelector(selector: string): ParsedSelector {
  const parsedStrings = parseSelectorString(selector);
  const parts: ParsedSelectorPart[] = [];
  for (const part of parsedStrings.parts) {
    if (part.name === 'css' || part.name === 'css:light') {
      if (part.name === 'css:light')
        part.body = ':light(' + part.body + ')';
      const parsedCSS = parseCSS(part.body, customCSSNames);
      parts.push({
        name: 'css',
        body: parsedCSS.selector,
        source: part.body
      });
      continue;
    }
    if (kNestedSelectorNames.has(part.name)) {
      let innerSelector: string;
      let distance: number | undefined;
      try {
        const unescaped = JSON.parse('[' + part.body + ']');
        if (!Array.isArray(unescaped) || unescaped.length < 1 || unescaped.length > 2 || typeof unescaped[0] !== 'string')
          throw new InvalidSelectorError(`Malformed selector: ${part.name}=` + part.body);
        innerSelector = unescaped[0];
        if (unescaped.length === 2) {
          if (typeof unescaped[1] !== 'number' || !kNestedSelectorNamesWithDistance.has(part.name))
            throw new InvalidSelectorError(`Malformed selector: ${part.name}=` + part.body);
          distance = unescaped[1];
        }
      } catch (e) {
        throw new InvalidSelectorError(`Malformed selector: ${part.name}=` + part.body);
      }
      const nested = { name: part.name, source: part.body, body: { parsed: parseSelector(innerSelector), distance } };
      const lastFrame = [...nested.body.parsed.parts].reverse().find(part => part.name === 'internal:control' && part.body === 'enter-frame');
      const lastFrameIndex = lastFrame ? nested.body.parsed.parts.indexOf(lastFrame) : -1;
      // Allow nested selectors to start with the same frame selector.
      if (lastFrameIndex !== -1 && selectorPartsEqual(nested.body.parsed.parts.slice(0, lastFrameIndex + 1), parts.slice(0, lastFrameIndex + 1)))
        nested.body.parsed.parts.splice(0, lastFrameIndex + 1);
      parts.push(nested);
      continue;
    }
    parts.push({ ...part, source: part.body });
  }
  if (kNestedSelectorNames.has(parts[0].name))
    throw new InvalidSelectorError(`"${parts[0].name}" selector cannot be first`);
  return {
    capture: parsedStrings.capture,
    parts
  };
}

export function splitSelectorByFrame(selectorText: string): ParsedSelector[] {
  const selector = parseSelector(selectorText);
  const result: ParsedSelector[] = [];
  let chunk: ParsedSelector = {
    parts: [],
  };
  let chunkStartIndex = 0;
  for (let i = 0; i < selector.parts.length; ++i) {
    const part = selector.parts[i];
    if (part.name === 'internal:control' && part.body === 'enter-frame') {
      if (!chunk.parts.length)
        throw new InvalidSelectorError('Selector cannot start with entering frame, select the iframe first');
      result.push(chunk);
      chunk = { parts: [] };
      chunkStartIndex = i + 1;
      continue;
    }
    if (selector.capture === i)
      chunk.capture = i - chunkStartIndex;
    chunk.parts.push(part);
  }
  if (!chunk.parts.length)
    throw new InvalidSelectorError(`Selector cannot end with entering frame, while parsing selector ${selectorText}`);
  result.push(chunk);
  if (typeof selector.capture === 'number' && typeof result[result.length - 1].capture !== 'number')
    throw new InvalidSelectorError(`Can not capture the selector before diving into the frame. Only use * after the last frame has been selected`);
  return result;
}

function selectorPartsEqual(list1: ParsedSelectorPart[], list2: ParsedSelectorPart[]) {
  return stringifySelector({ parts: list1 }) === stringifySelector({ parts: list2 });
}

export function stringifySelector(selector: string | ParsedSelector, forceEngineName?: boolean): string {
  if (typeof selector === 'string')
    return selector;
  return selector.parts.map((p, i) => {
    let includeEngine = true;
    if (!forceEngineName && i !== selector.capture) {
      if (p.name === 'css')
        includeEngine = false;
      else if (p.name === 'xpath' && p.source.startsWith('//') || p.source.startsWith('..'))
        includeEngine = false;
    }
    const prefix = includeEngine ? p.name + '=' : '';
    return `${i === selector.capture ? '*' : ''}${prefix}${p.source}`;
  }).join(' >> ');
}

export function visitAllSelectorParts(selector: ParsedSelector, visitor: (part: ParsedSelectorPart, nested: boolean) => void) {
  const visit = (selector: ParsedSelector, nested: boolean) => {
    for (const part of selector.parts) {
      visitor(part, nested);
      if (kNestedSelectorNames.has(part.name))
        visit((part.body as NestedSelectorBody).parsed, true);
    }
  };
  visit(selector, false);
}

function parseSelectorString(selector: string): ParsedSelectorStrings {
  let index = 0;
  let quote: string | undefined;
  let start = 0;
  const result: ParsedSelectorStrings = { parts: [] };
  const append = () => {
    const part = selector.substring(start, index).trim();
    const eqIndex = part.indexOf('=');
    let name: string;
    let body: string;
    if (eqIndex !== -1 && part.substring(0, eqIndex).trim().match(/^[a-zA-Z_0-9-+:*]+$/)) {
      name = part.substring(0, eqIndex).trim();
      body = part.substring(eqIndex + 1);
    } else if (part.length > 1 && part[0] === '"' && part[part.length - 1] === '"') {
      name = 'text';
      body = part;
    } else if (part.length > 1 && part[0] === "'" && part[part.length - 1] === "'") {
      name = 'text';
      body = part;
    } else if (/^\(*\/\//.test(part) || part.startsWith('..')) {
      // If selector starts with '//' or '//' prefixed with multiple opening
      // parenthesis, consider xpath. @see https://github.com/microsoft/playwright/issues/817
      // If selector starts with '..', consider xpath as well.
      name = 'xpath';
      body = part;
    } else {
      name = 'css';
      body = part;
    }
    let capture = false;
    if (name[0] === '*') {
      capture = true;
      name = name.substring(1);
    }
    result.parts.push({ name, body });
    if (capture) {
      if (result.capture !== undefined)
        throw new InvalidSelectorError(`Only one of the selectors can capture using * modifier`);
      result.capture = result.parts.length - 1;
    }
  };

  if (!selector.includes('>>')) {
    index = selector.length;
    append();
    return result;
  }

  const shouldIgnoreTextSelectorQuote = () => {
    const prefix = selector.substring(start, index);
    const match = prefix.match(/^\s*text\s*=(.*)$/);
    // Must be a text selector with some text before the quote.
    return !!match && !!match[1];
  };

  while (index < selector.length) {
    const c = selector[index];
    if (c === '\\' && index + 1 < selector.length) {
      index += 2;
    } else if (c === quote) {
      quote = undefined;
      index++;
    } else if (!quote && (c === '"' || c === '\'' || c === '`') && !shouldIgnoreTextSelectorQuote()) {
      quote = c;
      index++;
    } else if (!quote && c === '>' && selector[index + 1] === '>') {
      append();
      index += 2;
      start = index;
    } else {
      index++;
    }
  }
  append();
  return result;
}

export type AttributeSelectorOperator = '<truthy>'|'='|'*='|'|='|'^='|'$='|'~=';
export type AttributeSelectorPart = {
  name: string,
  jsonPath: string[],
  op: AttributeSelectorOperator,
  value: any,
  caseSensitive: boolean,
};

export type AttributeSelector = {
  name: string,
  attributes: AttributeSelectorPart[],
};


export function parseAttributeSelector(selector: string, allowUnquotedStrings: boolean): AttributeSelector {
  let wp = 0;
  let EOL = selector.length === 0;

  const next = () => selector[wp] || '';
  const eat1 = () => {
    const result = next();
    ++wp;
    EOL = wp >= selector.length;
    return result;
  };

  const syntaxError = (stage: string|undefined) => {
    if (EOL)
      throw new InvalidSelectorError(`Unexpected end of selector while parsing selector \`${selector}\``);
    throw new InvalidSelectorError(`Error while parsing selector \`${selector}\` - unexpected symbol "${next()}" at position ${wp}` + (stage ? ' during ' + stage : ''));
  };

  function skipSpaces() {
    while (!EOL && /\s/.test(next()))
      eat1();
  }

  function isCSSNameChar(char: string) {
    // https://www.w3.org/TR/css-syntax-3/#ident-token-diagram
    return (char >= '\u0080')  // non-ascii
        || (char >= '\u0030' && char <= '\u0039')  // digit
        || (char >= '\u0041' && char <= '\u005a')  // uppercase letter
        || (char >= '\u0061' && char <= '\u007a')  // lowercase letter
        || (char >= '\u0030' && char <= '\u0039')  // digit
        || char === '\u005f'  // "_"
        || char === '\u002d';  // "-"
  }

  function readIdentifier() {
    let result = '';
    skipSpaces();
    while (!EOL && isCSSNameChar(next()))
      result += eat1();
    return result;
  }

  function readQuotedString(quote: string) {
    let result = eat1();
    if (result !== quote)
      syntaxError('parsing quoted string');
    while (!EOL && next() !== quote) {
      if (next() === '\\')
        eat1();
      result += eat1();
    }
    if (next() !== quote)
      syntaxError('parsing quoted string');
    result += eat1();
    return result;
  }

  function readRegularExpression() {
    if (eat1() !== '/')
      syntaxError('parsing regular expression');
    let source = '';
    let inClass = false;
    // https://262.ecma-international.org/11.0/#sec-literals-regular-expression-literals
    while (!EOL) {
      if (next() === '\\') {
        source += eat1();
        if (EOL)
          syntaxError('parsing regular expression');
      } else if (inClass && next() === ']') {
        inClass = false;
      } else if (!inClass && next() === '[') {
        inClass = true;
      } else if (!inClass && next() === '/') {
        break;
      }
      source += eat1();
    }
    if (eat1() !== '/')
      syntaxError('parsing regular expression');
    let flags = '';
    // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
    while (!EOL && next().match(/[dgimsuy]/))
      flags += eat1();
    try {
      return new RegExp(source, flags);
    } catch (e) {
      throw new InvalidSelectorError(`Error while parsing selector \`${selector}\`: ${e.message}`);
    }
  }

  function readAttributeToken() {
    let token = '';
    skipSpaces();
    if (next() === `'` || next() === `"`)
      token = readQuotedString(next()).slice(1, -1);
    else
      token = readIdentifier();
    if (!token)
      syntaxError('parsing property path');
    return token;
  }

  function readOperator(): AttributeSelectorOperator {
    skipSpaces();
    let op = '';
    if (!EOL)
      op += eat1();
    if (!EOL && (op !== '='))
      op += eat1();
    if (!['=', '*=', '^=', '$=', '|=', '~='].includes(op))
      syntaxError('parsing operator');
    return (op as AttributeSelectorOperator);
  }

  function readAttribute(): AttributeSelectorPart {
    // skip leading [
    eat1();

    // read attribute name:
    // foo.bar
    // 'foo'  . "ba zz"
    const jsonPath = [];
    jsonPath.push(readAttributeToken());
    skipSpaces();
    while (next() === '.') {
      eat1();
      jsonPath.push(readAttributeToken());
      skipSpaces();
    }
    // check property is truthy: [enabled]
    if (next() === ']') {
      eat1();
      return { name: jsonPath.join('.'), jsonPath, op: '<truthy>', value: null, caseSensitive: false };
    }

    const operator = readOperator();

    let value = undefined;
    let caseSensitive = true;
    skipSpaces();
    if (next() === '/') {
      if (operator !== '=')
        throw new InvalidSelectorError(`Error while parsing selector \`${selector}\` - cannot use ${operator} in attribute with regular expression`);
      value = readRegularExpression();
    } else if (next() === `'` || next() === `"`) {
      value = readQuotedString(next()).slice(1, -1);
      skipSpaces();
      if (next() === 'i' || next() === 'I') {
        caseSensitive = false;
        eat1();
      } else if (next() === 's' || next() === 'S') {
        caseSensitive = true;
        eat1();
      }
    } else {
      value = '';
      while (!EOL && (isCSSNameChar(next()) || next() === '+' || next() === '.'))
        value += eat1();
      if (value === 'true') {
        value = true;
      } else if (value === 'false') {
        value = false;
      } else {
        if (!allowUnquotedStrings) {
          value = +value;
          if (Number.isNaN(value))
            syntaxError('parsing attribute value');
        }
      }
    }
    skipSpaces();
    if (next() !== ']')
      syntaxError('parsing attribute value');

    eat1();
    if (operator !== '=' && typeof value !== 'string')
      throw new InvalidSelectorError(`Error while parsing selector \`${selector}\` - cannot use ${operator} in attribute with non-string matching value - ${value}`);
    return { name: jsonPath.join('.'), jsonPath, op: operator, value, caseSensitive };
  }

  const result: AttributeSelector = {
    name: '',
    attributes: [],
  };
  result.name = readIdentifier();
  skipSpaces();
  while (next() === '[') {
    result.attributes.push(readAttribute());
    skipSpaces();
  }
  if (!EOL)
    syntaxError(undefined);
  if (!result.name && !result.attributes.length)
    throw new InvalidSelectorError(`Error while parsing selector \`${selector}\` - selector cannot be empty`);
  return result;
}
