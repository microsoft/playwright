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

/** @type {Map<Element, { setRenderer: (renderer: any) => void }>} */
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
      const key = component.key ? __pwRender(component.key) : undefined;
      const { children, ...propsWithoutChildren } = props;
      if (key)
        propsWithoutChildren.key = key;
      const createElementArguments = [propsWithoutChildren];
      if (children)
        createElementArguments.push(children);
      return { result: __pwReact.createElement(component.type, ...createElementArguments) };
    }
    if (v && typeof v === 'object' && v.__pw_type === 'map') {
      const map = new Map();
      for (const [k, v] of v.value)
        map.set(k, __pwRender(v));
      return { result: map };
    }
    if (v && typeof v === 'object' && v.__pw_type === 'set') {
      const set = new Set();
      for (const v of v.value)
        set.add(__pwRender(v));
      return { result: set };
    }
  });
}

window.playwrightMount = async (component, rootElement, hooksConfig) => {
  if (!isJsxComponent(component))
    throw new Error('Object mount notation is not supported');
  if (__pwRootRegistry.has(rootElement)) {
    throw new Error(
        'Attempting to mount a component into an container that already has a React root'
    );
  }

  const entry = { setRenderer: () => undefined };
  __pwRootRegistry.set(rootElement, entry);

  const App = () => {
    /** @type {any} */
    const [renderer, setRenderer] = __pwReact.useState(() => __pwRender(component));
    entry.setRenderer = setRenderer;
    return renderer;
  };
  let AppWrapper = App;
  for (const hook of window.__pw_hooks_before_mount || []) {
    const wrapper = await hook({ App: AppWrapper, hooksConfig });
    if (wrapper)
      AppWrapper = () => wrapper;
  }

  __pwReactDOM.render(__pwReact.createElement(AppWrapper), rootElement);

  for (const hook of window.__pw_hooks_after_mount || [])
    await hook({ hooksConfig });
};

window.playwrightUnmount = async rootElement => {
  if (!__pwReactDOM.unmountComponentAtNode(rootElement))
    throw new Error('Component was not mounted');

  __pwRootRegistry.delete(rootElement);
};

window.playwrightUpdate = async (rootElement, component) => {
  if (!isJsxComponent(component))
    throw new Error('Object mount notation is not supported');

  const entry = __pwRootRegistry.get(rootElement);
  if (!entry)
    throw new Error('Component was not mounted');
  entry.setRenderer(() => __pwRender(component));
};