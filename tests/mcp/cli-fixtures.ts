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
import path from 'path';

import { test as baseTest } from './fixtures';
import { killProcessGroup } from '../config/commonFixtures';

import type { CommonFixtures } from '../config/commonFixtures';

export { expect } from './fixtures';
export const test = baseTest.extend<{
  cli: (...args: any[]) => Promise<{
    output: string,
    error: string,
    exitCode: number | undefined,
    snapshot?: string,
    attachments?: { name: string, data: Buffer | null }[],
  }>;
}>({
  cli: async ({ mcpBrowser, mcpHeadless, childProcess }, use) => {
    const sessions: { name: string, pid: number }[] = [];
    await fs.promises.mkdir(test.info().outputPath('.playwright'), { recursive: true });

    await use(async (...args: string[]) => {
      const cliArgs = args.filter(arg => typeof arg === 'string');
      const cliOptions = args.findLast(arg => typeof arg === 'object') || {};
      return await runCli(childProcess, cliArgs, cliOptions, { mcpBrowser, mcpHeadless }, sessions);
    });

    for (const session of sessions) {
      await runCli(childProcess, ['--session=' + session.name, 'close'], {}, { mcpBrowser, mcpHeadless }, []).catch(e => {
        if (!e.message.includes('is not running'))
          throw e;
      });
      killProcessGroup(session.pid);
    }

    const daemonDir = path.join(test.info().outputDir, 'daemon');
    const userDataDirs = await fs.promises.readdir(daemonDir).catch(() => []);
    for (const dir of userDataDirs.filter(f => f.startsWith('ud-')))
      await fs.promises.rm(path.join(daemonDir, dir), { recursive: true, force: true }).catch(() => {});
  },
});

async function runCli(childProcess: CommonFixtures['childProcess'], args: string[], cliOptions: { cwd?: string, env?: Record<string, string> }, options: { mcpBrowser: string, mcpHeadless: boolean }, sessions: { name: string, pid: number }[]) {
  const stepTitle = `cli ${args.join(' ')}`;
  return await test.step(stepTitle, async () => {
    const testInfo = test.info();
    const cli = childProcess({
      command: [process.execPath, require.resolve('../../packages/playwright/lib/cli/client/cli.js'), ...args],
      cwd: cliOptions.cwd ?? testInfo.outputPath(),
      env: {
        ...process.env,
        ...cliOptions.env,
        PLAYWRIGHT_DAEMON_SESSION_DIR: testInfo.outputPath('daemon'),
        PLAYWRIGHT_DAEMON_SOCKETS_DIR: path.join(testInfo.project.outputDir, 'daemon-sockets'),
        PLAYWRIGHT_MCP_BROWSER: options.mcpBrowser,
        PLAYWRIGHT_MCP_HEADLESS: String(options.mcpHeadless),
        ...cliOptions.env,
      },
    });
    await cli.exited.finally(async () => {
      await testInfo.attach(stepTitle, { body: cli.output, contentType: 'text/plain' });
    });

    let snapshot: string | undefined;
    if (cli.stdout.includes('### Snapshot'))
      snapshot = await loadSnapshot(cli.stdout);
    const attachments = loadAttachments(cli.stdout);

    const matches = cli.stdout.includes('### Browser') ? cli.stdout.match(/Browser `(.+)` opened with pid (\d+)\./) : undefined;
    const [, sessionName, pid] = matches ?? [];
    if (sessionName && pid)
      sessions.push({ name: sessionName, pid: +pid });
    return {
      exitCode: await cli.exitCode,
      output: cli.stdout.trim(),
      error: cli.stderr.trim(),
      snapshot,
      attachments
    };
  });
}

function loadAttachments(output: string) {
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

async function loadSnapshot(output: string) {
  const lines = output.split('\n');
  if (!lines.includes('### Snapshot'))
    throw new Error('Snapshot file not found');
  const fileLine = lines[lines.indexOf('### Snapshot') + 1];
  const fileName = fileLine.match(/- \[(.+)\]\((.+)\)/)![2];
  try {
    return await fs.promises.readFile(test.info().outputPath(fileName), 'utf8').catch(() => undefined);
  } catch (e) {
    return '';
  }
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

export async function findDefaultSession() {
  const daemonDir = await daemonFolder();
  const fileName = path.join(daemonDir, 'default.session');
  return await fs.promises.readFile(fileName, 'utf-8').then(JSON.parse).catch(() => null);
}

export async function daemonFolder() {
  const daemonDir = test.info().outputPath('daemon');
  const folders = await fs.promises.readdir(daemonDir);
  for (const folder of folders) {
    const fullName = path.join(daemonDir, folder);
    if (fs.lstatSync(path.join(fullName)).isDirectory())
      return fullName;
  }
  return null;
}
