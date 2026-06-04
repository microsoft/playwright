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

import type { Browser } from '@playwright/test';
import type { PageTestFixtures, PageWorkerFixtures } from '../page/pageTestApi';
export { expect } from '@playwright/test';

type WebDriverWorkerFixtures = PageWorkerFixtures & {
  webdriverEndpoint: string;
  wdBrowser: Browser;
};

function killStraySafariDrivers(): void {
  // SIGTERM (not SIGKILL) so a leftover driver ends its session and unpairs
  // Safari; a SIGKILLed driver leaves Safari paired and blocks the next session.
  spawnSync('pkill', ['-f', 'safaridriver']);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
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

  // One long-lived safaridriver per worker. Requires macOS with `safaridriver --enable`.
  webdriverEndpoint: [async ({}, run) => {
    // Clear any driver orphaned by a previous crashed run, giving it a moment
    // to unpair Safari before we launch a fresh one.
    killStraySafariDrivers();
    await sleep(1000);
    const port = await findFreePort();
    const proc: ChildProcess = spawn('safaridriver', ['--port', String(port)], { stdio: 'ignore' });
    const baseURL = `http://localhost:${port}`;
    try {
      await waitForReady(baseURL, Date.now() + 30000);
      await run(`webdriver://localhost:${port}`);
    } finally {
      // Graceful stop: let safaridriver delete its session and unpair Safari.
      proc.kill('SIGTERM');
      await Promise.race([new Promise<void>(r => proc.once('exit', () => r())), sleep(3000)]);
    }
  }, { scope: 'worker', timeout: 60000 }],

  // One session per worker — creating a session re-prompts Safari's "remotely
  // controlled" dialog, so we open it once rather than per test. Reset to
  // about:blank between tests for a measure of isolation.
  wdBrowser: [async ({ playwright, webdriverEndpoint }, run) => {
    const browser = await playwright.webkit.connectOverCDP(webdriverEndpoint);
    try {
      await run(browser);
    } finally {
      await browser.close().catch(() => {});
    }
  }, { scope: 'worker', timeout: 60000 }],

  page: async ({ wdBrowser }, run) => {
    const page = wdBrowser.contexts()[0].pages()[0];
    if (!page)
      throw new Error('No Safari page is attached');
    await page.goto('about:blank').catch(() => {});
    await run(page);
  },
});
