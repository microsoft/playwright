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

export function createTextSelector(shadow: boolean): SelectorEngine {
  const engine: SelectorEngine = {
    create(root: SelectorRoot, targetElement: Element, type: SelectorType): string | undefined {
      const document = root instanceof Document ? root : root.ownerDocument;
      if (!document)
        return;
      for (let child = targetElement.firstChild; child; child = child.nextSibling) {
        if (child.nodeType === 3 /* Node.TEXT_NODE */) {
          const text = child.nodeValue;
          if (!text)
            continue;
          if (text.match(/^\s*[a-zA-Z0-9]+\s*$/) && engine.query(root, text.trim()) === targetElement)
            return text.trim();
          if (queryInternal(root, createMatcher(JSON.stringify(text)), shadow) === targetElement)
            return JSON.stringify(text);
        }
      }
    },

    query(root: SelectorRoot, selector: string): Element | undefined {
      return queryInternal(root, createMatcher(selector), shadow);
    },

    queryAll(root: SelectorRoot, selector: string): Element[] {
      const result: Element[] = [];
      queryAllInternal(root, createMatcher(selector), shadow, result);
      return result;
    }
  };
  return engine;
}

const SINGLE_QUOTE_CHAR = "'";
const DOUBLE_QUOTE_CHAR = '"';
const isSurroundedBy = (text: string, check: string) => text.length > 2 && text[0] === check && text[text.length - 1] === check;
export const hasTextSelectorSurroundings = (selector: string) => isSurroundedBy(selector, DOUBLE_QUOTE_CHAR) || isSurroundedBy(selector, SINGLE_QUOTE_CHAR);

type Matcher = (text: string) => boolean;
function createMatcher(selector: string): Matcher {
  // If the selector is surrounded by quotes test case sensitive
  if (hasTextSelectorSurroundings(selector)) {
    const innerText = selector.slice(1, selector.length - 1);
    // Use JSON.parse since we want to parse escaped characters
    const parsed = innerText.includes('\\') ? JSON.parse(`"${innerText}"`) : innerText;
    return text => text === parsed;
  }
  // If the selector is a RegExp, test for that
  if (selector[0] === '/' && selector.lastIndexOf('/') > 0) {
    const lastSlash = selector.lastIndexOf('/');
    const re = new RegExp(selector.substring(1, lastSlash), selector.substring(lastSlash + 1));
    return text => re.test(text);
  }
  // Otherwise case insensitive
  selector = selector.trim().toLowerCase();
  return text => text.toLowerCase().includes(selector);
}

function queryInternal(root: SelectorRoot, matcher: Matcher, shadow: boolean): Element | undefined {
  const document = root instanceof Document ? root : root.ownerDocument!;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  const shadowRoots: ShadowRoot[] = [];
  if (shadow && (root as Element).shadowRoot)
    shadowRoots.push((root as Element).shadowRoot!);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      if ((element instanceof HTMLInputElement) && (element.type === 'submit' || element.type === 'button') && matcher(element.value))
        return element;
      if (shadow && element.shadowRoot)
        shadowRoots.push(element.shadowRoot);
    } else {
      const element = node.parentElement;
      const text = node.nodeValue;
      if (element && element.nodeName !== 'SCRIPT' && element.nodeName !== 'STYLE' && text && matcher(text))
        return element;
    }
  }
  for (const shadowRoot of shadowRoots) {
    const element = queryInternal(shadowRoot, matcher, shadow);
    if (element)
      return element;
  }
}

function queryAllInternal(root: SelectorRoot, matcher: Matcher, shadow: boolean, result: Element[]) {
  const document = root instanceof Document ? root : root.ownerDocument!;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  const shadowRoots: ShadowRoot[] = [];
  if (shadow && (root as Element).shadowRoot)
    shadowRoots.push((root as Element).shadowRoot!);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      if ((element instanceof HTMLInputElement) && (element.type === 'submit' || element.type === 'button') && matcher(element.value))
        result.push(element);
      if (shadow && element.shadowRoot)
        shadowRoots.push(element.shadowRoot);
    } else {
      const element = node.parentElement;
      const text = node.nodeValue;
      if (element && element.nodeName !== 'SCRIPT' && element.nodeName !== 'STYLE' && text && matcher(text))
        result.push(element);
    }
  }
  for (const shadowRoot of shadowRoots)
    queryAllInternal(shadowRoot, matcher, shadow, result);
}
