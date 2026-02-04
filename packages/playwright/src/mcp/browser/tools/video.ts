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
import { z } from 'playwright-core/lib/mcpBundle';
import { defineTool } from './tool';

const startVideo = defineTool({
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

  handle: async (context, params, response) => {
    await context.startVideoRecording({ size: params.size });
    response.addTextResult('Video recording started.');
  },
});

const stopVideo = defineTool({
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

  handle: async (context, params, response) => {
    const videos = await context.stopVideoRecording();
    if (!videos.size) {
      response.addTextResult('No videos were recorded.');
      return;
    }
    for (const [index, video] of [...videos].entries()) {
      const suffix = index ? `-${index}` : '';
      let suggestedFilename = params.filename;
      if (suggestedFilename && suffix) {
        const ext = path.extname(suggestedFilename);
        suggestedFilename = path.basename(suggestedFilename, ext) + suffix + ext;
      }
      const resolvedFile = await response.resolveClientFile({ prefix: 'video' + suffix, ext: 'webm', suggestedFilename }, 'Video');
      await video.saveAs(resolvedFile.fileName);
      await response.addFileResult(resolvedFile, null);
    }
  },
});

export default [
  startVideo,
  stopVideo,
];
