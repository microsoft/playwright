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
  const stackFrames = (error.stack || '').split('\n').slice(1);
  // Find first stackframe that doesn't point to ignorePrefix.
  for (const frame of stackFrames) {
    const parsed = parseStackFrame(frame);
    if (!parsed)
      return null;
    if (parsed.filePath.startsWith(ignorePrefix) || parsed.filePath === __filename)
      continue;
    return parsed.filePath;
  }
  return null;
}

export function getCurrentApiCall(prefix = PLAYWRIGHT_LIB_PATH): string {
  const error = new Error();
  const stackFrames = (error.stack || '').split('\n').slice(1);
  // Find last stackframe that points to prefix - that should be the api call.
  let apiName: string = '';
  for (const frame of stackFrames) {
    const parsed = parseStackFrame(frame);
    if (!parsed || (!parsed.filePath.startsWith(prefix) && parsed.filePath !== __filename))
      break;
    apiName = parsed.functionName;
  }
  const parts = apiName.split('.');
  if (parts.length && parts[0].length) {
    parts[0] = parts[0][0].toLowerCase() + parts[0].substring(1);
    if (parts[0] === 'webKit')
      parts[0] = 'webkit';
  }
  return parts.join('.');
}
