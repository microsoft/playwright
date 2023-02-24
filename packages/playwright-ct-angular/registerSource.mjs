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

import '@angular/compiler';
import 'zone.js';
import { getTestBed, TestBed } from '@angular/core/testing';
import { BrowserDynamicTestingModule, platformBrowserDynamicTesting } from '@angular/platform-browser-dynamic/testing';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { reflectComponentType } from '@angular/core';

/** @typedef {import('../playwright-test/types/component').Component} Component */
/** @typedef {import('@angular/core').Type} FrameworkComponent */

/** @type {Map<string, FrameworkComponent>} */
const registry = new Map();

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
 * @param {Component} component
 */
function renderComponent(component) {
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

  const ngComponent = reflectComponentType(Component);
  if (!ngComponent || !ngComponent.isStandalone)
    throw new Error('Only standalone components are supported');

  TestBed.configureTestingModule({
    imports: [BrowserAnimationsModule]
  });
  const fixture = TestBed.createComponent(Component);
  fixture.nativeElement.id = 'root';

  for (const [name, value] of Object.entries(component.options?.props || {}))
    fixture.componentRef.setInput(name, value);

  fixture.autoDetectChanges();

  return fixture;
}

let fixture;

window.playwrightMount = async (component, rootElement, hooksConfig) => {
  for (const hook of /** @type {any} */(window).__pw_hooks_before_mount || [])
    await hook({ hooksConfig });

  fixture = renderComponent(component);

  for (const hook of /** @type {any} */(window).__pw_hooks_after_mount || [])
    await hook({ hooksConfig });
};

window.playwrightUnmount = async rootElement => {
  if (!fixture)
    throw new Error('Component was not mounted');

  fixture.destroy();
  fixture.nativeElement.replaceChildren();
};
