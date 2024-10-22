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

import { escapeWithQuotes } from '@isomorphic/stringUtils';
import * as roleUtils from './roleUtils';
import { isElementVisible, isElementStyleVisibilityVisible, getElementComputedStyle } from './domUtils';
import type { AriaRole } from './roleUtils';

type AriaProps = {
  checked?: boolean | 'mixed';
  disabled?: boolean;
  expanded?: boolean;
  level?: number;
  pressed?: boolean | 'mixed';
  selected?: boolean;
};

type AriaNode = AriaProps & {
  role: AriaRole | 'fragment' | 'text';
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

    const visible = isElementVisible(element);
    const hasVisibleChildren = isElementStyleVisibilityVisible(element);

    if (!hasVisibleChildren)
      return;

    if (visible) {
      const childAriaNode = toAriaNode(element);
      const isHiddenContainer = childAriaNode && hiddenContainerRoles.has(childAriaNode.ariaNode.role);
      if (childAriaNode && !isHiddenContainer)
        ariaNode.children.push(childAriaNode.ariaNode);
      if (isHiddenContainer || !childAriaNode?.isLeaf)
        processChildNodes(childAriaNode?.ariaNode || ariaNode, element);
    } else {
      processChildNodes(ariaNode, element);
    }
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

function toAriaNode(element: Element): { ariaNode: AriaNode, isLeaf: boolean } | null {
  const role = roleUtils.getAriaRole(element);
  if (!role)
    return null;

  const name = roleUtils.getElementAccessibleName(element, false) || '';
  const isLeaf = leafRoles.has(role);
  const result: AriaNode = { role, name, children: [] };
  if (isLeaf && !name) {
    const text = roleUtils.accumulatedElementText(element);
    if (text)
      result.children = [text];
  }

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

  return { isLeaf, ariaNode: result };
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
  };
  visit(rootA11yNode);
}

const hiddenContainerRoles = new Set(['none', 'presentation']);

const leafRoles = new Set<AriaRole>([
  'alert', 'blockquote', 'button', 'caption', 'checkbox', 'code', 'columnheader',
  'definition', 'deletion', 'emphasis', 'generic', 'heading', 'img', 'insertion',
  'link', 'menuitem', 'menuitemcheckbox', 'menuitemradio', 'meter', 'option',
  'progressbar', 'radio', 'rowheader', 'scrollbar', 'searchbox', 'separator',
  'slider', 'spinbutton', 'strong', 'subscript', 'superscript', 'switch', 'tab', 'term',
  'textbox', 'time', 'tooltip'
]);

const normalizeWhitespaceWithin = (text: string) => text.replace(/[\s\t\r\n]+/g, ' ');

function matchesText(text: string | undefined, template: RegExp | string | undefined) {
  if (!template)
    return true;
  if (!text)
    return false;
  if (typeof template === 'string')
    return text === template;
  return !!text.match(template);
}

export function matchesAriaTree(rootElement: Element, template: AriaTemplateNode): { matches: boolean, received: string } {
  const root = generateAriaTree(rootElement);
  const matches = matchesNodeDeep(root, template);
  return { matches, received: renderAriaTree(root, { noText: true }) };
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

export function renderAriaTree(ariaNode: AriaNode, options?: { noText?: boolean }): string {
  const lines: string[] = [];
  const visit = (ariaNode: AriaNode | string, indent: string) => {
    if (typeof ariaNode === 'string') {
      if (!options?.noText)
        lines.push(indent + '- text: ' + quoteYamlString(ariaNode));
      return;
    }
    let line = `${indent}- ${ariaNode.role}`;
    if (ariaNode.name)
      line += ` ${escapeWithQuotes(ariaNode.name, '"')}`;

    if (ariaNode.checked === 'mixed')
      line += ` [checked=mixed]`;
    if (ariaNode.checked === true)
      line += ` [checked]`;
    if (ariaNode.disabled)
      line += ` [disabled]`;
    if (ariaNode.expanded)
      line += ` [expanded]`;
    if (ariaNode.level)
      line += ` [level=${ariaNode.level}]`;
    if (ariaNode.pressed === 'mixed')
      line += ` [pressed=mixed]`;
    if (ariaNode.pressed === true)
      line += ` [pressed]`;
    if (ariaNode.selected === true)
      line += ` [selected]`;

    const stringValue = !ariaNode.children.length || (ariaNode.children?.length === 1 && typeof ariaNode.children[0] === 'string');
    if (stringValue) {
      if (!options?.noText && ariaNode.children.length)
        line += ': ' + quoteYamlString(ariaNode.children?.[0] as string);
      lines.push(line);
      return;
    }

    lines.push(line + ':');
    for (const child of ariaNode.children || [])
      visit(child, indent + '  ');
  };

  if (ariaNode.role === 'fragment') {
    // Render fragment.
    for (const child of ariaNode.children || [])
      visit(child, '');
  } else {
    visit(ariaNode, '');
  }
  return lines.join('\n');
}

function quoteYamlString(str: string) {
  return `"${str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r')}"`;
}
