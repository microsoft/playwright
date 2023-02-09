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

import { createApp, setDevtoolsHook, h } from 'vue';
import { compile } from '@vue/compiler-dom';
import * as Vue from 'vue';

/** @typedef {import('@playwright/test/types/component').Component} Component */
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

const allListeners = new Map();

/**
 * @param {Component | string} child
 * @returns {import('vue').VNode | string}
 */
function createChild(child) {
  return typeof child === 'string' ? child : createWrapper(child);
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
function createSlot(html) {
  let template = html.trim();
  const hasWrappingTemplate = template && template.startsWith('<template');

  // allow content without `template` tag, for easier testing
  if (!hasWrappingTemplate)
    template = `<template #default="params">${template}</template>`;

  const { code } = compile(`<transition>${template}</transition>`, {
    mode: 'function',
    prefixIdentifiers: false
  });
  const createRenderFunction = new Function('Vue', code);
  const renderFn = createRenderFunction(Vue);
  return (ctx = {}) => {
    const result = renderFn(ctx);
    const slotName = Object.keys(result.children)[0];
    return result.children[slotName](ctx);
  };
}

function slotToFunction(slot) {
  if (typeof slot === 'string')
    return createSlot(slot)();

  if (Array.isArray(slot))
    return slot.map(slot => createSlot(slot)());

  throw Error(`Invalid slot received.`);
}

/**
 * @param {Component} component
 */
function createComponent(component) {
  if (typeof component === 'string')
    return component;

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
        slots[slot] = child.children.map(createChild);
      } else {
        children.push(createChild(child));
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
        children.push(slotToFunction(value));
      else
        slots[key] = slotToFunction(value);
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

function wrapFunctions(slots) {
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
function createWrapper(component) {
  const { Component, props, slots, listeners } = createComponent(component);
  // @ts-ignore
  const wrapper = h(Component, props, slots);
  allListeners.set(wrapper, listeners);
  return wrapper;
}

/**
 * @returns {any}
 */
function createDevTools() {
  return {
    emit(eventType, ...payload) {
      if (eventType === 'component:emit') {
        const [, componentVM, event, eventArgs] = payload;
        for (const [wrapper, listeners] of allListeners) {
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

const appKey = Symbol('appKey');
const wrapperKey = Symbol('wrapperKey');

window.playwrightMount = async (component, rootElement, hooksConfig) => {
  const app = createApp({
    render: () => {
      const wrapper = createWrapper(component);
      rootElement[wrapperKey] = wrapper;
      return wrapper;
    }
  });
  setDevtoolsHook(createDevTools(), {});

  for (const hook of window.__pw_hooks_before_mount || [])
    await hook({ app, hooksConfig });
  const instance = app.mount(rootElement);
  rootElement[appKey] = app;

  for (const hook of window.__pw_hooks_after_mount || [])
    await hook({ app, hooksConfig, instance });
};

window.playwrightUnmount = async rootElement => {
  const app = /** @type {import('vue').App} */ (rootElement[appKey]);
  if (!app)
    throw new Error('Component was not mounted');
  app.unmount();
};

window.playwrightUpdate = async (rootElement, options) => {
  const wrapper = rootElement[wrapperKey];
  if (!wrapper)
    throw new Error('Component was not mounted');

  const { slots, listeners, props } = createComponent(options);

  wrapper.component.slots = wrapFunctions(slots);
  allListeners.set(wrapper, listeners);

  for (const [key, value] of Object.entries(props))
    wrapper.component.props[key] = value;

  if (!Object.keys(props).length)
    wrapper.component.update();
};
