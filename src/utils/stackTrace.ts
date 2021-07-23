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
  path.join('@playwright', 'test'),
].map(packageName => path.sep + packageName);

const runnerNpmPkgLib = path.join('@playwright', 'test', 'lib', 'test');
const runnerLib = path.join('lib', 'test');
const runnerSrc = path.join('src', 'test');

function includesFileInPlaywrightSubDir(subDir: string, fileName: string) {
  return PW_LIB_DIRS.map(p => path.join(p, subDir)).some(libDir => fileName.includes(libDir));
}

export type ParsedStackTrace = {
  frames: StackFrame[];
  frameTexts: string[];
  apiName: string;
};

export function captureStackTrace(): ParsedStackTrace {
  const stackTraceLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = 30;
  const error = new Error();
  const stack = error.stack!;
  Error.stackTraceLimit = stackTraceLimit;
  const frames: StackFrame[] = [];
  const frameTexts: string[] = [];
  const lines = stack.split('\n').reverse();
  let apiName = '';

  const isTesting = !!process.env.PWTEST_CLI_ALLOW_TEST_COMMAND || isUnderTest();

  for (const line of lines) {
    const frame = stackUtils.parseLine(line);
    if (!frame || !frame.file)
      continue;
    if (frame.file.startsWith('internal'))
      continue;
    const fileName = path.resolve(process.cwd(), frame.file);
    if (isTesting && fileName.includes(path.join('playwright', 'tests', 'config', 'coverage.js')))
      continue;
    if (isFilePartOfPlaywright(isTesting, fileName)) {
      apiName = frame.function ? frame.function[0].toLowerCase() + frame.function.slice(1) : '';
      break;
    }
    frameTexts.push(line);
    frames.push({
      file: fileName,
      line: frame.line,
      column: frame.column,
      function: frame.function,
    });
  }
  frames.reverse();
  frameTexts.reverse();
  return { frames, frameTexts, apiName };
}

function isFilePartOfPlaywright(isTesting: boolean, fileName: string): boolean {
  const isPlaywrightTest = fileName.includes(runnerNpmPkgLib);
  const isLocalPlaywright = isTesting && (fileName.includes(runnerSrc) || fileName.includes(runnerLib));
  const isInPlaywright = (includesFileInPlaywrightSubDir('src', fileName) || includesFileInPlaywrightSubDir('lib', fileName));
  return !isPlaywrightTest && !isLocalPlaywright && isInPlaywright;
}

export function splitErrorMessage(message: string): { name: string, message: string } {
  const separationIdx = message.indexOf(':');
  return {
    name: separationIdx !== -1 ? message.slice(0, separationIdx) : '',
    message: separationIdx !== -1 && separationIdx + 2 <= message.length ? message.substring(separationIdx + 2) : message,
  };
}
