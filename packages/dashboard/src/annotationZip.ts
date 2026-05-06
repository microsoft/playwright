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

export async function buildAnnotationZip(frames: SubmittedAnnotationFrame[], feedback: string): Promise<Blob> {
  zipjs.configure({ useWebWorkers: false } as any);
  const writer = new zipjs.ZipWriter(new zipjs.BlobWriter('application/zip'));

  const mdLines: string[] = [];
  if (feedback)
    mdLines.push(feedback, '');

  for (let i = 0; i < frames.length; i++) {
    const idx = i + 1;
    const frame = frames[i];
    const session = frame.sessionTitle || 'session';
    const tab = frame.title || 'tab';
    const header = `screenshot ${idx}: ${session} / ${tab} @ ${frame.url} (${frame.viewportWidth}x${frame.viewportHeight})`;

    mdLines.push(`## ${header}`);
    if (frame.data) {
      const pngFile = `annotations-${idx}.png`;
      await writer.add(pngFile, new zipjs.Uint8ArrayReader(Uint8Array.fromBase64(frame.data)));
      mdLines.push(`- [Screenshot ${idx}](${pngFile})`);
    }
    if (frame.ariaSnapshot) {
      const yamlFile = `annotations-${idx}.yaml`;
      const annotationLines = frame.annotations.map(a => `# { x: ${a.x}, y: ${a.y}, width: ${a.width}, height: ${a.height} }: ${a.text}`);
      const yamlContent = [...annotationLines, frame.ariaSnapshot].join('\n');
      await writer.add(yamlFile, new zipjs.TextReader(yamlContent));
      mdLines.push(`- [Aria snapshot ${idx}](${yamlFile})`);
    }
    for (const a of frame.annotations) {
      if (a.text)
        mdLines.push(`- { x: ${a.x}, y: ${a.y}, width: ${a.width}, height: ${a.height} }: ${a.text}`);
    }
    mdLines.push('');
  }

  await writer.add('feedback.md', new zipjs.TextReader(mdLines.join('\n')));
  return writer.close();
}
