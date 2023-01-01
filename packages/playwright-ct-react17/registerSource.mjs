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

import React from 'react';
import ReactDOM from 'react-dom';

/** @typedef {import('../playwright-test/types/component').Component} Component */
/** @typedef {import('react').FunctionComponent} FrameworkComponent */

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
 * @returns {JSX.Element}
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

  if (!componentFunc && component.type[0].toUpperCase() === component.type[0])
    throw new Error(`Unregistered component: ${component.type}. Following components are registered: ${[...registry.keys()]}`);

  const componentFuncOrString = componentFunc || component.type;

  if (component.kind !== 'jsx')
    throw new Error('Object mount notation is not supported');

  return React.createElement(componentFuncOrString, component.props, ...component.children.map(child => {
    if (typeof child === 'string')
      return child;
    return render(child);
  }).filter(child => {
    if (typeof child === 'string')
      return !!child.trim();
    return true;
  }));
}

window.playwrightMount = async (component, rootElement, hooksConfig) => {
  let App = () => render(component);
  for (const hook of window.__pw_hooks_before_mount || []) {
    const wrapper = await hook({ App, hooksConfig });
    if (wrapper)
      App = () => wrapper;
  }

  ReactDOM.render(App(), rootElement);

  for (const hook of window.__pw_hooks_after_mount || [])
    await hook({ hooksConfig });
};

window.playwrightUnmount = async rootElement => {
  if (!ReactDOM.unmountComponentAtNode(rootElement))
    throw new Error('Component was not mounted');
};

window.playwrightUpdate = async (rootElement, component) => {
  ReactDOM.render(render(/** @type {Component} */(component)), rootElement);
};
