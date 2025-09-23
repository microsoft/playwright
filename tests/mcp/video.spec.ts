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
import { test, expect } from './fixtures';

for (const mode of ['isolated', 'persistent']) {
  test(`should work with --save-video (${mode})`, async ({ startClient, server }, testInfo) => {
    const outputDir = testInfo.outputPath('output');

    const { client } = await startClient({
      args: [
        '--save-video=800x600',
        ...(mode === 'isolated' ? ['--isolated'] : []),
        '--output-dir', outputDir,
      ],
    });

    expect(await client.callTool({
      name: 'browser_navigate',
      arguments: { url: server.HELLO_WORLD },
    })).toHaveResponse({
      code: expect.stringContaining(`page.goto('http://localhost`),
    });

    expect(await client.callTool({
      name: 'browser_close',
    })).toHaveResponse({
      code: expect.stringContaining(`page.close()`),
    });

    const [file] = await fs.promises.readdir(outputDir);
    expect(file).toMatch(/page-.*.webm/);
  });
}
