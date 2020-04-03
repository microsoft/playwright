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

export function createAttributeEngine(attribute: string): SelectorEngine {
  const engine: SelectorEngine = {
    create(root: SelectorRoot, target: Element): string | undefined {
      const value = target.getAttribute(attribute);
      if (!value)
        return;
      if (queryInternal(root, attribute, value) === target)
        return value;
    },

    query(root: SelectorRoot, selector: string): Element | undefined {
      return queryInternal(root, attribute, selector);
    },

    queryAll(root: SelectorRoot, selector: string): Element[] {
      const result: Element[] = [];
      queryAllInternal(root, attribute, selector, result);
      return result;
    }
  };
  return engine;
}

function queryInternal(root: SelectorRoot, attribute: string, value: string): Element | undefined {
  const single = root.querySelector(`[${attribute}=${JSON.stringify(value)}]`);
  if (single)
    return single;
  const all = root.querySelectorAll('*');
  for (let i = 0; i < all.length; i++) {
    const shadowRoot = all[i].shadowRoot;
    if (shadowRoot) {
      const single = queryInternal(shadowRoot, attribute, value);
      if (single)
        return single;
    }
  }
}

function queryAllInternal(root: SelectorRoot, attribute: string, value: string, result: Element[]) {
  const document = root instanceof Document ? root : root.ownerDocument!;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  const shadowRoots = [];
  while (walker.nextNode()) {
    const element = walker.currentNode as Element;
    if (element.getAttribute(attribute) === value)
      result.push(element);
    if (element.shadowRoot)
      shadowRoots.push(element.shadowRoot);
  }
  for (const shadowRoot of shadowRoots)
    queryAllInternal(shadowRoot, attribute, value, result);
}
