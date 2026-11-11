#!/usr/bin/env node
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

// Stands in for the Chrome executable that the relay starts. Headless Chrome does not hand
// the URL over to a running instance of the same profile, so this script does it:
// it starts the browser when the profile has none, and then opens the URL in a new tab.
// It also records its arguments in the profile folder, for the tests to check.

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const args = process.argv.slice(2);
const userDataDir = args.find(arg => arg.startsWith('--user-data-dir=')).substring('--user-data-dir='.length);
fs.appendFileSync(path.join(userDataDir, 'chrome-stub.log'), JSON.stringify(args) + '\n');
const url = args.pop();

function browserEndpoint() {
  try {
    const [port, wsPath] = fs.readFileSync(path.join(userDataDir, 'DevToolsActivePort'), 'utf8').split('\n');
    return `ws://127.0.0.1:${port}${wsPath}`;
  } catch {
  }
}

async function startBrowser() {
  const extension = process.env.PWTEST_CHROME_STUB_EXTENSION;
  spawn(process.env.PWTEST_CHROME_STUB_EXECUTABLE, [
    '--headless',
    '--no-sandbox',
    '--remote-debugging-port=0',
    `--disable-extensions-except=${extension}`,
    `--load-extension=${extension}`,
    ...args,
  ], { detached: true, stdio: 'ignore' }).unref();
  while (!browserEndpoint())
    await new Promise(f => setTimeout(f, 100));
}

function openTab() {
  const ws = new WebSocket(browserEndpoint());
  ws.onopen = () => ws.send(JSON.stringify({
    id: 1,
    method: 'Target.createTarget',
    params: { url, background: args.includes('--open-in-background') },
  }));
  ws.onmessage = () => ws.close();
}

(async () => {
  if (!browserEndpoint())
    await startBrowser();
  openTab();
})();
