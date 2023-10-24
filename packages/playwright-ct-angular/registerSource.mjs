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

import 'zone.js';
import { getTestBed, TestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
import { EventEmitter, reflectComponentType, Component as defineComponent } from '@angular/core';
import { Router } from '@angular/router';

/** @typedef {import('@playwright/experimental-ct-core/types/component').Component} Component */
/** @typedef {import('@playwright/experimental-ct-core/types/component').JsxComponent} JsxComponent */
/** @typedef {import('@playwright/experimental-ct-core/types/component').ObjectComponent} ObjectComponent */
/** @typedef {import('@angular/core').Type} FrameworkComponent */

/** @type {Map<string, () => Promise<FrameworkComponent>>} */
const __pwLoaderRegistry = new Map();
/** @type {Map<string, FrameworkComponent>} */
const __pwRegistry = new Map();
/** @type {Map<string, import('@angular/core/testing').ComponentFixture>} */
const __pwFixtureRegistry = new Map();

getTestBed().initTestEnvironment(
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting(),
);

/**
 * @param {{[key: string]: () => Promise<FrameworkComponent>}} components
 */
export function pwRegister(components) {
  for (const [name, value] of Object.entries(components))
    __pwLoaderRegistry.set(name, value);
}

/**
 * @param {Component} component
 * @returns {component is JsxComponent | ObjectComponent}
 */
function isComponent(component) {
  return !(typeof component !== 'object' || Array.isArray(component));
}

/**
 * @param {Component} component
 */
async function __pwResolveComponent(component) {
  if (!isComponent(component))
    return;

  let componentFactory = __pwLoaderRegistry.get(component.type);
  if (!componentFactory) {
    // Lookup by shorthand.
    for (const [name, value] of __pwLoaderRegistry) {
      if (component.type.endsWith(`_${name}`)) {
        componentFactory = value;
        break;
      }
    }
  }

  if (!componentFactory && component.type[0].toUpperCase() === component.type[0])
    throw new Error(`Unregistered component: ${component.type}. Following components are registered: ${[...__pwRegistry.keys()]}`);

  if(componentFactory)
    __pwRegistry.set(component.type, await componentFactory())

  if ('children' in component)
    await Promise.all(component.children.map(child => __pwResolveComponent(child)))
}

/**
 * @param {import('@angular/core/testing').ComponentFixture} fixture
 */
function __pwUpdateProps(fixture, props = {}) {
  for (const [name, value] of Object.entries(props))
    fixture.debugElement.children[0].context[name] = value;
}

/**
 * @param {import('@angular/core/testing').ComponentFixture} fixture
 */
function __pwUpdateEvents(fixture, events = {}) {
  for (const [name, value] of Object.entries(events)) {
    fixture.debugElement.children[0].componentInstance[name] = {
      ...new EventEmitter(),
      emit: event => value(event)
    };
  }
}

function __pwUpdateSlots(Component, slots = {}, tagName) {
  const wrapper = document.createElement(tagName);
  for (const [key, value] of Object.entries(slots)) {
    let slotElements;
    if (typeof value !== 'object')
      slotElements = [__pwCreateSlot(value)];

    if (Array.isArray(value))
      slotElements = value.map(__pwCreateSlot);

    if (!slotElements)
      throw new Error(`Invalid slot with name: \`${key}\` supplied to \`mount()\``);

    for (const slotElement of slotElements) {
      if (!slotElement)
        throw new Error(`Invalid slot with name: \`${key}\` supplied to \`mount()\``);

      if (key === 'default') {
        wrapper.appendChild(slotElement);
        continue;
      }

      if (slotElement.nodeName === '#text') {
        throw new Error(
            `Invalid slot with name: \`${key}\` supplied to \`mount()\`, expected \`HTMLElement\` but received \`TextNode\`.`
        );
      }

      slotElement.setAttribute(key, '');
      wrapper.appendChild(slotElement);
    }
  }

  TestBed.overrideTemplate(Component, wrapper.outerHTML);
}

/**
 * @param {any} value
 * @return {?HTMLElement}
 */
function __pwCreateSlot(value) {
  return /** @type {?HTMLElement} */ (
    document
        .createRange()
        .createContextualFragment(value)
        .firstChild
  );
}

/**
 * @param {Component} component
 */
async function __pwRenderComponent(component) {
  const Component = __pwRegistry.get(component.type);
  if (!Component)
    throw new Error(`Unregistered component: ${component.type}. Following components are registered: ${[...__pwRegistry.keys()]}`);

  if (component.kind !== 'object')
    throw new Error('JSX mount notation is not supported');

  const componentMetadata = reflectComponentType(Component);
  if (!componentMetadata?.isStandalone)
    throw new Error('Only standalone components are supported');

  const WrapperComponent = defineComponent({
    selector: 'pw-wrapper-component',
    template: ``,
  })(class {});

  TestBed.configureTestingModule({
    imports: [Component],
    declarations: [WrapperComponent]
  });

  await TestBed.compileComponents();

  __pwUpdateSlots(WrapperComponent, component.options?.slots, componentMetadata.selector);

  // TODO: only inject when router is provided
  TestBed.inject(Router).initialNavigation();

  const fixture = TestBed.createComponent(WrapperComponent);
  fixture.nativeElement.id = 'root';

  __pwUpdateProps(fixture, component.options?.props);
  __pwUpdateEvents(fixture, component.options?.on);

  fixture.autoDetectChanges();

  return fixture;
}

window.playwrightMount = async (component, rootElement, hooksConfig) => {
  await __pwResolveComponent(component);
  for (const hook of window.__pw_hooks_before_mount || [])
    await hook({ hooksConfig, TestBed });

  const fixture = await __pwRenderComponent(component);

  for (const hook of window.__pw_hooks_after_mount || [])
    await hook({ hooksConfig });

  __pwFixtureRegistry.set(rootElement.id, fixture);
};

window.playwrightUnmount = async rootElement => {
  const fixture = __pwFixtureRegistry.get(rootElement.id);
  if (!fixture)
    throw new Error('Component was not mounted');

  fixture.destroy();
  fixture.nativeElement.replaceChildren();
};

window.playwrightUpdate = async (rootElement, component) => {
  await __pwResolveComponent(component);
  if (component.kind === 'jsx')
    throw new Error('JSX mount notation is not supported');

  if (component.options?.slots)
    throw new Error('Update slots is not supported yet');

  const fixture = __pwFixtureRegistry.get(rootElement.id);
  if (!fixture)
    throw new Error('Component was not mounted');

  __pwUpdateProps(fixture, component.options?.props);
  __pwUpdateEvents(fixture, component.options?.on);

  fixture.detectChanges();
};
