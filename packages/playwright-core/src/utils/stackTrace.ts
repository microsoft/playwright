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
import { StackFrame } from '../protocol/channels';
import StackUtils from 'stack-utils';
import { isUnderTest } from './utils';

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
const CLIENT_LIB = path.join(CORE_DIR, 'lib', 'client');
const CLIENT_SRC = path.join(CORE_DIR, 'src', 'client');
const TEST_DIR_SRC = path.resolve(CORE_DIR, '..', 'playwright-test');
const TEST_DIR_LIB = path.resolve(CORE_DIR, '..', '@playwright', 'test');
const WS_LIB = path.relative(process.cwd(), path.dirname(require.resolve('ws')));

export type ParsedStackTrace = {
  allFrames: StackFrame[];
  frames: StackFrame[];
  frameTexts: string[];
  apiName: string | undefined;
};

export function captureStackTrace(): ParsedStackTrace {
  const stackTraceLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = 30;
  const error = new Error();
  const stack = error.stack!;
  Error.stackTraceLimit = stackTraceLimit;

  const isTesting = isUnderTest();
  type ParsedFrame = {
    frame: StackFrame;
    frameText: string;
    inClient: boolean;
  };
  let parsedFrames = stack.split('\n').map(line => {
    const frame = stackUtils.parseLine(line);
    if (!frame || !frame.file)
      return null;
    // Node 16+ has node:internal.
    if (frame.file.startsWith('internal') || frame.file.startsWith('node:'))
      return null;
    // EventEmitter.emit has 'events.js' file.
    if (frame.file === 'events.js' && frame.function?.endsWith('.emit'))
      return null;
    // Node 12
    if (frame.file === '_stream_readable.js' || frame.file === '_stream_writable.js')
      return null;
    if (frame.file.startsWith(WS_LIB))
      return null;
    // Workaround for https://github.com/tapjs/stack-utils/issues/60
    let fileName: string;
    if (frame.file.startsWith('file://'))
      fileName = new URL(frame.file).pathname;
    else
      fileName = path.resolve(process.cwd(), frame.file);
    if (isTesting && fileName.includes(path.join('playwright', 'tests', 'config', 'coverage.js')))
      return null;
    const inClient = fileName.startsWith(CLIENT_LIB) || fileName.startsWith(CLIENT_SRC);
    const parsed: ParsedFrame = {
      frame: {
        file: fileName,
        line: frame.line,
        column: frame.column,
        function: frame.function,
      },
      frameText: line,
      inClient
    };
    return parsed;
  }).filter(Boolean) as ParsedFrame[];

  let apiName = '';
  const allFrames = parsedFrames;

  // expect matchers have the following stack structure:
  // at Object.__PWTRAP__[expect.toHaveText] (...)
  // at __EXTERNAL_MATCHER_TRAP__ (...)
  // at Object.throwingMatcher [as toHaveText] (...)
  const TRAP = '__PWTRAP__[';
  const expectIndex = parsedFrames.findIndex(f => f.frameText.includes(TRAP));
  if (expectIndex !== -1) {
    const text = parsedFrames[expectIndex].frameText;
    const aliasIndex = text.indexOf(TRAP);
    apiName = text.substring(aliasIndex + TRAP.length, text.indexOf(']'));
    parsedFrames = parsedFrames.slice(expectIndex + 3);
  } else {
    // Deepest transition between non-client code calling into client code
    // is the api entry.
    for (let i = 0; i < parsedFrames.length - 1; i++) {
      if (parsedFrames[i].inClient && !parsedFrames[i + 1].inClient) {
        const frame = parsedFrames[i].frame;
        apiName = frame.function ? frame.function[0].toLowerCase() + frame.function.slice(1) : '';
        parsedFrames = parsedFrames.slice(i + 1);
        break;
      }
    }
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
