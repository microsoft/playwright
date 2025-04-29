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

import { normalizeWhiteSpace } from '@isomorphic/stringUtils';

import { getAriaLabelledByElements } from './roleUtils';

import type { AttributeSelectorPart } from '@isomorphic/selectorParser';

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
  const document = element.ownerDocument;
  return element.nodeName === 'SCRIPT' || element.nodeName === 'NOSCRIPT' || element.nodeName === 'STYLE' || document.head && document.head.contains(element);
}

export type ElementText = { full: string, normalized: string, immediate: string[] };
export type TextMatcher = (text: ElementText) => boolean;

export function elementText(cache: Map<Element | ShadowRoot, ElementText>, root: Element | ShadowRoot): ElementText {
  let value = cache.get(root);
  if (value === undefined) {
    value = { full: '', normalized: '', immediate: [] };
    if (!shouldSkipForTextMatching(root)) {
      let currentImmediate = '';
      if ((root instanceof HTMLInputElement) && (root.type === 'submit' || root.type === 'button')) {
        value = { full: root.value, normalized: normalizeWhiteSpace(root.value), immediate: [root.value] };
      } else {
        for (let child = root.firstChild; child; child = child.nextSibling) {
          if (child.nodeType === Node.TEXT_NODE) {
            value.full += child.nodeValue || '';
            currentImmediate += child.nodeValue || '';
          } else if (child.nodeType === Node.COMMENT_NODE) {
            continue;
          } else {
            if (currentImmediate)
              value.immediate.push(currentImmediate);
            currentImmediate = '';
            if (child.nodeType === Node.ELEMENT_NODE)
              value.full += elementText(cache, child as Element).full;
          }
        }
        if (currentImmediate)
          value.immediate.push(currentImmediate);
        if ((root as Element).shadowRoot)
          value.full += elementText(cache, (root as Element).shadowRoot!).full;
        if (value.full)
          value.normalized = normalizeWhiteSpace(value.full);
      }
    }
    cache.set(root, value);
  }
  return value;
}

export function elementMatchesText(cache: Map<Element | ShadowRoot, ElementText>, element: Element, matcher: TextMatcher): 'none' | 'self' | 'selfAndChildren' {
  if (shouldSkipForTextMatching(element))
    return 'none';
  if (!matcher(elementText(cache, element)))
    return 'none';
  for (let child = element.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === Node.ELEMENT_NODE && matcher(elementText(cache, child as Element)))
      return 'selfAndChildren';
  }
  if (element.shadowRoot && matcher(elementText(cache, element.shadowRoot)))
    return 'selfAndChildren';
  return 'self';
}

export function getElementLabels(textCache: Map<Element | ShadowRoot, ElementText>, element: Element): ElementText[] {
  const labels = getAriaLabelledByElements(element);
  if (labels)
    return labels.map(label => elementText(textCache, label));
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel !== null && !!ariaLabel.trim())
    return [{ full: ariaLabel, normalized: normalizeWhiteSpace(ariaLabel), immediate: [ariaLabel] }];

  // https://html.spec.whatwg.org/multipage/forms.html#category-label
  const isNonHiddenInput = element.nodeName === 'INPUT' && (element as HTMLInputElement).type !== 'hidden';
  if (['BUTTON', 'METER', 'OUTPUT', 'PROGRESS', 'SELECT', 'TEXTAREA'].includes(element.nodeName) || isNonHiddenInput) {
    const labels = (element as HTMLInputElement).labels;
    if (labels)
      return [...labels].map(label => elementText(textCache, label));
  }
  return [];
}
