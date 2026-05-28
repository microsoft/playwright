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

import * as z from 'zod';
import { defineTool } from './tool';

import type { OutputFile } from './outputDir';

type TraceLegend = { tracesDir: OutputFile, name: string };

const tracingStart = defineTool({
  capability: 'devtools',

  schema: {
    name: 'browser_start_tracing',
    title: 'Start tracing',
    description: 'Start trace recording',
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async (context, params, response) => {
    const browserContext = await context.ensureBrowserContext();
    const tracesDir = await context.outputFile({ prefix: '', suggestedFilename: `traces`, ext: '' }, { origin: 'code' });
    const name = 'trace-' + Date.now();
    await browserContext.tracing.start({
      name,
      screenshots: true,
      snapshots: true,
      live: true,
    });
    response.addTextResult(`Trace recording started`);
    response.addFileLink('Action log', `${tracesDir.path}/${name}.trace`);
    response.addFileLink('Network log', `${tracesDir.path}/${name}.network`);
    response.addFileLink('Resources', `${tracesDir.path}/resources`);
    // eslint-disable-next-line no-restricted-syntax
    (browserContext.tracing as any)[traceLegendSymbol] = { tracesDir, name } satisfies TraceLegend;
  },
});

const tracingStop = defineTool({
  capability: 'devtools',

  schema: {
    name: 'browser_stop_tracing',
    title: 'Stop tracing',
    description: 'Stop trace recording',
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async (context, params, response) => {
    const browserContext = await context.ensureBrowserContext();
    await browserContext.tracing.stop();
    // eslint-disable-next-line no-restricted-syntax
    const traceLegend: TraceLegend | undefined = (browserContext.tracing as any)[traceLegendSymbol];
    if (!traceLegend)
      throw new Error('Tracing is not started');
    // eslint-disable-next-line no-restricted-syntax
    delete (browserContext.tracing as any)[traceLegendSymbol];

    const tracesDir = traceLegend.tracesDir;
    await tracesDir.trackSize(await directorySize(tracesDir.path));

    response.addTextResult(`Trace recording stopped.`);
    response.addFileLink('Trace', `${tracesDir.path}/${traceLegend.name}.trace`);
    response.addFileLink('Network log', `${tracesDir.path}/${traceLegend.name}.network`);
    response.addFileLink('Resources', `${tracesDir.path}/resources`);
  },
});

export default [
  tracingStart,
  tracingStop,
];

const traceLegendSymbol = Symbol('tracesDir');

async function directorySize(dir: string): Promise<number> {
  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true, recursive: true });
  } catch {
    return 0;
  }
  const sizes = await Promise.all(entries.filter(e => e.isFile()).map(async e => {
    try {
      return (await fs.promises.stat(path.join(e.parentPath, e.name))).size;
    } catch {
      return 0;
    }
  }));
  return sizes.reduce((a, b) => a + b, 0);
}
