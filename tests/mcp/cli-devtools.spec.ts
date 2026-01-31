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

import path from 'path';
import { test, expect } from './cli-fixtures';

test('console', async ({ cli, server }) => {
  await cli('open', server.PREFIX);
  await cli('eval', 'console.log("Hello, world!")');
  const { attachments } = await cli('console');
  expect(attachments[0].name).toEqual('Console');
  expect(attachments[0].data.toString()).toContain('Hello, world!');
});

test('console error', async ({ cli, server }) => {
  await cli('open', server.PREFIX);
  await cli('eval', 'console.log("log-level")');
  await cli('eval', 'console.error("error-level")');
  const { attachments } = await cli('console', 'error');
  expect(attachments[0].name).toEqual('Console');
  expect(attachments[0].data.toString()).not.toContain('log-level');
  expect(attachments[0].data.toString()).toContain('error-level');
});

test('console --clear', async ({ cli, server }) => {
  await cli('open', server.PREFIX);
  await cli('eval', 'console.log("log-level")');
  await cli('console', '--clear');
  const { attachments } = await cli('console');
  expect(attachments[0].name).toEqual('Console');
  expect(attachments[0].data.toString()).not.toContain('log-level');
});

test('network', async ({ cli, server }) => {
  await cli('open', server.PREFIX);
  await cli('eval', '() => fetch("/hello-world")');
  const { attachments } = await cli('network');
  expect(attachments[0].name).toEqual('Network');
  expect(attachments[0].data.toString()).not.toContain(`[GET] ${`${server.PREFIX}/`} => [200] OK`);
  expect(attachments[0].data.toString()).toContain(`[GET] ${`${server.PREFIX}/hello-world`} => [200] OK`);
});

test('network --static', async ({ cli, server }) => {
  await cli('open', server.PREFIX);
  const { attachments } = await cli('network', '--static');
  expect(attachments[0].name).toEqual('Network');
  expect(attachments[0].data.toString()).toContain(`[GET] ${`${server.PREFIX}/`} => [200] OK`);
});

test('network --clear', async ({ cli, server }) => {
  await cli('open', server.PREFIX);
  await cli('eval', '() => fetch("/hello-world")');
  await cli('network', '--clear');
  const { attachments } = await cli('network');
  expect(attachments[0].name).toEqual('Network');
  expect(attachments[0].data.toString()).not.toContain(`[GET] ${`${server.PREFIX}/hello-world`} => [200] OK`);
});

test('tracing-start-stop', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);
  const { output } = await cli('tracing-start');
  expect(output).toContain('Trace recording started');
  await cli('eval', '() => fetch("/hello-world")');
  const { output: tracingStopOutput } = await cli('tracing-stop');
  expect(tracingStopOutput).toContain('Trace recording stopped');
});

test('video-start-stop', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);
  const { output: videoStartOutput } = await cli('video-start');
  expect(videoStartOutput).toContain('Video recording started.');
  await cli('open', server.HELLO_WORLD);
  await cli('eval', `
    async () => {
      document.body.style.backgroundColor = "red";
      for (let i = 0; i < 100; i++)
        await new Promise(f => requestAnimationFrame(() => requestAnimationFrame(f)));
    }
  `);
  const { output: videoStopOutput } = await cli('video-stop', '--filename=video.webm');
  expect(videoStopOutput).toContain(`### Result\n- [Video](.playwright-cli${path.sep}video.webm)`);
});
