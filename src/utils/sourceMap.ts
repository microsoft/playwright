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

import * as fs from 'fs';
import * as util from 'util';
import { getCallerFilePath } from './stackTrace';
import { isDebugMode } from './utils';

type Position = {
  line: number;
  column: number;
};

let sourceUrlCounter = 0;
const playwrightSourceUrlPrefix = '__playwright_evaluation_script__';
const sourceUrlRegex = /^[\040\t]*\/\/[@#] sourceURL=\s*(\S*?)\s*$/m;

export function isPlaywrightSourceUrl(s: string): boolean {
  return s.startsWith(playwrightSourceUrlPrefix);
}

export function ensureSourceUrl(expression: string): string {
  return sourceUrlRegex.test(expression) ? expression : expression + generateSourceUrl();
}

export async function generateSourceMapUrl(functionText: string, generatedText: string): Promise<string> {
  if (!isDebugMode())
    return generateSourceUrl();
  const sourceMapUrl = await innerGenerateSourceMapUrl(functionText, generatedText);
  return sourceMapUrl || generateSourceUrl();
}

export function generateSourceUrl(): string {
  return `\n//# sourceURL=${playwrightSourceUrlPrefix}${sourceUrlCounter++}\n`;
}

async function innerGenerateSourceMapUrl(functionText: string, generatedText: string): Promise<string | undefined> {
  const filePath = getCallerFilePath();
  if (!filePath)
    return;
  try {
    const generatedIndex = generatedText.indexOf(functionText);
    if (generatedIndex === -1)
      return;
    const compiledPosition = findPosition(generatedText, generatedIndex);
    const source = await util.promisify(fs.readFile)(filePath, 'utf8');
    const sourceIndex = source.indexOf(functionText);
    if (sourceIndex === -1)
      return;
    const sourcePosition = findPosition(source, sourceIndex);
    const delta = findPosition(functionText, functionText.length);
    const sourceMap = generateSourceMap(filePath, sourcePosition, compiledPosition, delta);
    return `\n//# sourceMappingURL=data:application/json;base64,${Buffer.from(sourceMap).toString('base64')}\n`;
  } catch (e) {
  }
}

const VLQ_BASE_SHIFT = 5;
const VLQ_BASE = 1 << VLQ_BASE_SHIFT;
const VLQ_BASE_MASK = VLQ_BASE - 1;
const VLQ_CONTINUATION_BIT = VLQ_BASE;
const BASE64_DIGITS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64VLQ(value: number): string {
  if (value < 0)
    value = ((-value) << 1) | 1;
  else
    value <<= 1;
  let result = '';
  do {
    let digit = value & VLQ_BASE_MASK;
    value >>>= VLQ_BASE_SHIFT;
    if (value > 0)
      digit |= VLQ_CONTINUATION_BIT;
    result += BASE64_DIGITS[digit];
  } while (value > 0);
  return result;
}

function generateSourceMap(filePath: string, sourcePosition: Position, compiledPosition: Position, delta: Position): any {
  const mappings = [];
  let lastCompiled = { line: 0, column: 0 };
  let lastSource = { line: 0, column: 0 };
  for (let line = 0; line < delta.line; line++) {
    // We need at least a mapping per line. This will yield an execution line at the start of each line.
    // Note: for more granular mapping, we can do word-by-word.
    const source = advancePosition(sourcePosition, { line, column: 0 });
    const compiled = advancePosition(compiledPosition, { line, column: 0 });
    while (lastCompiled.line < compiled.line) {
      mappings.push(';');
      lastCompiled.line++;
      lastCompiled.column = 0;
    }
    mappings.push(base64VLQ(compiled.column - lastCompiled.column));
    mappings.push(base64VLQ(0)); // Source index.
    mappings.push(base64VLQ(source.line - lastSource.line));
    mappings.push(base64VLQ(source.column - lastSource.column));
    lastCompiled = compiled;
    lastSource = source;
  }
  return JSON.stringify({
    version: 3,
    sources: ['file://' + filePath],
    names: [],
    mappings: mappings.join(''),
  });
}

function findPosition(source: string, offset: number): Position {
  const result: Position = { line: 0, column: 0 };
  let index = 0;
  while (true) {
    const newline = source.indexOf('\n', index);
    if (newline === -1 || newline >= offset)
      break;
    result.line++;
    index = newline + 1;
  }
  result.column = offset - index;
  return result;
}

function advancePosition(position: Position, delta: Position): Position {
  return {
    line: position.line + delta.line,
    column: delta.column + (delta.line ? 0 : position.column),
  };
}
