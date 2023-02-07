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

import { detach, insert, noop } from 'svelte/internal';

/** @typedef {import('../playwright-test/types/component').Component} Component */
/** @typedef {any} FrameworkComponent */
/** @typedef {import('svelte').SvelteComponent} SvelteComponent */

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
 * TODO: remove this function when the following issue is fixed:
 * https://github.com/sveltejs/svelte/issues/2588
 */
function createSlots(slots) {
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
        c: noop,
        m: function mount(target, anchor) {
          insert(target, element, anchor);
        },
        d: function destroy(detaching) {
          if (detaching) detach(element);
        },
        l: noop,
      };
    };
  }
  return svelteSlots;
}

const svelteComponentKey = Symbol('svelteComponent');

window.playwrightMount = async (component, rootElement, hooksConfig) => {
  let componentCtor = registry.get(component.type);
  if (!componentCtor) {
    // Lookup by shorthand.
    for (const [name, value] of registry) {
      if (component.type.endsWith(`_${name}_svelte`)) {
        componentCtor = value;
        break;
      }
    }
  }

  if (!componentCtor)
    throw new Error(`Unregistered component: ${component.type}. Following components are registered: ${[...registry.keys()]}`);

  if (component.kind !== 'object')
    throw new Error('JSX mount notation is not supported');


  for (const hook of window.__pw_hooks_before_mount || [])
    await hook({ hooksConfig });

  const svelteComponent = /** @type {SvelteComponent} */ (new componentCtor({
    target: rootElement,
    props: {
      ...component.options?.props,
      $$slots: createSlots(component.options?.slots),
      $$scope: {},
    }
  }));
  rootElement[svelteComponentKey] = svelteComponent;

  for (const [key, listener] of Object.entries(component.options?.on || {}))
    svelteComponent.$on(key, event => listener(event.detail));

  for (const hook of window.__pw_hooks_after_mount || [])
    await hook({ hooksConfig, svelteComponent });
};

window.playwrightUnmount = async rootElement => {
  const svelteComponent = /** @type {SvelteComponent} */ (rootElement[svelteComponentKey]);
  if (!svelteComponent)
    throw new Error('Component was not mounted');
  svelteComponent.$destroy();
};

window.playwrightUpdate = async (rootElement, component) => {
  const svelteComponent = /** @type {SvelteComponent} */ (rootElement[svelteComponentKey]);
  if (!svelteComponent)
    throw new Error('Component was not mounted');

  for (const [key, listener] of Object.entries(component.options?.on || {}))
    svelteComponent.$on(key, event => listener(event.detail));

  if (component.options?.props)
    svelteComponent.$set(component.options.props);
};
