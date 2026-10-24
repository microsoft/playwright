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
  // See https://github.com/microsoft/playwright/issues/14047
  'AvoidUnnecessaryBeforeUnloadCheckSync',
  'DestroyProfileOnBrowserClose',
  // Hides the Lens feature in the URL address bar. Its not working in unofficial builds.
  'LensOverlay',
  // See https://github.com/microsoft/playwright/pull/8162
  'MediaRouter',
  // See https://github.com/microsoft/playwright/issues/28023
  'PaintHolding',
  // See https://github.com/microsoft/playwright/issues/32230
  'ThirdPartyStoragePartitioning',
  // Chromium 155 aborts preflighted cross-origin redirects with net::ERR_ABORTED while
  // Fetch interception is enabled. See https://github.com/microsoft/playwright/issues/43242
  'AvoidCorsURLLoaderRestartOnRedirect',
  // Avoids intermittent ERR_NO_BUFFER_SPACE failures on Windows (https://crbug.com/572515601).
  'TcpPortRandomizationWin',
  // Prevents downloading optimization hints on startup.
  'OptimizationHints',
  // Prevents network time queries to clients2.google.com on startup.
  'NetworkTimeServiceQuerying',
  // Prevents AI Mode eligibility requests to www.google.com on startup.
  'AimEnabled',
  // Prevents preconnects to the default search engine (www.google.com) on startup.
  // See https://github.com/microsoft/playwright/issues/42910
  'PreconnectToSearch',
  // Disables forced sign-in in Edge.
  'msForceBrowserSignIn',
  // Disables updating the preferred version in LaunchServices preferences on mac.
  'msEdgeUpdateLaunchServicesPreferredVersion',
].filter(Boolean);

const enabledFeatures = () => [
  process.env.PLAYWRIGHT_LEGACY_SCREENSHOT ? '' : 'CDPScreenshotNewSurface',
  // Prevents /ListAccounts requests to accounts.google.com on startup.
  // See https://github.com/microsoft/playwright/issues/42910 and https://issues.chromium.org/565837024
  'SkipListAccountsWithoutGaiaCookies',
].filter(Boolean);

export const chromiumSwitches = (options?: { android?: boolean }) => [
  '--disable-field-trial-config', // https://source.chromium.org/chromium/chromium/src/+/main:testing/variations/README.md
  '--disable-background-networking',
  '--disable-background-timer-throttling',
  '--disable-backgrounding-occluded-windows',
  '--disable-back-forward-cache', // Avoids surprises like main request not being intercepted during page.goBack().
  '--disable-breakpad',
  '--disable-component-extensions-with-background-pages',
  '--disable-component-update', // Avoids unneeded network activity after startup.
  '--no-default-browser-check',
  '--disable-default-apps',
  '--disable-dev-shm-usage',
  '--disable-edgeupdater', // Disables Edge-specific updater on mac.
  '--disable-extensions',
  '--disable-features=' + disabledFeatures.join(','),
  '--enable-features=' + enabledFeatures().join(','),
  '--allow-pre-commit-input',
  '--disable-hang-monitor',
  '--disable-ipc-flooding-protection',
  '--disable-popup-blocking',
  '--disable-prompt-on-repost',
  '--disable-renderer-backgrounding',
  '--disable-updater-scheduler', // Prevents Edge-specific updater from being launched when Edge is launched on mac.
  '--force-color-profile=srgb',
  '--metrics-recording-only',
  '--no-first-run',
  '--password-store=basic',
  '--use-mock-keychain',
  // See https://chromium-review.googlesource.com/c/chromium/src/+/2436773
  '--no-service-autorun',
  // https://chromium-review.googlesource.com/c/chromium/src/+/4853540
  '--disable-search-engine-choice-screen',
  // https://issues.chromium.org/41491762
  '--unsafely-disable-devtools-self-xss-warnings',
  // See https://issues.chromium.org/issues/40277080
  '--enable-unsafe-swiftshader',
  // Edge can potentially restart on Windows (msRelaunchNoCompatLayer) which looses its file descriptors (stdout/stderr) and CDP (3/4). Disable until fixed upstream.
  '--edge-skip-compat-layer-relaunch',
  // Chrome for Testing enables the stack sampling profiler, which crashes the browser on Windows
  // when it unwinds the main thread. See https://github.com/microsoft/playwright/issues/43327
  '--disable-stack-profiler',
  // This disables Chrome for Testing infobar that is visible in the persistent context.
  // The switch is ignored everywhere else, including Chromium/Chrome/Edge.
  '--disable-infobars',
  // Prevents the "three dots" menu crash in IdentityManager::HasPrimaryAccount for ephemeral contexts.
  options?.android ? '' : '--disable-sync',
  // Prevents relaunching as non-admin when started from an elevated process on Windows.
  // See https://issues.chromium.org/u/1/issues/435410220
  '--do-not-de-elevate',
].filter(Boolean);
