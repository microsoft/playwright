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

import type {
  TestType,
  PlaywrightTestArgs,
  PlaywrightTestConfig as BasePlaywrightTestConfig,
  PlaywrightTestOptions,
  PlaywrightWorkerArgs,
  PlaywrightWorkerOptions,
  Locator,
} from '@playwright/test';
import type { JsonObject } from '@playwright/experimental-ct-core/types/component';
import type { InlineConfig } from 'vite';
import type { Provider, Type } from '@angular/core';

export type PlaywrightTestConfig<T = {}, W = {}> = Omit<BasePlaywrightTestConfig<T, W>, 'use'> & {
  use?: BasePlaywrightTestConfig<T, W>['use'] & {
    ctPort?: number;
    ctTemplateDir?: string;
    ctCacheDir?: string;
    ctViteConfig?: InlineConfig | (() => Promise<InlineConfig>);
  };
};

type ComponentEvents = Record<string, Function>;

export interface MountOptions<HooksConfig extends JsonObject, Component> {
  props?: Partial<Component> | Record<string, unknown>, // TODO: filter props and handle signals
  providers?: Provider[],
  on?: ComponentEvents;
  hooksConfig?: HooksConfig;
}

export interface MountTemplateOptions<HooksConfig extends JsonObject, Component> extends MountOptions<HooksConfig, Component> {
  imports?: Type<unknown>[];
}

interface MountResult<Component> extends Locator {
  unmount(): Promise<void>;
  update(options: {
    props?: Partial<Component>,
    on?: Partial<ComponentEvents>,
  }): Promise<void>;
}

export interface ComponentFixtures {
  mount<HooksConfig extends JsonObject, Component = unknown>(
    template: string,
    options?: MountTemplateOptions<HooksConfig, Component>
  ): Promise<MountResult<Component>>;
  mount<HooksConfig extends JsonObject, Component = unknown>(
    component: Type<Component>,
    options?: MountOptions<HooksConfig, Component>
  ): Promise<MountResult<Component>>;
}

export const test: TestType<
  PlaywrightTestArgs & PlaywrightTestOptions & ComponentFixtures,
  PlaywrightWorkerArgs & PlaywrightWorkerOptions
>;

export function defineConfig(config: PlaywrightTestConfig): PlaywrightTestConfig;
export function defineConfig<T>(config: PlaywrightTestConfig<T>): PlaywrightTestConfig<T>;
export function defineConfig<T, W>(config: PlaywrightTestConfig<T, W>): PlaywrightTestConfig<T, W>;

export { expect, devices } from '@playwright/test';
