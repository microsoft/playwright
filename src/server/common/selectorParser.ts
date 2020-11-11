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

// This file can't have dependencies, it is a part of the utility script.

export type SelectorArgument = { selector: Selector } | { value: any };
type QuerySelector = { name: string, arguments: SelectorArgument[] };
type FilterSelector = { selector: Selector, name: string, arguments: SelectorArgument[] };
type RelativeSelector = { parent: Selector, child: Selector, kind: 'descendant' | 'child' | 'hasDescendant' | 'hasChild' };
export type Selector = { query: QuerySelector } | { filter: FilterSelector } | { relative: RelativeSelector };

export function visitSelector(selector: Selector): { engines: Set<string>, filters: Set<string> } {
  const engines = new Set<string>();
  const filters = new Set<string>();
  const visit = (selector: Selector) => {
    if ('query' in selector) {
      engines.add(selector.query.name);
    } else if ('relative' in selector) {
      visit(selector.relative.parent);
      visit(selector.relative.child);
    } else {
      filters.add(selector.filter.name);
      visit(selector.filter.selector);
    }
  };
  visit(selector);
  return { engines, filters };
}

export function parseSelector(selector: string): Selector {
  let index = 0;
  let quote: string | undefined;
  let start = 0;

  const parts: Selector[] = [];
  let captureIndex: number | undefined;

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
    parts.push({ query: { name, arguments: [{ value: body }] } });
    if (capture) {
      if (captureIndex !== undefined)
        throw new Error(`Only one of the selectors can capture using * modifier`);
      captureIndex = parts.length - 1;
    }
  };

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

  let result: Selector = parts[0];
  const actualCaptureIndex = captureIndex === undefined ? parts.length - 1 : captureIndex;
  for (let i = 1; i <= actualCaptureIndex; i++)
    result = { relative: { parent: result, child: parts[i], kind: 'descendant' }};
  if (actualCaptureIndex + 1 < parts.length) {
    let has: Selector = parts[actualCaptureIndex + 1];
    for (let i = actualCaptureIndex + 2; i < parts.length; i++)
      has = { relative: { parent: has, child: parts[i], kind: 'descendant' }};
    result = { relative: { parent: result, child: has, kind: 'hasDescendant' }};
  }
  return result;
}
