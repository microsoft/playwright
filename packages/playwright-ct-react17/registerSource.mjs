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
import __pwReactDOM from 'react-dom';
/** @typedef {import('../playwright-ct-core/types/component').JsxComponent} JsxComponent */

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
  if (value === null || typeof value !== 'object')
    return value;
  if (isJsxComponent(value)) {
    const component = value;
    const props = component.props ? __pwRender(component.props) : {};
    return __pwReact.createElement(/** @type { any } */ (component.type), { ...props, children: undefined }, props.children);
  }
  if (Array.isArray(value)) {
    const result = [];
    for (const item of value)
      result.push(__pwRender(item));
    return result;
  }
  const result = {};
  for (const [key, prop] of Object.entries(value))
    result[key] = __pwRender(prop);
  return result;
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

  __pwReactDOM.render(App(), rootElement);

  for (const hook of window.__pw_hooks_after_mount || [])
    await hook({ hooksConfig });
};

window.playwrightUnmount = async rootElement => {
  if (!__pwReactDOM.unmountComponentAtNode(rootElement))
    throw new Error('Component was not mounted');
};

window.playwrightUpdate = async (rootElement, component) => {
  if (!isJsxComponent(component))
    throw new Error('Object mount notation is not supported');

  __pwReactDOM.render(__pwRender(component), rootElement);
};
