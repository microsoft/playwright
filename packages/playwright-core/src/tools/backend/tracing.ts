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

import * as z from 'zod';
import { defineTool } from './tool';

import type { Context, TraceInfo } from './context';
import type { Response } from './response';


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
    const traces = await context.startTracing();
    response.addTextResult(`Trace recording started`);
    await addTraceLinks(context, response, traces, 'Action log');
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
    const traces = await context.stopTracing();
    if (!traces)
      throw new Error('Tracing is not started');
    response.addTextResult(`Trace recording stopped.`);
    await addTraceLinks(context, response, traces, 'Trace');
  },
});

async function addTraceLinks(context: Context, response: Response, traces: TraceInfo[], traceTitle: string) {
  const tracesDir = await context.outputFile({ prefix: '', suggestedFilename: `traces`, ext: '' }, { origin: 'code' });
  for (const trace of traces) {
    const suffix = trace.isolatedContext ? ` (isolatedContext: ${trace.isolatedContext})` : '';
    response.addFileLink(traceTitle + suffix, `${tracesDir}/${trace.name}.trace`);
    response.addFileLink('Network log' + suffix, `${tracesDir}/${trace.name}.network`);
  }
  response.addFileLink('Resources', `${tracesDir}/resources`);
}

export default [
  tracingStart,
  tracingStop,
];
