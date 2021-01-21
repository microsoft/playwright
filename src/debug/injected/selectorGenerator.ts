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

import type InjectedScript from '../../server/injected/injectedScript';

export function generateSelector(injectedScript: InjectedScript, targetElement: Element): { selector: string, elements: Element[] } {
  const path: SelectorToken[] = [];
  let numberOfMatchingElements = Number.MAX_SAFE_INTEGER;
  for (let element: Element | null = targetElement; element && element !== document.documentElement; element = parentElementOrShadowHost(element)) {
    const selector = buildSelectorCandidate(element);
    if (!selector)
      continue;
    const fullSelector = joinSelector([selector, ...path]);
    const parsedSelector = injectedScript.parseSelector(fullSelector);
    const selectorTargets = injectedScript.querySelectorAll(parsedSelector, targetElement.ownerDocument);
    if (!selectorTargets.length)
      break;
    if (selectorTargets[0] === targetElement)
      return { selector: fullSelector, elements: selectorTargets };
    if (selectorTargets.length && numberOfMatchingElements > selectorTargets.length) {
      numberOfMatchingElements = selectorTargets.length;
      path.unshift(selector);
    }
  }
  if (document.documentElement === targetElement) {
    return {
      selector: '/html',
      elements: [document.documentElement]
    };
  }
  const selector =
      createXPath(document.documentElement, targetElement) ||
      cssSelectorForElement(injectedScript, targetElement);
  const parsedSelector = injectedScript.parseSelector(selector);
  return {
    selector,
    elements: injectedScript.querySelectorAll(parsedSelector, targetElement.ownerDocument)
  };
}

function buildSelectorCandidate(element: Element): SelectorToken | null {
  const nodeName = element.nodeName.toLowerCase();
  for (const attribute of ['data-testid', 'data-test-id', 'data-test']) {
    if (element.hasAttribute(attribute))
      return { engine: 'css', selector: `${nodeName}[${attribute}=${quoteString(element.getAttribute(attribute)!)}]` };
  }
  for (const attribute of ['aria-label', 'role']) {
    if (element.hasAttribute(attribute))
      return { engine: 'css', selector: `${element.nodeName.toLocaleLowerCase()}[${attribute}=${quoteString(element.getAttribute(attribute)!)}]` };
  }
  if (['INPUT', 'TEXTAREA'].includes(element.nodeName)) {
    const nodeNameLowercase = element.nodeName.toLowerCase();
    if (element.getAttribute('name'))
      return { engine: 'css', selector: `${nodeNameLowercase}[name=${quoteString(element.getAttribute('name')!)}]` };
    if (element.getAttribute('placeholder'))
      return { engine: 'css', selector: `${nodeNameLowercase}[placeholder=${quoteString(element.getAttribute('placeholder')!)}]` };
    if (element.getAttribute('type'))
      return { engine: 'css', selector: `${nodeNameLowercase}[type=${quoteString(element.getAttribute('type')!)}]` };
  } else if (element.nodeName === 'IMG') {
    if (element.getAttribute('alt'))
      return { engine: 'css', selector: `img[alt=${quoteString(element.getAttribute('alt')!)}]` };
  }
  const textSelector = textSelectorForElement(element);
  if (textSelector)
    return { engine: 'text', selector: textSelector };

  // De-prioritize id, but still use it as a last resort.
  const idAttr = element.getAttribute('id');
  if (idAttr && !isGuidLike(idAttr))
    return { engine: 'css', selector: `${nodeName}[id=${quoteString(idAttr!)}]` };

  return null;
}

function parentElementOrShadowHost(element: Element): Element | null {
  if (element.parentElement)
    return element.parentElement;
  if (!element.parentNode)
    return null;
  if (element.parentNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE && (element.parentNode as ShadowRoot).host)
    return (element.parentNode as ShadowRoot).host;
  return null;
}

