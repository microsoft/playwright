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
import { defineTabTool } from './tool';

export const handleDialog = defineTabTool({
  capability: 'core',

  schema: {
    name: 'browser_handle_dialog',
    title: 'Handle a dialog',
    description: 'Handle a dialog',
    inputSchema: z.object({
      accept: z.boolean().describe('Whether to accept the dialog.'),
      promptText: z.string().optional().describe('The text of the prompt in case of a prompt dialog.'),
    }),
    type: 'action',
  },

  handle: async (tab, params, response) => {
    const dialogState = tab.modalStates().find(state => state.type === 'dialog');
    if (!dialogState)
      throw new Error('No dialog visible');

    tab.clearModalState(dialogState);
    await tab.waitForCompletion(async () => {
      try {
        if (params.accept)
          await dialogState.dialog.accept(params.promptText);
        else
          await dialogState.dialog.dismiss();
      } catch (error) {
        if (!isStaleDialogError(error))
          throw error;
        // The modal state is already cleared above, so report instead of failing.
        response.addTextResult(`Dialog was already handled in the browser, e.g. dismissed by the user.`);
      }
    });
  },

  clearsModalState: 'dialog',
});

// Chromium reports a protocol error when the dialog was already handled outside of
// this session, e.g. by the user in headed mode. Firefox and WebKit silently succeed.
// The "already handled" assertion covers dialogs that were handled through the same
// server twice, e.g. by two concurrent clients.
function isStaleDialogError(error: unknown): boolean {
  return error instanceof Error && (
    error.message.includes('No dialog is showing') ||
    error.message.includes('dialog which is already handled')
  );
}

export default [
  handleDialog,
];
