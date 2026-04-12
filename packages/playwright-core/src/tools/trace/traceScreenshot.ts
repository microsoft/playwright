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

import { loadTrace, saveOutputFile } from './traceUtils';

export async function traceScreenshot(actionId: string, options: { output?: string }) {
  const trace = await loadTrace();

  const action = trace.resolveActionId(actionId);
  if (!action) {
    console.error(`Action '${actionId}' not found.`);
    process.exitCode = 1;
    return;
  }

  const pageId = action.pageId;
  if (!pageId) {
    console.error(`Action '${actionId}' has no associated page.`);
    process.exitCode = 1;
    return;
  }

  const callId = action.callId;
  const storage = trace.loader.storage();
  const snapshotNames = ['input', 'before', 'after'];
  let sha1: string | undefined;
  for (const name of snapshotNames) {
    const renderer = storage.snapshotByName(pageId, `${name}@${callId}`);
    sha1 = renderer?.closestScreenshot();
    if (sha1)
      break;
  }

  if (!sha1) {
    console.error(`No screenshot found for action '${actionId}'.`);
    process.exitCode = 1;
    return;
  }

  const blob = await trace.loader.resourceForSha1(sha1);
  if (!blob) {
    console.error(`Screenshot resource not found.`);
    process.exitCode = 1;
    return;
  }

  const defaultName = `screenshot-${actionId}.png`;
  const buffer = Buffer.from(await blob.arrayBuffer());
  const outFile = await saveOutputFile(defaultName, buffer, options.output);
  console.log(`  Screenshot saved to ${outFile}`);
}
