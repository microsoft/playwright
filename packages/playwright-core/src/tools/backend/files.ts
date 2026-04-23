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
import { formatObject } from '@isomorphic/stringUtils';
import { defineTabTool } from './tool';
import { elementSchema } from './snapshot';

export const uploadFile = defineTabTool({
  capability: 'core',

  schema: {
    name: 'browser_file_upload',
    title: 'Upload files',
    description: 'Upload one or multiple files',
    inputSchema: z.object({
      paths: z.array(z.string()).optional().describe('The absolute paths to the files to upload. Can be single file or multiple files. If omitted, file chooser is cancelled.'),
    }),
    type: 'action',
  },

  handle: async (tab, params, response) => {
    response.setIncludeSnapshot();

    const modalState = tab.modalStates().find(state => state.type === 'fileChooser');
    if (!modalState)
      throw new Error('No file chooser visible');

    if (params.paths)
      await Promise.all(params.paths.map(filePath => response.resolveClientFilename(filePath)));

    response.addCode(`await fileChooser.setFiles(${JSON.stringify(params.paths)})`);

    tab.clearModalState(modalState);
    await tab.waitForCompletion(async () => {
      if (params.paths)
        await modalState.fileChooser.setFiles(params.paths);
    });
  },

  clearsModalState: 'fileChooser',
});

export const drop = defineTabTool({
  capability: 'core',

  schema: {
    name: 'browser_drop',
    title: 'Drop files or data onto an element',
    description: 'Drop files or MIME-typed data onto an element, as if dragged from outside the page. At least one of "paths" or "data" must be provided.',
    inputSchema: elementSchema.extend({
      paths: z.array(z.string()).optional().describe('Absolute paths to files to drop onto the element.'),
      data: z.record(z.string(), z.string()).optional().describe('Data to drop, as a map of MIME type to string value (e.g. {"text/plain": "hello", "text/uri-list": "https://example.com"}).'),
    }),
    type: 'action',
  },

  handle: async (tab, params, response) => {
    if (!params.paths?.length && !params.data)
      throw new Error('At least one of "paths" or "data" must be provided.');

    response.setIncludeSnapshot();
    const { locator, resolved } = await tab.targetLocator(params);

    if (params.paths)
      await Promise.all(params.paths.map(p => response.resolveClientFilename(p)));

    const payload: { files?: string | string[], data?: Record<string, string> } = {};
    if (params.paths?.length)
      payload.files = params.paths.length === 1 ? params.paths[0] : params.paths;
    if (params.data)
      payload.data = params.data;

    await tab.waitForCompletion(async () => {
      await locator.drop(payload, tab.actionTimeoutOptions);
    });

    response.addCode(`await page.${resolved}.drop(${formatObject(payload)});`);
  },
});

export default [
  uploadFile,
  drop,
];
