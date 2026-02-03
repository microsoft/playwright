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

import { z } from 'playwright-core/lib/mcpBundle';
import { defineTool } from './tool';

import type { Tracing } from '../../../../../playwright-core/src/client/tracing';

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
    await (browserContext.tracing as Tracing).start({
      name,
      screenshots: true,
      snapshots: true,
      _live: true,
    });
    response.addTextResult(`Trace recording started`);
    response.addFileLink('Action log', `${tracesDir}/${name}.trace`);
    response.addFileLink('Network log', `${tracesDir}/${name}.network`);
    response.addFileLink('Resources', `${tracesDir}/resources`);
    (browserContext.tracing as any)[traceLegendSymbol] = { tracesDir, name };
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
    const traceLegend = (browserContext.tracing as any)[traceLegendSymbol];
    response.addTextResult(`Trace recording stopped.`);
    response.addFileLink('Trace', `${traceLegend.tracesDir}/${traceLegend.name}.trace`);
    response.addFileLink('Network log', `${traceLegend.tracesDir}/${traceLegend.name}.network`);
    response.addFileLink('Resources', `${traceLegend.tracesDir}/resources`);
  },
});

export default [
  tracingStart,
  tracingStop,
];

const traceLegendSymbol = Symbol('tracesDir');
