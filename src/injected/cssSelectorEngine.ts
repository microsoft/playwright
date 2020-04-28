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
      const parts = split(selector);
      if (!parts.length)
        return;
      parts.reverse();
      return queryShadowInternal(root, root, parts, shadow);
    },

    queryAll(root: SelectorRoot, selector: string): Element[] {
      // TODO: uncomment for performance.
      // if (!shadow)
      //   return Array.from(root.querySelectorAll(selector));
      const result: Element[] = [];
      const parts = split(selector);
      if (parts.length) {
        parts.reverse();
        queryShadowAllInternal(root, root, parts, shadow, result);
      }
      return result;
    }
  };
  (engine as any)._test = () => test(engine);
  return engine;
}

function queryShadowInternal(boundary: SelectorRoot, root: SelectorRoot, parts: string[], shadow: boolean): Element | undefined {
  const matching = root.querySelectorAll(parts[0]);
  for (let i = 0; i < matching.length; i++) {
    const element = matching[i];
    if (parts.length === 1 || matches(element, parts, boundary))
      return element;
  }
  if (!shadow)
    return;
  if ((root as Element).shadowRoot) {
    const child = queryShadowInternal(boundary, (root as Element).shadowRoot!, parts, shadow);
    if (child)
      return child;
  }
  const elements = root.querySelectorAll('*');
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (element.shadowRoot) {
      const child = queryShadowInternal(boundary, element.shadowRoot, parts, shadow);
      if (child)
        return child;
    }
  }
}

function queryShadowAllInternal(boundary: SelectorRoot, root: SelectorRoot, parts: string[], shadow: boolean, result: Element[]) {
  const matching = root.querySelectorAll(parts[0]);
  for (let i = 0; i < matching.length; i++) {
    const element = matching[i];
    if (parts.length === 1 || matches(element, parts, boundary))
      result.push(element);
  }
  if (shadow && (root as Element).shadowRoot)
    queryShadowAllInternal(boundary, (root as Element).shadowRoot!, parts, shadow, result);
  const elements = root.querySelectorAll('*');
  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    if (shadow && element.shadowRoot)
      queryShadowAllInternal(boundary, element.shadowRoot, parts, shadow, result);
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
      } else if (c === '\'' || c === '"') {
        quote = c;
        index++;
      } else {
        index++;
      }
    }
  }
  append();
  return result;
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
