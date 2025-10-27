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

import { computeBox, getElementComputedStyle, isElementVisible } from './domUtils';
import * as roleUtils from './roleUtils';
import { yamlEscapeKeyIfNeeded, yamlEscapeValueIfNeeded } from './yaml';

import type { AriaProps, AriaRegex, AriaTextValue, AriaRole, AriaTemplateNode } from '@isomorphic/ariaSnapshot';
import type { Box } from './domUtils';

export type AriaNode = AriaProps & {
  role: AriaRole | 'fragment' | 'iframe';
  name: string;
  ref?: string;
  children: (AriaNode | string)[];
  element: Element;
  box: Box;
  receivesPointerEvents: boolean;
  props: Record<string, string>;
};

export type AriaSnapshot = {
  root: AriaNode;
  elements: Map<string, Element>;
  refs: Map<Element, string>;
};

type AriaRef = {
  role: string;
  name: string;
  ref: string;
};

let lastRef = 0;

export type AriaTreeOptions = {
  mode: 'ai' | 'expect' | 'codegen' | 'autoexpect';
  refPrefix?: string;
};

type InternalOptions = {
  visibility: 'aria' | 'ariaOrVisible' | 'ariaAndVisible',
  refs: 'all' | 'interactable' | 'none',
  refPrefix?: string,
  includeGenericRole?: boolean,
  renderCursorPointer?: boolean,
  renderActive?: boolean,
  renderStringsAsRegex?: boolean,
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
      renderCursorPointer: true,
    };
  }
  if (options.mode === 'autoexpect') {
    // To auto-generate assertions on visible elements.
    return { visibility: 'ariaAndVisible', refs: 'none' };
  }
  if (options.mode === 'codegen') {
    // To generate aria assertion with regex heurisitcs.
    return { visibility: 'aria', refs: 'none', renderStringsAsRegex: true };
  }
  // To match aria snapshot.
  return { visibility: 'aria', refs: 'none' };
}

export function generateAriaTree(rootElement: Element, publicOptions: AriaTreeOptions): AriaSnapshot {
  const options = toInternalOptions(publicOptions);
  const visited = new Set<Node>();

  const snapshot: AriaSnapshot = {
    root: { role: 'fragment', name: '', children: [], element: rootElement, props: {}, box: computeBox(rootElement), receivesPointerEvents: true },
    elements: new Map<string, Element>(),
    refs: new Map<Element, string>(),
  };

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
      if (childAriaNode.ref) {
        snapshot.elements.set(childAriaNode.ref, element);
        snapshot.refs.set(element, childAriaNode.ref);
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

function computeAriaRef(ariaNode: AriaNode, options: InternalOptions) {
  if (options.refs === 'none')
    return;
  if (options.refs === 'interactable' && (!ariaNode.box.visible || !ariaNode.receivesPointerEvents))
    return;

  let ariaRef: AriaRef | undefined;
  ariaRef = (ariaNode.element as any)._ariaRef;
  if (!ariaRef || ariaRef.role !== ariaNode.role || ariaRef.name !== ariaNode.name) {
    ariaRef = { role: ariaNode.role, name: ariaNode.name, ref: (options.refPrefix ?? '') + 'e' + (++lastRef) };
    (ariaNode.element as any)._ariaRef = ariaRef;
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
      element,
      box: computeBox(element),
      receivesPointerEvents: true,
      active
    };
    computeAriaRef(ariaNode, options);
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
    element,
    box,
    receivesPointerEvents,
    active
  };
  computeAriaRef(result, options);

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
      raw: renderAriaTree(snapshot, { mode: 'expect' }),
      regex: renderAriaTree(snapshot, { mode: 'codegen' }),
    }
  };
}

