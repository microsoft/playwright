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

import { findRepeatedSubsequences } from './sequence';
import { parseStackFrame } from './stackUtils';

import type { StackFrame } from '@protocol/channels';
import type { Platform } from '../../common/platform';

export function parseStackTraceLine(line: string, pathSeparator: string): StackFrame | null {
  const frame = parseStackFrame(line, pathSeparator);
  if (!frame)
    return null;
  if (!process.env.PWDEBUGIMPL && (frame.file?.startsWith('internal') || frame.file?.startsWith('node:')))
    return null;
  if (!frame.file)
    return null;
  return {
    file: frame.file,
    line: frame.line || 0,
    column: frame.column || 0,
    function: frame.function,
  };
}

export function rewriteErrorMessage<E extends Error>(e: E, newMessage: string): E {
  const lines: string[] = (e.stack?.split('\n') || []).filter(l => l.startsWith('    at '));
  e.message = newMessage;
  const errorTitle = `${e.name}: ${e.message}`;
  if (lines.length)
    e.stack = `${errorTitle}\n${lines.join('\n')}`;
  return e;
}

let coreDir: string | undefined;

const playwrightStackPrefixes: string[] = [];
export const addInternalStackPrefix = (prefix: string) => playwrightStackPrefixes.push(prefix);

export const setLibraryStackPrefix = (prefix: string) => {
  coreDir = prefix;
  playwrightStackPrefixes.push(prefix);
};

export type RawStack = string[];

export function captureRawStack(): RawStack {
  const stackTraceLimit = Error.stackTraceLimit;
  Error.stackTraceLimit = 50;
  const error = new Error();
  const stack = error.stack || '';
  Error.stackTraceLimit = stackTraceLimit;
  return stack.split('\n');
}

export function captureLibraryStackTrace(pathSeparator: string): { frames: StackFrame[], apiName: string } {
  const stack = captureRawStack();

  type ParsedFrame = {
    frame: StackFrame;
    frameText: string;
    isPlaywrightLibrary: boolean;
  };
  let parsedFrames = stack.map(line => {
    const frame = parseStackTraceLine(line, pathSeparator);
    if (!frame || !frame.file)
      return null;
    const isPlaywrightLibrary = !!coreDir && frame.file.startsWith(coreDir);
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
  parsedFrames = parsedFrames.filter(f => {
    if (process.env.PWDEBUGIMPL)
      return true;
    if (playwrightStackPrefixes.some(prefix => f.frame.file.startsWith(prefix)))
      return false;
    return true;
  });

  return {
    frames: parsedFrames.map(p => p.frame),
    apiName
  };
}

export function stringifyStackFrames(frames: StackFrame[]): string[] {
  const stackLines: string[] = [];
  for (const frame of frames) {
    if (frame.function)
      stackLines.push(`    at ${frame.function} (${frame.file}:${frame.line}:${frame.column})`);
    else
      stackLines.push(`    at ${frame.file}:${frame.line}:${frame.column}`);
  }
  return stackLines;
}

export function splitErrorMessage(message: string): { name: string, message: string } {
  const separationIdx = message.indexOf(':');
  return {
    name: separationIdx !== -1 ? message.slice(0, separationIdx) : '',
    message: separationIdx !== -1 && separationIdx + 2 <= message.length ? message.substring(separationIdx + 2) : message,
  };
}

export function formatCallLog(platform: Platform, log: string[] | undefined): string {
  if (!log || !log.some(l => !!l))
    return '';
  return `
Call log:
${platform.colors.dim(log.join('\n'))}
`;
}

export function compressCallLog(log: string[]): string[] {
  const lines: string[] = [];

  for (const block of findRepeatedSubsequences(log)) {
    for (let i = 0; i < block.sequence.length; i++) {
      const line = block.sequence[i];
      const leadingWhitespace = line.match(/^\s*/);
      const whitespacePrefix = '  ' + leadingWhitespace?.[0] || '';
      const countPrefix = `${block.count} × `;
      if (block.count > 1 && i === 0)
        lines.push(whitespacePrefix + countPrefix + line.trim());
      else if (block.count > 1)
        lines.push(whitespacePrefix + ' '.repeat(countPrefix.length - 2) + '- ' + line.trim());
      else
        lines.push(whitespacePrefix + '- ' + line.trim());
    }
  }
  return lines;
}
