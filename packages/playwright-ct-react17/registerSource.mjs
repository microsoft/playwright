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

// Don't clash with the user land.
import __pwReact from 'react';
import __pwReactDOM from 'react-dom';

/** @typedef {import('../playwright-test/types/experimentalComponent').Component} Component */
/** @typedef {import('react').FunctionComponent} FrameworkComponent */

/** @type {Map<string, Promise<FrameworkComponent>} */
const __pwRegistry = new Map();

/** @type {Map<string, FrameworkComponent} */
const __pwRegistryResolved = new Map();

/**
 * @param {{[key: string]: () => Promise<FrameworkComponent>}} components
 */
export function pwRegister(components) {
  for (const [name, value] of Object.entries(components))
    __pwRegistry.set(name, value);
}

/**
 * @param {Component} component
 */
async function __pwResolveAllComponents(component) {
  if (typeof component !== 'object' || Array.isArray(component))
    return

  let __pwRegistryKey = component.type

  let componentLoaderFunc = __pwRegistry.get(component.type);

  if (!componentLoaderFunc) {
    // Lookup by shorthand.
    for (const [name, value] of __pwRegistry) {
      if (component.type.endsWith(`_${name}`)) {
        __pwRegistryKey = name
        componentLoaderFunc = value;
        break;
      }
    }
  }

  if(componentLoaderFunc) {
    __pwRegistryResolved.set(__pwRegistryKey, await componentLoaderFunc())
  } else {
    __pwRegistryResolved.set(__pwRegistryKey, component.type)
  }

  await Promise.all(component.children.map(child => __pwResolveAllComponents(child)))
}

/**
 * @param {Component} component
 */
function __pwRender(component) {
  if (typeof component !== 'object' || Array.isArray(component))
    return component;

  let componentFunc = __pwRegistryResolved.get(component.type);
  if (!componentFunc) {
    // Lookup by shorthand.
    for (const [name, value] of __pwRegistryResolved) {
      if (component.type.endsWith(`_${name}`)) {
        componentFunc = value;
        break;
      }
    }
  }

  if (!componentFunc && component.type[0].toUpperCase() === component.type[0])
    throw new Error(`Unregistered component: ${component.type}. Following components are registered: ${[...__pwRegistryResolved.keys()]}`);

  const componentFuncOrString = componentFunc || component.type;

  if (component.kind !== 'jsx')
    throw new Error('Object mount notation is not supported');

  return __pwReact.createElement(componentFuncOrString, component.props, ...component.children.map(child => {
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
  await __pwResolveAllComponents(component);
  let App = () => __pwRender(component);
  for (const hook of window.__pw_hooks_before_mount || []) {
    const wrapper = await hook({ App, hooksConfig });
    if (wrapper)
      App = () => wrapper;
  }

  __pwReactDOM.render(App(), rootElement);

  for (const hook of window.__pw_hooks_after_mount || [])
    await hook({ hooksConfig });
};

window.playwrightUnmount = async rootElement => {
  if (!__pwReactDOM.unmountComponentAtNode(rootElement))
    throw new Error('Component was not mounted');
};

window.playwrightUpdate = async (rootElement, component) => {
  await __pwResolveAllComponents(component);
  __pwReactDOM.render(__pwRender(/** @type {Component} */(component)), rootElement);
};
