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

import * as path from 'path';

// NOTE: update this to point to playwright/lib when moving this file.
const PLAYWRIGHT_LIB_PATH = path.normalize(path.join(__dirname, '..'));

type ParsedStackFrame = { filePath: string, functionName: string };

function parseStackFrame(frame: string): ParsedStackFrame | null {
  frame = frame.trim();
  if (!frame.startsWith('at '))
    return null;
  frame = frame.substring('at '.length);
  if (frame.startsWith('async '))
    frame = frame.substring('async '.length);
  let location: string;
  let functionName: string;
  if (frame.endsWith(')')) {
    const from = frame.indexOf('(');
    location = frame.substring(from + 1, frame.length - 1);
    functionName = frame.substring(0, from).trim();
  } else {
    location = frame;
    functionName = '';
  }
  const match = location.match(/^(?:async )?([^(]*):(\d+):(\d+)$/);
  if (!match)
    return null;
  const filePath = match[1];
  return { filePath, functionName };
}

export function getCallerFilePath(ignorePrefix = PLAYWRIGHT_LIB_PATH): string | null {
  const error = new Error();
  const stackFrames = (error.stack || '').split('\n').slice(2);
  // Find first stackframe that doesn't point to ignorePrefix.
  for (const frame of stackFrames) {
    const parsed = parseStackFrame(frame);
    if (!parsed)
      return null;
    if (parsed.filePath.startsWith(ignorePrefix))
      continue;
    return parsed.filePath;
  }
  return null;
}

export function rewriteErrorMessage(e: Error, newMessage: string): Error {
  if (e.stack) {
    const index = e.stack.indexOf(e.message);
    if (index !== -1)
      e.stack = e.stack.substring(0, index) + newMessage + e.stack.substring(index + e.message.length);
  }
  e.message = newMessage;
  return e;
}

