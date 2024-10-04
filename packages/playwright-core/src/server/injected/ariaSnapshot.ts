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

type AriaNode = {
  role: string;
  name?: string;
  children?: (AriaNode | string)[];
};

export type AriaTemplateString = {
  kind: 'string';
  chunks: (RegExp | string)[];
};

export type AriaTemplateNode = {
  kind: 'node';
  role: string;
  name?: string;
  children?: (AriaTemplateNode | AriaTemplateString)[];
};

export function generateAriaTree(injectedScript: InjectedScript, rootElement?: Element): AriaNode {
  const toAriaNode = (element: Element): { ariaNode: AriaNode, isLeaf: boolean } | null => {
    const role = injectedScript.utils.getAriaRole(element);
    if (!role)
      return null;

    const name = role ? injectedScript.utils.getElementAccessibleName(element, false) || undefined : undefined;
    const isLeaf = leafRoles.has(role);
    const result: AriaNode = { role };

    if (isLeaf)
      result.children = [name || element.textContent || ''];
    else
      result.name = name;
    return { isLeaf, ariaNode: result };
  };

  const visit = (ariaNode: AriaNode, node: Node) => {
    if (node.nodeType === Node.TEXT_NODE && node.nodeValue) {
      ariaNode.children = ariaNode.children || [];
      ariaNode.children.push(node.nodeValue);
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE)
      return;

    const element = node as Element;
    if (element.nodeName === 'SCRIPT' || element.nodeName === 'STYLE' || element.nodeName === 'NOSCRIPT')
      return;

    const isElementVisible = injectedScript.utils.isElementVisible(element);
    const hasVisibleChildren = element.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true });

    if (!hasVisibleChildren)
      return;

    if (isElementVisible) {
      const childAriaNode = toAriaNode(element);
      if (childAriaNode) {
        ariaNode.children = ariaNode.children || [];
        ariaNode.children.push(childAriaNode.ariaNode);
      }
      if (!childAriaNode?.isLeaf) {
        for (let child = element.firstChild; child; child = child.nextSibling)
          visit(childAriaNode?.ariaNode || ariaNode, child);
      }
    } else {
      for (let child = element.firstChild; child; child = child.nextSibling)
        visit(ariaNode, child);
    }
  };

  injectedScript.utils.beginAriaCaches();
  rootElement = rootElement || injectedScript.document.body;
  const result = toAriaNode(rootElement);
  const ariaRoot = result?.ariaNode || { role: '' };
  try {
    visit(ariaRoot, rootElement);
  } finally {
    injectedScript.utils.endAriaCaches();
  }

  normalizeStringChildren(ariaRoot);
  return ariaRoot;
}

export function renderedAriaTree(injectedScript: InjectedScript, rootElement?: Element): string {
  return renderAriaTree(injectedScript, generateAriaTree(injectedScript, rootElement));
}

function normalizeStringChildren(rootA11yNode: AriaNode) {
  const flushChildren = (buffer: string[], normalizedChildren: (AriaNode | string)[]) => {
    if (!buffer.length)
      return;
    const text = normalizeWhitespace(buffer.join(''));
    if (text.trim())
      normalizedChildren.push(text.trim());
    buffer.length = 0;
  };

  const visit = (ariaNode: AriaNode) => {
    const normalizedChildren: (AriaNode | string)[] = [];
    const buffer: string[] = [];
    for (const child of ariaNode.children || []) {
      if (typeof child === 'string') {
        buffer.push(child);
      } else {
        flushChildren(buffer, normalizedChildren);
        visit(child);
        normalizedChildren.push(child);
      }
    }
    flushChildren(buffer, normalizedChildren);
    ariaNode.children = normalizedChildren.length ? normalizedChildren : undefined;
  };
  visit(rootA11yNode);
}

const leafRoles = new Set([
  'alert', 'blockquote', 'button', 'caption', 'checkbox', 'code', 'columnheader',
  'definition', 'deletion', 'emphasis', 'generic', 'heading', 'img', 'insertion',
  'link', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'meter', 'none', 'option',
  'presentation', 'progressbar', 'radio', 'rowheader', 'scrollbar', 'searchbox', 'separator',
  'slider', 'spinbutton', 'strong', 'subscript', 'superscript', 'switch', 'tab', 'term',
  'textbox', 'time', 'tooltip'
]);

const normalizeWhitespace = (text: string) => text.replace(/[\s\n]+/g, ' ');

function escapeRegex(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function matchesAriaTree(injectedScript: InjectedScript, rootElement: Element, template: AriaTemplateNode): { matches: boolean, received: string } {
  const root = generateAriaTree(injectedScript, rootElement);
  const matches = nodeMatches(root, template);
  return { matches, received: renderAriaTree(injectedScript, root) };
}

function matchesNode(node: AriaNode | string, template: AriaTemplateNode | AriaTemplateString, depth: number): boolean {
  if (typeof node === 'string' && template.kind === 'string') {
    const pattern = template.chunks.map(s => typeof s === 'string' ? escapeRegex(normalizeWhitespace(s)) : s.source);
    return !!node.match(new RegExp(pattern.join('')));
  }

  if (typeof node === 'object' && template.kind === 'node') {
    if (template.role && template.role !== node.role)
      return false;
    if (template.role && template.name !== node.name)
      return false;
    if (!containsList(node.children || [], template.children || [], depth))
      return false;
    return true;
  }
  return false;
}

function containsList(children: (AriaNode | string)[], template: (AriaTemplateNode | AriaTemplateString)[], depth: number): boolean {
  if (template.length > children.length)
    return false;
  const cc = children.slice();
  const tt = template.slice();
  for (let t = tt.shift(); t; t = tt.shift()) {
    let c = cc.shift();
    while (c) {
      if (matchesNode(c, t, depth + 1))
        break;
      c = cc.shift();
    }
    if (!c)
      return false;
  }
  return !tt.length;
}

function nodeMatches(root: AriaNode, template: AriaTemplateNode): boolean {
  const results: (AriaNode | string)[] = [];
  const visit = (node: AriaNode | string): boolean => {
    if (matchesNode(node, template, 0)) {
      results.push(node);
      return true;
    }
    if (typeof node === 'string')
      return false;
    for (const child of node.children || []) {
      if (visit(child))
        return true;
    }
    return false;
  };
  visit(root);
  return !!results.length;
}

export function renderAriaTree(injectedScript: InjectedScript, ariaNode: AriaNode): string {
  const lines: string[] = [];
  const visit = (ariaNode: AriaNode, indent: string) => {
    let line = `${indent}<x.${ariaNode.role}`;
    if (ariaNode.name)
      line += ` name="${injectedScript.utils.escapeHTMLAttribute(ariaNode.name)}"`;
    line += '>';

    const noChild = !ariaNode.name && !ariaNode.children?.length;
    const oneChild = !ariaNode.name && ariaNode.children?.length === 1 && typeof ariaNode.children[0] === 'string';
    if (noChild || oneChild) {
      if (oneChild)
        line += injectedScript.utils.escapeHTML(ariaNode.children?.[0] as string);
      line += `</x.${ariaNode.role}>`;
      lines.push(line);
      return;
    }
    lines.push(line);
    for (const child of ariaNode.children || []) {
      if (typeof child === 'string')
        lines.push(indent + '  ' + injectedScript.utils.escapeHTML(child));
      else
        visit(child, indent + '  ');
    }
    lines.push(`${indent}</x.${ariaNode.role}>`);
  };
  visit(ariaNode, '');
  return lines.join('\n');
}
