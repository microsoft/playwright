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

import { render as __pwSolidRender, createComponent as __pwSolidCreateComponent } from 'solid-js/web';
import __pwH from 'solid-js/h';

/** @typedef {import('../playwright-ct-core/types/component').JsxComponentChild} JsxComponentChild */
/** @typedef {import('../playwright-ct-core/types/component').JsxComponent} JsxComponent */
/** @typedef {() => import('solid-js').JSX.Element} FrameworkComponent */

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
 * @returns {component is JsxComponent}
 */
function isComponent(component) {
  return !(typeof component !== 'object' || Array.isArray(component));
}

/**
 * @param {JsxComponent | JsxComponentChild} component
 */
async function __pwResolveComponent(component) {
  if (!isComponent(component))
    return;

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

  if (componentFactory)
    __pwRegistry.set(component.type, await componentFactory());

  if ('children' in component)
    await Promise.all(component.children.map(child => __pwResolveComponent(child)));
}

function __pwCreateChild(child) {
  return typeof child === 'string' ? child : __pwCreateComponent(child);
}

/**
 * @param {JsxComponent} component
 */
function __pwCreateComponent(component) {
  if (typeof component !== 'object' || Array.isArray(component))
    return component;

  const componentFunc = __pwRegistry.get(component.type);


  const children = component.children.reduce((/** @type {any[]} */ children, current) => {
    const child = __pwCreateChild(current);
    if (Array.isArray(child))
      return child.map(grandChild => __pwCreateChild(grandChild));
    if (typeof child !== 'string' || !!child.trim())
      children.push(child);
    return children;
  }, []);

  if (!componentFunc)
    return __pwH(component.type, component.props, children);

  return __pwSolidCreateComponent(componentFunc, { ...component.props, children });
}

const __pwUnmountKey = Symbol('unmountKey');

window.playwrightMount = async (component, rootElement, hooksConfig) => {
  if (component.kind !== 'jsx')
    throw new Error('Object mount notation is not supported');

  await __pwResolveComponent(component);
  let App = () => __pwCreateComponent(component);
  for (const hook of window.__pw_hooks_before_mount || []) {
    const wrapper = await hook({ App, hooksConfig });
    if (wrapper)
      App = () => wrapper;
  }

  const unmount = __pwSolidRender(App, rootElement);
  rootElement[__pwUnmountKey] = unmount;

  for (const hook of window.__pw_hooks_after_mount || [])
    await hook({ hooksConfig });
};

window.playwrightUnmount = async rootElement => {
  const unmount = rootElement[__pwUnmountKey];
  if (!unmount)
    throw new Error('Component was not mounted');

  unmount();
};

window.playwrightUpdate = async (rootElement, component) => {
  if (component.kind !== 'jsx')
    throw new Error('Object mount notation is not supported');

  window.playwrightUnmount(rootElement);
  window.playwrightMount(component, rootElement, {});
};
