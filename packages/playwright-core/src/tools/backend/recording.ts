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

const browserRecordingStart = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_recording_start',
    title: 'Start recording browser interactions',
    description: [
      'Starts capturing user browser interactions — clicks, form fills, navigations — into a recording buffer.',
      'Use this before asking the user to perform a workflow manually in the browser.',
      'Pair with `browser_recording_stop` to end the session and `browser_recording_get` to retrieve',
      'the captured interactions as Playwright TypeScript code.',
    ].join(' '),
    inputSchema: z.object({}),
    type: 'action',
  },

  handle: async (context, _params, response) => {
    await context.startRecording();
    response.addTextResult('Recording started. Interact with the browser, then call `browser_recording_get` to retrieve the captured Playwright code.');
  },
});

const browserRecordingStop = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_recording_stop',
    title: 'Stop recording browser interactions',
    description: [
      'Stops the active browser interaction recording session.',
      'The captured events remain accessible via `browser_recording_get` until a new recording is started.',
    ].join(' '),
    inputSchema: z.object({}),
    type: 'action',
  },

  handle: async (context, _params, response) => {
    const count = context.stopRecording();
    response.addTextResult(`Recording stopped. ${count} interaction(s) captured. Use \`browser_recording_get\` to retrieve the recorded code.`);
  },
});

const browserRecordingGet = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_recording_get',
    title: 'Get recorded browser interactions as Playwright code',
    description: [
      'Returns all browser interactions captured since `browser_recording_start` as a Playwright TypeScript code snippet.',
      'Can be called while recording is still in progress to retrieve a partial log.',
      'The buffer is not cleared by this call; use `browser_recording_stop` to end the session.',
    ].join(' '),
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async (context, _params, response) => {
    const lines = context.getRecordedCode();
    if (!lines.length) {
      response.addTextResult('No interactions have been recorded yet. Start a recording with `browser_recording_start` and interact with the browser first.');
      return;
    }
    response.addTextResult('Recorded interactions:\n\n```typescript\n' + lines.join('\n') + '\n```');
  },
});

const browserRecordingSave = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_recording_save',
    title: 'Save recorded interactions as a Playwright test file',
    description: [
      'Wraps the recorded browser interactions in a complete `@playwright/test` test and writes it to disk.',
      'Provide a human-readable `testName` (used as the test title) and an absolute or relative `outputPath`',
      'for the `.spec.ts` file. The directory will be created if it does not exist.',
      'The generated file content is also returned so you can review it immediately.',
    ].join(' '),
    inputSchema: z.object({
      testName: z.string().describe('Human-readable title for the test, e.g. "user can add a new component"'),
      outputPath: z.string().describe('File path where the .spec.ts file should be written, e.g. "tests/recorded/my-flow.spec.ts"'),
    }),
    type: 'action',
  },

  handle: async (context, params, response) => {
    const lines = context.getRecordedCode();
    if (!lines.length) {
      response.addTextResult('No interactions have been recorded yet. Start a recording with `browser_recording_start` and interact with the browser first.');
      return;
    }
    const content = context.saveRecordingAsTest(params.testName, params.outputPath);
    response.addTextResult(`Test file written to \`${params.outputPath}\`:\n\n\`\`\`typescript\n${content}\`\`\``);
  },
});

const browserRecordingReset = defineTool({
  capability: 'core',

  schema: {
    name: 'browser_recording_reset',
    title: 'Reset the recording buffer and start a fresh session',
    description: [
      'Clears all previously captured interactions and starts a brand-new recording session.',
      'Use this to distinguish the current workflow from earlier interactions that were already recorded.',
      'Equivalent to calling `browser_recording_stop` + clearing the buffer + `browser_recording_start`,',
      'but in a single step.',
    ].join(' '),
    inputSchema: z.object({}),
    type: 'action',
  },

  handle: async (context, _params, response) => {
    await context.resetRecording();
    response.addTextResult('Recording buffer cleared. A fresh recording session has started. Interact with the browser, then call `browser_recording_get` to retrieve only the new interactions.');
  },
});

export default [
  browserRecordingStart,
  browserRecordingStop,
  browserRecordingGet,
  browserRecordingSave,
  browserRecordingReset,
];
