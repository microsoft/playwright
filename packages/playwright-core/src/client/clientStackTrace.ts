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

import { captureRawStack, parseStackFrame } from '../utils/isomorphic/stackTrace';

import type { Platform } from './platform';
import type { StackFrame } from '@isomorphic/stackTrace';

export function captureLibraryStackTrace(platform: Platform): { frames: StackFrame[], apiName: string } {
  const stack = captureRawStack();

  type ParsedFrame = {
    frame: StackFrame;
    frameText: string;
    isPlaywrightLibrary: boolean;
  };
  let parsedFrames = stack.map(line => {
    const frame = parseStackFrame(line, platform.pathSeparator, platform.showInternalStackFrames());
    if (!frame || !frame.file)
      return null;
    const isPlaywrightLibrary = !!platform.coreDir && frame.file.startsWith(platform.coreDir);
    const parsed: ParsedFrame = {
      frame,
      frameText: line,
      isPlaywrightLibrary
    };
    return parsed;
  }).filter(Boolean) as ParsedFrame[];

  let apiName = '';

  // Deepest transition between non-client code calling into client
  // code is the api entry.
  for (let i = 0; i < parsedFrames.length - 1; i++) {
    const parsedFrame = parsedFrames[i];
    if (parsedFrame.isPlaywrightLibrary && !parsedFrames[i + 1].isPlaywrightLibrary) {
      apiName = apiName || normalizeAPIName(parsedFrame.frame.function);
      break;
    }
  }

  function normalizeAPIName(name?: string): string {
    if (!name)
      return '';
    const match = name.match(/(API|JS|CDP|[A-Z])(.*)/);
    if (!match)
      return name;
    return match[1].toLowerCase() + match[2];
  }

  // This is for the inspector so that it did not include the test runner stack frames.
  const filterPrefixes = platform.boxedStackPrefixes();
  parsedFrames = parsedFrames.filter(f => {
    if (filterPrefixes.some(prefix => f.frame.file.startsWith(prefix)))
      return false;
    return true;
  });

  return {
    frames: parsedFrames.map(p => p.frame),
    apiName
  };
}
