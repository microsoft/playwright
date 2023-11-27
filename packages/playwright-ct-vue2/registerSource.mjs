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

import __pwVue, { h as __pwH } from 'vue';

/** @typedef {import('../playwright-ct-core/types/component').Component} Component */
/** @typedef {import('../playwright-ct-core/types/component').JsxComponentChild} JsxComponentChild */
/** @typedef {import('../playwright-ct-core/types/component').JsxComponent} JsxComponent */
/** @typedef {import('../playwright-ct-core/types/component').ObjectComponent} ObjectComponent */
/** @typedef {import('vue').Component} FrameworkComponent */

/** @type {Map<string, () => Promise<FrameworkComponent>>} */
const __pwLoaderRegistry = new Map();
/** @type {Map<string, FrameworkComponent>} */
const __pwRegistry = new Map();

/**
 * @param {{[key: string]: () => Promise<FrameworkComponent>}} components
 */
export function pwRegister(components) {
  for (const [name, value] of Object.entries(components))
    __pwLoaderRegistry.set(name, value);
}

/**
 * @param {any} component
 * @returns {component is Component}
 */
function isComponent(component) {
  return !(typeof component !== 'object' || Array.isArray(component));
}

/**
 * @param {Component | JsxComponentChild} component
 */
async function __pwResolveComponent(component) {
  if (!isComponent(component))
    return;

  let componentFactory = __pwLoaderRegistry.get(component.type);
  if (!componentFactory) {
    // Lookup by shorthand.
    for (const [name, value] of __pwLoaderRegistry) {
      if (component.type.endsWith(`_${name}_vue`)) {
        componentFactory = value;
        break;
      }
    }
  }

  if (!componentFactory && component.type[0].toUpperCase() === component.type[0])
    throw new Error(`Unregistered component: ${component.type}. Following components are registered: ${[...__pwRegistry.keys()]}`);

  if (componentFactory)
    __pwRegistry.set(component.type, await componentFactory());

  if ('children' in component && component.children?.length)
    await Promise.all(component.children.map(child => __pwResolveComponent(child)));
}

/**
 * @param {Component | JsxComponentChild} child
 */
function __pwCreateChild(child) {
  if (Array.isArray(child))
    return child.map(grandChild => __pwCreateChild(grandChild));
  if (isComponent(child))
    return __pwCreateWrapper(child);
  return child;
}

/**
 * Exists to support fallthrough attributes:
 * https://vuejs.org/guide/components/attrs.html#fallthrough-attributes
 * @param {any} Component
 * @param {string} key
 * @return {boolean}
 */
function __pwComponentHasKeyInProps(Component, key) {
  if (Array.isArray(Component.props))
    return Component.props.includes(key);

  return Object.entries(Component.props).flat().includes(key);
}

/**
 * @param {Component} component
 */
function __pwCreateComponent(component) {
  const componentFunc = __pwRegistry.get(component.type) || component.type;
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
        nodeData.scopedSlots[slot] = () => child.children?.map(c => __pwCreateChild(c));
      } else {
        children.push(__pwCreateChild(child));
      }
    }

    for (const [key, value] of Object.entries(component.props)) {
      if (key.startsWith('v-on:')) {
        const event = key.substring('v-on:'.length);
        nodeData.on[event] = value;
      } else {
        if (isVueComponent && __pwComponentHasKeyInProps(componentFunc, key))
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
      const list = (Array.isArray(value) ? value : [value]).map(v => __pwCreateChild(v));
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
 * @returns {import('vue').VNode}
 */
function __pwCreateWrapper(component) {
  const { Component, nodeData, slots } = __pwCreateComponent(component);
  const wrapper = __pwH(Component, nodeData, slots);
  return wrapper;
}

const instanceKey = Symbol('instanceKey');
const wrapperKey = Symbol('wrapperKey');

window.playwrightMount = async (component, rootElement, hooksConfig) => {
  await __pwResolveComponent(component);
  let options = {};
  for (const hook of window.__pw_hooks_before_mount || [])
    options = await hook({ hooksConfig, Vue: __pwVue });

  const instance = new __pwVue({
    ...options,
    render: () => {
      const wrapper = __pwCreateWrapper(component);
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
  await __pwResolveComponent(options);
  const wrapper = /** @type {any} */(element)[wrapperKey];
  if (!wrapper)
    throw new Error('Component was not mounted');

  const component = wrapper.componentInstance;
  if (!component)
    throw new Error('Updating a native HTML element is not supported');

  const { nodeData, slots } = __pwCreateComponent(options);

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
