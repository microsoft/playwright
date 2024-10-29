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

import * as roleUtils from './roleUtils';
import { getElementComputedStyle } from './domUtils';
import type { AriaRole } from './roleUtils';
import { escapeRegExp, longestCommonSubstring } from '@isomorphic/stringUtils';
import { yamlEscapeStringIfNeeded, yamlQuoteFragment } from './yaml';

type AriaProps = {
  checked?: boolean | 'mixed';
  disabled?: boolean;
  expanded?: boolean;
  level?: number;
  pressed?: boolean | 'mixed';
  selected?: boolean;
};

type AriaNode = AriaProps & {
  role: AriaRole | 'fragment';
  name: string;
  children: (AriaNode | string)[];
};

export type AriaTemplateNode = AriaProps & {
  role: AriaRole | 'fragment' | 'text';
  name?: RegExp | string;
  children?: (AriaTemplateNode | string | RegExp)[];
};

export function generateAriaTree(rootElement: Element): AriaNode {
  const visit = (ariaNode: AriaNode, node: Node) => {
    if (node.nodeType === Node.TEXT_NODE && node.nodeValue) {
      const text = node.nodeValue;
      if (text)
        ariaNode.children.push(node.nodeValue || '');
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE)
      return;

    const element = node as Element;
    if (roleUtils.isElementHiddenForAria(element))
      return;

    const childAriaNode = toAriaNode(element);
    if (childAriaNode)
      ariaNode.children.push(childAriaNode);
    processChildNodes(childAriaNode || ariaNode, element);
  };

  function processChildNodes(ariaNode: AriaNode, element: Element) {
    // Surround every element with spaces for the sake of concatenated text nodes.
    const display = getElementComputedStyle(element)?.display || 'inline';
    const treatAsBlock = (display !== 'inline' || element.nodeName === 'BR') ? ' ' : '';
    if (treatAsBlock)
      ariaNode.children.push(treatAsBlock);

    ariaNode.children.push(roleUtils.getPseudoContent(element, '::before'));
    const assignedNodes = element.nodeName === 'SLOT' ? (element as HTMLSlotElement).assignedNodes() : [];
    if (assignedNodes.length) {
      for (const child of assignedNodes)
        visit(ariaNode, child);
    } else {
      for (let child = element.firstChild; child; child = child.nextSibling) {
        if (!(child as Element | Text).assignedSlot)
          visit(ariaNode, child);
      }
      if (element.shadowRoot) {
        for (let child = element.shadowRoot.firstChild; child; child = child.nextSibling)
          visit(ariaNode, child);
      }
    }

    ariaNode.children.push(roleUtils.getPseudoContent(element, '::after'));

    if (treatAsBlock)
      ariaNode.children.push(treatAsBlock);

    if (ariaNode.children.length === 1 && ariaNode.name === ariaNode.children[0])
      ariaNode.children = [];
  }

  roleUtils.beginAriaCaches();
  const ariaRoot: AriaNode = { role: 'fragment', name: '', children: [] };
  try {
    visit(ariaRoot, rootElement);
  } finally {
    roleUtils.endAriaCaches();
  }

  normalizeStringChildren(ariaRoot);
  return ariaRoot;
}

function toAriaNode(element: Element): AriaNode | null {
  const role = roleUtils.getAriaRole(element);
  if (!role || role === 'presentation' || role === 'none')
    return null;

  const name = roleUtils.getElementAccessibleName(element, false) || '';
  const result: AriaNode = { role, name, children: [] };

  if (roleUtils.kAriaCheckedRoles.includes(role))
    result.checked = roleUtils.getAriaChecked(element);

  if (roleUtils.kAriaDisabledRoles.includes(role))
    result.disabled = roleUtils.getAriaDisabled(element);

  if (roleUtils.kAriaExpandedRoles.includes(role))
    result.expanded = roleUtils.getAriaExpanded(element);

  if (roleUtils.kAriaLevelRoles.includes(role))
    result.level = roleUtils.getAriaLevel(element);

  if (roleUtils.kAriaPressedRoles.includes(role))
    result.pressed = roleUtils.getAriaPressed(element);

  if (roleUtils.kAriaSelectedRoles.includes(role))
    result.selected = roleUtils.getAriaSelected(element);

  return result;
}

export function renderedAriaTree(rootElement: Element): string {
  return renderAriaTree(generateAriaTree(rootElement));
}

function normalizeStringChildren(rootA11yNode: AriaNode) {
  const flushChildren = (buffer: string[], normalizedChildren: (AriaNode | string)[]) => {
    if (!buffer.length)
      return;
    const text = normalizeWhitespaceWithin(buffer.join('')).trim();
    if (text)
      normalizedChildren.push(text);
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
    ariaNode.children = normalizedChildren.length ? normalizedChildren : [];
    if (ariaNode.children.length === 1 && ariaNode.children[0] === ariaNode.name)
      ariaNode.children = [];
  };
  visit(rootA11yNode);
}

const normalizeWhitespaceWithin = (text: string) => text.replace(/[\u200b\s\t\r\n]+/g, ' ');

function matchesText(text: string | undefined, template: RegExp | string | undefined) {
  if (!template)
    return true;
  if (!text)
    return false;
  if (typeof template === 'string')
    return text === template;
  return !!text.match(template);
}

export function matchesAriaTree(rootElement: Element, template: AriaTemplateNode): { matches: boolean, received: { raw: string, regex: string } } {
  const root = generateAriaTree(rootElement);
  const matches = matchesNodeDeep(root, template);
  return {
    matches,
    received: {
      raw: renderAriaTree(root),
      regex: renderAriaTree(root, {
        includeText,
        renderString: convertToBestGuessRegex
      }),
    }
  };
}

