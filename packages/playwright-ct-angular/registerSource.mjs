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

/** @typedef {import('../playwright-ct-core/types/component').ObjectComponent} ObjectComponent */

import 'zone.js';
import { reflectComponentType } from '@angular/core';
import { getTestBed, TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';

/** @type {WeakMap<import('@angular/core/testing').ComponentFixture, Record<string, import('rxjs').Subscription>>} */
const __pwOutputSubscriptionRegistry = new WeakMap();

/** @type {Map<string, import('@angular/core/testing').ComponentFixture>} */
const __pwFixtureRegistry = new Map();

getTestBed().initTestEnvironment(
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting(),
);

/**
 * @param {ObjectComponent} component
 */
async function __pwRenderComponent(component) {
  const componentMetadata = reflectComponentType(component.type);
  if (!componentMetadata?.isStandalone)
    throw new Error('Only standalone components are supported');

  TestBed.configureTestingModule({
    imports: [component.type],
  });

  await TestBed.compileComponents();

  const fixture = TestBed.createComponent(component.type);
  fixture.nativeElement.id = 'root';

  __pwUpdateProps(fixture, component.props);
  __pwUpdateEvents(fixture, component.on);

  fixture.autoDetectChanges();

  return fixture;
}

/**
 * @param {import('@angular/core/testing').ComponentFixture} fixture
 */
function __pwUpdateProps(fixture, props = {}) {
  for (const [name, value] of Object.entries(props))
    fixture.componentRef.setInput(name, value);
}

/**
 * @param {import('@angular/core/testing').ComponentFixture} fixture
 */
function __pwUpdateEvents(fixture, events = {}) {
  const outputSubscriptionRecord =
    __pwOutputSubscriptionRegistry.get(fixture) ?? {};
  for (const [name, listener] of Object.entries(events)) {
    /* Unsubscribe previous listener. */
    outputSubscriptionRecord[name]?.unsubscribe();

    const subscription = fixture.componentInstance[
        name
    ].subscribe((/** @type {unknown} */ event) => listener(event));

    /* Store new subscription. */
    outputSubscriptionRecord[name] = subscription;
  }

  /* Update output subscription registry. */
  __pwOutputSubscriptionRegistry.set(fixture, outputSubscriptionRecord);
}

window.playwrightMount = async (component, rootElement, hooksConfig) => {
  if (component.__pw_type === 'jsx')
    throw new Error('JSX mount notation is not supported');

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

  /* Unsubscribe from all outputs. */
  for (const subscription of Object.values(__pwOutputSubscriptionRegistry.get(fixture) ?? {}))
    subscription?.unsubscribe();
  __pwOutputSubscriptionRegistry.delete(fixture);

  fixture.destroy();
  fixture.nativeElement.replaceChildren();
};

window.playwrightUpdate = async (rootElement, component) => {
  if (component.__pw_type === 'jsx')
    throw new Error('JSX mount notation is not supported');

  const fixture = __pwFixtureRegistry.get(rootElement.id);
  if (!fixture)
    throw new Error('Component was not mounted');

  __pwUpdateProps(fixture, component.props);
  __pwUpdateEvents(fixture, component.on);

  fixture.detectChanges();
};
