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

import __pwReact from 'react';
import { createRoot as __pwCreateRoot } from 'react-dom/client';
/** @typedef {import('../playwright-ct-core/types/component').JsxComponent} JsxComponent */

/** @type {Map<Element, import('react-dom/client').Root>} */
const __pwRootRegistry = new Map();

/**
 * @param {any} component
 * @returns {component is JsxComponent}
 */
function isJsxComponent(component) {
  return typeof component === 'object' && component && component.__pw_type === 'jsx';
}

/**
 * @param {any} value
 */
function __pwRender(value) {
  return window.__pwTransformObject(value, v => {
    if (isJsxComponent(v)) {
      const component = v;
      const props = component.props ? __pwRender(component.props) : {};
      return { result: __pwReact.createElement(/** @type { any } */ (component.type), { ...props, children: undefined }, props.children) };
    }
  });
}

window.playwrightMount = async (component, rootElement, hooksConfig) => {
  if (!isJsxComponent(component))
    throw new Error('Object mount notation is not supported');

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
  if (!isJsxComponent(component))
    throw new Error('Object mount notation is not supported');

  const root = __pwRootRegistry.get(rootElement);
  if (root === undefined)
    throw new Error('Component was not mounted');

  root.render(__pwRender(component));
};
