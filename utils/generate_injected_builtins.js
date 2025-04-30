/**
 * Copyright (c) Microsoft Corporation. All rights reserved.
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

// IMPORTANT: This file should match javascript.ts and utilityScript.ts
const gSetTimeout = globalThis.__playwright_utility_script__$runtime_guid$?.builtins.setTimeout ?? globalThis.setTimeout;
const gClearTimeout = globalThis.__playwright_utility_script__$runtime_guid$?.builtins.clearTimeout ?? globalThis.clearTimeout;
const gSetInterval = globalThis.__playwright_utility_script__$runtime_guid$?.builtins.setInterval ?? globalThis.setInterval;
const gClearInterval = globalThis.__playwright_utility_script__$runtime_guid$?.builtins.clearInterval ?? globalThis.clearInterval;
const gRequestAnimationFrame = globalThis.__playwright_utility_script__$runtime_guid$?.builtins.requestAnimationFrame ?? globalThis.requestAnimationFrame;
const gCancelAnimationFrame = globalThis.__playwright_utility_script__$runtime_guid$?.builtins.cancelAnimationFrame ?? globalThis.cancelAnimationFrame;
const gRequestIdleCallback = globalThis.__playwright_utility_script__$runtime_guid$?.builtins.requestIdleCallback ?? globalThis.requestIdleCallback;
const gCancelIdleCallback = globalThis.__playwright_utility_script__$runtime_guid$?.builtins.cancelIdleCallback ?? globalThis.cancelIdleCallback;
const gPerformance = globalThis.__playwright_utility_script__$runtime_guid$?.builtins.performance ?? globalThis.performance;
const gEval = globalThis.__playwright_utility_script__$runtime_guid$?.builtins.eval ?? globalThis.eval;
const gIntl = globalThis.__playwright_utility_script__$runtime_guid$?.builtins.Intl ?? globalThis.Intl;
const gDate = globalThis.__playwright_utility_script__$runtime_guid$?.builtins.Date ?? globalThis.Date;
const gMap = globalThis.__playwright_utility_script__$runtime_guid$?.builtins.Map ?? globalThis.Map;
const gSet = globalThis.__playwright_utility_script__$runtime_guid$?.builtins.Set ?? globalThis.Set;

export {
  gSetTimeout as 'setTimeout',
  gClearTimeout as 'clearTimeout',
  gSetInterval as 'setInterval',
  gClearInterval as 'clearInterval',
  gRequestAnimationFrame as 'requestAnimationFrame',
  gCancelAnimationFrame as 'cancelAnimationFrame',
  gRequestIdleCallback as 'requestIdleCallback',
  gCancelIdleCallback as 'cancelIdleCallback',
  gPerformance as 'performance',
  gEval as 'eval',
  gIntl as 'Intl',
  gDate as 'Date',
  gMap as 'Map',
  gSet as 'Set',
};
