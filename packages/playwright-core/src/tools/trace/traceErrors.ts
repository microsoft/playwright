/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable no-console */

import { loadTrace, actionFullTitle } from './traceUtils';

export type TraceErrorItem = {
  actionOrdinal?: number;
  actionTitle?: string;
  message: string;
  stack: Array<{
    file: string;
    line?: number;
    column?: number;
  }>;
};

export async function traceErrors(options: { json?: boolean } = {}) {
  const trace = await loadTrace();
  const model = trace.model;

  if (options.json) {
    const list: TraceErrorItem[] = model.errorDescriptors.map(error => {
      const actionOrdinal = error.action ? trace.callIdToOrdinal.get(error.action.callId) : undefined;
      const actionTitle = error.action ? actionFullTitle(error.action) : undefined;
      return {
        actionOrdinal,
        actionTitle,
        message: error.message,
        stack: error.stack?.map(f => ({
          file: f.file,
          line: f.line,
          column: f.column,
        })) ?? [],
      };
    });
    console.log(JSON.stringify(list, null, 2));
    return;
  }

  if (!model.errorDescriptors.length) {
    console.log('  No errors');
    return;
  }

  for (const error of model.errorDescriptors) {
    if (error.action) {
      const title = actionFullTitle(error.action);
      console.log(`\n  ✗ ${title}`);
    } else {
      console.log(`\n  ✗ Error`);
    }

    if (error.stack?.length) {
      const frame = error.stack[0];
      const file = frame.file.replace(/.*[/\\](.*)/, '$1');
      console.log(`    at ${file}:${frame.line}:${frame.column}`);
    }
    console.log('');
    const indented = error.message.split('\n').map(l => `    ${l}`).join('\n');
    console.log(indented);
  }
  console.log('');
}
