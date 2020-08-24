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

const maxTextLength = 80;
const minMeaningfulSelectorLegth = 100;

export const XPathEngine: SelectorEngine = {
  create(root: SelectorRoot, targetElement: Element, type: SelectorType): string | undefined {
    const maybeDocument = root instanceof Document ? root : root.ownerDocument;
    if (!maybeDocument)
      return;
    const document = maybeDocument;

    const xpathCache = new Map<string, Element[]>();
    if (type === 'notext')
      return createNoText(root, targetElement);

    const tokens: string[] = [];

    function evaluateXPath(expression: string): Element[] {
      let nodes: Element[] | undefined = xpathCache.get(expression);
      if (!nodes) {
        nodes = [];
        try {
          const result = document.evaluate(expression, root, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE);
          for (let node = result.iterateNext(); node; node = result.iterateNext()) {
            if (node.nodeType === Node.ELEMENT_NODE)
              nodes.push(node as Element);
          }
        } catch (e) {
        }
        xpathCache.set(expression, nodes);
      }
      return nodes;
    }

    function uniqueXPathSelector(prefix?: string): string | undefined {
      const path = tokens.slice();
      if (prefix)
        path.unshift(prefix);
      let selector = '//' + path.join('/');
      while (selector.includes('///'))
        selector = selector.replace('///', '//');
      if (selector.endsWith('/'))
        selector = selector.substring(0, selector.length - 1);
      const nodes: Element[] = evaluateXPath(selector);
      if (nodes[nodes.length - 1] === targetElement)
        return selector;

      // If we are looking at a small set of elements with long selector, fall back to ordinal.
      if (nodes.length < 5 && selector.length > minMeaningfulSelectorLegth) {
        const index = nodes.indexOf(targetElement);
        if (index !== -1)
          return `(${selector})[${index + 1}]`;
      }
      return undefined;
    }

    function escapeAndCap(text: string) {
      text = text.substring(0, maxTextLength);
      // XPath 1.0 does not support quote escaping.
      // 1. If there are no single quotes - use them.
      if (text.indexOf(`'`) === -1)
        return `'${text}'`;
      // 2. If there are no double quotes - use them to enclose text.
      if (text.indexOf(`"`) === -1)
        return `"${text}"`;
      // 3. Otherwise, use popular |concat| trick.
      const Q = `'`;
      return `concat(${text.split(Q).map(token => Q + token + Q).join(`, "'", `)})`;
    }

    const defaultAttributes = new Set([ 'title', 'aria-label', 'disabled', 'role' ]);
    const importantAttributes = new Map<string, string[]>([
      [ 'form', [ 'action' ] ],
      [ 'img', [ 'alt' ] ],
      [ 'input', [ 'placeholder', 'type', 'name', 'value' ] ],
    ]);

    let usedTextConditions = false;
    for (let element: Element | null = targetElement; element && element !== root; element = element.parentElement) {
      const nodeName = element.nodeName.toLowerCase();
      const tag = nodeName === 'svg' ? '*' : nodeName;

      const tagConditions = [];
      if (nodeName === 'svg')
        tagConditions.push('local-name()="svg"');

      const attrConditions: string[] = [];
      const importantAttrs = [ ...defaultAttributes, ...(importantAttributes.get(tag) || []) ];
      for (const attr of importantAttrs) {
        const value = element.getAttribute(attr);
        if (value && value.length < maxTextLength)
          attrConditions.push(`normalize-space(@${attr})=${escapeAndCap(value)}`);
        else if (value)
          attrConditions.push(`starts-with(normalize-space(@${attr}), ${escapeAndCap(value)})`);
      }

      const text = document.evaluate('normalize-space(.)', element).stringValue;
      const textConditions = [];
      if (tag !== 'select' && text.length && !usedTextConditions) {
        if (text.length < maxTextLength)
          textConditions.push(`normalize-space(.)=${escapeAndCap(text)}`);
        else
          textConditions.push(`starts-with(normalize-space(.), ${escapeAndCap(text)})`);
        usedTextConditions = true;
      }

      // Always retain the last tag.
      const conditions = [ ...tagConditions, ...textConditions, ...attrConditions ];
      const token = conditions.length ? `${tag}[${conditions.join(' and ')}]` : (tokens.length ? '' : tag);
      const selector = uniqueXPathSelector(token);
      if (selector)
        return selector;

      // Ordinal is the weakest signal.
      const parent = element.parentElement;
      let tagWithOrdinal = tag;
      if (parent) {
        const siblings = Array.from(parent.children);
        const sameTagSiblings = siblings.filter(sibling => (sibling).nodeName.toLowerCase() === nodeName);
        if (sameTagSiblings.length > 1)
          tagWithOrdinal += `[${1 + siblings.indexOf(element)}]`;
      }

      // Do not include text into this token, only tag / attributes.
      // Topmost node will get all the text.
      const nonTextConditions = [ ...tagConditions, ...attrConditions ];
      const levelToken = nonTextConditions.length ? `${tagWithOrdinal}[${nonTextConditions.join(' and ')}]` : tokens.length ? '' : tagWithOrdinal;
      tokens.unshift(levelToken);
    }
    return uniqueXPathSelector();
  },

  query(root: SelectorRoot, selector: string): Element | undefined {
    const document = root instanceof Document ? root : root.ownerDocument;
    if (!document)
      return;
    const it = document.evaluate(selector, root, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE);
    for (let node = it.iterateNext(); node; node = it.iterateNext()) {
      if (node.nodeType === Node.ELEMENT_NODE)
        return node as Element;
    }
  },

  queryAll(root: SelectorRoot, selector: string): Element[] {
    const result: Element[] = [];
    const document = root instanceof Document ? root : root.ownerDocument;
    if (!document)
      return result;
    const it = document.evaluate(selector, root, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE);
    for (let node = it.iterateNext(); node; node = it.iterateNext()) {
      if (node.nodeType === Node.ELEMENT_NODE)
        result.push(node as Element);
    }
    return result;
  }
};

function createNoText(root: SelectorRoot, targetElement: Element): string {
  const steps = [];
  for (let element: Element | null = targetElement; element && element !== root; element = element.parentElement) {
    if (element.getAttribute('id')) {
      steps.unshift(`//*[@id="${element.getAttribute('id')}"]`);
      return steps.join('/');
    }
    const siblings = element.parentElement ? Array.from(element.parentElement.children) : [];
    const similarElements: Element[] = siblings.filter(sibling => element!.nodeName === sibling.nodeName);
    const index = similarElements.length === 1 ? 0 : similarElements.indexOf(element) + 1;
    steps.unshift(index ? `${element.nodeName}[${index}]` : element.nodeName);
  }

  return '/' + steps.join('/');
}
