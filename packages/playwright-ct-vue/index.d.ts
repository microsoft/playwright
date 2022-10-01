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
} from "@playwright/test";
import type { InlineConfig } from "vite";
import type { ComponentPublicInstance } from "vue";

export type PlaywrightTestConfig = Omit<BasePlaywrightTestConfig, "use"> & {
  use?: BasePlaywrightTestConfig["use"] & {
    ctPort?: number;
    ctTemplateDir?: string;
    ctCacheDir?: string;
    ctViteConfig?: InlineConfig;
  };
};

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonObject | JsonArray;
type JsonArray = JsonValue[];
type JsonObject = { [Key in string]?: JsonValue };

type Slot = string | string[];

type VueComponent = abstract new (...args: any) => { $props: any };

type ComponentProps<Component extends VueComponent | any> = Component extends VueComponent ? InstanceType<Component>['$props'] : any;

export interface MountOptions<Component extends VueComponent | any> {
  props?: ComponentProps<Component>;
  slots?: Record<string, Slot> & { default?: Slot };
  on?: Record<string, Function>,
  hooksConfig?: JsonObject,
}

interface MountResult<Component = VueComponent | any> extends Locator {
  unmount(): Promise<void>;
  rerender(options: {
    props: ComponentProps<Component>;
  }): Promise<void>;
}

export interface ComponentFixtures {
  mount(component: JSX.Element, options?: { hooksConfig?: any }): Promise<MountResult<any>>;
  mount<Component extends VueComponent | any>(
    component: Component,
    options?: MountOptions<Component>
  ): Promise<MountResult<Component>>;
}

export const test: TestType<
  PlaywrightTestArgs & PlaywrightTestOptions & ComponentFixtures,
  PlaywrightWorkerArgs & PlaywrightWorkerOptions
>;

export { expect, devices } from "@playwright/test";
