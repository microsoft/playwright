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

import { escapeRegExp, longestCommonSubstring, normalizeWhiteSpace } from '@isomorphic/stringUtils';

import { getElementComputedStyle } from './domUtils';
import * as roleUtils from './roleUtils';
import { yamlEscapeKeyIfNeeded, yamlEscapeValueIfNeeded } from './yaml';

import type { AriaProps, AriaRegex, AriaRole, AriaTemplateNode, AriaTemplateRoleNode, AriaTemplateTextNode } from '@isomorphic/ariaSnapshot';
import type { Builtins } from '../isomorphic/builtins';

export type AriaNode = AriaProps & {
  role: AriaRole | 'fragment';
  name: string;
  children: (AriaNode | string)[];
  element: Element;
  props: Record<string, string>;
};

export type AriaSnapshot = {
  root: AriaNode;
  elements: Builtins.Map<number, Element>;
  generation: number;
  ids: Builtins.Map<Element, number>;
};

export function generateAriaTree(builtins: Builtins, rootElement: Element, generation: number): AriaSnapshot {
  const visited = new builtins.Set<Node>();

  const snapshot: AriaSnapshot = {
    root: { role: 'fragment', name: '', children: [], element: rootElement, props: {} },
    elements: new builtins.Map<number, Element>(),
    generation,
    ids: new builtins.Map<Element, number>(),
  };

  const addElement = (element: Element) => {
    const id = snapshot.elements.size + 1;
    snapshot.elements.set(id, element);
    snapshot.ids.set(element, id);
  };

  addElement(rootElement);

  const visit = (ariaNode: AriaNode, node: Node) => {
    if (visited.has(node))
      return;
    visited.add(node);

    if (node.nodeType === Node.TEXT_NODE && node.nodeValue) {
      const text = node.nodeValue;
      // <textarea>AAA</textarea> should not report AAA as a child of the textarea.
      if (ariaNode.role !== 'textbox' && text)
        ariaNode.children.push(node.nodeValue || '');
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE)
      return;

    const element = node as Element;
    if (roleUtils.isElementHiddenForAria(element))
      return;

    const ariaChildren: Element[] = [];
    if (element.hasAttribute('aria-owns')) {
      const ids = element.getAttribute('aria-owns')!.split(/\s+/);
      for (const id of ids) {
        const ownedElement = rootElement.ownerDocument.getElementById(id);
        if (ownedElement)
          ariaChildren.push(ownedElement);
      }
    }

    addElement(element);
    const childAriaNode = toAriaNode(builtins, element);
    if (childAriaNode)
      ariaNode.children.push(childAriaNode);
    processElement(childAriaNode || ariaNode, element, ariaChildren);
  };

  function processElement(ariaNode: AriaNode, element: Element, ariaChildren: Element[] = []) {
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

    for (const child of ariaChildren)
      visit(ariaNode, child);

    ariaNode.children.push(roleUtils.getPseudoContent(element, '::after'));

    if (treatAsBlock)
      ariaNode.children.push(treatAsBlock);

    if (ariaNode.children.length === 1 && ariaNode.name === ariaNode.children[0])
      ariaNode.children = [];

    if (ariaNode.role === 'link' && element.hasAttribute('href')) {
      const href = element.getAttribute('href')!;
      ariaNode.props['url'] = href;
    }
  }

  roleUtils.beginAriaCaches(builtins);
  try {
    visit(snapshot.root, rootElement);
  } finally {
    roleUtils.endAriaCaches();
  }

  normalizeStringChildren(snapshot.root);
  return snapshot;
}

function toAriaNode(builtins: Builtins, element: Element): AriaNode | null {
  const role = roleUtils.getAriaRole(element);
  if (!role || role === 'presentation' || role === 'none')
    return null;

  const name = normalizeWhiteSpace(roleUtils.getElementAccessibleName(builtins, element, false) || '');
  const result: AriaNode = { role, name, children: [], props: {}, element };

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

  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    if (element.type !== 'checkbox' && element.type !== 'radio')
      result.children = [element.value];
  }

  return result;
}

