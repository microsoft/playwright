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
export function playwright(browser: 'chromium'): import('./lib/api').ChromiumPlaywright;
export function playwright(browser: 'firefox'): import('./lib/api').FirefoxPlaywright;
export function playwright(browser: 'webkit'): import('./lib/api').WebKitPlaywright;
export function connect(browser: 'chromium'): import('./lib/api').ChromiumBrowser.connect;
