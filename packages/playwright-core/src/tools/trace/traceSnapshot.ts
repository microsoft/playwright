/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable no-console */

import { TraceLoader } from '../../utils/isomorphic/trace/traceLoader';
import { BrowserBackend } from '../backend/browserBackend';
import { browserTools } from '../backend/tools';
import * as playwright from '../../..';
import { gracefullyCloseAll } from '../../utils';
import { parseCommand } from '../cli-daemon/command';
import { minimist } from '../cli-client/minimist';
import { commands } from '../cli-daemon/commands';
import { loadTrace } from './traceUtils';

import type { SnapshotStorage } from '@isomorphic/trace/snapshotStorage';

export async function traceSnapshot(actionId: string, options: { name?: string, serve?: boolean, browserArgs?: string[] }): Promise<void> {
  const trace = await loadTrace();

  const action = trace.resolveActionId(actionId);
  if (!action) {
    console.error(`Action '${actionId}' not found.`);
    process.exitCode = 1;
    return;
  }

  const pageId = action.pageId;
  if (!pageId) {
    console.error(`Action '${actionId}' has no associated page.`);
    process.exitCode = 1;
    return;
  }

  const callId = action.callId;
  const storage = trace.loader.storage();

  let snapshotName: string | undefined;
  let renderer;
  if (options.name) {
    snapshotName = options.name;
    renderer = storage.snapshotByName(pageId, `${snapshotName}@${callId}`);
  } else {
    for (const candidate of ['input', 'before', 'after']) {
      renderer = storage.snapshotByName(pageId, `${candidate}@${callId}`);
      if (renderer) {
        snapshotName = candidate;
        break;
      }
    }
  }

  if (!renderer || !snapshotName) {
    console.error(`No snapshot found for action '${actionId}'.`);
    process.exitCode = 1;
    return;
  }

  const snapshotKey = `${snapshotName}@${callId}`;
  const server = await serveTraceSnapshot(storage, trace.loader, pageId, snapshotKey);

  if (options.serve) {
    console.log(`Serving snapshot at ${server.url}`);
    await new Promise(() => {});
    return;
  }

  await runCommandOnSnapshot(server, options.browserArgs || []);
}

async function serveTraceSnapshot(storage: SnapshotStorage, loader: TraceLoader, pageId: string, snapshotKey: string): Promise<{ url: string, stop: () => Promise<void> }> {
  const { SnapshotServer } = require('../../utils/isomorphic/trace/snapshotServer') as typeof import('../../utils/isomorphic/trace/snapshotServer');
  const { HttpServer } = require('../../server/utils/httpServer') as typeof import('../../server/utils/httpServer');

  const snapshotServer = new SnapshotServer(storage, sha1 => loader.resourceForSha1(sha1));
  const httpServer = new HttpServer();

  httpServer.routePrefix('/snapshot', (request: any, response: any) => {
    const url = new URL('http://localhost' + request.url!);
    const searchParams = url.searchParams;
    searchParams.set('name', snapshotKey);
    const snapshotResponse = snapshotServer.serveSnapshot(pageId, searchParams, '/snapshot');
    response.statusCode = snapshotResponse.status;
    snapshotResponse.headers.forEach((value: string, key: string) => response.setHeader(key, value));
    snapshotResponse.text().then((text: string) => response.end(text));
    return true;
  });

  httpServer.routePrefix('/', (_request: any, response: any) => {
    response.statusCode = 302;
    response.setHeader('Location', '/snapshot');
    response.end();
    return true;
  });

  await httpServer.start({ preferredPort: 0 });
  return { url: httpServer.urlPrefix('human-readable'), stop: () => httpServer.stop() };
}

async function runCommandOnSnapshot(server: { url: string, stop: () => Promise<void> }, browserArgs: string[]) {
  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(server.url);

  const backend = new BrowserBackend({
    snapshot: { mode: 'full' },
    outputMode: 'file',
    skillMode: true,
  }, context, browserTools);
  await backend.initialize({ cwd: process.cwd(), clientName: 'playwright-cli' });

  try {
    if (!browserArgs.length)
      browserArgs = ['snapshot'];
    const args = minimist(browserArgs, { string: ['_'] });
    const command = commands[args._[0]];
    if (!command)
      throw new Error(`Unknown command: ${args._[0]}`);
    const { toolName, toolParams } = parseCommand(command, args as Record<string, string> & { _: string[] });
    const result = await backend.callTool(toolName, toolParams);
    const text = result.content[0]?.type === 'text' ? result.content[0].text : undefined;
    if (text)
      console.log(text);
    if (result.isError) {
      console.error('Command failed.');
      process.exitCode = 1;
    }
  } catch (e) {
    console.error((e as Error).message);
    process.exitCode = 1;
  } finally {
    await server.stop().catch(e => console.error(e));
    await gracefullyCloseAll();
  }
}
