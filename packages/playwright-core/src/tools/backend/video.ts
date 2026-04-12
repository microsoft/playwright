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

import { z } from '../../zodBundle';
import { defineTool } from './tool';

const videoStart = defineTool({
  capability: 'devtools',

  schema: {
    name: 'browser_start_video',
    title: 'Start video',
    description: 'Start video recording',
    inputSchema: z.object({
      filename: z.string().optional().describe('Filename to save the video.'),
      size: z.object({
        width: z.number().describe('Video width'),
        height: z.number().describe('Video height'),
      }).optional().describe('Video size'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params, response) => {
    const resolvedFile = await response.resolveClientFile({ prefix: 'video', ext: 'webm', suggestedFilename: params.filename }, 'Video');
    await context.startVideoRecording(resolvedFile.fileName, { size: params.size });
    response.addTextResult('Video recording started.');
  },
});

const videoStop = defineTool({
  capability: 'devtools',

  schema: {
    name: 'browser_stop_video',
    title: 'Stop video',
    description: 'Stop video recording',
    inputSchema: z.object({}),
    type: 'readOnly',
  },

  handle: async (context, params, response) => {
    const fileNames = await context.stopVideoRecording();
    if (!fileNames.length) {
      response.addTextResult('No videos were recorded.');
      return;
    }
    for (const fileName of fileNames) {
      const resolvedFile = await response.resolveClientFile({
        prefix: 'video',
        ext: 'webm',
        suggestedFilename: fileName
      }, 'Video');
      await response.addFileResult(resolvedFile, null);
    }
  },
});

const videoChapter = defineTool({
  capability: 'devtools',

  schema: {
    name: 'browser_video_chapter',
    title: 'Video chapter',
    description: 'Add a chapter marker to the video recording. Shows a full-screen chapter card with blurred backdrop.',
    inputSchema: z.object({
      title: z.string().describe('Chapter title'),
      description: z.string().optional().describe('Chapter description'),
      duration: z.number().optional().describe('Duration in milliseconds to show the chapter card'),
    }),
    type: 'readOnly',
  },

  handle: async (context, params, response) => {
    const tab = context.currentTabOrDie();
    await tab.page.screencast.showChapter(params.title, {
      description: params.description,
      duration: params.duration,
    });
    response.addTextResult(`Chapter '${params.title}' added.`);
  },
});

export default [
  videoStart,
  videoStop,
  videoChapter,
];
