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
import { spawn } from 'child_process';

import { test as baseTest } from './fixtures';

export { expect } from './fixtures';
export const test = baseTest.extend<{
  cli: (...args: string[]) => Promise<{
    output: string,
    error: string,
    snapshot?: string,
    attachments?: { name: string, data: Buffer | null }[],
  }>;
}>({
  cli: async ({ mcpBrowser, mcpHeadless }, use) => {
    const sessions: { name: string, pid: number }[] = [];

    await use(async (...args: string[]) => {
      return await runCli(args, { mcpBrowser, mcpHeadless }, sessions);
    });

    for (const session of sessions) {
      await runCli(['session-stop', session.name], { mcpBrowser, mcpHeadless }, []);
      try {
        process.kill(session.pid, 'SIGTERM');
      } catch (e) {
      }
    }

    const daemonDir = path.join(test.info().outputDir, 'daemon');
    const userDataDirs = await fs.promises.readdir(daemonDir).catch(() => []);
    for (const dir of userDataDirs.filter(f => f.startsWith('ud-')))
      await fs.promises.rm(path.join(daemonDir, dir), { recursive: true, force: true }).catch(() => {});
  },
});

async function runCli(args: string[], options: { mcpBrowser: string, mcpHeadless: boolean }, sessions: { name: string, pid: number }[]) {
  const testInfo = test.info();
  const cli = spawn(process.execPath, [require.resolve('../../packages/playwright/lib/mcp/terminal/cli.js'), ...args], {
    cwd: testInfo.outputPath(),
    stdio: 'pipe',
    env: {
      ...process.env,
      PLAYWRIGHT_DAEMON_INSTALL_DIR: testInfo.outputPath(),
      PLAYWRIGHT_DAEMON_SESSION_DIR: testInfo.outputPath('daemon'),
      PLAYWRIGHT_DAEMON_SOCKETS_DIR: path.join(testInfo.project.outputDir, 'daemon-sockets'),
      PLAYWRIGHT_MCP_BROWSER: options.mcpBrowser,
      PLAYWRIGHT_MCP_HEADLESS: String(options.mcpHeadless),
    },
  });
  let stdout = '';
  let stderr = '';
  cli.stdout.on('data', data => { stdout += data.toString(); });
  cli.stderr.on('data', data => { stderr += data.toString(); });
  await new Promise<void>((resolve, reject) => {
    cli.on('close', code => {
      if (code === 0)
        resolve();
      else
        reject(new Error(`CLI exited with code ${code}: ${stderr}`));
    });
  });
  let snapshot: string | undefined;
  if (stdout.includes('### Snapshot'))
    snapshot = await loadSnapshot(stdout);
  const attachments = loadAttachments(stdout);

  const matches = stdout.includes('Daemon for') ? stdout.match(/Daemon for `(.+)` session started with pid (\d+)\./) : undefined;
  const [, sessionName, pid] = matches ?? [];
  if (sessionName && pid)
    sessions.push({ name: sessionName, pid: +pid });
  return {
    output: stdout.trim(),
    error: stderr.trim(),
    snapshot,
    attachments
  };
}

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
  const lines = output.split('\n');
  if (!lines.includes('### Snapshot'))
    throw new Error('Snapshot file not found');
  const fileLine = lines[lines.indexOf('### Snapshot') + 1];
  const fileName = fileLine.match(/- \[(.+)\]\((.+)\)/)![2];
  return await fs.promises.readFile(test.info().outputPath(fileName), 'utf8');
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
