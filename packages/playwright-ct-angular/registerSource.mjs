// /**
//  * Copyright (c) Microsoft Corporation.
//  *
//  * Licensed under the Apache License, Version 2.0 (the "License");
//  * you may not use this file except in compliance with the License.
//  * You may obtain a copy of the License at
//  *
//  *     http://www.apache.org/licenses/LICENSE-2.0
//  *
//  * Unless required by applicable law or agreed to in writing, software
//  * distributed under the License is distributed on an "AS IS" BASIS,
//  * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//  * See the License for the specific language governing permissions and
//  * limitations under the License.
//  */

// @ts-check
// This file is injected into the registry as text, no dependencies are allowed.

import '@angular/compiler';
import 'zone.js';
import {
  Component as defineComponent,
  reflectComponentType
} from '@angular/core';
import { getTestBed, TestBed } from '@angular/core/testing';
import {
  BrowserDynamicTestingModule,
  platformBrowserDynamicTesting,
} from '@angular/platform-browser-dynamic/testing';
import { Router } from '@angular/router';

getTestBed().initTestEnvironment(
    BrowserDynamicTestingModule,
    platformBrowserDynamicTesting(),
);

window.playwrightMount = async (component, rootElement, hooksConfig) => {
  for (const hook of window.__pw_hooks_before_mount || [])
    await hook({ hooksConfig, TestBed });

  const fixture = await __pwRenderComponent(component);

  for (const hook of window.__pw_hooks_after_mount || [])
    await hook({ hooksConfig });

  __pwFixtureRegistry.set(rootElement.id, fixture);
};

window.playwrightUnmount = async rootElement => {
  const fixture = __pwFixtureRegistry.get(rootElement.id);
  if (!fixture) throw new Error('Component was not mounted');

  /* Unsubscribe from all outputs. */
  for (const subscription of Object.values(__pwOutputSubscriptionRegistry.get(fixture) ?? {}))
    subscription?.unsubscribe();
  __pwOutputSubscriptionRegistry.delete(fixture);

  fixture.destroy();
  fixture.nativeElement.replaceChildren();
};

window.playwrightUpdate = async (rootElement, component) => {
  if (component.slots)
    throw new Error('Update slots is not supported yet');

  const fixture = __pwFixtureRegistry.get(rootElement.id);
  if (!fixture)
    throw new Error('Component was not mounted');

  __pwUpdateProps(fixture, component.props);
  __pwUpdateEvents(fixture, component.on);

  fixture.detectChanges();
};

/** @type {WeakMap<import('@angular/core/testing').ComponentFixture, Record<string, import('rxjs').Subscription>>} */
const __pwOutputSubscriptionRegistry = new WeakMap();

/** @type {Map<string, import('@angular/core/testing').ComponentFixture>} */
const __pwFixtureRegistry = new Map();
/**
 * @param {Component} component
 */
async function __pwRenderComponent(component) {
  const componentClass = component.type;
  if (!componentClass)
    throw new Error(`Unregistered component: ${componentClass}. Following components are registered: ${[...__pwRegistry.keys()]}`);


  const componentMetadata = reflectComponentType(componentClass);
  if (!componentMetadata?.isStandalone)
    throw new Error('Only standalone components are supported');

  const WrapperComponent = defineComponent({
    selector: 'pw-wrapper-component',
    template: ``,
  })(class {});

  TestBed.configureTestingModule({
    imports: [componentClass],
    declarations: [WrapperComponent]
  });

  await TestBed.compileComponents();

  __pwUpdateSlots(WrapperComponent, component.options?.slots, componentMetadata.selector);

  // TODO: only inject when router is provided
  TestBed.inject(Router).initialNavigation();

  const fixture = TestBed.createComponent(WrapperComponent);
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
    fixture.debugElement.children[0].context[name] = value;
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

    const subscription = fixture.debugElement.children[0].componentInstance[
      name
    ].subscribe((event) => listener(event));

    /* Store new subscription. */
    outputSubscriptionRecord[name] = subscription;
  }

  /* Update output subscription registry. */
  __pwOutputSubscriptionRegistry.set(fixture, outputSubscriptionRecord);
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
