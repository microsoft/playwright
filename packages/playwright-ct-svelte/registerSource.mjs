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

/** @typedef {import('../playwright-test/types/experimentalComponent').Component} Component */
/** @typedef {any} FrameworkComponent */
/** @typedef {import('svelte').SvelteComponent} SvelteComponent */

/** @type {Map<string, FrameworkComponent>} */
const __pwRegistry = new Map();

/**
 * @param {{[key: string]: FrameworkComponent}} components
 */
export function pwRegister(components) {
  for (const [name, value] of Object.entries(components))
    __pwRegistry.set(name, value);
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
  let componentCtor = __pwRegistry.get(component.type);
  if (!componentCtor) {
    // Lookup by shorthand.
    for (const [name, value] of __pwRegistry) {
      if (component.type.endsWith(`_${name}_svelte`)) {
        componentCtor = value;
        break;
      }
    }
  }

  if (!componentCtor)
    throw new Error(`Unregistered component: ${component.type}. Following components are registered: ${[...__pwRegistry.keys()]}`);

  if (component.kind !== 'object')
    throw new Error('JSX mount notation is not supported');


  for (const hook of window.__pw_hooks_before_mount || [])
    await hook({ hooksConfig });

  const svelteComponent = /** @type {SvelteComponent} */ (new componentCtor({
    target: rootElement,
    props: {
      ...component.options?.props,
      $$slots: __pwCreateSlots(component.options?.slots),
      $$scope: {},
    }
  }));
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
  const svelteComponent = /** @type {SvelteComponent} */ (rootElement[__pwSvelteComponentKey]);
  if (!svelteComponent)
    throw new Error('Component was not mounted');

  for (const [key, listener] of Object.entries(component.options?.on || {}))
    svelteComponent.$on(key, event => listener(event.detail));

  if (component.options?.props)
    svelteComponent.$set(component.options.props);
};
