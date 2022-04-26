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

export default components => {
  for (const [name, value] of Object.entries(components))
    registry.set(name, value);
};

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

  componentFunc = componentFunc || component.type;

  return React.createElement(componentFunc, component.props, ...component.children.map(child => {
    if (typeof child === 'string')
      return child;
    return render(child);
  }).filter(child => {
    if (typeof child === 'string')
      return !!child.trim();
    return true;
  }));
}

window.playwrightMount = component => {
  if (!document.getElementById('root')) {
    const rootElement = document.createElement('div');
    rootElement.id = 'root';
    document.body.append(rootElement);
  }
  ReactDOM.render(render(component), document.getElementById('root'));
  return '#root > *';
};
