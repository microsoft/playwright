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

import { type ChildProcess, spawn, spawnSync } from 'child_process';
import net from 'net';

import { baseTest } from '../config/baseTest';

import type { PageTestFixtures, PageWorkerFixtures } from '../page/pageTestApi';
export { expect } from '@playwright/test';

type WebDriverWorkerFixtures = PageWorkerFixtures & {
  webdriverEndpoint: string;
};

function killStraySafariDrivers(): void {
  // A crashed run can leave safaridriver alive with Safari still "paired",
  // which makes the next session creation fail. Clear it before launching.
  spawnSync('pkill', ['-9', '-f', 'safaridriver']);
}

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, () => {
      const port = (server.address() as net.AddressInfo).port;
      server.close(() => resolve(port));
    });
    server.on('error', reject);
  });
}

async function waitForReady(baseURL: string, deadline: number): Promise<void> {
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseURL}/status`);
      if (res.ok) {
        const json = await res.json() as { value?: { ready?: boolean } };
        if (json?.value?.ready !== false)
          return;
      }
    } catch {
      // safaridriver not accepting connections yet — retry.
    }
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error(`safaridriver did not become ready at ${baseURL}`);
}

export const webdriverTest = baseTest.extend<PageTestFixtures, WebDriverWorkerFixtures>({
  browserVersion: ['', { scope: 'worker' }],
  browserMajorVersion: [0, { scope: 'worker' }],
  electronMajorVersion: [0, { scope: 'worker' }],
  isBidi: [false, { scope: 'worker' }],
  isAndroid: [false, { scope: 'worker' }],
  isElectron: [false, { scope: 'worker' }],
  isHeadlessShell: [false, { scope: 'worker' }],
  isFrozenWebkit: [false, { scope: 'worker' }],

  // Launch one safaridriver per worker and expose its HTTP endpoint. Each test
  // then creates and tears down its own WebDriver session (a fresh Safari
  // window) against it — mirroring the webview worker-endpoint / per-test-page
  // split. safaridriver drives desktop Safari, so this only works on macOS with
  // `safaridriver --enable` run once.
  webdriverEndpoint: [async ({}, run) => {
    killStraySafariDrivers();
    await new Promise(r => setTimeout(r, 1000));
    const port = await findFreePort();
    const proc: ChildProcess = spawn('safaridriver', ['--port', String(port)], { stdio: 'ignore' });
    const baseURL = `http://localhost:${port}`;
    try {
      await waitForReady(baseURL, Date.now() + 30000);
      await run(`webdriver://localhost:${port}`);
    } finally {
      proc.kill('SIGTERM');
      killStraySafariDrivers();
    }
  }, { scope: 'worker', timeout: 60000 }],

  page: async ({ playwright, webdriverEndpoint }, run) => {
    const browser = await playwright.webkit.connectOverCDP(webdriverEndpoint);
    const page = browser.contexts()[0].pages()[0];
    if (!page)
      throw new Error('No Safari page is attached');
    await page.goto('about:blank').catch(() => {});
    await run(page);
    await browser.close().catch(() => {});
  },
});
