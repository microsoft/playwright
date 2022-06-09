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
import { StackUtils } from '../utilsBundle';
import { isUnderTest } from './';

const stackUtils = new StackUtils();

export function rewriteErrorMessage<E extends Error>(e: E, newMessage: string): E {
  const lines: string[] = (e.stack?.split('\n') || []).filter(l => l.startsWith('    at '));
  e.message = newMessage;
  const errorTitle = `${e.name}: ${e.message}`;
  if (lines.length)
    e.stack = `${errorTitle}\n${lines.join('\n')}`;
  return e;
}

const CORE_DIR = path.resolve(__dirname, '..', '..');
const CORE_LIB = path.join(CORE_DIR, 'lib');
const CORE_SRC = path.join(CORE_DIR, 'src');
const TEST_DIR_SRC = path.resolve(CORE_DIR, '..', 'playwright-test');
const TEST_DIR_LIB = path.resolve(CORE_DIR, '..', '@playwright', 'test');
const COVERAGE_PATH = path.join(CORE_DIR, '..', '..', 'tests', 'config', 'coverage.js');

export type StackFrame = {
  file: string,
  line?: number,
  column?: number,
  function?: string,
};

export type ParsedStackTrace = {
  allFrames: StackFrame[];
  frames: StackFrame[];
  frameTexts: string[];
  apiName: string | undefined;
};

export function captureRawStack(): string {
  const stackTraceLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = 30;
  const error = new Error();
  const stack = error.stack!;
  Error.stackTraceLimit = stackTraceLimit;
  return stack;
}

export function isInternalFileName(file: string, functionName?: string): boolean {
  // Node 16+ has node:internal.
  if (file.startsWith('internal') || file.startsWith('node:'))
    return true;
  // EventEmitter.emit has 'events.js' file.
  if (file === 'events.js' && functionName?.endsWith('emit'))
    return true;
  // Node 12
  if (file === '_stream_readable.js' || file === '_stream_writable.js')
    return true;
  return false;
}

export function captureStackTrace(rawStack?: string): ParsedStackTrace {
  const stack = rawStack || captureRawStack();

  const isTesting = isUnderTest();
  type ParsedFrame = {
    frame: StackFrame;
    frameText: string;
    inCore: boolean;
  };
  let parsedFrames = stack.split('\n').map(line => {
    const frame = stackUtils.parseLine(line);
    if (!frame || !frame.file)
      return null;
    if (isInternalFileName(frame.file, frame.function))
      return null;
    // Workaround for https://github.com/tapjs/stack-utils/issues/60
    let fileName: string;
    if (frame.file.startsWith('file://'))
      fileName = new URL(frame.file).pathname;
    else
      fileName = path.resolve(process.cwd(), frame.file);
    if (isTesting && fileName.includes(COVERAGE_PATH))
      return null;
    const inCore = fileName.startsWith(CORE_LIB) || fileName.startsWith(CORE_SRC);
    const parsed: ParsedFrame = {
      frame: {
        file: fileName,
        line: frame.line,
        column: frame.column,
        function: frame.function,
      },
      frameText: line,
      inCore
    };
    return parsed;
  }).filter(Boolean) as ParsedFrame[];

  let apiName = '';
  const allFrames = parsedFrames;
  // Deepest transition between non-client code calling into client code
  // is the api entry.
  for (let i = 0; i < parsedFrames.length - 1; i++) {
    if (parsedFrames[i].inCore && !parsedFrames[i + 1].inCore) {
      const frame = parsedFrames[i].frame;
      apiName = normalizeAPIName(frame.function);
      parsedFrames = parsedFrames.slice(i + 1);
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

  // Hide all test runner and library frames in the user stack (event handlers produce them).
  parsedFrames = parsedFrames.filter((f, i) => {
    if (f.frame.file.startsWith(TEST_DIR_SRC) || f.frame.file.startsWith(TEST_DIR_LIB))
      return false;
    if (i && f.frame.file.startsWith(CORE_DIR))
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
