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

import { SelectorEngine, SelectorRoot } from './selectorEngine';
import { isInsideScope } from './selectorEvaluator';
import { checkComponentAttribute, parseComponentSelector } from './componentUtils';

type ComponentNode = {
  name: string,
  children: ComponentNode[],
  rootElements: Element[],
  props: any,
};

type ReactVNode = {
  // React 16+
  type: any,
  child?: ReactVNode,
  sibling?: ReactVNode,
  stateNode?: Node,
  memoizedProps?: any,

  // React 15
  _hostNode?: any,
  _currentElement?: any,
  _renderedComponent?: any,
  _renderedChildren?: any[],
};

function getComponentName(reactElement: ReactVNode): string {
  // React 16+
  // @see https://github.com/baruchvlz/resq/blob/5c15a5e04d3f7174087248f5a158c3d6dcc1ec72/src/utils.js#L16
  if (typeof reactElement.type === 'function')
    return reactElement.type.displayName || reactElement.type.name || 'Anonymous';
  if (typeof reactElement.type === 'string')
    return reactElement.type;

  // React 15
  // @see https://github.com/facebook/react/blob/2edf449803378b5c58168727d4f123de3ba5d37f/packages/react-devtools-shared/src/backend/legacy/renderer.js#L59
  if (reactElement._currentElement) {
    const elementType = reactElement._currentElement.type;
    if (typeof elementType === 'string')
      return elementType;
    if (typeof elementType === 'function')
      return elementType.displayName || elementType.name || 'Anonymous';
  }
  return '';
}

function getChildren(reactElement: ReactVNode): ReactVNode[] {
  // React 16+
  // @see https://github.com/baruchvlz/resq/blob/5c15a5e04d3f7174087248f5a158c3d6dcc1ec72/src/utils.js#L192
  if (reactElement.child) {
    const children: ReactVNode[] = [];
    for (let child: ReactVNode|undefined = reactElement.child; child; child = child.sibling)
      children.push(child);
    return children;
  }

  // React 15
  // @see https://github.com/facebook/react/blob/2edf449803378b5c58168727d4f123de3ba5d37f/packages/react-devtools-shared/src/backend/legacy/renderer.js#L101
  if (!reactElement._currentElement)
    return [];
  const isKnownElement = (reactElement: ReactVNode) => {
    const elementType = reactElement._currentElement?.type;
    return typeof elementType === 'function' || typeof elementType === 'string';
  };

  if (reactElement._renderedComponent) {
    const child = reactElement._renderedComponent;
    return isKnownElement(child) ? [child] : [];
  }
  if (reactElement._renderedChildren)
    return [...Object.values(reactElement._renderedChildren)].filter(isKnownElement);
  return [];
}

function getProps(reactElement: ReactVNode) {
  const props =
      // React 16+
      reactElement.memoizedProps ||
      // React 15
      reactElement._currentElement?.props;
  if (!props || typeof props === 'string')
    return props;
  const result = { ...props };

  delete result.children;
  return result;
}

function buildComponentsTree(reactElement: ReactVNode): ComponentNode {
  const treeNode: ComponentNode = {
    name: getComponentName(reactElement),
    children: getChildren(reactElement).map(buildComponentsTree),
    rootElements: [],
    props: getProps(reactElement),
  };

  const rootElement =
      // React 16+
      // @see https://github.com/baruchvlz/resq/blob/5c15a5e04d3f7174087248f5a158c3d6dcc1ec72/src/utils.js#L29
      reactElement.stateNode ||
      // React 15
      reactElement._hostNode || reactElement._renderedComponent?._hostNode;
  if (rootElement instanceof Element) {
    treeNode.rootElements.push(rootElement);
  } else {
    for (const child of treeNode.children)
      treeNode.rootElements.push(...child.rootElements);
  }
  return treeNode;
}

function filterComponentsTree(treeNode: ComponentNode, searchFn: (node: ComponentNode) => boolean, result: ComponentNode[] = []) {
  if (searchFn(treeNode))
    result.push(treeNode);
  for (const child of treeNode.children)
    filterComponentsTree(child, searchFn, result);
  return result;
}

function findReactRoots(root: Document | ShadowRoot, roots: ReactVNode[] = []): ReactVNode[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  do {
    const node = walker.currentNode;
    // @see https://github.com/baruchvlz/resq/blob/5c15a5e04d3f7174087248f5a158c3d6dcc1ec72/src/utils.js#L329
    if (node.hasOwnProperty('_reactRootContainer'))
      roots.push((node as any)._reactRootContainer._internalRoot.current);

    // Pre-react 16: rely on `data-reactroot`
    // @see https://github.com/facebook/react/issues/10971
    if ((node instanceof Element) && node.hasAttribute('data-reactroot')) {
      for (const key of Object.keys(node)) {
        // @see https://github.com/baruchvlz/resq/blob/5c15a5e04d3f7174087248f5a158c3d6dcc1ec72/src/utils.js#L334
        if (key.startsWith('__reactInternalInstance') || key.startsWith('__reactFiber'))
          roots.push((node as any)[key]);
      }
    }

    const shadowRoot = node instanceof Element ? node.shadowRoot : null;
    if (shadowRoot)
      findReactRoots(shadowRoot, roots);
  } while (walker.nextNode());
  return roots;
}

export const ReactEngine: SelectorEngine = {
  queryAll(scope: SelectorRoot, selector: string): Element[] {
    const { name, attributes } = parseComponentSelector(selector);

    const reactRoots = findReactRoots(document);
    const trees = reactRoots.map(reactRoot => buildComponentsTree(reactRoot));
    const treeNodes = trees.map(tree => filterComponentsTree(tree, treeNode => {
      if (name && treeNode.name !== name)
        return false;
      if (treeNode.rootElements.some(domNode => !isInsideScope(scope, domNode)))
        return false;
      for (const attr of attributes) {
        if (!checkComponentAttribute(treeNode.props, attr))
          return false;
      }
      return true;
    })).flat();
    const allRootElements: Set<Element> = new Set();
    for (const treeNode of treeNodes) {
      for (const domNode of treeNode.rootElements)
        allRootElements.add(domNode);
    }
    return [...allRootElements];
  }
};
