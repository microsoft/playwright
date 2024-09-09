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

import type { InjectedScript } from './injectedScript';

const leafRoles = new Set([
  'button',
  'checkbox',
  'combobox',
  'link',
  'textbox',
]);

export type SimpleDom = {
  markup: string;
  elements: Map<string, Element>;
};

export type SimpleDomNode = {
  dom: SimpleDom;
  id: string;
  tag: string;
};

let lastDom: SimpleDom | undefined;

export function generateSimpleDom(injectedScript: InjectedScript): SimpleDom {
  return generate(injectedScript).dom;
}

export function generateSimpleDomNode(injectedScript: InjectedScript, target: Element): SimpleDomNode {
  return generate(injectedScript, target).node!;
}

export function selectorForSimpleDomNodeId(injectedScript: InjectedScript, id: string): string {
  const element = lastDom?.elements.get(id);
  if (!element)
    throw new Error(`Internal error: element with id "${id}" not found`);
  return injectedScript.generateSelectorSimple(element);
}

function generate(injectedScript: InjectedScript, target?: Element): { dom: SimpleDom, node?: SimpleDomNode } {
  const normalizeWhitespace = (text: string) => text.replace(/[\s\n]+/g, match => match.includes('\n') ? '\n' : ' ');
  const tokens: string[] = [];
  const elements = new Map<string, Element>();
  let lastId = 0;
  let resultTarget: { tag: string, id: string } | undefined;
  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      tokens.push(node.nodeValue!);
      return;
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element;
      if (element.nodeName === 'SCRIPT' || element.nodeName === 'STYLE' || element.nodeName === 'NOSCRIPT')
        return;
      if (injectedScript.utils.isElementVisible(element)) {
        const role = injectedScript.utils.getAriaRole(element) as string;
        if (role && leafRoles.has(role)) {
          let value: string | undefined;
          if (element.nodeName === 'INPUT' || element.nodeName === 'TEXTAREA')
            value = (element as HTMLInputElement | HTMLTextAreaElement).value;
          const name = injectedScript.utils.getElementAccessibleName(element, false);
          const structuralId = String(++lastId);
          elements.set(structuralId, element);
          tokens.push(renderTag(injectedScript, role, name, structuralId, { value }));
          if (element === target) {
            const tagNoValue = renderTag(injectedScript, role, name, structuralId);
            resultTarget = { tag: tagNoValue, id: structuralId };
          }
          return;
        }
      }
      for (let child = element.firstChild; child; child = child.nextSibling)
        visit(child);
    }
  };
  injectedScript.utils.beginAriaCaches();
  try {
    visit(injectedScript.document.body);
  } finally {
    injectedScript.utils.endAriaCaches();
  }
  const dom = {
    markup: normalizeWhitespace(tokens.join(' ')),
    elements
  };

  if (target && !resultTarget)
    throw new Error('Target element is not in the simple DOM');

  lastDom = dom;

  return { dom, node: resultTarget ? { dom, ...resultTarget } : undefined };
}

function renderTag(injectedScript: InjectedScript, role: string, name: string, id: string, params?: { value?: string }): string {
  const escapedTextContent = injectedScript.utils.escapeHTML(name);
  const escapedValue = injectedScript.utils.escapeHTMLAttribute(params?.value || '');
  switch (role) {
    case 'button': return `<button id="${id}">${escapedTextContent}</button>`;
    case 'link': return `<a id="${id}">${escapedTextContent}</a>`;
    case 'textbox': return `<input id="${id}" title="${escapedTextContent}" value="${escapedValue}"></input>`;
  }
  return `<div role=${role} id="${id}">${escapedTextContent}</div>`;
}