function matchesNode(node: AriaNode | string, template: AriaTemplateNode | RegExp | string, depth: number): boolean {
  if (typeof node === 'string' && (typeof template === 'string' || template instanceof RegExp))
    return matchesText(node, template);

  if (typeof node === 'object' && typeof template === 'object' && !(template instanceof RegExp)) {
    if (template.role !== 'fragment' && template.role !== node.role)
      return false;
    if (template.checked !== undefined && template.checked !== node.checked)
      return false;
    if (template.disabled !== undefined && template.disabled !== node.disabled)
      return false;
    if (template.expanded !== undefined && template.expanded !== node.expanded)
      return false;
    if (template.level !== undefined && template.level !== node.level)
      return false;
    if (template.pressed !== undefined && template.pressed !== node.pressed)
      return false;
    if (template.selected !== undefined && template.selected !== node.selected)
      return false;
    if (!matchesText(node.name, template.name))
      return false;
    if (!containsList(node.children || [], template.children || [], depth))
      return false;
    return true;
  }
  return false;
}

function containsList(children: (AriaNode | string)[], template: (AriaTemplateNode | RegExp | string)[], depth: number): boolean {
  if (template.length > children.length)
    return false;
  const cc = children.slice();
  const tt = template.slice();
  for (const t of tt) {
    let c = cc.shift();
    while (c) {
      if (matchesNode(c, t, depth + 1))
        break;
      c = cc.shift();
    }
    if (!c)
      return false;
  }
  return true;
}

function matchesNodeDeep(root: AriaNode, template: AriaTemplateNode): boolean {
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

type RenderAriaTreeOptions = {
  includeText?: (node: AriaNode, text: string) => boolean;
  renderString?: (text: string) => string | null;
};

export function renderAriaTree(ariaNode: AriaNode, options?: RenderAriaTreeOptions): string {
  const lines: string[] = [];
  const includeText = options?.includeText || (() => true);
  const renderString = options?.renderString || (str => str);
  const visit = (ariaNode: AriaNode | string, parentAriaNode: AriaNode | null, indent: string) => {
    if (typeof ariaNode === 'string') {
      if (parentAriaNode && !includeText(parentAriaNode, ariaNode))
        return;
      const text = renderString(ariaNode);
      if (text)
        lines.push(indent + '- text: ' + text);
      return;
    }

    let key = ariaNode.role;
    if (ariaNode.name) {
      const name = renderString(ariaNode.name);
      if (name)
        key += ' ' + yamlQuoteFragment(name);
    }
    if (ariaNode.checked === 'mixed')
      key += ` [checked=mixed]`;
    if (ariaNode.checked === true)
      key += ` [checked]`;
    if (ariaNode.disabled)
      key += ` [disabled]`;
    if (ariaNode.expanded)
      key += ` [expanded]`;
    if (ariaNode.level)
      key += ` [level=${ariaNode.level}]`;
    if (ariaNode.pressed === 'mixed')
      key += ` [pressed=mixed]`;
    if (ariaNode.pressed === true)
      key += ` [pressed]`;
    if (ariaNode.selected === true)
      key += ` [selected]`;

    const escapedKey = indent + '- ' + yamlEscapeStringIfNeeded(key, '\'');
    if (!ariaNode.children.length) {
      lines.push(escapedKey);
    } else if (ariaNode.children.length === 1 && typeof ariaNode.children[0] === 'string') {
      const text = includeText(ariaNode, ariaNode.children[0]) ? renderString(ariaNode.children[0] as string) : null;
      if (text)
        lines.push(escapedKey + ': ' + yamlEscapeStringIfNeeded(text, '"'));
      else
        lines.push(escapedKey);
    } else {
      lines.push(escapedKey + ':');
      for (const child of ariaNode.children || [])
        visit(child, ariaNode, indent + '  ');
    }
  };

  if (ariaNode.role === 'fragment') {
    // Render fragment.
    for (const child of ariaNode.children || [])
      visit(child, ariaNode, '');
  } else {
    visit(ariaNode, null, '');
  }
  return lines.join('\n');
}

function convertToBestGuessRegex(text: string): string {
  const dynamicContent = [
    // Do not replace single digits with regex by default.
    // 2+ digits: [Issue 22, 22.3, 2.33, 2,333]
    { regex: /\b\d{2,}\b/g, replacement: '\\d+' },
    { regex: /\b\{2,}\.\d+\b/g, replacement: '\\d+\\.\\d+' },
    { regex: /\b\d+\.\d{2,}\b/g, replacement: '\\d+\\.\\d+' },
    { regex: /\b\d+,\d+\b/g, replacement: '\\d+,\\d+' },
    // 2ms, 20s
    { regex: /\b\d+[hms]+\b/g, replacement: '\\d+[hms]+' },
    { regex: /\b[\d,.]+[hms]+\b/g, replacement: '[\\d,.]+[hms]+' },
  ];

  let result = escapeRegExp(text);
  let hasDynamicContent = false;

  for (const { regex, replacement } of dynamicContent) {
    if (regex.test(result)) {
      result = result.replace(regex, replacement);
      hasDynamicContent = true;
    }
  }

  return hasDynamicContent ? String(new RegExp(result)) : text;
}

function includeText(node: AriaNode, text: string): boolean {
  if (!text.length)
    return false;

  if (!node.name)
    return true;

  // Figure out if text adds any value.
  const substr = longestCommonSubstring(text, node.name);
  let filtered = text;
  while (substr && filtered.includes(substr))
    filtered = filtered.replace(substr, '');
  return filtered.trim().length / text.length > 0.1;
}
