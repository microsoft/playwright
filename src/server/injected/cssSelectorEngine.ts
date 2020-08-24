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

export function createCSSEngine(shadow: boolean): SelectorEngine {
  const engine: SelectorEngine = {
    create(root: SelectorRoot, targetElement: Element): string | undefined {
      if (shadow)
        return;
      const tokens: string[] = [];

      function uniqueCSSSelector(prefix?: string): string | undefined {
        const path = tokens.slice();
        if (prefix)
          path.unshift(prefix);
        const selector = path.join(' > ');
        const nodes = Array.from(root.querySelectorAll(selector));
        return nodes[0] === targetElement ? selector : undefined;
      }

      for (let element: Element | null = targetElement; element && element !== root; element = element.parentElement) {
        const nodeName = element.nodeName.toLowerCase();

        // Element ID is the strongest signal, use it.
        let bestTokenForLevel: string = '';
        if (element.id) {
          const token = /^[a-zA-Z][a-zA-Z0-9\-\_]+$/.test(element.id) ? '#' + element.id : `[id="${element.id}"]`;
          const selector = uniqueCSSSelector(token);
          if (selector)
            return selector;
          bestTokenForLevel = token;
        }

        const parent = element.parentElement;

        // Combine class names until unique.
        const classes = Array.from(element.classList);
        for (let i = 0; i < classes.length; ++i) {
          const token = '.' + classes.slice(0, i + 1).join('.');
          const selector = uniqueCSSSelector(token);
          if (selector)
            return selector;
          // Even if not unique, does this subset of classes uniquely identify node as a child?
          if (!bestTokenForLevel && parent) {
            const sameClassSiblings = parent.querySelectorAll(token);
            if (sameClassSiblings.length === 1)
              bestTokenForLevel = token;
          }
        }

        // Ordinal is the weakest signal.
        if (parent) {
          const siblings = Array.from(parent.children);
          const sameTagSiblings = siblings.filter(sibling => (sibling).nodeName.toLowerCase() === nodeName);
          const token = sameTagSiblings.length === 1 ? nodeName : `${nodeName}:nth-child(${1 + siblings.indexOf(element)})`;
          const selector = uniqueCSSSelector(token);
          if (selector)
            return selector;
          if (!bestTokenForLevel)
            bestTokenForLevel = token;
        } else if (!bestTokenForLevel) {
          bestTokenForLevel = nodeName;
        }
        tokens.unshift(bestTokenForLevel);
      }
      return uniqueCSSSelector();
    },

    query(root: SelectorRoot, selector: string): Element | undefined {
      // TODO: uncomment for performance.
      // const simple = root.querySelector(selector);
      // if (simple)
      //   return simple;
      // if (!shadow)
      //   return;
      const selectors = split(selector);
      // Note: we do not just merge results produced by each selector, as that
      // will not return them in the tree traversal order, but rather in the selectors
      // matching order.
      if (!selectors.length)
        return;
      return queryShadowInternal(root, root, selectors, shadow);
    },

    queryAll(root: SelectorRoot, selector: string): Element[] {
      // TODO: uncomment for performance.
      // if (!shadow)
      //   return Array.from(root.querySelectorAll(selector));
      const result: Element[] = [];
      const selectors = split(selector);
      // Note: we do not just merge results produced by each selector, as that
      // will not return them in the tree traversal order, but rather in the selectors
      // matching order.
      if (selectors.length)
        queryShadowAllInternal(root, root, selectors, shadow, result);
      return result;
    }
  };
  (engine as any)._test = () => test(engine);
  return engine;
}

