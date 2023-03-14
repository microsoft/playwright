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
import { parseStackTraceLine } from '../utilsBundle';
import { isUnderTest } from './';
import type { StackFrame } from '@protocol/channels';

export function rewriteErrorMessage<E extends Error>(e: E, newMessage: string): E {
  const lines: string[] = (e.stack?.split('\n') || []).filter(l => l.startsWith('    at '));
  e.message = newMessage;
  const errorTitle = `${e.name}: ${e.message}`;
  if (lines.length)
    e.stack = `${errorTitle}\n${lines.join('\n')}`;
  return e;
}

const CORE_DIR = path.resolve(__dirname, '..', '..');
const COVERAGE_PATH = path.join(CORE_DIR, '..', '..', 'tests', 'config', 'coverage.js');

const internalStackPrefixes = [
  CORE_DIR,
];
export const addInternalStackPrefix = (prefix: string) => internalStackPrefixes.push(prefix);

export type ParsedStackTrace = {
  allFrames: StackFrame[];
  frames: StackFrame[];
  frameTexts: string[];
  apiName: string | undefined;
};

export type RawStack = string[];

export function captureRawStack(): RawStack {
  const stackTraceLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = 30;
  const error = new Error();
  const stack = error.stack || '';
  Error.stackTraceLimit = stackTraceLimit;
  return stack.split('\n');
}

export function captureLibraryStackTrace(rawStack?: RawStack): ParsedStackTrace {
  const stack = rawStack || captureRawStack();

  const isTesting = isUnderTest();
  type ParsedFrame = {
    frame: StackFrame;
    frameText: string;
    isPlaywrightLibrary: boolean;
  };
  let parsedFrames = stack.map(line => {
    const frame = parseStackTraceLine(line);
    if (!frame || !frame.file)
      return null;
    if (!process.env.PWDEBUGIMPL && isTesting && frame.file.includes(COVERAGE_PATH))
      return null;
    const isPlaywrightLibrary = frame.file.startsWith(CORE_DIR);
    const parsed: ParsedFrame = {
      frame,
      frameText: line,
      isPlaywrightLibrary
    };
    return parsed;
  }).filter(Boolean) as ParsedFrame[];

  let apiName = '';
  const allFrames = parsedFrames;

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
  parsedFrames = parsedFrames.filter(f => {
    if (process.env.PWDEBUGIMPL)
      return true;
    if (internalStackPrefixes.some(prefix => f.frame.file.startsWith(prefix)))
      return false;
    return true;
  });

  return {
    allFrames: allFrames.map(p => p.frame),
    frames: parsedFrames.map(p => p.frame),
    frameTexts: parsedFrames.map(p => p.frameText),
    apiName
  };
}

export function splitErrorMessage(message: string): { name: string, message: string } {
  const separationIdx = message.indexOf(':');
  return {
    name: separationIdx !== -1 ? message.slice(0, separationIdx) : '',
    message: separationIdx !== -1 && separationIdx + 2 <= message.length ? message.substring(separationIdx + 2) : message,
  };
}

export type ExpectZone = {
  title: string;
  wallTime: number;
};
