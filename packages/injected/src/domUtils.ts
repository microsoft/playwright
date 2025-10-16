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

type GlobalOptions = {
  browserNameForWorkarounds?: string;
};
let globalOptions: GlobalOptions = {};
export function setGlobalOptions(options: GlobalOptions) {
  globalOptions = options;
}
export function getGlobalOptions(): GlobalOptions {
  return globalOptions;
}

export function isInsideScope(scope: Node, element: Element | undefined): boolean {
  while (element) {
    if (scope.contains(element))
      return true;
    element = enclosingShadowHost(element);
  }
  return false;
}

export function enclosingElement(node: Node) {
  if (node.nodeType === 1 /* Node.ELEMENT_NODE */)
    return node as Element;
  return node.parentElement ?? undefined;
}

export function parentElementOrShadowHost(element: Element): Element | undefined {
  if (element.parentElement)
    return element.parentElement;
  if (!element.parentNode)
    return;
  if (element.parentNode.nodeType === 11 /* Node.DOCUMENT_FRAGMENT_NODE */ && (element.parentNode as ShadowRoot).host)
    return (element.parentNode as ShadowRoot).host;
}

export function enclosingShadowRootOrDocument(element: Element): Document | ShadowRoot | undefined {
  let node: Node = element;
  while (node.parentNode)
    node = node.parentNode;
  if (node.nodeType === 11 /* Node.DOCUMENT_FRAGMENT_NODE */ || node.nodeType === 9 /* Node.DOCUMENT_NODE */)
    return node as Document | ShadowRoot;
}

function enclosingShadowHost(element: Element): Element | undefined {
  while (element.parentElement)
    element = element.parentElement;
  return parentElementOrShadowHost(element);
}

// Assumption: if scope is provided, element must be inside scope's subtree.
export function closestCrossShadow(element: Element | undefined, css: string, scope?: Document | Element): Element | undefined {
  while (element) {
    const closest = element.closest(css);
    if (scope && closest !== scope && closest?.contains(scope))
      return;
    if (closest)
      return closest;
    element = enclosingShadowHost(element);
  }
}

export function getElementComputedStyle(element: Element, pseudo?: string): CSSStyleDeclaration | undefined {
  const cache = pseudo === '::before' ? cacheStyleBefore : pseudo === '::after' ? cacheStyleAfter : cacheStyle;
  if (cache && cache.has(element))
    return cache.get(element);
  const style = element.ownerDocument && element.ownerDocument.defaultView ? element.ownerDocument.defaultView.getComputedStyle(element, pseudo) : undefined;
  cache?.set(element, style);
  return style;
}

export function isElementStyleVisibilityVisible(element: Element, style?: CSSStyleDeclaration): boolean {
  style = style ?? getElementComputedStyle(element);
  if (!style)
    return true;
  // Element.checkVisibility checks for content-visibility and also looks at
  // styles up the flat tree including user-agent ShadowRoots, such as the
  // details element for example.
  // All the browser implement it, but WebKit has a bug which prevents us from using it:
  // https://bugs.webkit.org/show_bug.cgi?id=264733
  // @ts-ignore
  if (Element.prototype.checkVisibility && globalOptions.browserNameForWorkarounds !== 'webkit') {
    if (!element.checkVisibility())
      return false;
  } else {
    // Manual workaround for WebKit that does not have checkVisibility.
    const detailsOrSummary = element.closest('details,summary');
    if (detailsOrSummary !== element && detailsOrSummary?.nodeName === 'DETAILS' && !(detailsOrSummary as HTMLDetailsElement).open)
      return false;
  }
  if (style.visibility !== 'visible')
    return false;
  return true;
}

export type Box = {
  visible: boolean;
  inline: boolean;
  rect?: DOMRect;
  // Note: we do not store the CSSStyleDeclaration object, because it is a live object
  // and changes values over time. This does not work for caching or comparing to the
  // old values. Instead, store all the properties separately.
  cursor?: CSSStyleDeclaration['cursor'];
};

export function computeBox(element: Element): Box {
  // Note: this logic should be similar to waitForDisplayedAtStablePosition() to avoid surprises.
  const style = getElementComputedStyle(element);
  if (!style)
    return { visible: true, inline: false };
  const cursor = style.cursor;
  if (style.display === 'contents') {
    // display:contents is not rendered itself, but its child nodes are.
    for (let child = element.firstChild; child; child = child.nextSibling) {
      if (child.nodeType === 1 /* Node.ELEMENT_NODE */ && isElementVisible(child as Element))
        return { visible: true, inline: false, cursor };
      if (child.nodeType === 3 /* Node.TEXT_NODE */ && isVisibleTextNode(child as Text))
        return { visible: true, inline: true, cursor };
    }
    return { visible: false, inline: false, cursor };
  }
  if (!isElementStyleVisibilityVisible(element, style))
    return { cursor, visible: false, inline: false };
  const rect = element.getBoundingClientRect();
  return { rect, cursor, visible: rect.width > 0 && rect.height > 0, inline: style.display === 'inline' };
}

export function isElementVisible(element: Element): boolean {
  return computeBox(element).visible;
}

export function isVisibleTextNode(node: Text) {
  // https://stackoverflow.com/questions/1461059/is-there-an-equivalent-to-getboundingclientrect-for-text-nodes
  const range = node.ownerDocument.createRange();
  range.selectNode(node);
  const rect = range.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function elementSafeTagName(element: Element) {
  const tagName = element.tagName;
  if (typeof tagName === 'string')  // Fast path.
    return tagName.toUpperCase();
  // Named inputs, e.g. <input name=tagName>, will be exposed as fields on the parent <form>
  // and override its properties.
  if (element instanceof HTMLFormElement)
    return 'FORM';
  // Elements from the svg namespace do not have uppercase tagName right away.
  return element.tagName.toUpperCase();
}

let cacheStyle: Map<Element, CSSStyleDeclaration | undefined> | undefined;
let cacheStyleBefore: Map<Element, CSSStyleDeclaration | undefined> | undefined;
let cacheStyleAfter: Map<Element, CSSStyleDeclaration | undefined> | undefined;
let cachesCounter = 0;

export function beginDOMCaches() {
  ++cachesCounter;
  cacheStyle ??= new Map();
  cacheStyleBefore ??= new Map();
  cacheStyleAfter ??= new Map();
}

export function endDOMCaches() {
  if (!--cachesCounter) {
    cacheStyle = undefined;
    cacheStyleBefore = undefined;
    cacheStyleAfter = undefined;
  }
}
