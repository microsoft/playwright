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

import { type AttributeSelectorPart } from '../isomorphic/selectorParser';
import { flatTreeChildElements, flatTreeChildNodes } from './domUtils';

export function matchesComponentAttribute(obj: any, attr: AttributeSelectorPart) {
  for (const token of attr.jsonPath) {
    if (obj !== undefined && obj !== null)
      obj = obj[token];
  }
  return matchesAttributePart(obj, attr);
}

export function matchesAttributePart(value: any, attr: AttributeSelectorPart) {
  const objValue = typeof value === 'string' && !attr.caseSensitive ? value.toUpperCase() : value;
  const attrValue = typeof attr.value === 'string' && !attr.caseSensitive ? attr.value.toUpperCase() : attr.value;

  if (attr.op === '<truthy>')
    return !!objValue;
  if (attr.op === '=') {
    if (attrValue instanceof RegExp)
      return typeof objValue === 'string' && !!objValue.match(attrValue);
    return objValue === attrValue;
  }
  if (typeof objValue !== 'string' || typeof attrValue !== 'string')
    return false;
  if (attr.op === '*=')
    return objValue.includes(attrValue);
  if (attr.op === '^=')
    return objValue.startsWith(attrValue);
  if (attr.op === '$=')
    return objValue.endsWith(attrValue);
  if (attr.op === '|=')
    return objValue === attrValue || objValue.startsWith(attrValue + '-');
  if (attr.op === '~=')
    return objValue.split(' ').includes(attrValue);
  return false;
}

export function shouldSkipForTextMatching(element: Element | ShadowRoot) {
  return element.nodeName === 'SCRIPT' || element.nodeName === 'NOSCRIPT' || element.nodeName === 'STYLE' || document.head && document.head.contains(element);
}

export type ElementText = { full: string, immediate: string[] };
export type TextMatcher = (text: ElementText) => boolean;

export function elementText(cache: Map<Element, ElementText>, root: Element, shadowDomMode: 'flat' | 'shadowy'): ElementText {
  let value = cache.get(root);
  if (value === undefined) {
    value = { full: '', immediate: [] };
    if (!shouldSkipForTextMatching(root)) {
      let currentImmediate = '';
      if ((root instanceof HTMLInputElement) && (root.type === 'submit' || root.type === 'button')) {
        value = { full: root.value, immediate: [root.value] };
      } else {
        const children = shadowDomMode === 'flat' ? flatTreeChildNodes(root) : [...root.childNodes];
        for (const child of children) {
          if (child.nodeType === Node.TEXT_NODE) {
            value.full += child.nodeValue || '';
            currentImmediate += child.nodeValue || '';
          } else {
            if (currentImmediate)
              value.immediate.push(currentImmediate);
            currentImmediate = '';
            if (child.nodeType === Node.ELEMENT_NODE)
              value.full += elementText(cache, child as Element, shadowDomMode).full;
          }
        }
        if (currentImmediate)
          value.immediate.push(currentImmediate);
      }
    }
    cache.set(root, value);
  }
  return value;
}

export function elementMatchesText(cache: Map<Element, ElementText>, element: Element, matcher: TextMatcher, shadowDomMode: 'flat' | 'shadowy'): 'none' | 'self' | 'selfAndChildren' {
  if (shouldSkipForTextMatching(element))
    return 'none';
  if (!matcher(elementText(cache, element, shadowDomMode)))
    return 'none';
  const children = shadowDomMode === 'flat' ?
    flatTreeChildElements(element) :
    [...element.childNodes].filter(node => node.nodeType === 1 /* Node.ELEMENT_NODE */) as Element[];
  for (const child of children) {
    if (matcher(elementText(cache, child, shadowDomMode)))
      return 'selfAndChildren';
  }
  return 'self';
}
