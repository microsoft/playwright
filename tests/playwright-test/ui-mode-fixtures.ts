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

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { TestChildProcess } from '../config/commonFixtures';
import { cleanEnv, cliEntrypoint, test as base, writeFiles, removeFolders } from './playwright-test-fixtures';
import type { Files, RunOptions } from './playwright-test-fixtures';
import type { Browser, Page, TestInfo } from './stable-test-runner';
import { chromium } from './stable-test-runner';
import { createGuid } from '../../packages/playwright-core/src/server/utils/crypto';

type Latch = {
  blockingCode: string;
  open: () => void;
  close: () => void;
};

type UIModeOptions = RunOptions & {
  useWeb?: boolean
};

type Fixtures = {
  runUITest: (files: Files, env?: NodeJS.ProcessEnv, options?: UIModeOptions) => Promise<{ page: Page, testProcess: TestChildProcess }>;
  createLatch: () => Latch;
};

export function dumpTestTree(page: Page, options: { time?: boolean } = {}): () => Promise<string> {
  return () => page.getByTestId('test-tree').evaluate(async (treeElement, options) => {
    function iconName(iconElement: Element): string {
      const icon = iconElement.className.replace('codicon codicon-', '');
      if (icon === 'chevron-right')
        return '►';
      if (icon === 'chevron-down')
        return '▼';
      if (icon === 'blank')
        return ' ';
      if (icon === 'circle-outline')
        return '◯';
      if (icon === 'circle-slash')
        return '⊘';
      if (icon === 'check')
        return '✅';
      if (icon === 'error')
        return '❌';
      if (icon === 'eye')
        return '👁';
      if (icon === 'loading')
        return '↻';
      if (icon === 'clock')
        return '🕦';
      return icon;
    }

    const result: string[] = [];
    const treeItems = treeElement.querySelectorAll('[role=treeitem]');
    for (const treeItem of treeItems) {
      const treeItemHeader = treeItem.querySelector('.tree-view-entry');
      const iconElements = treeItemHeader.querySelectorAll('.codicon');
      const treeIcon = iconName(iconElements[0]);
      const statusIcon = iconName(iconElements[1]);
      const indent = treeItemHeader.querySelectorAll('.tree-view-indent').length;
      const watch = treeItemHeader.querySelector('.toolbar-button.eye.toggled') ? ' 👁' : '';
      const selected = treeItem.getAttribute('aria-selected') === 'true' ? ' <=' : '';
      const title = treeItemHeader.querySelector('.ui-mode-tree-item-title').childNodes[0].textContent;
      const timeElement = options.time ? treeItemHeader.querySelector('.ui-mode-tree-item-time') : undefined;
      const time = timeElement ? ' ' + timeElement.textContent.replace(/[.\d]+m?s/, 'XXms') : '';
      result.push('    ' + '  '.repeat(indent) + treeIcon + ' ' + statusIcon + ' ' + title + time + watch + selected);
    }
    return '\n' + result.join('\n') + '\n  ';
  }, options);
}

export const test = base
    .extend<Fixtures>({
      runUITest: async ({ childProcess, headless }, use, testInfo: TestInfo) => {
        if (process.env.CI)
          testInfo.slow();
        const cacheDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'playwright-test-cache-'));
        let testProcess: TestChildProcess | undefined;
        let browser: Browser | undefined;
        await use(async (files: Files, env: NodeJS.ProcessEnv = {}, options: UIModeOptions = {}) => {
          const baseDir = await writeFiles(testInfo, files, true);
          testProcess = childProcess({
            command: ['node', cliEntrypoint, 'test', (options.useWeb ? '--ui-host=127.0.0.1' : '--ui'), '--workers=1', ...(options.additionalArgs || [])],
            env: {
              ...cleanEnv(env),
              PWTEST_UNDER_TEST: '1',
              PWTEST_CACHE_DIR: cacheDir,
              PWTEST_HEADED_FOR_TEST: headless ? '0' : '1',
              PWTEST_PRINT_WS_ENDPOINT: '1',
            },
            cwd: options.cwd ? path.resolve(baseDir, options.cwd) : baseDir,
          });
          let page: Page;
          if (options.useWeb) {
            await testProcess.waitForOutput('Listening on');
            const line = testProcess.output.split('\n').find(l => l.includes('Listening on'));
            const uiAddress = line!.split(' ')[2];
            browser = await chromium.launch({ channel: 'chrome' });
            page = await browser.newPage();
            await page.goto(uiAddress);
          } else {
            await testProcess.waitForOutput('DevTools listening on');
            const line = testProcess.output.split('\n').find(l => l.includes('DevTools listening on'));
            const wsEndpoint = line!.split(' ')[3];
            browser = await chromium.connectOverCDP(wsEndpoint);
            const [context] = browser.contexts();
            [page] = context.pages();
          }
          return { page, testProcess };
        });
        await browser?.close();
        await testProcess?.kill('SIGINT');
        await removeFolders([cacheDir]);
      },
      createLatch: async ({}, use, testInfo) => {
        await use(() => {
          const latchFile = path.join(testInfo.project.outputDir, createGuid() + '.latch');
          return {
            blockingCode: `await ((${waitForLatch})(${JSON.stringify(latchFile)}))`,
            open: () => fs.writeFileSync(latchFile, 'ok'),
            close: () => fs.unlinkSync(latchFile),
          };
        });
      },
    });

import { expect as baseExpect } from './stable-test-runner';

// Slow tests are 90s.
export const expect = baseExpect.configure({ timeout: process.env.CI ? 75000 : 25000 });
export const retries = process.env.CI ? 3 : 0;

async function waitForLatch(latchFile: string) {
  const fs = require('fs');
  while (!fs.existsSync(latchFile))
    await new Promise(f => setTimeout(f, 250));
}