function normalizeStringChildren(rootA11yNode: AriaNode) {
  const flushChildren = (buffer: string[], normalizedChildren: (AriaNode | string)[]) => {
    if (!buffer.length)
      return;
    const text = normalizeWhiteSpace(buffer.join(''));
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

function matchesText(text: string, template: AriaRegex | string | undefined): boolean {
  if (!template)
    return true;
  if (!text)
    return false;
  if (typeof template === 'string')
    return text === template;
  return !!text.match(new RegExp(template.pattern));
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

export function matchesAriaTree(builtins: Builtins, rootElement: Element, template: AriaTemplateNode): { matches: AriaNode[], received: MatcherReceived } {
  const snapshot = generateAriaTree(builtins, rootElement, 0);
  const matches = matchesNodeDeep(snapshot.root, template, false);
  return {
    matches,
    received: {
      raw: renderAriaTree(snapshot, { mode: 'raw' }),
      regex: renderAriaTree(snapshot, { mode: 'regex' }),
    }
  };
}

export function getAllByAria(builtins: Builtins, rootElement: Element, template: AriaTemplateNode): Element[] {
  const root = generateAriaTree(builtins, rootElement, 0).root;
  const matches = matchesNodeDeep(root, template, true);
  return matches.map(n => n.element);
}

function matchesNode(node: AriaNode | string, template: AriaTemplateNode, depth: number): boolean {
  if (typeof node === 'string' && template.kind === 'text')
    return matchesTextNode(node, template);

  if (node !== null && typeof node === 'object' && template.kind === 'role') {
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
    if (!matchesText(node.props.url, template.props?.url))
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

function matchesNodeDeep(root: AriaNode, template: AriaTemplateNode, collectAll: boolean): AriaNode[] {
  const results: AriaNode[] = [];
  const visit = (node: AriaNode | string, parent: AriaNode | null): boolean => {
    if (matchesNode(node, template, 0)) {
      const result = typeof node === 'string' ? parent : node;
      if (result)
        results.push(result);
      return !collectAll;
    }
    if (typeof node === 'string')
      return false;
    for (const child of node.children || []) {
      if (visit(child, node))
        return true;
    }
    return false;
  };
  visit(root, null);
  return results;
}

export function renderAriaTree(ariaSnapshot: AriaSnapshot, options?: { mode?: 'raw' | 'regex', ref?: boolean }): string {
  const lines: string[] = [];
  const includeText = options?.mode === 'regex' ? textContributesInfo : () => true;
  const renderString = options?.mode === 'regex' ? convertToBestGuessRegex : (str: string) => str;
  const visit = (ariaNode: AriaNode | string, parentAriaNode: AriaNode | null, indent: string) => {
    if (typeof ariaNode === 'string') {
      if (parentAriaNode && !includeText(parentAriaNode, ariaNode))
        return;
      const text = yamlEscapeValueIfNeeded(renderString(ariaNode));
      if (text)
        lines.push(indent + '- text: ' + text);
      return;
    }

    let key = ariaNode.role;
    // Yaml has a limit of 1024 characters per key, and we leave some space for role and attributes.
    if (ariaNode.name && ariaNode.name.length <= 900) {
      const name = renderString(ariaNode.name);
      if (name) {
        const stringifiedName = name.startsWith('/') && name.endsWith('/') ? name : JSON.stringify(name);
        key += ' ' + stringifiedName;
      }
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
    if (options?.ref) {
      const id = ariaSnapshot.ids.get(ariaNode.element);
      if (id)
        key += ` [ref=s${ariaSnapshot.generation}e${id}]`;
    }

    const escapedKey = indent + '- ' + yamlEscapeKeyIfNeeded(key);
    const hasProps = !!Object.keys(ariaNode.props).length;
    if (!ariaNode.children.length && !hasProps) {
      lines.push(escapedKey);
    } else if (ariaNode.children.length === 1 && typeof ariaNode.children[0] === 'string' && !hasProps) {
      const text = includeText(ariaNode, ariaNode.children[0]) ? renderString(ariaNode.children[0] as string) : null;
      if (text)
        lines.push(escapedKey + ': ' + yamlEscapeValueIfNeeded(text));
      else
        lines.push(escapedKey);
    } else {
      lines.push(escapedKey + ':');
      for (const [name, value] of Object.entries(ariaNode.props))
        lines.push(indent + '  - /' + name + ': ' + yamlEscapeValueIfNeeded(value));
      for (const child of ariaNode.children || [])
        visit(child, ariaNode, indent + '  ');
    }
  };

  const ariaNode = ariaSnapshot.root;
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

  // Figure out if text adds any value. "longestCommonSubstring" is expensive, so limit strings length.
  const substr = (text.length <= 200 && node.name.length <= 200) ? longestCommonSubstring(text, node.name) : '';
  let filtered = text;
  while (substr && filtered.includes(substr))
    filtered = filtered.replace(substr, '');
  return filtered.trim().length / text.length > 0.1;
}