export function getAllElementsMatchingExpectAriaTemplate(rootElement: Element, template: AriaTemplateNode): Element[] {
  const root = generateAriaTree(rootElement, { mode: 'expect' }).root;
  const matches = matchesNodeDeep(root, template, true, false);
  return matches.map(n => n.element);
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

function buildByRefMap(root: AriaNode | undefined, map: Map<string, AriaNode> = new Map()): Map<string, AriaNode> {
  if (root?.ref)
    map.set(root.ref, root);
  for (const child of root?.children || []) {
    if (typeof child !== 'string')
      buildByRefMap(child, map);
  }
  return map;
}

function hasIframeNodes(root: AriaNode): boolean {
  if (root.role === 'iframe')
    return true;
  return (root.children || []).some(child => typeof child !== 'string' && hasIframeNodes(child));
}

function arePropsEqual(a: AriaNode, b: AriaNode): boolean {
  const aKeys = Object.keys(a.props);
  const bKeys = Object.keys(b.props);
  return aKeys.length === bKeys.length && aKeys.every(k => a.props[k] === b.props[k]);
}

export function renderAriaTree(ariaSnapshot: AriaSnapshot, publicOptions: AriaTreeOptions, previous?: AriaSnapshot): string {
  if (hasIframeNodes(ariaSnapshot.root))
    previous = undefined;

  const options = toInternalOptions(publicOptions);
  const lines: string[] = [];
  const includeText = options.renderStringsAsRegex ? textContributesInfo : () => true;
  const renderString = options.renderStringsAsRegex ? convertToBestGuessRegex : (str: string) => str;
  const previousByRef = buildByRefMap(previous?.root);

  const visitText = (text: string, indent: string) => {
    const escaped = yamlEscapeValueIfNeeded(renderString(text));
    if (escaped)
      lines.push(indent + '- text: ' + escaped);
  };

  const createKey = (ariaNode: AriaNode, renderCursorPointer: boolean): string => {
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
    if (ariaNode.active && options.renderActive)
      key += ` [active]`;
    if (ariaNode.level)
      key += ` [level=${ariaNode.level}]`;
    if (ariaNode.pressed === 'mixed')
      key += ` [pressed=mixed]`;
    if (ariaNode.pressed === true)
      key += ` [pressed]`;
    if (ariaNode.selected === true)
      key += ` [selected]`;

    if (ariaNode.ref) {
      key += ` [ref=${ariaNode.ref}]`;
      if (renderCursorPointer && hasPointerCursor(ariaNode))
        key += ' [cursor=pointer]';
    }
    return key;
  };

  const getSingleInlinedTextChild = (ariaNode: AriaNode | undefined): string | undefined => {
    return ariaNode?.children.length === 1 && typeof ariaNode.children[0] === 'string' && !Object.keys(ariaNode.props).length ? ariaNode.children[0] : undefined;
  };

  const visit = (ariaNode: AriaNode, indent: string, renderCursorPointer: boolean, previousNode: AriaNode | undefined): { unchanged: boolean } => {
    if (ariaNode.ref)
      previousNode = previousByRef.get(ariaNode.ref);

    const linesBefore = lines.length;
    const key = createKey(ariaNode, renderCursorPointer);
    const escapedKey = indent + '- ' + yamlEscapeKeyIfNeeded(key);
    const inCursorPointer = renderCursorPointer && !!ariaNode.ref && hasPointerCursor(ariaNode);
    const singleInlinedTextChild = getSingleInlinedTextChild(ariaNode);

    // Whether ariaNode's subtree is the same as previousNode's, and can be replaced with just a ref.
    let unchanged = !!previousNode && key === createKey(previousNode, renderCursorPointer) && arePropsEqual(ariaNode, previousNode);

    if (!ariaNode.children.length && !Object.keys(ariaNode.props).length) {
      // Leaf node without children.
      lines.push(escapedKey);
    } else if (singleInlinedTextChild !== undefined) {
      // Leaf node with just some text inside.
      // Unchanged when the previous node also had the same single text child.
      unchanged = unchanged && getSingleInlinedTextChild(previousNode) === singleInlinedTextChild;

      const shouldInclude = includeText(ariaNode, singleInlinedTextChild);
      if (shouldInclude)
        lines.push(escapedKey + ': ' + yamlEscapeValueIfNeeded(renderString(singleInlinedTextChild)));
      else
        lines.push(escapedKey);
    } else {
      // Node with (optional) props and some children.
      lines.push(escapedKey + ':');
      for (const [name, value] of Object.entries(ariaNode.props))
        lines.push(indent + '  - /' + name + ': ' + yamlEscapeValueIfNeeded(value));

      // All children must be the same.
      unchanged = unchanged && previousNode?.children.length === ariaNode.children.length;

      const childIndent = indent + '  ';
      for (let childIndex = 0 ; childIndex < ariaNode.children.length; childIndex++) {
        const child = ariaNode.children[childIndex];
        if (typeof child === 'string') {
          unchanged = unchanged && previousNode?.children[childIndex] === child;
          if (includeText(ariaNode, child))
            visitText(child, childIndent);
        } else {
          const previousChild = previousNode?.children[childIndex];
          const childResult = visit(child, childIndent, renderCursorPointer && !inCursorPointer, typeof previousChild !== 'string' ? previousChild : undefined);
          unchanged = unchanged && childResult.unchanged;
        }
      }
    }

    if (unchanged && ariaNode.ref) {
      // Replace the whole subtree with a single reference.
      lines.splice(linesBefore);
      lines.push(indent + `- ref=${ariaNode.ref} [unchanged]`);
    }

    return { unchanged };
  };

  // Do not render the root fragment, just its children.
  const nodesToRender = ariaSnapshot.root.role === 'fragment' ? ariaSnapshot.root.children : [ariaSnapshot.root];
  for (const nodeToRender of nodesToRender) {
    if (typeof nodeToRender === 'string')
      visitText(nodeToRender, '');
    else
      visit(nodeToRender, '', !!options.renderCursorPointer, undefined);
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

function hasPointerCursor(ariaNode: AriaNode): boolean {
  return ariaNode.box.cursor === 'pointer';
}
