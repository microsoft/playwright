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
function __pwCreateComponent(value) {
  return window.__pwTransformObject(value, v => {
    if (isJsxComponent(v)) {
      const component = v;
      const props = component.props ? __pwCreateComponent(component.props) : {};
      if (typeof component.type === 'string') {
        const { children, ...propsWithoutChildren } = props;
        return { result: __pwH(component.type, propsWithoutChildren, children) };
      }
      return { result: __pwSolidCreateComponent(component.type, props) };
    }
  });
}

const __pwUnmountKey = Symbol('unmountKey');

window.playwrightMount = async (component, rootElement, hooksConfig) => {
  if (!isJsxComponent(component))
    throw new Error('Object mount notation is not supported');

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
  delete rootElement[__pwUnmountKey];
};

window.playwrightUpdate = async (rootElement, component) => {
  if (!isJsxComponent(component))
    throw new Error('Object mount notation is not supported');

  window.playwrightUnmount(rootElement);
  window.playwrightMount(component, rootElement, {});
};
