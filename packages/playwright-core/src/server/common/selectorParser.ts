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

import { InvalidSelectorError } from './selectorErrors';
import { CSSComplexSelectorList, parseCSS } from './cssParser';

export type ParsedSelectorPart = {
  name: string,
  body: string | CSSComplexSelectorList,
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
  const result = parseSelectorString(selector);
  const parts: ParsedSelectorPart[] = result.parts.map(part => {
    if (part.name === 'css' || part.name === 'css:light') {
      if (part.name === 'css:light')
        part.body = ':light(' + part.body + ')';
      const parsedCSS = parseCSS(part.body, customCSSNames);
      return {
        name: 'css',
        body: parsedCSS.selector,
        source: part.body
      };
    }
    return { ...part, source: part.body };
  });
  return {
    capture: result.capture,
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
    if (part.name === 'control' && part.body === 'enter-frame') {
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

export function stringifySelector(selector: string | ParsedSelector): string {
  if (typeof selector === 'string')
    return selector;
  return selector.parts.map((p, i) => {
    const prefix = p.name === 'css' ? '' : p.name + '=';
    return `${i === selector.capture ? '*' : ''}${prefix}${p.source}`;
  }).join(' >> ');
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

  while (index < selector.length) {
    const c = selector[index];
    if (c === '\\' && index + 1 < selector.length) {
      index += 2;
    } else if (c === quote) {
      quote = undefined;
      index++;
    } else if (!quote && (c === '"' || c === '\'' || c === '`')) {
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
