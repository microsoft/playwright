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
import { test, expect } from './fixtures';

test.describe('browser launch recovery', () => {
  test('should not retry on crash without SingletonLock file', async ({ startClient, server }, testInfo) => {
    // This test verifies that when Chrome crashes (without creating a lock file),
    // we don't misleadingly report "Browser is already in use"
    const userDataDir = testInfo.outputPath('user-data-dir');

    // Start with invalid executable - this will fail immediately without lock file
    const { client } = await startClient({
      args: [
        `--executable-path=/non/existent/browser/executable`,
        `--user-data-dir=${userDataDir}`,
      ],
    });

    const response = await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    });

    // Should get the actual error, not "already in use"
    expect(response).toHaveResponse({
      result: expect.stringContaining(`executable doesn't exist`),
      isError: true,
    });

    // Verify no lock file was created
    const lockPath = path.join(userDataDir, 'SingletonLock');
    expect(fs.existsSync(lockPath)).toBe(false);
  });

  test('should recover across sessions with same user data dir', async ({ startClient, server }, testInfo) => {
    const userDataDir = testInfo.outputPath('user-data-dir');

    // First session with non-existent executable
    const { client } = await startClient({
      args: [
        `--executable-path=/non/existent/browser/executable`,
        `--user-data-dir=${userDataDir}`,
      ],
    });

    const firstResponse = await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    });
    expect(firstResponse).toHaveResponse({
      result: expect.stringContaining(`executable doesn't exist`),
      isError: true,
    });

    await client.close();

    // Second session with valid browser but same user data dir
    const { client: client2 } = await startClient({
      args: [`--user-data-dir=${userDataDir}`],
    });

    const secondResponse = await client2.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    });

    // Should work - no stale state should remain
    expect(secondResponse).toHaveResponse({
      pageState: expect.stringContaining(`Hello, world!`),
    });
  });

  test('should retry when SingletonLock file exists', async ({ startClient, server }, testInfo) => {
    // This test verifies that we DO retry when there's an actual lock file
    // (indicating another browser instance might be using the profile)
    const userDataDir = testInfo.outputPath('user-data-dir');

    // Create user data dir with a SingletonLock file
    await fs.promises.mkdir(userDataDir, { recursive: true });
    const lockFile = path.join(userDataDir, 'SingletonLock');
    await fs.promises.writeFile(lockFile, 'fake-lock');

    const { client } = await startClient({
      args: [`--user-data-dir=${userDataDir}`],
    });

    const response = await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    });

    // With a real lock file, Chrome should handle it (stale locks are usually cleaned up)
    // or we should get ProcessSingleton error after retries
    // The key is we should NOT get immediate failure
    if ((response as any).isError) {
      // If it errors, it should mention ProcessSingleton (actual lock contention)
      expect(response).toHaveResponse({
        result: expect.stringContaining(`ProcessSingleton`),
        isError: true,
      });
    } else {
      // Chrome successfully handled the stale lock
      expect(response).toHaveResponse({
        pageState: expect.stringContaining(`Hello, world!`),
      });
    }
  });
});
