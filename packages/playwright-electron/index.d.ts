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
  PlaywrightTestArgs as BasePlaywrightTestArgs,
  PlaywrightTestOptions as BasePlaywrightTestOptions,
  PlaywrightWorkerArgs as BasePlaywrightWorkerArgs,
  PlaywrightWorkerOptions as BasePlaywrightWorkerOptions,
  PlaywrightTestConfig as BasePlaywrightTestConfig,
  TestType as BaseTestType,
} from 'playwright/test';
import type { Electron, ElectronApplication } from './types';

export * from './types';
export { expect, devices, mergeExpects, mergeTests } from 'playwright/test';

export type ElectronAppOptions = Parameters<Electron['launch']>[0];
export type PlaywrightTestOptions = BasePlaywrightTestOptions & {
  appOptions: ElectronAppOptions;
};
export type PlaywrightTestArgs = BasePlaywrightTestArgs & {
  app: ElectronApplication;
};
export type PlaywrightWorkerArgs = Omit<BasePlaywrightWorkerArgs, 'browser'>;
export type PlaywrightWorkerOptions = BasePlaywrightWorkerOptions;

export type TestType<T, W> = BaseTestType<
  PlaywrightTestOptions & PlaywrightTestArgs & T,
  PlaywrightWorkerArgs & PlaywrightWorkerOptions & W,
>;
export const test: TestType<{}, {}>;

export type PlaywrightTestConfig<T = {}, W = {}> = Omit<BasePlaywrightTestConfig<T, W>, 'use'> & {
  use?: BasePlaywrightTestConfig<T, W>['use'] & {
    appOptions?: ElectronAppOptions;
  };
};
export function defineConfig(config: PlaywrightTestConfig): PlaywrightTestConfig;
export function defineConfig<T>(config: PlaywrightTestConfig<T>): PlaywrightTestConfig<T>;
export function defineConfig<T, W>(config: PlaywrightTestConfig<T, W>): PlaywrightTestConfig<T, W>;
export function defineConfig(config: PlaywrightTestConfig, ...configs: PlaywrightTestConfig[]): PlaywrightTestConfig;
export function defineConfig<T>(config: PlaywrightTestConfig<T>, ...configs: PlaywrightTestConfig<T>[]): PlaywrightTestConfig<T>;
export function defineConfig<T, W>(config: PlaywrightTestConfig<T, W>, ...configs: PlaywrightTestConfig<T, W>[]): PlaywrightTestConfig<T, W>;
