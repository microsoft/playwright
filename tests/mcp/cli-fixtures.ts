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

import fs from 'fs';
import os from 'os';
import path from 'path';

import { test as baseTest } from './fixtures';
import { calculateSha1 } from '../../packages/playwright-core/src/server/utils/crypto';

import type { TestChildProcess } from '../config/commonFixtures';

export { expect } from './fixtures';
export const test = baseTest.extend<{
  socketPath: string;
  daemon: TestChildProcess;
  cliNoDaemon: (...args: string[]) => Promise<string>;
  cli: (...args: string[]) => Promise<{ output: string, error: string, snapshot?: string, attachments?: { name: string, data: Buffer | null }[] }>;
}>({
  socketPath: async ({}, use, testInfo) => {
    if (os.platform() === 'win32') {
      const hash = calculateSha1(testInfo.outputPath());
      await use(`\\\\.\\pipe\\${hash}`);
      return;
    }
    await use(path.join(test.info().outputPath(), 'socket.sock'));
  },

  daemon: async ({ socketPath, childProcess }, use, testInfo) => {
    const userDataDir = testInfo.outputPath('user-data-dir');
    const daemonPath = path.resolve(__dirname, '../../packages/playwright/cli.js');
    const daemon = childProcess({
      command: [process.execPath, daemonPath, 'run-mcp-server', `--daemon=${socketPath}`, `--user-data-dir=${userDataDir}`],
      cwd: testInfo.outputPath(),
    });
    await daemon.waitForOutput('Daemon server listening');
    await use(daemon);
  },

  cliNoDaemon: async ({ childProcess }, use, testInfo) => {
    await use(async (...args: string[]) => {
      const child = childProcess({
        command: [process.execPath, require.resolve('../../packages/playwright/lib/mcp/terminal/cli.js'), ...args],
        cwd: testInfo.outputPath(),
      });
      await child.cleanExit();
      return child.output;
    });
  },

  cli: async ({ socketPath, daemon, childProcess }, use, testInfo) => {
    await use(async (...args: string[]) => {
      const cli = childProcess({
        command: [process.execPath, require.resolve('../../packages/playwright/lib/mcp/terminal/cli.js'), ...args],
        cwd: testInfo.outputPath(),
        env: {
          ...process.env,
          PLAYWRIGHT_DAEMON_SOCKET_PATH: socketPath,
        },
      });
      await cli.cleanExit();
      let snapshot: string | undefined;
      if (cli.stdout.includes('### Snapshot'))
        snapshot = await loadSnapshot(cli.stdout);
      const attachments = loadAttachments(cli.stdout);
      return { output: cli.stdout.trim(), error: cli.stderr.trim(), snapshot, attachments };
    });
  },
});

export function loadAttachments(output: string) {
  // attachments look like md links  - [Page as pdf](.playwright-cli/page-2026-01-22T23-13-56-347Z.pdf)
  const match = output.match(/- \[(.+)\]\((.+)\)/g);
  if (!match)
    return [];

  return match.map(m => {
    const [, name, path] = m.match(/- \[(.+)\]\((.+)\)/)!;
    try {
      const data = fs.readFileSync(test.info().outputPath(path));
      return { name, data };
    } catch (e) {
      return { name, data: null };
    }
  });
}

export async function loadSnapshot(output: string) {
  const match = output.match(/- File: (.+)/m);
  if (!match)
    throw new Error('Snapshot file not found');
  const snapshotPath = match[1];
  const fileName = test.info().outputPath(snapshotPath);
  return await fs.promises.readFile(fileName, 'utf8');
}

export const eventsPage = `<!DOCTYPE html>
<html>
  <body style="width: 400px; height: 400px; margin: 0; padding: 0;">
    <div id='square'style="width: 100px; height: 100px;"></div>
    <div id='log'></div>
    <script>
      const logElement = document.querySelector('#log');

      const log = (...args) => {
        const el = document.createElement('div');
        el.textContent = args.join(' ');
        logElement.appendChild(el);
      };
      document.body.addEventListener('mousemove', (event) => {
        log('mouse move', event.clientX, event.clientY);
      });
      document.body.addEventListener('mousedown', () => {
        log('mouse down');
      });
      document.body.addEventListener('mouseup', () => {
        log('mouse up');
      });
      document.body.addEventListener('wheel', (event) => {
        log('wheel', event.deltaX, event.deltaY);
      });
      document.body.addEventListener('click', () => {
        log('click', event.button);
      });
      document.body.addEventListener('dblclick', (event) => {
        log('dblclick', event.button);
      });
    </script>
  </body>
</html>
`;
