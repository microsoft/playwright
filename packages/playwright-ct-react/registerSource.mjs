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

import * as __pwReact from 'react';
import { createRoot as __pwCreateRoot } from 'react-dom/client';

/** @typedef {import('../playwright-ct-core/types/component').Component} Component */
/** @typedef {import('../playwright-ct-core/types/component').JsxComponent} JsxComponent */
/** @typedef {import('../playwright-ct-core/types/component').ObjectComponent} ObjectComponent */
/** @typedef {import('react').FunctionComponent} FrameworkComponent */

/** @type {Map<string, () => Promise<FrameworkComponent>>} */
const __pwLoaderRegistry = new Map();
/** @type {Map<string, FrameworkComponent>} */
const __pwRegistry = new Map();
/** @type {Map<Element, import('react-dom/client').Root>} */
const __pwRootRegistry = new Map();

/**
 * @param {{[key: string]: () => Promise<FrameworkComponent>}} components
 */
export function pwRegister(components) {
  for (const [name, value] of Object.entries(components))
    __pwLoaderRegistry.set(name, value);
}

/**
 * @param {Component} component
 * @returns {component is JsxComponent | ObjectComponent}
 */
function isComponent(component) {
  return !(typeof component !== 'object' || Array.isArray(component));
}

/**
 * @param {Component} component
 */
async function __pwResolveComponent(component) {
  if (!isComponent(component))
    return

  let componentFactory = __pwLoaderRegistry.get(component.type);
  if (!componentFactory) {
    // Lookup by shorthand.
    for (const [name, value] of __pwLoaderRegistry) {
      if (component.type.endsWith(`_${name}`)) {
        componentFactory = value;
        break;
      }
    }
  }

  if (!componentFactory && component.type[0].toUpperCase() === component.type[0])
    throw new Error(`Unregistered component: ${component.type}. Following components are registered: ${[...__pwRegistry.keys()]}`);

  if(componentFactory)
    __pwRegistry.set(component.type, await componentFactory())

  if ('children' in component)
    await Promise.all(component.children.map(child => __pwResolveComponent(child)))
}

/**
 * @param {Component} component
 */
function __pwRender(component) {
  if (!isComponent(component))
    return component;

  const componentFunc = __pwRegistry.get(component.type);

  if (component.kind !== 'jsx')
    throw new Error('Object mount notation is not supported');

  return __pwReact.createElement(componentFunc || component.type, component.props, ...component.children.map(child => {
    if (typeof child === 'string')
      return child;
    return __pwRender(child);
  }).filter(child => {
    if (typeof child === 'string')
      return !!child.trim();
    return true;
  }));
}

window.playwrightMount = async (component, rootElement, hooksConfig) => {
  await __pwResolveComponent(component);
  let App = () => __pwRender(component);
  for (const hook of window.__pw_hooks_before_mount || []) {
    const wrapper = await hook({ App, hooksConfig });
    if (wrapper)
      App = () => wrapper;
  }

  if (__pwRootRegistry.has(rootElement)) {
    throw new Error(
        'Attempting to mount a component into an container that already has a React root'
    );
  }

  const root = __pwCreateRoot(rootElement);
  __pwRootRegistry.set(rootElement, root);
  root.render(App());

  for (const hook of window.__pw_hooks_after_mount || [])
    await hook({ hooksConfig });
};

window.playwrightUnmount = async rootElement => {
  const root = __pwRootRegistry.get(rootElement);
  if (root === undefined)
    throw new Error('Component was not mounted');

  root.unmount();
  __pwRootRegistry.delete(rootElement);
};

window.playwrightUpdate = async (rootElement, component) => {
  await __pwResolveComponent(component);
  const root = __pwRootRegistry.get(rootElement);
  if (root === undefined)
    throw new Error('Component was not mounted');

  root.render(__pwRender(/** @type {Component} */ (component)));
};
