/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const registry = new Map();

export const registerComponent = (name, componentClass) => {
  registry.set(name, componentClass);
};

window.playwrightMount = component => {
  const componentCtor = registry.get(component.type);

  const wrapper = new componentCtor({
    target: document.getElementById('app'),
    props: component.options.props,
  });

  for (const [key, listener] of Object.entries(component.options.on || {}))
    wrapper.$on(key, event => listener(event.detail));
  return '#app';
};
