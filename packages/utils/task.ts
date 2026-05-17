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

// See https://joel.tools/microtasks/
export function makeWaitForNextTask() {
  // Electron's setImmediate doesn't yield a new macrotask in some renderer/main
  // contexts (https://github.com/electron/electron/issues/28261), so fall back
  // to setTimeout(0) when running under Electron.
  if ((process.versions as any).electron)
    return (callback: () => void) => setTimeout(callback, 0);
  return setImmediate;
}
