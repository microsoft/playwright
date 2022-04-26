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

import { createApp, setDevtoolsHook, h } from 'vue';

const registry = new Map();
let instance = { createApp, setDevtoolsHook, h };

export default (components, options) => {
  if (options)
    instance = options;
  for (const [name, value] of Object.entries(components))
    registry.set(name, value);
};

const allListeners = [];

function render(component) {
  if (typeof component === 'string')
    return component;

  let componentFunc = registry.get(component.type);
  if (!componentFunc) {
    // Lookup by shorthand.
    for (const [name, value] of registry) {
      if (component.type.endsWith(`_${name}_vue`)) {
        componentFunc = value;
        break;
      }
    }
  }

  if (!componentFunc && component.type[0].toUpperCase() === component.type[0])
    throw new Error(`Unregistered component: ${component.type}. Following components are registered: ${[...registry.keys()]}`);

  componentFunc = componentFunc || component.type;

  const isVueComponent = componentFunc !== component.type;

  const children = [];
  const slots = {};
  const listeners = {};
  let props = {};

  if (component.kind === 'jsx') {
    for (const child of component.children || []) {
      if (child.type === 'template') {
        const slotProperty = Object.keys(child.props).find(k => k.startsWith('v-slot:'));
        const slot = slotProperty ? slotProperty.substring('v-slot:'.length) : 'default';
        slots[slot] = child.children.map(render);
      } else {
        children.push(render(child));
      }
    }

    for (const [key, value] of Object.entries(component.props)) {
      if (key.startsWith('v-on:')) {
        const event = key.substring('v-on:'.length);
        if (isVueComponent)
          listeners[event] = value;
        else
          props[`on${event[0].toUpperCase()}${event.substring(1)}`] = value;
      } else {
        props[key] = value;
      }
    }
  }

  if (component.kind === 'object') {
    // Vue test util syntax.
    for (const [key, value] of Object.entries(component.options.slots || {})) {
      if (key === 'default')
        children.push(value);
      else
        slots[key] = value;
    }
    props = component.options.props || {};
    for (const [key, value] of Object.entries(component.options.on || {}))
      listeners[key] = value;
  }

  let lastArg;
  if (Object.entries(slots).length) {
    lastArg = slots;
    if (children.length)
      slots.default = children;
  } else if (children.length) {
    lastArg = children;
  }

  const wrapper = instance.h(componentFunc, props, lastArg);
  allListeners.push([wrapper, listeners]);
  return wrapper;
}

function createDevTools() {
  return {
    emit(eventType, ...payload) {
      if (eventType === 'component:emit') {
        const [, componentVM, event, eventArgs] = payload;
        for (const [wrapper, listeners] of allListeners) {
          if (wrapper.component !== componentVM)
            continue;
          const listener = listeners[event];
          if (!listener)
            return;
          listener(...eventArgs);
        }
      }
    }
  };
}

window.playwrightMount = async component => {
  if (!document.getElementById('root')) {
    const rootElement = document.createElement('div');
    rootElement.id = 'root';
    document.body.append(rootElement);
  }
  const app = instance.createApp({
    render: () => render(component)
  });
  instance.setDevtoolsHook(createDevTools(), {});
  app.mount('#root');
  return '#root > *';
};
