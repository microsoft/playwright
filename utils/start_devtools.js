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

// @ts-check

const net = require('net');
const playwright = require('playwright-core');

const CDP_BASE_PORT = 14782;

async function findFreePort(startPort) {
  for (let port = startPort; port < startPort + 100; port++) {
    const free = await new Promise(resolve => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.listen(port, '127.0.0.1', () => {
        server.close(() => resolve(true));
      });
    });
    if (free)
      return port;
  }
  throw new Error(`Could not find a free port starting from ${startPort}`);
}

async function main() {
  const cdpPort = await findFreePort(CDP_BASE_PORT);

  const browser = await playwright.chromium.launch({ headless: true, args: [`--remote-debugging-port=${cdpPort}`] });

  const context = browser.contexts()[0] || await browser.newContext();

  const { url: devtoolsUrl } = await /** @type {any} */ (context)._devtoolsStart();

  console.log('');
  console.log('DevTools environment started.');
  console.log('');
  console.log(`  DevTools UI:  ${devtoolsUrl}`);
  console.log(`  CDP endpoint: http://127.0.0.1:${cdpPort}`);
  console.log('');
  console.log('Set PLAYWRIGHT_MCP_CDP_ENDPOINT to the CDP endpoint.');
  console.log('Press Ctrl+C to stop.');
  console.log('');

  async function shutdown() {
    console.log('\nShutting down...');
    await /** @type {any} */ (context)._devtoolsStop().catch(() => {});
    await browser.close().catch(() => {});
    process.exit(0);
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
