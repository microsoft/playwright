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

import { createApp as __pwCreateApp, setDevtoolsHook as __pwSetDevtoolsHook, h as __pwH } from 'vue';
import { compile as __pwCompile } from '@vue/compiler-dom';
import * as __pwVue from 'vue';

/** @typedef {import('@playwright/test/types/experimentalComponent').Component} Component */
/** @typedef {import('vue').Component} FrameworkComponent */

/** @type {Map<string, FrameworkComponent>} */
const __pwRegistry = new Map();

/**
 * @param {{[key: string]: FrameworkComponent}} components
 */
export function pwRegister(components) {
  for (const [name, value] of Object.entries(components))
    __pwRegistry.set(name, value);
}

const __pwAllListeners = new Map();

/**
 * @param {Component | string} child
 * @returns {import('vue').VNode | string}
 */
function __pwCreateChild(child) {
  return typeof child === 'string' ? child : __pwCreateWrapper(child);
}

/**
 * Copied from: https://github.com/vuejs/test-utils/blob/main/src/utils/compileSlots.ts
 * Vue does not provide an easy way to compile template in "slot" mode
 * Since we do not want to rely on compiler internals and specify
 * transforms manually we create fake component invocation with the slot we
 * need and pick slots param from render function later. Fake component will
 * never be instantiated but it requires to be a component so compile
 * properly generate invocation. Since we do not want to monkey-patch
 * `resolveComponent` function we are just using one of built-in components.
 *
 * @param {string} html
 */
function __pwCreateSlot(html) {
  let template = html.trim();
  const hasWrappingTemplate = template && template.startsWith('<template');

  // allow content without `template` tag, for easier testing
  if (!hasWrappingTemplate)
    template = `<template #default="params">${template}</template>`;

  const { code } = __pwCompile(`<transition>${template}</transition>`, {
    mode: 'function',
    prefixIdentifiers: false
  });
  const createRenderFunction = new Function('Vue', code);
  const renderFn = createRenderFunction(__pwVue);
  return (ctx = {}) => {
    const result = renderFn(ctx);
    const slotName = Object.keys(result.children)[0];
    return result.children[slotName](ctx);
  };
}

function __pwSlotToFunction(slot) {
  if (typeof slot === 'string')
    return __pwCreateSlot(slot)();

  if (Array.isArray(slot))
    return slot.map(slot => __pwCreateSlot(slot)());

  throw Error(`Invalid slot received.`);
}

/**
 * @param {Component} component
 */
function __pwCreateComponent(component) {
  if (typeof component === 'string')
    return component;

  /**
   * @type {import('vue').Component | string | undefined}
   */
  let componentFunc = __pwRegistry.get(component.type);
  if (!componentFunc) {
    // Lookup by shorthand.
    for (const [name, value] of __pwRegistry) {
      if (component.type.endsWith(`_${name}_vue`)) {
        componentFunc = value;
        break;
      }
    }
  }

  if (!componentFunc && component.type[0].toUpperCase() === component.type[0])
    throw new Error(`Unregistered component: ${component.type}. Following components are registered: ${[...__pwRegistry.keys()]}`);

  componentFunc = componentFunc || component.type;

  const isVueComponent = componentFunc !== component.type;

  /**
   * @type {(import('vue').VNode | string)[]}
   */
  const children = [];
  /** @type {{[key: string]: any}} */
  const slots = {};
  const listeners = {};
  /** @type {{[key: string]: any}} */
  let props = {};

  if (component.kind === 'jsx') {
    for (const child of component.children || []) {
      if (typeof child !== 'string' && child.type === 'template' && child.kind === 'jsx') {
        const slotProperty = Object.keys(child.props).find(k => k.startsWith('v-slot:'));
        const slot = slotProperty ? slotProperty.substring('v-slot:'.length) : 'default';
        slots[slot] = child.children.map(__pwCreateChild);
      } else {
        children.push(__pwCreateChild(child));
      }
    }

    for (const [key, value] of Object.entries(component.props)) {
      if (key.startsWith('v-on:')) {
        const event = key.substring('v-on:'.length);
        if (isVueComponent)
          listeners[event] = value;
        else
          props[`on${event[0].toUpperCase()}${event.substring(1)}`] = value;
      } else {
        props[key] = value;
      }
    }
  }

  if (component.kind === 'object') {
    // Vue test util syntax.
    for (const [key, value] of Object.entries(component.options?.slots || {})) {
      if (key === 'default')
        children.push(__pwSlotToFunction(value));
      else
        slots[key] = __pwSlotToFunction(value);
    }
    props = component.options?.props || {};
    for (const [key, value] of Object.entries(component.options?.on || {}))
      listeners[key] = value;
  }

  let lastArg;
  if (Object.entries(slots).length) {
    lastArg = slots;
    if (children.length)
      slots.default = children;
  } else if (children.length) {
    lastArg = children;
  }

  return { Component: componentFunc, props, slots: lastArg, listeners };
}

function __pwWrapFunctions(slots) {
  const slotsWithRenderFunctions = {};
  if (!Array.isArray(slots)) {
    for (const [key, value] of Object.entries(slots || {}))
      slotsWithRenderFunctions[key] = () => [value];
  } else if (slots?.length) {
    slots['default'] = () => slots;
  }
  return slotsWithRenderFunctions;
}

/**
 * @param {Component} component
 * @returns {import('vue').VNode | string}
 */
function __pwCreateWrapper(component) {
  const { Component, props, slots, listeners } = __pwCreateComponent(component);
  // @ts-ignore
  const wrapper = __pwH(Component, props, slots);
  __pwAllListeners.set(wrapper, listeners);
  return wrapper;
}

/**
 * @returns {any}
 */
function __pwCreateDevTools() {
  return {
    emit(eventType, ...payload) {
      if (eventType === 'component:emit') {
        const [, componentVM, event, eventArgs] = payload;
        for (const [wrapper, listeners] of __pwAllListeners) {
          if (wrapper.component !== componentVM)
            continue;
          const listener = listeners[event];
          if (!listener)
            return;
          listener(...eventArgs);
        }
      }
    }
  };
}

const __pwAppKey = Symbol('appKey');
const __pwWrapperKey = Symbol('wrapperKey');

window.playwrightMount = async (component, rootElement, hooksConfig) => {
  const app = __pwCreateApp({
    render: () => {
      const wrapper = __pwCreateWrapper(component);
      rootElement[__pwWrapperKey] = wrapper;
      return wrapper;
    }
  });
  __pwSetDevtoolsHook(__pwCreateDevTools(), {});

  for (const hook of window.__pw_hooks_before_mount || [])
    await hook({ app, hooksConfig });
  const instance = app.mount(rootElement);
  rootElement[__pwAppKey] = app;

  for (const hook of window.__pw_hooks_after_mount || [])
    await hook({ app, hooksConfig, instance });
};

window.playwrightUnmount = async rootElement => {
  const app = /** @type {import('vue').App} */ (rootElement[__pwAppKey]);
  if (!app)
    throw new Error('Component was not mounted');
  app.unmount();
};

window.playwrightUpdate = async (rootElement, options) => {
  const wrapper = rootElement[__pwWrapperKey];
  if (!wrapper)
    throw new Error('Component was not mounted');

  const { slots, listeners, props } = __pwCreateComponent(options);

  wrapper.component.slots = __pwWrapFunctions(slots);
  __pwAllListeners.set(wrapper, listeners);

  for (const [key, value] of Object.entries(props))
    wrapper.component.props[key] = value;

  if (!Object.keys(props).length)
    wrapper.component.update();
};
