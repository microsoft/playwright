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

import { spawn, spawnSync, type ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';

import { baseTest } from '../config/baseTest';
import { loadWebViewExpectations, shouldSkipWebViewTest, type WebViewExpectation } from './expectationUtil';
import type { PageTestFixtures, PageWorkerFixtures } from '../page/pageTestApi';
export { expect } from '@playwright/test';

const PROXY_BASE = process.env.PW_WEBVIEW_PROXY_BASE || 'http://localhost:9222';

// WebKitGTK / WPE: which browser to launch with its remote inspector HTTP server.
// Any WebKitGTK or WPE app works (Epiphany, MiniBrowser, Cog, ...). Override the
// binary with PW_WEBVIEW_BROWSER and pass extra args via PW_WEBVIEW_BROWSER_ARGS,
// e.g. PW_WEBVIEW_BROWSER=epiphany PW_WEBVIEW_BROWSER_ARGS="--private-instance".
const DEFAULT_WEBKITGTK_BROWSER = '/usr/lib/x86_64-linux-gnu/webkitgtk-6.0/MiniBrowser';

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

// WebKitGTK binds its inspector server on a numeric IP (parsed with
// g_inet_socket_address_new_from_string), and only on that single address. Using
// "localhost" would both fail to bind and let Node's fetch try ::1 first while the
// server listens on 127.0.0.1 only. Normalize to a numeric IP everywhere.
const GTK_PROXY_BASE = (() => {
  const u = new URL(PROXY_BASE);
  if (u.hostname === 'localhost')
    u.hostname = '127.0.0.1';
  return u.origin;
})();

// WEBKIT_INSPECTOR_HTTP_SERVER expects a bare host:port.
function inspectorHttpAddress(): string {
  const u = new URL(GTK_PROXY_BASE);
  return `${u.hostname}:${u.port || '9222'}`;
}

// Launch a WebKitGTK/WPE browser with its remote inspector HTTP server enabled.
function launchWebKitGTKBrowser(): ChildProcess {
  const command = process.env.PW_WEBVIEW_BROWSER || DEFAULT_WEBKITGTK_BROWSER;
  const extraArgs = process.env.PW_WEBVIEW_BROWSER_ARGS ? process.env.PW_WEBVIEW_BROWSER_ARGS.split(' ').filter(Boolean) : [];
  return spawn(command, [...extraArgs, 'about:blank'], {
    env: {
      ...process.env,
      WEBKIT_INSPECTOR_HTTP_SERVER: inspectorHttpAddress(),
      // WebKit's bubblewrap sandbox needs an unprivileged user namespace, which
      // distros like Ubuntu 24.04 deny to unconfined processes
      // (kernel.apparmor_restrict_unprivileged_userns=1) — bwrap then fails with
      // "setting up uid map: Permission denied". The browser is a throwaway test
      // target, so disable the sandbox to run regardless of the host policy.
      WEBKIT_DISABLE_SANDBOX_THIS_IS_DANGEROUS: '1',
    },
    stdio: 'ignore',
  });
}

// The WebKitGTK/WPE remote inspector publishes targets as an HTML page at `/`,
// each with a `/socket/<connectionID>/<targetID>/WebPage` link. Wait until at
// least one page target shows up, then hand the HTTP base to connectOverCDP.
async function waitForWebKitGTKTarget(deadlineMs: number): Promise<void> {
  let lastError = '';
  while (Date.now() < deadlineMs) {
    try {
      const res = await fetch(`${GTK_PROXY_BASE}/`);
      if (res.ok && /\/socket\/\d+\/\d+\/WebPage/.test(await res.text()))
        return;
    } catch (e) {
      lastError = String(e);
    }
    await sleep(500);
  }
  throw new Error(`No WebPage target appeared at ${GTK_PROXY_BASE}/ within timeout. ${lastError}`);
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

  // Discover the WebKit RDP endpoint at the start of every worker and feed it to
  // the page fixture. Two transports are supported:
  //  - iOS Simulator (macOS): Mobile Safari driven through ios_webkit_debug_proxy.
  //    Reset Safari first so a prior worker can't leave a stuck modal, an orphan
  //    tab, or restored session state behind.
  //  - WebKitGTK / WPE (Linux): launch a browser with its remote inspector HTTP
  //    server (Epiphany, MiniBrowser, ...) and tear it down when the worker ends.
  webviewEndpoint: [async ({}, run) => {
    const udid = process.platform === 'darwin' ? bootedSimulatorUdid() : undefined;
    if (udid) {
      await resetMobileSafari(udid);
      const endpoint = await discoverEndpoint(Date.now() + 120000);
      await run(endpoint);
      return;
    }
    const browser = launchWebKitGTKBrowser();
    try {
      await waitForWebKitGTKTarget(Date.now() + 60000);
      // connectOverCDP discovers the page target(s) from the HTML listing itself.
      await run(GTK_PROXY_BASE);
    } finally {
      // Sandboxed browsers (e.g. the Epiphany snap) refuse signals from outside
      // their confinement, so a failed kill must not fail the worker.
      try {
        browser.kill('SIGKILL');
      } catch {}
    }
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
