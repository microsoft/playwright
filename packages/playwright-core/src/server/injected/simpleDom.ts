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

import { escapeHTMLAttribute, escapeHTML } from '@isomorphic/stringUtils';
import { beginAriaCaches, endAriaCaches, getAriaRole, getElementAccessibleName } from './roleUtils';
import { isElementVisible } from './domUtils';

const leafRoles = new Set([
  'button',
  'checkbox',
  'combobox',
  'link',
  'textbox',
]);

export function simpleDom(document: Document): { markup: string, elements: Map<string, Element> } {
  const normalizeWhitespace = (text: string) => text.replace(/[\s\n]+/g, match => match.includes('\n') ? '\n' : ' ');
  const tokens: string[] = [];
  const idMap = new Map<string, Element>();
  let lastId = 0;
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      tokens.push(node.nodeValue!);
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      if (element.nodeName === 'SCRIPT' || element.nodeName === 'STYLE' || element.nodeName === 'NOSCRIPT')
        return;
      if (isElementVisible(element)) {
        const role = getAriaRole(element) as string;
        if (role && leafRoles.has(role)) {
          let value: string | undefined;
          if (element.nodeName === 'INPUT' || element.nodeName === 'TEXTAREA')
            value = (element as HTMLInputElement | HTMLTextAreaElement).value;
          const name = getElementAccessibleName(element, false);
          const structuralId = String(++lastId);
          idMap.set(structuralId, element);
          tokens.push(renderTag(role, name, structuralId, { value }));
          return;
        }
      }
      for (let child = element.firstChild; child; child = child.nextSibling)
        visit(child);
    }
  };
  beginAriaCaches();
  try {
    visit(document.body);
  } finally {
    endAriaCaches();
  }
  return {
    markup: normalizeWhitespace(tokens.join(' ')),
    elements: idMap
  };
}

function renderTag(role: string, name: string, id: string, params?: { value?: string }): string {
  const escapedTextContent = escapeHTML(name);
  const escapedValue = escapeHTMLAttribute(params?.value || '');
  switch (role) {
    case 'button': return `<button id="${id}">${escapedTextContent}</button>`;
    case 'link': return `<a id="${id}">${escapedTextContent}</a>`;
    case 'textbox': return `<input id="${id}" title="${escapedTextContent}" value="${escapedValue}"></input>`;
  }
  return `<div role=${role} id="${id}">${escapedTextContent}</div>`;
}
