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

test('check that trace is saved with --save-trace', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');

  const { client } = await startClient({
    args: ['--save-trace', `--output-dir=${outputDir}`],
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    code: expect.stringContaining(`page.goto('http://localhost`),
  });

  const [file] = await fs.promises.readdir(outputDir);
  expect(file).toContain('traces');
});

test('check that trace is saved with browser_start_tracing', async ({ startClient, server }, testInfo) => {
  const outputDir = testInfo.outputPath('output');

  const { client } = await startClient({ args: [`--output-dir=${outputDir}`, '--caps=tracing'] });

  expect(await client.callTool({
    name: 'browser_start_tracing',
  })).toHaveResponse({
    result: expect.stringContaining(`Tracing started, saving to ${outputDir}`),
  });

  expect(await client.callTool({
    name: 'browser_navigate',
    arguments: { url: server.HELLO_WORLD },
  })).toHaveResponse({
    code: expect.stringContaining(`page.goto('http://localhost`),
  });

  expect(await client.callTool({
    name: 'browser_stop_tracing',
  })).toHaveResponse({
    result: expect.stringMatching(/trace-\d+.trace/)
  });

  const files = await fs.promises.readdir(path.join(outputDir, 'traces'));
  expect(files).toEqual([
    'resources',
    expect.stringMatching(/trace-\d+\.network/),
    expect.stringMatching(/trace-\d+\.trace/),
  ]);
});
