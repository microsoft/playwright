/**
 * Copyright (c) Microsoft Corporation.
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

import * as electron from 'electron';

// Electron loader is passed to Electron as --require electronLoader.js and
// defers the app ready event until remote debugging is established.

(async () => {
  const app = electron.app;
  const originalEmitMethod = app.emit.bind(app);
  const originalIsReadyMethod = app.isReady.bind(app);
  const originalWhenReadyMethod = app.whenReady.bind(app);

  const deferredEmits: { event: string | symbol, args: any[] }[] = [];
  let attached = false;
  let isReady = false;
  let readyCallback: () => void;
  const readyPromise = new Promise(f => readyCallback = f);

  app.isReady = () => {
    if (attached)
      return originalIsReadyMethod();
    return isReady;
  };

  app.whenReady = async () => {
    if (attached)
      return originalWhenReadyMethod();
    await readyPromise;
  };

  app.emit = (event: string | symbol, ...args: any[]): boolean => {
    if (attached)
      return originalEmitMethod(event, ...args);
    deferredEmits.push({ event, args });
    return true;
  };

  const playwrightRun = () => {
    while (deferredEmits.length) {
      const emit = deferredEmits.shift();
      if (emit!.event === 'ready') {
        isReady = true;
        readyCallback();
      }
      originalEmitMethod(emit!.event, ...emit!.args);
    }
    attached = true;
    return electron;
  };

  // Resolving the race between the debugger and the boot-time script.
  if ((global as any)._playwrightRunCallback) {
    (global as any)._playwrightRunCallback(playwrightRun());
    return;
  }
  (global as any)._playwrightRun = playwrightRun;
})();
