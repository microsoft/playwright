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

// Runs inside the Electron main process via `electron -r loader.js`.
// Must be self-contained — Electron's main process does not have access
// to playwright-core's bundled deps. Keep the chromium switches list in sync
// with packages/playwright-core/src/server/chromium/chromiumSwitches.ts.

const electronModule = require('electron') as typeof import('electron');

const { app } = electronModule;

const chromiumSwitches = [
  '--disable-field-trial-config',
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-back-forward-cache',
  '--disable-breakpad',
  '--disable-client-side-phishing-detection',
  '--disable-component-extensions-with-background-pages',
  '--disable-component-update',
  '--no-default-browser-check',
  '--disable-default-apps',
  '--disable-dev-shm-usage',
  '--disable-edgeupdater',
  '--disable-extensions',
  '--disable-features=AvoidUnnecessaryBeforeUnloadCheckSync,BoundaryEventDispatchTracksNodeRemoval,DestroyProfileOnBrowserClose,DialMediaRouteProvider,GlobalMediaControls,HttpsUpgrades,LensOverlay,MediaRouter,PaintHolding,ThirdPartyStoragePartitioning,Translate,AutoDeElevate,RenderDocument,OptimizationHints,msForceBrowserSignIn,msEdgeUpdateLaunchServicesPreferredVersion',
  '--enable-features=CDPScreenshotNewSurface',
  '--allow-pre-commit-input',
  '--disable-hang-monitor',
  '--disable-ipc-flooding-protection',
  '--disable-popup-blocking',
  '--disable-prompt-on-repost',
  '--disable-renderer-backgrounding',
  '--force-color-profile=srgb',
  '--metrics-recording-only',
  '--no-first-run',
  '--password-store=basic',
  '--use-mock-keychain',
  '--no-service-autorun',
  '--export-tagged-pdf',
  '--disable-search-engine-choice-screen',
  '--unsafely-disable-devtools-self-xss-warnings',
  '--edge-skip-compat-layer-relaunch',
  '--enable-automation',
  '--disable-infobars',
  '--disable-sync',
];

// The new `chromium.connectToWorker`-based client reads these globals via
// the Node debugger to bootstrap the Electron app.
(globalThis as any).__playwright_electron = electronModule;

// Always pass user arguments first.
// https://github.com/microsoft/playwright/issues/16614
// https://github.com/microsoft/playwright/issues/29198
// argv layout: [Electron, -r, loader.js[, --no-sandbox], --inspect=0, --remote-debugging-port=0, ...userArgs]
process.argv.splice(1, process.argv.indexOf('--remote-debugging-port=0'));

for (const arg of chromiumSwitches) {
  const match = arg.match(/--([^=]*)=?(.*)/)!;
  app.commandLine.appendSwitch(match[1], match[2]);
}

// Defer the `ready` event until the Playwright client has wired up auto-attach.
const originalWhenReady = app.whenReady();
const originalEmit = app.emit.bind(app);
let readyEventArgs: any[];
app.emit = (event: string | symbol, ...args: any[]): boolean => {
  if (event === 'ready') {
    readyEventArgs = args;
    return app.listenerCount('ready') > 0;
  }
  return originalEmit(event, ...args);
};

let isReady = false;
let whenReadyCallback: (event: any) => any;
const whenReadyPromise = new Promise<void>(f => whenReadyCallback = f);
app.isReady = () => isReady;
app.whenReady = () => whenReadyPromise;

(globalThis as any).__playwright_run = async () => {
  // Wait for app to be ready to avoid browser-initialization races.
  const event = await originalWhenReady;
  isReady = true;
  whenReadyCallback(event);
  originalEmit('ready', ...readyEventArgs);
};
