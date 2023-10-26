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

// @ts-check

// This file is injected into the registry as text, no dependencies are allowed.

import { detach as __pwDetach, insert as __pwInsert, noop as __pwNoop } from 'svelte/internal';

/** @typedef {import('../playwright-ct-core/types/component').Component} Component */
/** @typedef {import('../playwright-ct-core/types/component').ObjectComponent} ObjectComponent */
/** @typedef {any} FrameworkComponent */
/** @typedef {import('svelte').SvelteComponent} SvelteComponent */

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
 * @returns {component is ObjectComponent}
 */
function isComponent(component) {
  return !(typeof component !== 'object' || Array.isArray(component));
}

/**
 * @param {ObjectComponent} component
 */
async function __pwResolveComponent(component) {
  if (!isComponent(component))
    return;

  let componentFactory = __pwLoaderRegistry.get(component.type);
  if (!componentFactory) {
    // Lookup by shorthand.
    for (const [name, value] of __pwLoaderRegistry) {
      if (component.type.endsWith(`_${name}_svelte`)) {
        componentFactory = value;
        break;
      }
    }
  }

  if (!componentFactory)
    throw new Error(`Unregistered component: ${component.type}. Following components are registered: ${[...__pwRegistry.keys()]}`);

  if (componentFactory)
    __pwRegistry.set(component.type, await componentFactory());
}

/**
 * TODO: remove this function when the following issue is fixed:
 * https://github.com/sveltejs/svelte/issues/2588
 */
function __pwCreateSlots(slots) {
  const svelteSlots = {};

  for (const slotName in slots) {
    const template = document
      .createRange()
      .createContextualFragment(slots[slotName]);
    svelteSlots[slotName] = [createSlotFn(template)];
  }

  function createSlotFn(element) {
    return function() {
      return {
        c: __pwNoop,
        m: function mount(target, anchor) {
          __pwInsert(target, element, anchor);
        },
        d: function destroy(detaching) {
          if (detaching) __pwDetach(element);
        },
        l: __pwNoop,
      };
    };
  }
  return svelteSlots;
}

const __pwSvelteComponentKey = Symbol('svelteComponent');

window.playwrightMount = async (component, rootElement, hooksConfig) => {
  if (component.kind !== 'object')
    throw new Error('JSX mount notation is not supported');

  await __pwResolveComponent(component);
  const componentCtor = __pwRegistry.get(component.type);

  class App extends componentCtor {
    constructor(options = {}) {
      super({
        target: rootElement,
        props: {
          ...component.options?.props,
          $$slots: __pwCreateSlots(component.options?.slots),
          $$scope: {},
        },
        ...options
      });
    }
  }

  let svelteComponent;
  for (const hook of window.__pw_hooks_before_mount || [])
    svelteComponent = await hook({ hooksConfig, App });

  if (!svelteComponent)
    svelteComponent = new App();

  rootElement[__pwSvelteComponentKey] = svelteComponent;

  for (const [key, listener] of Object.entries(component.options?.on || {}))
    svelteComponent.$on(key, event => listener(event.detail));

  for (const hook of window.__pw_hooks_after_mount || [])
    await hook({ hooksConfig, svelteComponent });
};

window.playwrightUnmount = async rootElement => {
  const svelteComponent = /** @type {SvelteComponent} */ (rootElement[__pwSvelteComponentKey]);
  if (!svelteComponent)
    throw new Error('Component was not mounted');
  svelteComponent.$destroy();
};

window.playwrightUpdate = async (rootElement, component) => {
  if (component.kind !== 'object')
    throw new Error('JSX mount notation is not supported');

  await __pwResolveComponent(component);
  const svelteComponent = /** @type {SvelteComponent} */ (rootElement[__pwSvelteComponentKey]);
  if (!svelteComponent)
    throw new Error('Component was not mounted');

  for (const [key, listener] of Object.entries(component.options?.on || {}))
    svelteComponent.$on(key, event => listener(event.detail));

  if (component.options?.props)
    svelteComponent.$set(component.options.props);
};
