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

import { SelectorEngine, SelectorType, SelectorRoot } from './selectorEngine';

export const TextEngine: SelectorEngine = {
  name: 'text',

  create(root: SelectorRoot, targetElement: Element, type: SelectorType): string | undefined {
    const document = root instanceof Document ? root : root.ownerDocument;
    if (!document)
      return;
    for (let child = targetElement.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 3 /* Node.TEXT_NODE */) {
        const text = child.nodeValue;
        if (!text)
          continue;
        if (text.match(/^\s*[a-zA-Z0-9]+\s*$/) && TextEngine.query(root, text.trim()) === targetElement)
          return text.trim();
        if (TextEngine.query(root, JSON.stringify(text)) === targetElement)
          return JSON.stringify(text);
      }
    }
  },

  query(root: SelectorRoot, selector: string): Element | undefined {
    const document = root instanceof Document ? root : root.ownerDocument;
    if (!document)
      return;
    const matcher = createMatcher(selector);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const element = node.parentElement;
      const text = node.nodeValue;
      if (element && text && matcher(text))
        return element;
    }
  },

  queryAll(root: SelectorRoot, selector: string): Element[] {
    const result: Element[] = [];
    const document = root instanceof Document ? root : root.ownerDocument;
    if (!document)
      return result;
    const matcher = createMatcher(selector);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const element = node.parentElement;
      const text = node.nodeValue;
      if (element && text && matcher(text))
        result.push(element);
    }
    return result;
  }
};

type Matcher = (text: string) => boolean;
function createMatcher(selector: string): Matcher {
  if (selector[0] === '"' && selector[selector.length - 1] === '"') {
    const parsed = JSON.parse(selector);
    return text => text === parsed;
  }
  if (selector[0] === '/' && selector.lastIndexOf('/') > 0) {
    const lastSlash = selector.lastIndexOf('/');
    const re = new RegExp(selector.substring(1, lastSlash), selector.substring(lastSlash + 1));
    return text => re.test(text);
  }
  selector = selector.trim();
  return text => text.trim() === selector;
}
