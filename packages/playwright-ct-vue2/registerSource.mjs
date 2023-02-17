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
/** @typedef {import('vue').Component} FrameworkComponent */

/** @type {Map<string, FrameworkComponent>} */
const registry = new Map();

/**
 * @param {{[key: string]: FrameworkComponent}} components
 */
export function register(components) {
  for (const [name, value] of Object.entries(components))
    registry.set(name, value);
}

/**
 * @param {Component | string} child
 * @param {import('vue').CreateElement} h
 */
function createChild(child, h) {
  return typeof child === 'string' ? child : createWrapper(child, h);
}

/**
 * Exists to support fallthrough attributes:
 * https://vuejs.org/guide/components/attrs.html#fallthrough-attributes
 * @param {any} Component
 * @param {string} key
 * @return {boolean}
 */
function componentHasKeyInProps(Component, key) {
  if (Array.isArray(Component.props))
    return Component.props.includes(key);

  return Object.entries(Component.props).flat().includes(key);
}

/**
 * @param {Component} component
 * @param {import('vue').CreateElement} h
 */
function createComponent(component, h) {
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
        nodeData.scopedSlots[slot] = () => child.children.map(c => createChild(c, h));
      } else {
        children.push(createChild(child, h));
      }
    }

    for (const [key, value] of Object.entries(component.props)) {
      if (key.startsWith('v-on:')) {
        const event = key.substring('v-on:'.length);
        nodeData.on[event] = value;
      } else {
        if (isVueComponent && componentHasKeyInProps(componentFunc, key))
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
      const list = (Array.isArray(value) ? value : [value]).map(v => createChild(v, h));
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

  return { Component: componentFunc, nodeData, slots: lastArg };
}

/**
 * @param {Component} component
 * @param {import('vue').CreateElement} h
 * @returns {import('vue').VNode}
 */
function createWrapper(component, h) {
  const { Component, nodeData, slots } = createComponent(component, h);
  const wrapper = h(Component, nodeData, slots);
  return wrapper;
}

const instanceKey = Symbol('instanceKey');
const wrapperKey = Symbol('wrapperKey');

window.playwrightMount = async (component, rootElement, hooksConfig) => {
  let options = {};
  for (const hook of window.__pw_hooks_before_mount || [])
    options = await hook({ hooksConfig, Vue });

  const instance = new Vue({
    ...options,
    render: h => {
      const wrapper = createWrapper(component, h);
      /** @type {any} */ (rootElement)[wrapperKey] = wrapper;
      return wrapper;
    },
  }).$mount();
  rootElement.appendChild(instance.$el);
  /** @type {any} */ (rootElement)[instanceKey] = instance;

  for (const hook of window.__pw_hooks_after_mount || [])
    await hook({ hooksConfig, instance });
};

window.playwrightUnmount = async rootElement => {
  const component = rootElement[instanceKey];
  if (!component)
    throw new Error('Component was not mounted');
  component.$destroy();
  component.$el.remove();
};

window.playwrightUpdate = async (element, options) => {
  const wrapper = /** @type {any} */(element)[wrapperKey];
  if (!wrapper)
    throw new Error('Component was not mounted');

  const component = wrapper.componentInstance;
  const { nodeData, slots } = createComponent(options, component.$createElement);

  for (const [name, value] of Object.entries(nodeData.on || {})) {
    component.$on(name, value);
    component.$listeners[name] = value;
  }

  Object.assign(component.$scopedSlots, nodeData.scopedSlots);
  component.$slots.default = slots;

  for (const [key, value] of Object.entries(nodeData.props || {}))
    component[key] = value;

  if (!Object.keys(nodeData.props || {}).length)
    component.$forceUpdate();
};