function cssSelectorForElement(injectedScript: InjectedScript, targetElement: Element): string {
  const root: Node = targetElement.ownerDocument;
  const tokens: string[] = [];

  function uniqueCSSSelector(prefix?: string): string | undefined {
    const path = tokens.slice();
    if (prefix)
      path.unshift(prefix);
    const selector = path.join(' ');
    const parsedSelector = injectedScript.parseSelector(selector);
    const node = injectedScript.querySelector(parsedSelector, targetElement.ownerDocument);
    return node === targetElement ? selector : undefined;
  }

  for (let element: Element | null = targetElement; element && element !== root; element = parentElementOrShadowHost(element)) {
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

    const parent = element.parentNode as (Element | ShadowRoot);

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
      const token = sameTagSiblings.indexOf(element) === 0 ? nodeName : `${nodeName}:nth-child(${1 + siblings.indexOf(element)})`;
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
  return uniqueCSSSelector()!;
}

function textSelectorForElement(node: Node): string | null {
  const maxLength = 30;
  let needsRegex = false;
  let trimmedText: string | null = null;
  for (const child of node.childNodes) {
    if (child.nodeType !== Node.TEXT_NODE)
      continue;
    if (child.textContent && child.textContent.trim()) {
      if (trimmedText)
        return null;
      trimmedText = child.textContent.trim().substr(0, maxLength);
      needsRegex = child.textContent !== trimmedText;
    } else {
      needsRegex = true;
    }
  }
  if (!trimmedText)
    return null;
  return needsRegex ? `/.*${escapeForRegex(trimmedText)}.*/` : `"${trimmedText}"`;
}

function escapeForRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function quoteString(text: string): string {
  return `"${text.replaceAll(/"/g, '\\"')}"`;
}

type SelectorToken = {
  engine: string;
  selector: string;
};

function joinSelector(path: SelectorToken[]): string {
  const tokens = [];
  let lastEngine = '';
  for (const { engine, selector } of path) {
    if (tokens.length  && (lastEngine !== 'css' || engine !== 'css'))
      tokens.push('>>');
    lastEngine = engine;
    if (engine === 'css')
      tokens.push(selector);
    else
      tokens.push(`${engine}=${selector}`);
  }
  return tokens.join(' ');
}

function isGuidLike(id: string): boolean {
  let lastCharacterType: 'lower' | 'upper' | 'digit' | 'other' | undefined;
  let transitionCount = 0;
  for (let i = 0; i < id.length; ++i) {
    const c = id[i];
    let characterType: 'lower' | 'upper' | 'digit' | 'other';
    if (c === '-' || c === '_')
      continue;
    if (c >= 'a' && c <= 'z')
      characterType = 'lower';
    else  if (c >= 'A' && c <= 'Z')
      characterType = 'upper';
    else if (c >= '0' && c <= '9')
      characterType = 'digit';
    else
      characterType = 'other';

    if (characterType === 'lower' && lastCharacterType === 'upper') {
      lastCharacterType = characterType;
      continue;
    }

    if (lastCharacterType && lastCharacterType !== characterType)
      ++transitionCount;
    lastCharacterType = characterType;
  }
  return transitionCount >= id.length / 4;
}

function createXPath(root: Node, targetElement: Element): string | undefined {
  const maxTextLength = 80;
  const minMeaningfulSelectorLegth = 100;

  const maybeDocument = root instanceof Document ? root : root.ownerDocument;
  if (!maybeDocument)
    return;
  const document = maybeDocument;

  const xpathCache = new Map<string, Element[]>();
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
    if (nodes[0] === targetElement)
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
    [ 'input', [ 'placeholder', 'type', 'name' ] ],
    [ 'textarea', [ 'placeholder', 'type', 'name' ] ],
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

    const parent = element.parentElement;
    let ordinal = -1;
    if (parent) {
      const siblings = Array.from(parent.children);
      const sameTagSiblings = siblings.filter(sibling => (sibling).nodeName.toLowerCase() === nodeName);
      if (sameTagSiblings.length > 1)
        ordinal = sameTagSiblings.indexOf(element);
    }

    // Do not include text into this token, only tag / attributes.
    // Topmost node will get all the text.
    const conditionsString = conditions.length ? `[${conditions.join(' and ')}]` : '';
    const ordinalString = ordinal >= 0 ? `[${ordinal + 1}]` : '';
    tokens.unshift(`${tag}${ordinalString}${conditionsString}`);
  }
  return uniqueXPathSelector();
}
