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

function unescape(s: string): string {
  if (!s.includes('\\'))
    return s;
  const r: string[] = [];
  let i = 0;
  while (i < s.length) {
    if (s[i] === '\\' && i + 1 < s.length)
      i++;
    r.push(s[i++]);
  }
  return r.join('');
}

type Matcher = (text: string) => boolean;
function createMatcher(selector: string): Matcher {
  if (selector.length > 1 && selector[0] === '"' && selector[selector.length - 1] === '"') {
    const parsed = unescape(selector.substring(1, selector.length - 1));
    return text => text === parsed;
  }
  if (selector.length > 1 && selector[0] === "'" && selector[selector.length - 1] === "'") {
    const parsed = unescape(selector.substring(1, selector.length - 1));
    return text => text === parsed;
  }
  if (selector[0] === '/' && selector.lastIndexOf('/') > 0) {
    const lastSlash = selector.lastIndexOf('/');
    const re = new RegExp(selector.substring(1, lastSlash), selector.substring(lastSlash + 1));
    return text => re.test(text);
  }
  selector = selector.trim().toLowerCase();
  return text => text.toLowerCase().includes(selector);
}

// Skips <head>, <script> and <style> elements and all their children.
const nodeFilter: NodeFilter = {
  acceptNode: node => {
    return node.nodeName === 'HEAD' || node.nodeName === 'SCRIPT' || node.nodeName === 'STYLE' ?
      NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
  }
};

// If we are querying inside a filtered element, nodeFilter is never called, so we need a separate check.
function isFilteredNode(root: SelectorRoot, document: Document) {
  return root.nodeName === 'SCRIPT' || root.nodeName === 'STYLE' || document.head && document.head.contains(root);
}

function queryInternal(root: SelectorRoot, matcher: Matcher, shadow: boolean): Element | undefined {
  const document = root instanceof Document ? root : root.ownerDocument;
  if (isFilteredNode(root, document))
    return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, nodeFilter);
  const shadowRoots: ShadowRoot[] = [];
  if (shadow && (root as Element).shadowRoot)
    shadowRoots.push((root as Element).shadowRoot!);

  let lastTextParent: Element | null = null;
  let lastText = '';
  while (true) {
    const node = walker.nextNode();

    const textParent = (node && node.nodeType === Node.TEXT_NODE) ? node.parentElement : null;
    if (lastTextParent && textParent !== lastTextParent) {
      if (matcher(lastText))
        return lastTextParent;
      lastText = '';
    }
    lastTextParent = textParent;

    if (!node)
      break;
    if (node.nodeType === Node.TEXT_NODE) {
      lastText += node.nodeValue;
    } else {
      const element = node as Element;
      if ((element instanceof HTMLInputElement) && (element.type === 'submit' || element.type === 'button') && matcher(element.value))
        return element;
      if (shadow && element.shadowRoot)
        shadowRoots.push(element.shadowRoot);
    }
  }

  for (const shadowRoot of shadowRoots) {
    const element = queryInternal(shadowRoot, matcher, shadow);
    if (element)
      return element;
  }
}

function queryAllInternal(root: SelectorRoot, matcher: Matcher, shadow: boolean, result: Element[]) {
  const document = root instanceof Document ? root : root.ownerDocument;
  if (isFilteredNode(root, document))
    return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, nodeFilter);
  const shadowRoots: ShadowRoot[] = [];
  if (shadow && (root as Element).shadowRoot)
    shadowRoots.push((root as Element).shadowRoot!);

  let lastTextParent: Element | null = null;
  let lastText = '';
  while (true) {
    const node = walker.nextNode();

    const textParent = (node && node.nodeType === Node.TEXT_NODE) ? node.parentElement : null;
    if (lastTextParent && textParent !== lastTextParent) {
      if (matcher(lastText))
        result.push(lastTextParent);
      lastText = '';
    }
    lastTextParent = textParent;

    if (!node)
      break;
    if (node.nodeType === Node.TEXT_NODE) {
      lastText += node.nodeValue;
    } else {
      const element = node as Element;
      if ((element instanceof HTMLInputElement) && (element.type === 'submit' || element.type === 'button') && matcher(element.value))
        result.push(element);
      if (shadow && element.shadowRoot)
        shadowRoots.push(element.shadowRoot);
    }
  }

  for (const shadowRoot of shadowRoots)
    queryAllInternal(shadowRoot, matcher, shadow, result);
}
