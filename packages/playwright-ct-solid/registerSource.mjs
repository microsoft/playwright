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

import { render as solidRender, createComponent } from 'solid-js/web';

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

/**
 * @param {Component} component
 */
function render(component) {
  let componentFunc = registry.get(component.type);
  if (!componentFunc) {
    // Lookup by shorthand.
    for (const [name, value] of registry) {
      if (component.type.endsWith(`_${name}`)) {
        componentFunc = value;
        break;
      }
    }
  }

  if (!componentFunc)
    throw new Error(`Unregistered component: ${component.type}. Following components are registered: ${[...registry.keys()]}`);

  if (component.kind !== 'jsx')
    throw new Error('Object mount notation is not supported');

  return createComponent(componentFunc, {
    children: component.children,
    ...component.props
  });
}

const unmountKey = Symbol('disposeKey');

window.playwrightMount = async (component, rootElement, hooksConfig) => {
  for (const hook of /** @type {any} */(window).__pw_hooks_before_mount || [])
    await hook({ hooksConfig });

  const unmount = solidRender(() => render(component), rootElement);
  rootElement[unmountKey] = unmount;

  for (const hook of /** @type {any} */(window).__pw_hooks_after_mount || [])
    await hook({ hooksConfig });
};

window.playwrightUnmount = async rootElement => {
  const unmount = rootElement[unmountKey];
  if (!unmount)
    throw new Error('Component was not mounted');

  unmount();
};
