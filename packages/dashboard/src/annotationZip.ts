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

// @ts-ignore
import * as zipImport from '@zip.js/zip.js/lib/zip-no-worker-deflate.js';

import type * as zip from '@zip.js/zip.js';
import type { SubmittedAnnotationFrame } from './dashboardChannel';

const zipjs = zipImport as typeof zip;

function base64ToUint8(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++)
    out[i] = binary.charCodeAt(i);
  return out;
}

export async function buildAnnotationZip(frames: SubmittedAnnotationFrame[], feedback: string): Promise<Blob> {
  zipjs.configure({ useWebWorkers: false } as any);
  const writer = new zipjs.ZipWriter(new zipjs.BlobWriter('application/zip'));
  const yamlChunks: string[] = [];
  if (feedback)
    yamlChunks.push(`# feedback: ${feedback}\n`);
  for (let i = 0; i < frames.length; i++) {
    const idx = i + 1;
    const frame = frames[i];
    const session = frame.sessionTitle || 'session';
    const tab = frame.tabTitle || 'tab';
    const header = `screenshot ${idx}: ${session} / ${tab} @ ${frame.url} (${frame.viewportWidth}x${frame.viewportHeight})`;
    if (frame.data)
      await writer.add(`annotations-${idx}.png`, new zipjs.Uint8ArrayReader(base64ToUint8(frame.data)));
    const lines = [
      `--- # ${header}`,
      ...frame.annotations.map(a => `# { x: ${a.x}, y: ${a.y}, width: ${a.width}, height: ${a.height} }: ${a.text}`),
      frame.ariaSnapshot ?? '',
    ].join('\n');
    yamlChunks.push(lines);
  }
  await writer.add('annotations.yaml', new zipjs.TextReader(yamlChunks.join('\n')));
  return writer.close();
}
