/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// @ts-check

// This file is injected into the registry as text, no dependencies are allowed.

import Vue from 'vue';

/** @typedef {import('../playwright-test/types/component').Component} Component */

/** @type { Map<string, import('vue').Component> } */
const registry = new Map();

/**
 * @param {{[key: string]: import('vue').Component}} components
 */
export function register(components) {
  for (const [name, value] of Object.entries(components))
    registry.set(name, value);
}

/**
 * @param {Component | string} child 
 * @param {import('vue').CreateElement} h 
 * @returns {import('vue').VNode | string}
 */
function renderChild(child, h) {
  return typeof child === 'string' ? child : render(child, h);
}

/**
 * @param {Component} component 
 * @param {import('vue').CreateElement} h 
 * @returns {import('vue').VNode}
 */
function render(component, h) {
  /**
   * @type {import('vue').Component | string | undefined}
   */
  let componentFunc = registry.get(component.type);
  if (!componentFunc) {
    // Lookup by shorthand.
    for (const [name, value] of registry) {
      if (component.type.endsWith(`_${name}_vue`)) {
        componentFunc = value;
        break;
      }
    }
  }

  if (!componentFunc && component.type[0].toUpperCase() === component.type[0])
    throw new Error(`Unregistered component: ${component.type}. Following components are registered: ${[...registry.keys()]}`);

  componentFunc = componentFunc || component.type;

  const isVueComponent = componentFunc !== component.type;

  /**
   * @type {(import('vue').VNode | string)[]}
   */
  const children = [];

  /** @type {import('vue').VNodeData} */
  const nodeData = {};
  nodeData.attrs = {};
  nodeData.props = {};
  nodeData.scopedSlots = {};
  nodeData.on = {};

  if (component.kind === 'jsx') {
    for (const child of component.children || []) {
      if (typeof child !== 'string' && child.type === 'template' && child.kind === 'jsx') {
        const slotProperty = Object.keys(child.props).find(k => k.startsWith('v-slot:'));
        const slot = slotProperty ? slotProperty.substring('v-slot:'.length) : 'default';
        nodeData.scopedSlots[slot] = () => child.children.map(c => renderChild(c, h));
      } else {
        children.push(renderChild(child, h));
      }
    }

    for (const [key, value] of Object.entries(component.props)) {
      if (key.startsWith('v-on:')) {
        const event = key.substring('v-on:'.length);
        nodeData.on[event] = value;
      } else {
        if (isVueComponent)
          nodeData.props[key] = value;
        else
          nodeData.attrs[key] = value;
      }
    }
  }

  if (component.kind === 'object') {
    // Vue test util syntax.
    const options = component.options || {};
    for (const [key, value] of Object.entries(options.slots || {})) {
      const list = (Array.isArray(value) ? value : [value]).map(v => renderChild(v, h));
      if (key === 'default')
        children.push(...list);
      else
        nodeData.scopedSlots[key] = () => list;
    }
    nodeData.props = options.props || {};
    for (const [key, value] of Object.entries(options.on || {}))
      nodeData.on[key] = value;
  }

  /** @type {(string|import('vue').VNode)[] | undefined} */
  let lastArg;
  if (Object.entries(nodeData.scopedSlots).length) {
    if (children.length)
      nodeData.scopedSlots.default = () => children;
  } else if (children.length) {
    lastArg = children;
  }

  const wrapper = h(componentFunc, nodeData, lastArg);
  return wrapper;
}

/** @type {any} */ (window).playwrightMount = /** @param {Component} component */ async component => {
  let rootElement = document.getElementById('root');
  if (!rootElement) {
    rootElement = document.createElement('div');
    rootElement.id = 'root';
    document.body.append(rootElement);
  }
  const mounted = new Vue({
    render: h => render(component, h),
  }).$mount();
  rootElement.appendChild(mounted.$el);
  return '#root > *';
};
