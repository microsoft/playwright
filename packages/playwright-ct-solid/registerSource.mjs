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

import { render as solidRender, createComponent as solidCreateComponent } from 'solid-js/web';
import h from 'solid-js/h';

/** @typedef {import('../playwright-test/types/component').Component} Component */
/** @typedef {() => import('solid-js').JSX.Element} FrameworkComponent */

/** @type {Map<string, FrameworkComponent>} */
const registry = new Map();

/**
 * @param {{[key: string]: FrameworkComponent}} components
 */
export function register(components) {
  for (const [name, value] of Object.entries(components))
    registry.set(name, value);
}

function createChild(child) {
  return typeof child === 'string' ? child : createComponent(child);
}

/**
 * @param {Component} component
 */
function createComponent(component) {
  if (typeof component === 'string')
    return component;

  let Component = registry.get(component.type);
  if (!Component) {
    // Lookup by shorthand.
    for (const [name, value] of registry) {
      if (component.type.endsWith(`_${name}`)) {
        Component = value;
        break;
      }
    }
  }

  if (!Component && component.type[0].toUpperCase() === component.type[0])
    throw new Error(`Unregistered component: ${component.type}. Following components are registered: ${[...registry.keys()]}`);

  if (component.kind !== 'jsx')
    throw new Error('Object mount notation is not supported');

  const children = component.children.reduce((/** @type {any[]} */ children, current) => {
    const child = createChild(current);
    if (typeof child !== 'string' || !!child.trim())
      children.push(child);
    return children;
  }, []);

  if (!Component)
    return h(component.type, component.props, children);

  return solidCreateComponent(Component, { ...component.props, children });
}

const unmountKey = Symbol('unmountKey');

window.playwrightMount = async (component, rootElement, hooksConfig) => {
  let App = () => createComponent(component);
  for (const hook of window.__pw_hooks_before_mount || []) {
    const wrapper = await hook({ App, hooksConfig });
    if (wrapper)
      App = () => wrapper;
  }

  const unmount = solidRender(App, rootElement);
  rootElement[unmountKey] = unmount;

  for (const hook of window.__pw_hooks_after_mount || [])
    await hook({ hooksConfig });
};

window.playwrightUnmount = async rootElement => {
  const unmount = rootElement[unmountKey];
  if (!unmount)
    throw new Error('Component was not mounted');

  unmount();
};

window.playwrightUpdate = async (rootElement, component) => {
  window.playwrightUnmount(rootElement);
  window.playwrightMount(component, rootElement, {});
};
