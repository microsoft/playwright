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

import { playwrightTest as test, expect } from '../../config/browserTest';

test.skip(({ mode }) => mode === 'service2');

test('should connect, evaluate, receive console and disconnect', async ({ browserType, childProcess }) => {
  const child = childProcess({ command: [process.execPath, '--inspect-brk=0', '-e', 'console.log("hello from node"); setTimeout(() => {}, 1e9)'] });
  await child.waitForOutput('Debugger listening on ws://');
  const endpoint = child.output.match(/Debugger listening on (ws:\/\/\S+)/)![1];
  const worker = await browserType.connectToWorker(endpoint);
  // Script runs after connect due to --inspect-brk, so listen before evaluating.
  const messagePromise = worker.waitForEvent('console');
  const result = await worker.evaluate(() => 1 + 1);
  expect(result).toBe(2);
  const message = await messagePromise;
  expect(message.text()).toBe('hello from node');
  expect(message.type()).toBe('log');
  // Disconnect and receive close event.
  const closePromise = worker.waitForEvent('close');
  await worker.disconnect();
  await closePromise;
});

test('should receive close when node process exits', async ({ browserType, childProcess }) => {
  const child = childProcess({ command: [process.execPath, '--inspect-brk=0', '-e', 'setTimeout(() => {}, 1e9)'] });
  await child.waitForOutput('Debugger listening on ws://');
  const endpoint = child.output.match(/Debugger listening on (ws:\/\/\S+)/)![1];
  const worker = await browserType.connectToWorker(endpoint);
  const closePromise = worker.waitForEvent('close');
  child.process.kill();
  await closePromise;
});
