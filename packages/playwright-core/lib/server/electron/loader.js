"use strict";

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

const {
  app
} = require('electron');
const {
  chromiumSwitches
} = require('../chromium/chromiumSwitches');

// Always pass user arguments first, see https://github.com/microsoft/playwright/issues/16614 and
// https://github.com/microsoft/playwright/issues/29198.
// [Electron, -r, loader.js[, --no-sandbox>], --inspect=0, --remote-debugging-port=0, ...args]
process.argv.splice(1, process.argv.indexOf('--remote-debugging-port=0'));
for (const arg of chromiumSwitches) {
  const match = arg.match(/--([^=]*)=?(.*)/);
  app.commandLine.appendSwitch(match[1], match[2]);
}

// Defer ready event.
const originalWhenReady = app.whenReady();
const originalEmit = app.emit.bind(app);
let readyEventArgs;
app.emit = (event, ...args) => {
  if (event === 'ready') {
    readyEventArgs = args;
    return app.listenerCount('ready') > 0;
  }
  return originalEmit(event, ...args);
};
let isReady = false;
let whenReadyCallback;
const whenReadyPromise = new Promise(f => whenReadyCallback = f);
app.isReady = () => isReady;
app.whenReady = () => whenReadyPromise;
globalThis.__playwright_run = async () => {
  // Wait for app to be ready to avoid browser initialization races.
  const event = await originalWhenReady;
  isReady = true;
  whenReadyCallback(event);
  originalEmit('ready', ...readyEventArgs);
};