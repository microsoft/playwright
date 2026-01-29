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
import { defineTabTool } from './tool';
import { dateAsFileName } from './utils';

const startVideo = defineTabTool({
  capability: 'devtools',

  schema: {
    name: 'browser_start_video',
    title: 'Start video',
    description: 'Start video recording',
    inputSchema: z.object({
      size: z.object({
        width: z.number().describe('Video width'),
        height: z.number().describe('Video height'),
      }).optional().describe('Video size'),
    }),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    await tab.page.video().start({ size: params.size });
    response.addTextResult('Video recording started.');
  },
});

const stopVideo = defineTabTool({
  capability: 'devtools',

  schema: {
    name: 'browser_stop_video',
    title: 'Stop video',
    description: 'Stop video recording',
    inputSchema: z.object({
      filename: z.string().optional().describe('Filename to save the video'),
    }),
    type: 'readOnly',
  },

  handle: async (tab, params, response) => {
    let videoPath: string | undefined;
    if (params.filename) {
      const suggestedFilename = params.filename ?? dateAsFileName('video', 'webm');
      videoPath = await tab.context.outputFile(suggestedFilename, { origin: 'llm', title: 'Saving video' });
    }
    await tab.page.video().stop({ path: videoPath });
    const tmpPath = await tab.page.video().path();
    response.addTextResult(`Video recording stopped: ${videoPath ?? tmpPath}`);
  },
});

export default [
  startVideo,
  stopVideo,
];
