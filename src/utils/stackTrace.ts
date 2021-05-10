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

import path from 'path';
import { StackFrame } from '../common/types';
import StackUtils from 'stack-utils';
import { isUnderTest } from './utils';

const stackUtils = new StackUtils();

export function getCallerFilePath(ignorePrefix: string): string | null {
  const frame = captureStackTrace().frames.find(f => !f.file.startsWith(ignorePrefix));
  return frame ? frame.file : null;
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

const PW_LIB_DIRS = [
  'playwright',
  'playwright-chromium',
  'playwright-firefox',
  'playwright-webkit',
].map(packageName => path.sep + path.join(packageName, 'lib'));

export function captureStackTrace(): { stack: string, frames: StackFrame[] } {
  const stackTraceLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = 30;
  const stack = new Error().stack!;
  Error.stackTraceLimit = stackTraceLimit;
  const frames: StackFrame[] = [];
  for (const line of stack.split('\n')) {
    const frame = stackUtils.parseLine(line);
    if (!frame || !frame.file)
      continue;
    if (frame.file.startsWith('internal'))
      continue;
    const fileName = path.resolve(process.cwd(), frame.file);
    if (PW_LIB_DIRS.some(libDir => fileName.includes(libDir)))
      continue;
    // for tests.
    if (isUnderTest() && fileName.includes(path.join('playwright', 'src')))
      continue;
    if (isUnderTest() && fileName.includes(path.join('playwright', 'tests', 'config', 'coverage.js')))
      continue;
    frames.push({
      file: fileName,
      line: frame.line,
      column: frame.column,
      function: frame.function,
    });
  }
  return { stack, frames };
}

export function splitErrorMessage(message: string): { name: string, message: string } {
  const separationIdx = message.indexOf(':');
  return {
    name: separationIdx !== -1 ? message.slice(0, separationIdx) : '',
    message: separationIdx !== -1 && separationIdx + 2 <= message.length ? message.substring(separationIdx + 2) : message,
  };
}
