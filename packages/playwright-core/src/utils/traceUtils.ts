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

import type { ClientSideCallMetadata, StackFrame } from '@protocol/channels';
import type { SerializedClientSideCallMetadata } from '@trace/traceUtils';

export function serializeClientSideCallMetadata(metadatas: ClientSideCallMetadata[]): SerializedClientSideCallMetadata {
  const stackFrames = new Map<string, number>();
  const frames: StackFrame[] = [];
  const stacks: [number, number[]][] = [];
  for (const m of metadatas) {
    if (!m.stack || !m.stack.length)
      continue;
    const stack: number[] = [];
    for (const frame of m.stack) {
      const key = `${frame.file}:${frame.line || 0}:${frame.column || 0}`;
      let ordinal = stackFrames.get(key);
      if (typeof ordinal !== 'number') {
        ordinal = stackFrames.size;
        stackFrames.set(key, ordinal);
        frames.push(frame);
      }
      stack.push(ordinal);
    }
    stacks.push([m.id, stack]);
  }
  return { frames, stacks };
}
