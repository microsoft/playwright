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
import { codeframeForLanguage } from './codegen';
import { defineTool } from './tool';

const startRecording = defineTool({
  capability: 'devtools',

  schema: {
    name: 'browser_start_recording',
    title: 'Start recording user actions',
    description: 'Start recording actions that the user performs in the browser as Playwright code. Use it when the user wants to demonstrate a flow manually. Call browser_stop_recording when the user says they are done to retrieve the recorded actions.',
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async (context, params, response) => {
    const tab = await context.ensureTab();
    await context.startRecording();
    await tab.page.bringToFront();
    response.addTextResult(`Recording started. Call ${stopRecording.schema.name} to retrieve the recorded actions.`);
  },
});

const stopRecording = defineTool({
  capability: 'devtools',

  schema: {
    name: 'browser_stop_recording',
    title: 'Stop recording user actions',
    description: 'Stop the recording started with browser_start_recording and return the recorded actions as Playwright code.',
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async (context, params, response) => {
    const recordedActions = await context.stopRecording();
    if (!recordedActions)
      throw new Error(`No recording in progress, use ${startRecording.schema.name} to start one.`);
    if (!recordedActions.length) {
      response.addTextResult('Recording stopped. No actions were recorded.');
    } else {
      const codeframe = codeframeForLanguage(context.codegenLanguage());
      response.addTextResult(`Recording stopped. Recorded actions:\n\n\`\`\`${codeframe}\n${recordedActions.join('\n')}\n\`\`\``);
    }
    response.setIncludeSnapshot();
  },
});

export default [
  startRecording,
  stopRecording,
];
