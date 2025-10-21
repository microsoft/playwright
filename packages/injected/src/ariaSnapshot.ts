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
import { renderAriaTree } from '@isomorphic/ariaSnapshot';

import { computeBox, getElementComputedStyle, isElementVisible } from './domUtils';
import * as roleUtils from './roleUtils';

import type { AriaNode, AriaRegex, AriaTextValue, AriaTemplateNode, AriaTreeMode } from '@isomorphic/ariaSnapshot';

export type AriaSnapshot = {
  root: AriaNode;
  elementByRef: Map<string, Element>;
  elementByNode: Map<AriaNode, Element>;
  refByElement: Map<Element, string>;
};

type AriaRef = {
  role: string;
  name: string;
  ref: string;
};

let lastRef = 0;

export type AriaTreeOptions = {
  mode: AriaTreeMode;
  refPrefix?: string;
};

type InternalOptions = {
  visibility: 'aria' | 'ariaOrVisible' | 'ariaAndVisible',
  refs: 'all' | 'interactable' | 'none',
  refPrefix?: string,
  includeGenericRole?: boolean,
  renderActive?: boolean,
};

function toInternalOptions(options: AriaTreeOptions): InternalOptions {
  if (options.mode === 'ai') {
    // For AI consumption.
    return {
      visibility: 'ariaOrVisible',
      refs: 'interactable',
      refPrefix: options.refPrefix,
      includeGenericRole: true,
      renderActive: true,
    };
  }
  if (options.mode === 'autoexpect') {
    // To auto-generate assertions on visible elements.
    return { visibility: 'ariaAndVisible', refs: 'none' };
  }
  if (options.mode === 'codegen') {
    // To generate aria assertion with regex heurisitcs.
    return { visibility: 'aria', refs: 'none' };
  }
  // To match aria snapshot.
  return { visibility: 'aria', refs: 'none' };
}

export function generateAriaTree(rootElement: Element, publicOptions: AriaTreeOptions): AriaSnapshot {
  const options = toInternalOptions(publicOptions);
  const visited = new Set<Node>();

  const snapshot: AriaSnapshot = {
    root: { role: 'fragment', name: '', children: [], props: {}, box: computeBox(rootElement), receivesPointerEvents: true },
    elementByRef: new Map<string, Element>(),
    elementByNode: new Map<AriaNode, Element>(),
    refByElement: new Map<Element, string>(),
  };
  snapshot.elementByNode.set(snapshot.root, rootElement);

  const visit = (ariaNode: AriaNode, node: Node, parentElementVisible: boolean) => {
    if (visited.has(node))
      return;
    visited.add(node);

    if (node.nodeType === Node.TEXT_NODE && node.nodeValue) {
      if (!parentElementVisible)
        return;

      const text = node.nodeValue;
      // <textarea>AAA</textarea> should not report AAA as a child of the textarea.
      if (ariaNode.role !== 'textbox' && text)
        ariaNode.children.push(node.nodeValue || '');
      return;
    }

    if (node.nodeType !== Node.ELEMENT_NODE)
      return;

    const element = node as Element;
    const isElementVisibleForAria = !roleUtils.isElementHiddenForAria(element);
    let visible = isElementVisibleForAria;
    if (options.visibility === 'ariaOrVisible')
      visible = isElementVisibleForAria || isElementVisible(element);
    if (options.visibility === 'ariaAndVisible')
      visible = isElementVisibleForAria && isElementVisible(element);

    // Optimization: if we only consider aria visibility, we can skip child elements because
    // they will not be visible for aria as well.
    if (options.visibility === 'aria' && !visible)
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

    const childAriaNode = visible ? toAriaNode(element, options) : null;
    if (childAriaNode) {
      snapshot.elementByNode.set(childAriaNode, element);
      if (childAriaNode.ref) {
        snapshot.elementByRef.set(childAriaNode.ref, element);
        snapshot.refByElement.set(element, childAriaNode.ref);
      }
      ariaNode.children.push(childAriaNode);
    }
    processElement(childAriaNode || ariaNode, element, ariaChildren, visible);
  };

  function processElement(ariaNode: AriaNode, element: Element, ariaChildren: Element[], parentElementVisible: boolean) {
    // Surround every element with spaces for the sake of concatenated text nodes.
    const display = getElementComputedStyle(element)?.display || 'inline';
    const treatAsBlock = (display !== 'inline' || element.nodeName === 'BR') ? ' ' : '';
    if (treatAsBlock)
      ariaNode.children.push(treatAsBlock);

    ariaNode.children.push(roleUtils.getCSSContent(element, '::before') || '');
    const assignedNodes = element.nodeName === 'SLOT' ? (element as HTMLSlotElement).assignedNodes() : [];
    if (assignedNodes.length) {
      for (const child of assignedNodes)
        visit(ariaNode, child, parentElementVisible);
    } else {
      for (let child = element.firstChild; child; child = child.nextSibling) {
        if (!(child as Element | Text).assignedSlot)
          visit(ariaNode, child, parentElementVisible);
      }
      if (element.shadowRoot) {
        for (let child = element.shadowRoot.firstChild; child; child = child.nextSibling)
          visit(ariaNode, child, parentElementVisible);
      }
    }

    for (const child of ariaChildren)
      visit(ariaNode, child, parentElementVisible);

    ariaNode.children.push(roleUtils.getCSSContent(element, '::after') || '');

    if (treatAsBlock)
      ariaNode.children.push(treatAsBlock);

    if (ariaNode.children.length === 1 && ariaNode.name === ariaNode.children[0])
      ariaNode.children = [];

    if (ariaNode.role === 'link' && element.hasAttribute('href')) {
      const href = element.getAttribute('href')!;
      ariaNode.props['url'] = href;
    }

    if (ariaNode.role === 'textbox' && element.hasAttribute('placeholder') && element.getAttribute('placeholder') !== ariaNode.name) {
      const placeholder = element.getAttribute('placeholder')!;
      ariaNode.props['placeholder'] = placeholder;
    }
  }

  roleUtils.beginAriaCaches();
  try {
    visit(snapshot.root, rootElement, true);
  } finally {
    roleUtils.endAriaCaches();
  }

  normalizeStringChildren(snapshot.root);
  normalizeGenericRoles(snapshot.root);
  return snapshot;
}

