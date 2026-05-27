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

import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import { baseTest } from '../config/baseTest';
import { loadWebViewExpectations, shouldSkipWebViewTest, type WebViewExpectation } from './expectationUtil';
import type { PageTestFixtures, PageWorkerFixtures } from '../page/pageTestApi';
export { expect } from '@playwright/test';

const PROXY_BASE = process.env.PW_WEBVIEW_PROXY_BASE || 'http://localhost:9222';

type WebViewWorkerFixtures = PageWorkerFixtures & {
  webviewExpectations: Map<string, WebViewExpectation>;
  webviewEndpoint: string;
};

type WebViewTestFixtures = PageTestFixtures & {
  _autoSkipWebView: void;
};

type ProxyTab = { url: string; webSocketDebuggerUrl: string };

function bootedSimulatorUdid(): string | undefined {
  const out = spawnSync('xcrun', ['simctl', 'list', 'devices', 'booted', '-j'], { encoding: 'utf8' });
  if (out.status !== 0)
    return undefined;
  try {
    const data = JSON.parse(out.stdout);
    for (const runtime of Object.values<any>(data.devices)) {
      for (const dev of runtime) {
        if (dev.state === 'Booted')
          return dev.udid;
      }
    }
  } catch {}
  return undefined;
}

async function sleep(ms: number) {
  await new Promise(r => setTimeout(r, ms));
}

async function listTabs(): Promise<ProxyTab[]> {
  try {
    const res = await fetch(`${PROXY_BASE}/json`);
    if (!res.ok)
      return [];
    return await res.json() as ProxyTab[];
  } catch {
    return [];
  }
}

// Wipe Safari's tab-restore + session state so a relaunch doesn't reopen
// whatever a prior worker left behind. Limited to Library/Safari and
// Library/SafariView — caches and prefs untouched.
function clearMobileSafariState(udid: string): void {
  const out = spawnSync('xcrun', ['simctl', 'get_app_container', udid, 'com.apple.mobilesafari', 'data'], { encoding: 'utf8' });
  if (out.status !== 0)
    return;
  const dataDir = out.stdout.trim();
  if (!dataDir || !fs.existsSync(dataDir))
    return;
  for (const sub of ['Library/Safari', 'Library/SafariView']) {
    const target = path.join(dataDir, sub);
    if (fs.existsSync(target))
      fs.rmSync(target, { recursive: true, force: true });
  }
}

async function resetMobileSafari(udid: string): Promise<void> {
  spawnSync('xcrun', ['simctl', 'terminate', udid, 'com.apple.mobilesafari']);
  // Let the proxy drop the dead tabs before wiping state and relaunching.
  const drained = Date.now() + 30000;
  while (Date.now() < drained && (await listTabs()).length > 0)
    await sleep(1000);
  clearMobileSafariState(udid);
  spawnSync('xcrun', ['simctl', 'launch', udid, 'com.apple.mobilesafari', 'about:blank']);
}

async function discoverEndpoint(deadlineMs: number): Promise<string> {
  let last: ProxyTab[] = [];
  while (Date.now() < deadlineMs) {
    last = await listTabs();
    // Prefer the about:blank tab the worker fixture just launched. Fall back
    // to any tab with a usable webSocketDebuggerUrl — the per-test page
    // fixture closes extras and navigates to about:blank.
    const aboutBlank = last.find(t => t.url === 'about:blank' && t.webSocketDebuggerUrl);
    if (aboutBlank)
      return aboutBlank.webSocketDebuggerUrl;
    await sleep(500);
  }
  const any = last.find(t => t.webSocketDebuggerUrl);
  if (any)
    return any.webSocketDebuggerUrl;
  throw new Error(`No webview tab visible on ${PROXY_BASE}/json after waiting. Last response: ${JSON.stringify(last)}`);
}

export const webviewTest = baseTest.extend<WebViewTestFixtures, WebViewWorkerFixtures>({
  browserVersion: ['', { scope: 'worker' }],
  browserMajorVersion: [0, { scope: 'worker' }],
  electronMajorVersion: [0, { scope: 'worker' }],
  isBidi: [false, { scope: 'worker' }],
  isAndroid: [false, { scope: 'worker' }],
  isElectron: [false, { scope: 'worker' }],
  isHeadlessShell: [false, { scope: 'worker' }],
  isFrozenWebkit: [false, { scope: 'worker' }],

  webviewExpectations: [async ({}, run, workerInfo) => {
    await run(loadWebViewExpectations(workerInfo.project.name));
  }, { scope: 'worker' }],

  // Reset Mobile Safari and discover the WebKit RDP endpoint at the start of
  // every worker. Failing tests from a prior worker can't leave a stuck modal,
  // an orphan tab, or restored session state lying around for the next worker
  // to inherit. The returned endpoint feeds the page fixture.
  webviewEndpoint: [async ({}, run) => {
    const udid = bootedSimulatorUdid();
    if (udid)
      await resetMobileSafari(udid);
    const endpoint = await discoverEndpoint(Date.now() + 120000);
    await run(endpoint);
  }, { scope: 'worker', timeout: 180000 }],

  page: async ({ playwright, webviewEndpoint }, run) => {
    const browser = await playwright.webkit.connectOverCDP(webviewEndpoint);
    const [context] = browser.contexts();
    const pages = context.pages();
    await Promise.all(pages.slice(1).map(p => p.close().catch(() => {})));
    const page = pages[0];
    if (!page)
      throw new Error('No Mobile Safari tab is attached');
    await page.goto('about:blank').catch(() => {});
    await run(page);
    await browser.close();
  },

  _autoSkipWebView: [async ({ webviewExpectations }, run, testInfo) => {
    if (process.env.PWTEST_DISABLE_WEBVIEW_EXPECTATIONS !== undefined) {
      await run();
      return;
    }
    const outcome = shouldSkipWebViewTest(testInfo.titlePath, webviewExpectations);
    if (outcome)
      testInfo.fixme(true, `webview expectation: ${outcome}`);
    await run();
  }, { auto: true }],
});
