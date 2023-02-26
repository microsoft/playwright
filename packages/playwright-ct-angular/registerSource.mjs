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
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { EventEmitter, reflectComponentType, Component as defineComponent } from '@angular/core';
import { Router } from '@angular/router';

/** @typedef {import('../playwright-test/types/component').Component} Component */
/** @typedef {import('@angular/core').Type} FrameworkComponent */

/** @type {Map<string, FrameworkComponent>} */
const registry = new Map();
/** @type {Map<string, import('@angular/core/testing').ComponentFixture>} */
const fixtureRegistry = new Map();

getTestBed().initTestEnvironment(
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting()
);

/**
 * @param {{[key: string]: FrameworkComponent}} components
 */
export function register(components) {
  for (const [name, value] of Object.entries(components))
    registry.set(name, value);
}

/**
 * @param {import('@angular/core/testing').ComponentFixture} fixture
 */
function updateProps(fixture, props = {}) {
  for (const [name, value] of Object.entries(props))
    fixture.debugElement.children[0].context[name] = value;
}

/**
 * @param {import('@angular/core/testing').ComponentFixture} fixture
 */
function updateEvents(fixture, events = {}) {
  for (const [name, value] of Object.entries(events)) {
    fixture.debugElement.children[0].componentInstance[name] = {
      ...new EventEmitter(),
      emit: event => value(event)
    };
  }
}

function updateSlots(Component, slots = {}, tag) {
  const wrapper = document.createElement('div');
  for (const [key, value] of Object.entries(slots)) {
    let slotElements;
    if (typeof value !== 'object')
      slotElements = [createSlot(value)];

    if (Array.isArray(value))
      slotElements = value.map(createSlot);

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

  TestBed.overrideTemplate(Component, `<${tag}>${wrapper.innerHTML}</${tag}>`);
}

/**
 * @param {any} value
 * @return {?HTMLElement}
 */
function createSlot(value) {
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
async function renderComponent(component) {
  let Component = registry.get(component.type);
  if (!Component) {
    // Lookup by shorthand.
    for (const [name, value] of registry) {
      if (component.type.endsWith(`_${name}`)) {
        Component = value;
        break;
      }
    }
  }

  if (!Component)
    throw new Error(`Unregistered component: ${component.type}. Following components are registered: ${[...registry.keys()]}`);

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
    imports: [Component, BrowserAnimationsModule],
    declarations: [WrapperComponent]
  });

  await TestBed.compileComponents();

  updateSlots(WrapperComponent, component.options?.slots, componentMetadata.selector);

  // TODO: only inject when router is provided
  TestBed.inject(Router).initialNavigation();

  const fixture = TestBed.createComponent(WrapperComponent);
  fixture.nativeElement.id = 'root';

  updateProps(fixture, component.options?.props);
  updateEvents(fixture, component.options?.on);

  fixture.autoDetectChanges();

  return fixture;
}

window.playwrightMount = async (component, rootElement, hooksConfig) => {
  for (const hook of window.__pw_hooks_before_mount || [])
    await hook({ hooksConfig, TestBed });

  const fixture = await renderComponent(component);

  for (const hook of window.__pw_hooks_after_mount || [])
    await hook({ hooksConfig });

  fixtureRegistry.set(rootElement.id, fixture);
};

window.playwrightUnmount = async rootElement => {
  const fixture = fixtureRegistry.get(rootElement.id);
  if (!fixture)
    throw new Error('Component was not mounted');

  fixture.destroy();
  fixture.nativeElement.replaceChildren();
};

window.playwrightUpdate = async (rootElement, component) => {
  if (component.kind === 'jsx')
    throw new Error('JSX mount notation is not supported');

  const fixture = fixtureRegistry.get(rootElement.id);
  if (!fixture)
    throw new Error('Component was not mounted');

  updateProps(fixture, component.options?.props);
  updateEvents(fixture, component.options?.on);

  fixture.detectChanges();
};
