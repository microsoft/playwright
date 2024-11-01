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
import { yamlEscapeKeyIfNeeded, yamlEscapeValueIfNeeded, yamlQuoteFragment } from './yaml';

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

export type AriaTemplateTextNode = {
  kind: 'text';
  text: RegExp | string;
};

export type AriaTemplateRoleNode = AriaProps & {
  kind: 'role';
  role: AriaRole | 'fragment';
  name?: RegExp | string;
  children?: AriaTemplateNode[];
};

export type AriaTemplateNode = AriaTemplateRoleNode | AriaTemplateTextNode;

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

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)
    result.children = [element.value];

  return result;
}

export function renderedAriaTree(rootElement: Element, options?: { mode?: 'raw' | 'regex' }): string {
  return renderAriaTree(generateAriaTree(rootElement), options);
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

function matchesText(text: string, template: RegExp | string | undefined): boolean {
  if (!template)
    return true;
  if (!text)
    return false;
  if (typeof template === 'string')
    return text === template;
  return !!text.match(template);
}

function matchesTextNode(text: string, template: AriaTemplateTextNode) {
  return matchesText(text, template.text);
}

function matchesName(text: string, template: AriaTemplateRoleNode) {
  return matchesText(text, template.name);
}

export type MatcherReceived = {
  raw: string;
  regex: string;
};

export function matchesAriaTree(rootElement: Element, template: AriaTemplateNode): { matches: boolean, received: MatcherReceived } {
  const root = generateAriaTree(rootElement);
  const matches = matchesNodeDeep(root, template);
  return {
    matches,
    received: {
      raw: renderAriaTree(root, { mode: 'raw' }),
      regex: renderAriaTree(root, { mode: 'regex' }),
    }
  };
}

function matchesNode(node: AriaNode | string, template: AriaTemplateNode, depth: number): boolean {
  if (typeof node === 'string' && template.kind === 'text')
    return matchesTextNode(node, template);

  if (typeof node === 'object' && template.kind === 'role') {
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
    if (!matchesName(node.name, template))
      return false;
    if (!containsList(node.children || [], template.children || [], depth))
      return false;
    return true;
  }
  return false;
}

function containsList(children: (AriaNode | string)[], template: AriaTemplateNode[], depth: number): boolean {
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

export function renderAriaTree(ariaNode: AriaNode, options?: { mode?: 'raw' | 'regex' }): string {
  const lines: string[] = [];
  const includeText = options?.mode === 'regex' ? textContributesInfo : () => true;
  const renderString = options?.mode === 'regex' ? convertToBestGuessRegex : (str: string) => str;
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
        key += ' ' + (name.startsWith('/') && name.endsWith('/') ? name : yamlQuoteFragment(name));
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

    const escapedKey = indent + '- ' + yamlEscapeKeyIfNeeded(key);
    if (!ariaNode.children.length) {
      lines.push(escapedKey);
    } else if (ariaNode.children.length === 1 && typeof ariaNode.children[0] === 'string') {
      const text = includeText(ariaNode, ariaNode.children[0]) ? renderString(ariaNode.children[0] as string) : null;
      if (text)
        lines.push(escapedKey + ': ' + yamlEscapeValueIfNeeded(text));
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
    // 2mb
    { regex: /\b[\d,.]+[bkmBKM]+\b/, replacement: '[\\d,.]+[bkmBKM]+' },
    // 2ms, 20s
    { regex: /\b\d+[hmsp]+\b/, replacement: '\\d+[hmsp]+' },
    { regex: /\b[\d,.]+[hmsp]+\b/, replacement: '[\\d,.]+[hmsp]+' },
    // Do not replace single digits with regex by default.
    // 2+ digits: [Issue 22, 22.3, 2.33, 2,333]
    { regex: /\b\d+,\d+\b/, replacement: '\\d+,\\d+' },
    { regex: /\b\d+\.\d{2,}\b/, replacement: '\\d+\\.\\d+' },
    { regex: /\b\d{2,}\.\d+\b/, replacement: '\\d+\\.\\d+' },
    { regex: /\b\d{2,}\b/, replacement: '\\d+' },
  ];

  let pattern = '';
  let lastIndex = 0;

  const combinedRegex = new RegExp(dynamicContent.map(r => '(' + r.regex.source + ')').join('|'), 'g');
  text.replace(combinedRegex, (match, ...args) => {
    const offset = args[args.length - 2];
    const groups = args.slice(0, -2);
    pattern += escapeRegExp(text.slice(lastIndex, offset));
    for (let i = 0; i < groups.length; i++) {
      if (groups[i]) {
        const { replacement } = dynamicContent[i];
        pattern += replacement;
        break;
      }
    }
    lastIndex = offset + match.length;
    return match;
  });
  if (!pattern)
    return text;

  pattern += escapeRegExp(text.slice(lastIndex));
  return String(new RegExp(pattern));
}

function textContributesInfo(node: AriaNode, text: string): boolean {
  if (!text.length)
    return false;

  if (!node.name)
    return true;

  if (node.name.length > text.length)
    return false;

  // Figure out if text adds any value.
  const substr = longestCommonSubstring(text, node.name);
  let filtered = text;
  while (substr && filtered.includes(substr))
    filtered = filtered.replace(substr, '');
  return filtered.trim().length / text.length > 0.1;
}