function queryShadowInternal(boundary: SelectorRoot, root: SelectorRoot, selectors: string[][], shadow: boolean): Element | undefined {
  let elements: NodeListOf<Element> | undefined;
  if (selectors.length === 1) {
    // Fast path for a single selector - query only matching elements, not all.
    const parts = selectors[0];
    const matching = root.querySelectorAll(parts[0]);
    for (const element of matching) {
      // If there is a single part, there are no ancestors to match.
      if (parts.length === 1 || ancestorsMatch(element, parts, boundary))
        return element;
    }
  } else {
    // Multiple selectors: visit each element in tree-traversal order and check whether it matches.
    elements = root.querySelectorAll('*');
    for (const element of elements) {
      for (const parts of selectors) {
        if (!element.matches(parts[0]))
          continue;
        // If there is a single part, there are no ancestors to match.
        if (parts.length === 1 || ancestorsMatch(element, parts, boundary))
          return element;
      }
    }
  }

  // Visit shadow dom after the light dom to preserve the tree-traversal order.
  if (!shadow)
    return;
  if ((root as Element).shadowRoot) {
    const child = queryShadowInternal(boundary, (root as Element).shadowRoot!, selectors, shadow);
    if (child)
      return child;
  }
  if (!elements)
    elements = root.querySelectorAll('*');
  for (const element of elements) {
    if (element.shadowRoot) {
      const child = queryShadowInternal(boundary, element.shadowRoot, selectors, shadow);
      if (child)
        return child;
    }
  }
}

function queryShadowAllInternal(boundary: SelectorRoot, root: SelectorRoot, selectors: string[][], shadow: boolean, result: Element[]) {
  let elements: NodeListOf<Element> | undefined;
  if (selectors.length === 1) {
    // Fast path for a single selector - query only matching elements, not all.
    const parts = selectors[0];
    const matching = root.querySelectorAll(parts[0]);
    for (const element of matching) {
      // If there is a single part, there are no ancestors to match.
      if (parts.length === 1 || ancestorsMatch(element, parts, boundary))
        result.push(element);
    }
  } else {
    // Multiple selectors: visit each element in tree-traversal order and check whether it matches.
    elements = root.querySelectorAll('*');
    for (const element of elements) {
      for (const parts of selectors) {
        if (!element.matches(parts[0]))
          continue;
        // If there is a single part, there are no ancestors to match.
        if (parts.length === 1 || ancestorsMatch(element, parts, boundary))
          result.push(element);
      }
    }
  }

  // Visit shadow dom after the light dom to preserve the tree-traversal order.
  if (!shadow)
    return;
  if ((root as Element).shadowRoot)
    queryShadowAllInternal(boundary, (root as Element).shadowRoot!, selectors, shadow, result);
  if (!elements)
    elements = root.querySelectorAll('*');
  for (const element of elements) {
    if (element.shadowRoot)
      queryShadowAllInternal(boundary, element.shadowRoot, selectors, shadow, result);
  }
}

function ancestorsMatch(element: Element | undefined, parts: string[], boundary: SelectorRoot): boolean {
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

// Splits the string into separate selectors by comma, and then each selector by the descendant combinator (space).
// Parts of each selector are reversed, so that the first one matches the target element.
function split(selector: string): string[][] {
  let index = 0;
  let quote: string | undefined;
  let insideAttr = false;
  let start = 0;
  const result: string[][] = [];
  let current: string[] = [];
  const appendToCurrent = () => {
    const part = selector.substring(start, index).trim();
    if (part.length)
      current.push(part);
  };
  const appendToResult = () => {
    appendToCurrent();
    result.push(current);
    current = [];
  };
  const isCombinator = (char: string) => {
    return char === '>' || char === '+' || char === '~';
  };
  const peekForward = () => {
    return selector.substring(index).trim()[0];
  };
  const peekBackward = () => {
    const s = selector.substring(0, index).trim();
    return s[s.length - 1];
  };
  while (index < selector.length) {
    const c = selector[index];
    if (!quote && !insideAttr && c === ' ' && !isCombinator(peekForward()) && !isCombinator(peekBackward())) {
      appendToCurrent();
      start = index;
      index++;
    } else {
      if (c === '\\' && index + 1 < selector.length) {
        index += 2;
      } else if (c === quote) {
        quote = undefined;
        index++;
      } else if (!quote && (c === '\'' || c === '"')) {
        quote = c;
        index++;
      } else if (!quote && c === '[') {
        insideAttr = true;
        index++;
      } else if (!quote && insideAttr && c === ']') {
        insideAttr = false;
        index++;
      } else if (!quote && !insideAttr && c === ',') {
        appendToResult();
        index++;
        start = index;
      } else {
        index++;
      }
    }
  }
  appendToResult();
  return result.filter(parts => !!parts.length).map(parts => parts.reverse());
}

function test(engine: SelectorEngine) {
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

  const {query, queryAll} = engine;

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
}
