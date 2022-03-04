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

import React from 'react';
import ReactDOM from 'react-dom';

const registry = new Map();

export const registerComponent = (name, componentFunc) => {
  registry.set(name, componentFunc);
};

function render(component) {
  const componentFunc = registry.get(component.type) || component.type;
  return React.createElement(componentFunc, component.props, ...component.children.map(child => {
    if (typeof child === 'string')
      return child;
    return render(child);
  }));
}

window.playwrightMount = component => {
  ReactDOM.render(render(component), document.getElementById('root'));
  return '#root';
};
