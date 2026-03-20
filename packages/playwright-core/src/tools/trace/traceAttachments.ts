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

export async function traceAttachments() {
  const trace = await loadTrace();

  if (!trace.model.attachments.length) {
    console.log('  No attachments');
    return;
  }
  console.log(`  ${'#'.padStart(4)} ${'Name'.padEnd(40)} ${'Content-Type'.padEnd(30)} ${'Action'.padEnd(8)}`);
  console.log(`  ${'─'.repeat(4)} ${'─'.repeat(40)} ${'─'.repeat(30)} ${'─'.repeat(8)}`);
  for (let i = 0; i < trace.model.attachments.length; i++) {
    const a = trace.model.attachments[i];
    const actionOrdinal = trace.callIdToOrdinal.get(a.callId);
    console.log(`  ${((i + 1) + '.').padStart(4)} ${a.name.padEnd(40)} ${a.contentType.padEnd(30)} ${(actionOrdinal !== undefined ? String(actionOrdinal) : a.callId).padEnd(8)}`);
  }
}

export async function traceAttachment(attachmentId: string, options: { output?: string }) {
  const trace = await loadTrace();

  const ordinal = parseInt(attachmentId, 10);
  const attachment = !isNaN(ordinal) && ordinal >= 1 && ordinal <= trace.model.attachments.length
    ? trace.model.attachments[ordinal - 1]
    : undefined;

  if (!attachment) {
    console.error(`Attachment '${attachmentId}' not found. Use 'trace attachments' to see available attachments.`);
    process.exitCode = 1;
    return;
  }

  let content: Buffer | undefined;
  if (attachment.sha1) {
    const blob = await trace.loader.resourceForSha1(attachment.sha1);
    if (blob)
      content = Buffer.from(await blob.arrayBuffer());
  } else if (attachment.base64) {
    content = Buffer.from(attachment.base64, 'base64');
  }

  if (!content) {
    console.error(`Could not extract attachment content.`);
    process.exitCode = 1;
    return;
  }

  const outFile = await saveOutputFile(attachment.name, content, options.output);
  console.log(`  Attachment saved to ${outFile}`);
}
