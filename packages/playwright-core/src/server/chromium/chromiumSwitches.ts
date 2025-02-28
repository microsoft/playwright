/**
 * Copyright 2017 Google Inc. All rights reserved.
 * Modifications copyright (c) Microsoft Corporation.
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

// No dependencies as it is used from the Electron loader.

const disabledFeatures = [
  // See https://github.com/microsoft/playwright/pull/10380
  'AcceptCHFrame',
  // See https://github.com/microsoft/playwright/pull/10679
  'AutoExpandDetailsElement',
  // See https://github.com/microsoft/playwright/issues/14047
  'AvoidUnnecessaryBeforeUnloadCheckSync',
  // See https://github.com/microsoft/playwright/pull/12992
  'CertificateTransparencyComponentUpdater',
  // This makes Page.frameScheduledNavigation arrive much later after a click,
  // making our navigation auto-wait after click not working.
  // Can be removed once we deperecate noWaitAfter.
  // See https://github.com/microsoft/playwright/pull/34372.
  'DeferRendererTasksAfterInput',
  'DestroyProfileOnBrowserClose',
  // See https://github.com/microsoft/playwright/pull/13854
  'DialMediaRouteProvider',
  // Chromium is disabling manifest version 2. Allow testing it as long as Chromium can actually run it.
  // Disabled in https://chromium-review.googlesource.com/c/chromium/src/+/6265903.
  'ExtensionManifestV2Disabled',
  'GlobalMediaControls',
  // See https://github.com/microsoft/playwright/pull/27605
  'HttpsUpgrades',
  'ImprovedCookieControls',
  'LazyFrameLoading',
  // Hides the Lens feature in the URL address bar. Its not working in unofficial builds.
  'LensOverlay',
  // See https://github.com/microsoft/playwright/pull/8162
  'MediaRouter',
  // See https://github.com/microsoft/playwright/issues/28023
  'PaintHolding',
  // See https://github.com/microsoft/playwright/issues/32230
  'ThirdPartyStoragePartitioning',
  // See https://github.com/microsoft/playwright/issues/16126
  'Translate',
];

export const chromiumSwitches = [
  '--disable-field-trial-config', // https://source.chromium.org/chromium/chromium/src/+/main:testing/variations/README.md
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-back-forward-cache', // Avoids surprises like main request not being intercepted during page.goBack().
  '--disable-breakpad',
  '--disable-client-side-phishing-detection',
  '--disable-component-extensions-with-background-pages',
  '--disable-component-update', // Avoids unneeded network activity after startup.
  '--no-default-browser-check',
  '--disable-default-apps',
  '--disable-dev-shm-usage',
  '--disable-extensions',
  '--disable-features=' + disabledFeatures.join(','),
  '--allow-pre-commit-input',
  '--disable-hang-monitor',
  '--disable-ipc-flooding-protection',
  '--disable-popup-blocking',
  '--disable-prompt-on-repost',
  '--disable-renderer-backgrounding',
  '--force-color-profile=srgb',
  '--metrics-recording-only',
  '--no-first-run',
  '--enable-automation',
  '--password-store=basic',
  '--use-mock-keychain',
  // See https://chromium-review.googlesource.com/c/chromium/src/+/2436773
  '--no-service-autorun',
  '--export-tagged-pdf',
  // https://chromium-review.googlesource.com/c/chromium/src/+/4853540
  '--disable-search-engine-choice-screen',
  // https://issues.chromium.org/41491762
  '--unsafely-disable-devtools-self-xss-warnings',
];
