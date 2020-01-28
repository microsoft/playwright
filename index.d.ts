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

export * from './lib/api';
export const devices: typeof import('./lib/deviceDescriptors').DeviceDescriptors;
export const errors: { TimeoutError: typeof import('./lib/errors').TimeoutError };
export const chromium: import('./lib/server/chromium').Chromium;
export const firefox: import('./lib/server/firefox').Firefox;
export const webkit: import('./lib/server/webkit').WebKit;
export const selectors: import('./lib/api').Selectors;
export type PlaywrightWeb = typeof import('./lib/web');
