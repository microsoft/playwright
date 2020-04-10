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

import { SelectorEngine, SelectorRoot } from './selectorEngine';

export const DeepEngine: SelectorEngine = {
  create(root: SelectorRoot, targetElement: Element): string | undefined {
    return;
  },

  query(root: SelectorRoot, selector: string): Element | undefined {
    const simple = root.querySelector(selector);
    if (simple)
      return simple;
    const parts = split(selector);
    if (!parts.length)
      return;
    parts.reverse();
    return queryInternal(root, root, parts);
  },

  queryAll(root: SelectorRoot, selector: string): Element[] {
    const result: Element[] = [];
    const parts = split(selector);
    if (parts.length) {
      parts.reverse();
      queryAllInternal(root, root, parts, result);
    }
    return result;
  }
};

function queryInternal(boundary: SelectorRoot, root: SelectorRoot, parts: string[]): Element | undefined {
  const matching = root.querySelectorAll(parts[0]);
  for (let i = 0; i < matching.length; i++) {
    const element = matching[i];
    if (parts.length === 1 || matches(element, parts, boundary))
      return element;
  }
  if ((root as Element).shadowRoot) {
    const child = queryInternal(boundary, (root as Element).shadowRoot!, parts);
    if (child)
      return child;
  }
  const elements = root.querySelectorAll('*');
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (element.shadowRoot) {
      const child = queryInternal(boundary, element.shadowRoot, parts);
      if (child)
        return child;
    }
  }
}

function queryAllInternal(boundary: SelectorRoot, root: SelectorRoot, parts: string[], result: Element[]) {
  const matching = root.querySelectorAll(parts[0]);
  for (let i = 0; i < matching.length; i++) {
    const element = matching[i];
    if (parts.length === 1 || matches(element, parts, boundary))
      result.push(element);
  }
  if ((root as Element).shadowRoot)
    queryAllInternal(boundary, (root as Element).shadowRoot!, parts, result);
  const elements = root.querySelectorAll('*');
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (element.shadowRoot)
      queryAllInternal(boundary, element.shadowRoot, parts, result);
  }
}

function matches(element: Element | undefined, parts: string[], boundary: SelectorRoot): boolean {
  let i = 1;
  while (i < parts.length && (element = parentElementOrShadowHost(element!)) && element !== boundary) {
    if (element.matches(parts[i]))
      i++;
  }
  return i === parts.length;
}

function parentElementOrShadowHost(element: Element): Element | undefined {
  if (element.parentElement)
    return element.parentElement;
  if (!element.parentNode)
    return;
  if (element.parentNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE && (element.parentNode as ShadowRoot).host)
    return (element.parentNode as ShadowRoot).host;
}

function split(selector: string): string[] {
  let index = 0;
  let quote: string | undefined;
  let start = 0;
  let space: 'none' | 'before' | 'after' = 'none';
  const result: string[] = [];
  const append = () => {
    const part = selector.substring(start, index).trim();
    if (part.length)
      result.push(part);
  };
  while (index < selector.length) {
    const c = selector[index];
    if (!quote && c === ' ') {
      if (space === 'none' || space === 'before')
        space = 'before';
      index++;
    } else {
      if (space === 'before') {
        if (c === '>' || c === '+' || c === '~') {
          space = 'after';
        } else {
          append();
          start = index;
          space = 'none';
        }
      } else {
        space = 'none';
      }
      if (c === '\\' && index + 1 < selector.length) {
        index += 2;
      } else if (c === quote) {
        quote = undefined;
        index++;
      } else {
        index++;
      }
    }
  }
  append();
  return result;
}

(DeepEngine as any)._test = () => {
  let id = 0;

  function createShadow(level: number): Element {
    const root = document.createElement('div');
    root.id = 'id' + id;
    root.textContent = 'root #id' + id;
    id++;
    const shadow = root.attachShadow({ mode: 'open' });
    for (let i = 0; i < 9; i++) {
      const div = document.createElement('div');
      div.id = 'id' + id;
      div.textContent = '#id' + id;
      id++;
      shadow.appendChild(div);
    }
    if (level) {
      shadow.appendChild(createShadow(level - 1));
      shadow.appendChild(createShadow(level - 1));
    }
    return root;
  }

  const {query, queryAll} = DeepEngine;

  document.body.textContent = '';
  document.body.appendChild(createShadow(10));
  console.time('found');
  for (let i = 0; i < id; i += 17) {
    const e = query(document, `div #id${i}`);
    if (!e || e.id !== 'id' + i)
      console.log(`div #id${i}`);  // eslint-disable-line no-console
  }
  console.timeEnd('found');
  console.time('not found');
  for (let i = 0; i < id; i += 17) {
    const e = query(document, `div div div div div #d${i}`);
    if (e)
      console.log(`div div div div div #d${i}`);  // eslint-disable-line no-console
  }
  console.timeEnd('not found');
  console.log(query(document, '#id543 + #id544'));  // eslint-disable-line no-console
  console.log(query(document, '#id542 ~ #id545'));  // eslint-disable-line no-console
  console.time('all');
  queryAll(document, 'div div div + div');
  console.timeEnd('all');
};
