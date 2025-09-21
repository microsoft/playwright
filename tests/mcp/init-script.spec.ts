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

import { test, expect } from './fixtures';
import fs from 'fs';


for (const context of ['isolated', 'persistent']) {
  test(`--init-script option loads and executes script (${context})`, async ({ startClient, server }, testInfo) => {
    // Create a temporary init script
    const initScriptPath = testInfo.outputPath('init-script1.js');
    const initScriptContent1 = `window.testInitScriptExecuted = true;`;
    await fs.promises.writeFile(initScriptPath, initScriptContent1);

    const initScriptPath2 = testInfo.outputPath('init-script2.js');
    const initScriptContent2 = `console.log('Init script executed successfully');`;
    await fs.promises.writeFile(initScriptPath2, initScriptContent2);

    // Start the client with the init script option
    const { client: client } = await startClient({
      args: [`--init-script=${initScriptPath}`, `--init-script=${initScriptPath2}`, ...(context === 'isolated' ? ['--isolated'] : [])]
    });

    // Navigate to a page and verify the init script was executed
    await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    });

    await client.callTool({
      name: 'browser_evaluate',
      arguments: { function: '() => console.log("Custom log")' }
    });

    // Check that the init script variables are available
    expect(await client.callTool({
      name: 'browser_evaluate',
      arguments: { function: '() => window.testInitScriptExecuted' }
    })).toHaveResponse({
      result: 'true',
    });

    expect(await client.callTool({
      name: 'browser_console_messages',
    })).toHaveResponse({
      result: expect.stringMatching(/Init script executed successfully.*Custom log/ms),
    });
  });
}

test('--init-script option with non-existent file throws error', async ({ startClient }, testInfo) => {
  const nonExistentPath = testInfo.outputPath('non-existent-script.js');

  // Attempting to start with a non-existent init script should fail
  await expect(startClient({
    args: [`--init-script=${nonExistentPath}`]
  })).rejects.toThrow();
});