function computeAriaRef(ariaNode: AriaNode, element: Element, options: InternalOptions) {
  if (options.refs === 'none')
    return;
  if (options.refs === 'interactable' && (!ariaNode.box.visible || !ariaNode.receivesPointerEvents))
    return;

  let ariaRef: AriaRef | undefined;
  ariaRef = (element as any)._ariaRef;
  if (!ariaRef || ariaRef.role !== ariaNode.role || ariaRef.name !== ariaNode.name) {
    ariaRef = { role: ariaNode.role, name: ariaNode.name, ref: (options.refPrefix ?? '') + 'e' + (++lastRef) };
    (element as any)._ariaRef = ariaRef;
  }
  ariaNode.ref = ariaRef.ref;
}

function toAriaNode(element: Element, options: InternalOptions): AriaNode | null {
  const active = element.ownerDocument.activeElement === element;
  if (element.nodeName === 'IFRAME') {
    const ariaNode: AriaNode = {
      role: 'iframe',
      name: '',
      children: [],
      props: {},
      box: computeBox(element),
      receivesPointerEvents: true,
      active
    };
    computeAriaRef(ariaNode, element, options);
    return ariaNode;
  }

  const defaultRole = options.includeGenericRole ? 'generic' : null;
  const role = roleUtils.getAriaRole(element) ?? defaultRole;
  if (!role || role === 'presentation' || role === 'none')
    return null;

  const name = normalizeWhiteSpace(roleUtils.getElementAccessibleName(element, false) || '');
  const receivesPointerEvents = roleUtils.receivesPointerEvents(element);

  const box = computeBox(element);
  if (role === 'generic' && box.inline && element.childNodes.length === 1 && element.childNodes[0].nodeType === Node.TEXT_NODE)
    return null;

  const result: AriaNode = {
    role,
    name,
    children: [],
    props: {},
    box,
    receivesPointerEvents,
    active
  };
  computeAriaRef(result, element, options);

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
    if (element.type !== 'checkbox' && element.type !== 'radio' && element.type !== 'file')
      result.children = [element.value];
  }

  return result;
}

