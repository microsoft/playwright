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

// IMPORTANT: This file should mirror accessUtilityScript() function.
const builtins = WeakSet.prototype.delete[Symbol.for('__playwright_utility_script__$runtime_guid$')]?.builtins;
const gSetTimeout = builtins?.setTimeout ?? globalThis.setTimeout;
const gClearTimeout = builtins?.clearTimeout ?? globalThis.clearTimeout;
const gSetInterval = builtins?.setInterval ?? globalThis.setInterval;
const gClearInterval = builtins?.clearInterval ?? globalThis.clearInterval;
const gRequestAnimationFrame = builtins?.requestAnimationFrame ?? globalThis.requestAnimationFrame;
const gCancelAnimationFrame = builtins?.cancelAnimationFrame ?? globalThis.cancelAnimationFrame;
const gRequestIdleCallback = builtins?.requestIdleCallback ?? globalThis.requestIdleCallback;
const gCancelIdleCallback = builtins?.cancelIdleCallback ?? globalThis.cancelIdleCallback;
const gPerformance = builtins?.performance ?? globalThis.performance;
const gEval = builtins?.eval ?? globalThis.eval;
const gIntl = builtins?.Intl ?? globalThis.Intl;
const gDate = builtins?.Date ?? globalThis.Date;
const gMap = builtins?.Map ?? globalThis.Map;
const gSet = builtins?.Set ?? globalThis.Set;

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
