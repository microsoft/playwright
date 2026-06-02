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
import { execSync, spawn } from 'child_process';

import { test, expect, mcpServerPath } from './fixtures';
import { inheritAndCleanEnv, isAlive } from '../config/utils';

test.slow();

// Regression test for https://github.com/microsoft/playwright/issues/41013:
// when the host process dies without delivering SIGINT/SIGTERM (e.g. SIGKILL,
// OOM kill, IDE hard-reload) the MCP server is re-parented and must still shut
// the browser down. We reproduce this by putting the MCP server's stdin behind
// a FIFO held open by the test process, spawning it from an intermediate parent
// and then killing that parent: neither a stdin 'close' nor a signal reaches
// the MCP server, so only parent-death (PPID) detection can clean it up.
test('should close the browser when the MCP host is killed without a signal', async ({ mcpBrowser, mcpHeadless }, testInfo) => {
  test.skip(process.platform === 'win32', 'There is no process re-parenting on Windows');

  const fifo = testInfo.outputPath('mcp-stdin.fifo');
  execSync(`mkfifo ${fifo}`);
  // Open read-write so the open never blocks and the write end stays open even
  // after the intermediate parent dies.
  const stdinFd = fs.openSync(fifo, 'r+');

  const pidFile = testInfo.outputPath('mcp.pid');
  const stdoutLog = testInfo.outputPath('mcp-stdout.log');

  const mcpArgs = [...mcpServerPath, '--isolated'];
  if (mcpHeadless)
    mcpArgs.push('--headless');
  if (mcpBrowser)
    mcpArgs.push(`--browser=${mcpBrowser}`);

  // The intermediate parent launches the MCP server reading from the FIFO and
  // then stays alive, so the MCP server only dies once we kill this parent.
  const parentScript = `
    const fs = require('fs');
    const { spawn } = require('child_process');
    const readFd = fs.openSync(${JSON.stringify(fifo)}, 'r');
    const out = fs.openSync(${JSON.stringify(stdoutLog)}, 'a');
    const child = spawn(process.execPath, ${JSON.stringify(mcpArgs)}, {
      stdio: [readFd, out, 'inherit'],
    });
    fs.writeFileSync(${JSON.stringify(pidFile)}, String(child.pid));
    setInterval(() => {}, 1000);
  `;

  const parent = spawn(process.execPath, ['-e', parentScript], {
    stdio: ['ignore', 'inherit', 'inherit'],
    env: inheritAndCleanEnv({
      PWMCP_PROFILES_DIR_FOR_TEST: testInfo.outputPath('ms-playwright'),
      PW_TMPDIR_FOR_TEST: testInfo.outputPath('tmp'),
    }),
  });

  // Wait for the MCP server pid to be reported.
  await expect.poll(() => fs.existsSync(pidFile), { timeout: 15000 }).toBe(true);
  const mcpPid = Number(fs.readFileSync(pidFile, 'utf8'));
  expect(mcpPid).toBeGreaterThan(0);

  // Drive the MCP server to launch the browser.
  const send = (msg: any) => fs.writeSync(stdinFd, JSON.stringify(msg) + '\n');
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'repro', version: '1' } } });
  send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  send({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'browser_navigate', arguments: { url: 'about:blank' } } });

  // Wait for the navigate response, which means the browser is up.
  await expect.poll(() => {
    try {
      return fs.readFileSync(stdoutLog, 'utf8').includes('"id":2');
    } catch {
      return false;
    }
  }, { timeout: 30000 }).toBe(true);

  // The browser is a direct child of the MCP server process.
  const browserPids = execSync(`pgrep -P ${mcpPid} || true`).toString().split('\n').map(Number).filter(Boolean);
  expect(browserPids.length).toBeGreaterThan(0);
  expect(isAlive(mcpPid)).toBe(true);

  // Simulate the host dying without a signal: the MCP server is re-parented but
  // keeps its (FIFO) stdin and never receives SIGINT/SIGTERM.
  process.kill(parent.pid!, 'SIGKILL');

  // The watchdog should notice the orphaning and shut everything down.
  await expect.poll(() => isAlive(mcpPid), { timeout: 20000, message: 'MCP server should exit after being orphaned' }).toBe(false);
  for (const pid of browserPids)
    await expect.poll(() => isAlive(pid), { timeout: 20000, message: `Browser process ${pid} should exit` }).toBe(false);

  fs.closeSync(stdinFd);
});