function normalizeGenericRoles(node: AriaNode) {
  const normalizeChildren = (node: AriaNode) => {
    const result: (AriaNode | string)[] = [];
    for (const child of node.children || []) {
      if (typeof child === 'string') {
        result.push(child);
        continue;
      }
      const normalized = normalizeChildren(child);
      result.push(...normalized);
    }

    // Only remove generic that encloses one element, logical grouping still makes sense, even if it is not ref-able.
    const removeSelf = node.role === 'generic' && !node.name && result.length <= 1 && result.every(c => typeof c !== 'string' && !!c.ref);
    if (removeSelf)
      return result;
    node.children = result;
    return [node];
  };

  normalizeChildren(node);
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

function matchesStringOrRegex(text: string, template: AriaRegex | string | undefined): boolean {
  if (!template)
    return true;
  if (!text)
    return false;
  if (typeof template === 'string')
    return text === template;
  return !!text.match(new RegExp(template.pattern));
}

function matchesTextValue(text: string, template: AriaTextValue | undefined) {
  if (!template?.normalized)
    return true;
  if (!text)
    return false;
  if (text === template.normalized)
    return true;
  // Accept pattern as value.
  if (text === template.raw)
    return true;

  const regex = cachedRegex(template);
  if (regex)
    return !!text.match(regex);
  return false;
}

const cachedRegexSymbol = Symbol('cachedRegex');

function cachedRegex(template: AriaTextValue): RegExp | null {
  if ((template as any)[cachedRegexSymbol] !== undefined)
    return (template as any)[cachedRegexSymbol];

  const { raw } = template;
  const canBeRegex = raw.startsWith('/') && raw.endsWith('/') && raw.length > 1;
  let regex: RegExp | null;
  try {
    regex = canBeRegex ? new RegExp(raw.slice(1, -1)) : null;
  } catch (e) {
    regex = null;
  }
  (template as any)[cachedRegexSymbol] = regex;
  return regex;
}

export type MatcherReceived = {
  raw: string;
  regex: string;
};

export function matchesExpectAriaTemplate(rootElement: Element, template: AriaTemplateNode): { matches: AriaNode[], received: MatcherReceived } {
  const snapshot = generateAriaTree(rootElement, { mode: 'expect' });
  const matches = matchesNodeDeep(snapshot.root, template, false, false);
  return {
    matches,
    received: {
      raw: renderAriaTree(snapshot.root, 'expect'),
      regex: renderAriaTree(snapshot.root, 'codegen'),
    }
  };
}

export function getAllElementsMatchingExpectAriaTemplate(rootElement: Element, template: AriaTemplateNode): Element[] {
  const tree = generateAriaTree(rootElement, { mode: 'expect' });
  const matches = matchesNodeDeep(tree.root, template, true, false);
  return matches.map(n => tree.elementByNode.get(n)!);
}

function matchesNode(node: AriaNode | string, template: AriaTemplateNode, isDeepEqual: boolean): boolean {
  if (typeof node === 'string' && template.kind === 'text')
    return matchesTextValue(node, template.text);

  if (node === null || typeof node !== 'object' || template.kind !== 'role')
    return false;

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
  if (!matchesStringOrRegex(node.name, template.name))
    return false;
  if (!matchesTextValue(node.props.url, template.props?.url))
    return false;

  // Proceed based on the container mode.
  if (template.containerMode === 'contain')
    return containsList(node.children || [], template.children || []);
  if (template.containerMode === 'equal')
    return listEqual(node.children || [], template.children || [], false);
  if (template.containerMode === 'deep-equal' || isDeepEqual)
    return listEqual(node.children || [], template.children || [], true);
  return containsList(node.children || [], template.children || []);
}

function listEqual(children: (AriaNode | string)[], template: AriaTemplateNode[], isDeepEqual: boolean): boolean {
  if (template.length !== children.length)
    return false;
  for (let i = 0; i < template.length; ++i) {
    if (!matchesNode(children[i], template[i], isDeepEqual))
      return false;
  }
  return true;
}

function containsList(children: (AriaNode | string)[], template: AriaTemplateNode[]): boolean {
  if (template.length > children.length)
    return false;
  const cc = children.slice();
  const tt = template.slice();
  for (const t of tt) {
    let c = cc.shift();
    while (c) {
      if (matchesNode(c, t, false))
        break;
      c = cc.shift();
    }
    if (!c)
      return false;
  }
  return true;
}

function matchesNodeDeep(root: AriaNode, template: AriaTemplateNode, collectAll: boolean, isDeepEqual: boolean): AriaNode[] {
  const results: AriaNode[] = [];
  const visit = (node: AriaNode | string, parent: AriaNode | null): boolean => {
    if (matchesNode(node, template, isDeepEqual)) {
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
