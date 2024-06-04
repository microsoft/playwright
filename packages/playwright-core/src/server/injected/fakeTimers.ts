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

// @ts-ignore
import SinonFakeTimers from '../../third_party/fake-timers-src';

export function inject() {
  // eslint-disable-next-line no-restricted-globals
  const window = globalThis;
  const builtin = {
    setTimeout: window.setTimeout.bind(window),
    clearTimeout: window.clearTimeout.bind(window),
    setInterval: window.setInterval.bind(window),
    clearInterval: window.clearInterval.bind(window),
    requestAnimationFrame: window.requestAnimationFrame.bind(window),
    cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
    requestIdleCallback: window.requestIdleCallback?.bind(window),
    cancelIdleCallback: window.cancelIdleCallback?.bind(window),
    performance: window.performance,
    Intl: window.Intl,
    Date: window.Date,
  };
  const result = SinonFakeTimers;
  result.builtin = builtin;
  return result;
}
