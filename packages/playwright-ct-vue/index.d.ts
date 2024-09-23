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

import type { TestType, Locator } from '@playwright/experimental-ct-core';

type ComponentSlot = string | string[];
type ComponentSlots = Record<string, ComponentSlot> & { default?: ComponentSlot };

type ComponentEvents = Record<string, Function>;

// Copied from: https://github.com/vuejs/language-tools/blob/master/packages/vue-component-type-helpers/index.d.ts#L10-L13
type ComponentProps<T> =
	T extends new (...angs: any) => { $props: infer P; } ? NonNullable<P> :
	T extends (props: infer P, ...args: any) => any ? P :
	{};

export interface MountOptions<HooksConfig, Component> {
  props?: ComponentProps<Component>;
  slots?: ComponentSlots;
  on?: ComponentEvents;
  hooksConfig?: HooksConfig;
}

export interface MountOptionsJsx<HooksConfig> {
  hooksConfig?: HooksConfig;
}

export interface MountResult<Component> extends Locator {
  unmount(): Promise<void>;
  update(options: {
    props?: Partial<ComponentProps<Component>>;
    slots?: Partial<ComponentSlots>;
    on?: Partial<ComponentEvents>;
  }): Promise<void>;
}

export interface MountResultJsx extends Locator {
  unmount(): Promise<void>;
  update(component: JSX.Element): Promise<void>;
}

export const test: TestType<{
  mount<HooksConfig>(
    component: JSX.Element,
    options?: MountOptionsJsx<HooksConfig>
  ): Promise<MountResultJsx>;
  mount<HooksConfig, Component = unknown>(
    component: Component,
    options?: MountOptions<HooksConfig, Component>
  ): Promise<MountResult<Component>>;
}>;

export { defineConfig, PlaywrightTestConfig, expect, devices } from '@playwright/experimental-ct-core';
