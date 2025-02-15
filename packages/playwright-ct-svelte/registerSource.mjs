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

import { asClassComponent } from 'svelte/legacy';
import { createRawSnippet } from "svelte";

/** @typedef {import('../playwright-ct-core/types/component').Component} Component */
/** @typedef {import('../playwright-ct-core/types/component').ObjectComponent} ObjectComponent */
/** @typedef {import('svelte').SvelteComponent} SvelteComponent */
/** @typedef {import('svelte').ComponentType} ComponentType */

/**
 * @param {any} component
 * @returns {component is ObjectComponent}
 */
function isObjectComponent(component) {
  return typeof component === 'object' && component && component.__pw_type === 'object-component';
}

/** @type {( component: ObjectComponent ) => Record<string, any>} */
function extractParams(component) {
  let {props, slots, on} = component;

  slots = Object.fromEntries(
    Object.entries(slots ?? {}).map(([key, snippet]) => {
      if(typeof snippet === "string") {
        console.log("ugraded", key);
        return [key, createRawSnippet(() => ({render: () => snippet}))];
      }

      return [key, snippet]
    })
  );

  on = Object.fromEntries(
    Object.entries(on ?? {}).map(([key, fn]) => {
      return [`on${key}`, fn]
    })
  );

  return {...props, ...slots, ...on};
}

const __pwSvelteComponentKey = Symbol('svelteComponent');

window.playwrightMount = async (component, rootElement, hooksConfig) => {
  if (!isObjectComponent(component))
    throw new Error('JSX mount notation is not supported');

  const componentCtor = asClassComponent(component.type);

  class App extends componentCtor {
    constructor(options = {}) {
      if (!isObjectComponent(component))
        throw new Error('JSX mount notation is not supported');

      super({
        target: rootElement,
        props: extractParams(component),
        ...options
      });
    }
  }

  /** @type {SvelteComponent | undefined} */
  let svelteComponent;
  for (const hook of window.__pw_hooks_before_mount || []) {
    svelteComponent = await hook({ hooksConfig, App });
  }

  if (!svelteComponent) {
    svelteComponent = new App();
  }

  rootElement[__pwSvelteComponentKey] = svelteComponent;

  for (const hook of window.__pw_hooks_after_mount || [])
    await hook({ hooksConfig, svelteComponent });
};

window.playwrightUnmount = async rootElement => {
  const svelteComponent = /** @type {SvelteComponent} */ (rootElement[__pwSvelteComponentKey]);
  if (!svelteComponent)
    throw new Error('Component was not mounted');
  svelteComponent.$destroy();
  delete rootElement[__pwSvelteComponentKey];
};

window.playwrightUpdate = async (rootElement, component) => {
  if (!isObjectComponent(component))
    throw new Error('JSX mount notation is not supported');

  const svelteComponent = /** @type {SvelteComponent} */ (rootElement[__pwSvelteComponentKey]);
  if (!svelteComponent)
    throw new Error('Component was not mounted');

  svelteComponent.$set(extractParams(component));
};
