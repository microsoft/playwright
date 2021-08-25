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
import { checkComponentAttribute, parseComponentSelector } from '../common/componentUtils';

interface IEmberAppInstance {
    __container__: unknown;
    _debugContainerKey?: string;
}

interface CapturedRenderNode {
    type: 'outlet' | 'engine' | 'route-template' | 'component';
    name: string;
    args: {
      positional: unknown[];
      named: Record<string, unknown>;
    };
    instance: unknown;
    bounds: {
      parentElement: HTMLElement;
      firstNode: HTMLElement;
      lastNode: HTMLElement;
    };
    children: CapturedRenderNode[];
}

interface IEmberComponent {
    name: string;
    args?: Record<string, unknown>;
    rootElements: HTMLElement[];
    components: IEmberComponent[];
    isComponent?: boolean;
}

function normalizeToAngleBracketComponent(name: string) {
  const SIMPLE_DASHERIZE_REGEXP = /[a-z]|\/|-/g;
  const ALPHA = /[A-Za-z0-9]/;

  if (name.includes('.'))
    return name;


  return name.replace(SIMPLE_DASHERIZE_REGEXP, (char, index) => {
    if (char === '/')
      return '::';


    if (index === 0 || !ALPHA.test(name[index - 1]))
      return char.toUpperCase();


    // Remove all occurrences of '-'s from the name that aren't starting with `-`
    return char === '-' ? '' : char.toLowerCase();
  });
}

function getEmber() {
  let EmberCore;
  const w = window as any;

  try {
    EmberCore = w.requireModule('ember')['default'];
  } catch {
    EmberCore = w.Ember;
  }

  return EmberCore;
}

function findEmberRoots(): IEmberAppInstance[] {

  const EmberCore = getEmber();

  if (!EmberCore)
    return [];


  const isEmberApp = (el: any) => el._debugContainerKey === 'application:main';

  const apps = Object.values(EmberCore.Application.NAMESPACES).filter(isEmberApp) as unknown as IEmberAppInstance[];

  return apps;
}

function normalizeExtractedComponents(node: IEmberComponent) {
  function cleanComponent(el: IEmberComponent) {
    if (el.isComponent) {
      delete el.isComponent;
      if (!Object.keys(el.args || {}).length)
        delete el.args;

    }
  }

  const result = [];
  if (node.isComponent) {
    cleanComponent(node);
    node.components.forEach((el: IEmberComponent) => {
      cleanComponent(el);
    });
    result.push(node);
  } else {
    node.components.forEach((el: IEmberComponent) => {
      const results = normalizeExtractedComponents(el);
      result.push(...results);
    });
  }

  return result;
}

function buildComponentsTree(appRoot: IEmberAppInstance): IEmberComponent[] {
  try {
    const ember = getEmber();
    if (!ember || typeof ember._captureRenderTree !== 'function')
      return [];

    const tree = ember._captureRenderTree(appRoot.__container__);
    const components = extractComponents(tree[0]);
    const normalizedComponents = normalizeExtractedComponents(components[0]);
    return normalizedComponents;
  } catch {
    return [];
  }
}


function findRoots(bounds: { firstNode: HTMLElement, lastNode: HTMLElement, parentElement: HTMLElement }) {
  const { firstNode, lastNode, parentElement } = bounds;
  const roots: ChildNode[] = [];
  const closest = parentElement.childNodes;
  if (firstNode === lastNode)
    return [firstNode];

  let start = null;
  let end = null;
  for (let i = 0; i < closest.length; i++) {
    if (closest.item(i) === firstNode)
      start = i;
    else if (closest.item(i) === lastNode)
      end = i;
  }

  if (start === null || end === null)
    return [];


  for (let i = start; i <= end; i++)
    roots.push(closest.item(i));


  return roots.filter((el: ChildNode) => {
    if (el.nodeType === 3) {
      if (el.nodeValue && el.nodeValue.trim() === '')
        return false;

    }
    return el;
  }) as HTMLElement[];
}

function extractComponents(node: CapturedRenderNode) {
  const components: IEmberComponent[] = node.children.map((el: CapturedRenderNode) => {
    const instance: IEmberComponent = {
      isComponent: el.type === 'component',
      name: normalizeToAngleBracketComponent(el.name),
      args: el.args.named,
      rootElements: findRoots(el.bounds),
      components: extractComponents(el)
    };
    return instance;
  });
  return components;
}

function filterComponentsTree(treeNode: IEmberComponent, searchFn: (node: IEmberComponent) => boolean, result: IEmberComponent[] = []) {
  if (searchFn(treeNode))
    result.push(treeNode);
  for (const child of treeNode.components)
    filterComponentsTree(child, searchFn, result);
  return result;
}

export const EmberEngine: SelectorEngine = {
  queryAll(scope: SelectorRoot, selector: string): Element[] {
    const { name, attributes } = parseComponentSelector(selector);

    const emberRoots = findEmberRoots();

    const trees = emberRoots.map(emberRoot => buildComponentsTree(emberRoot)[0]);
    const treeNodes = trees.map(tree => filterComponentsTree(tree, treeNode => {
      if (name && treeNode.name !== name)
        return false;
      if (treeNode.rootElements.some(domNode => !scope.contains(domNode)))
        return false;
      for (const attr of attributes) {
        if (!checkComponentAttribute(treeNode.args || {}, attr))
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
