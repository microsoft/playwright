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

import fs from 'fs';
import path from 'path';

import { parseErrorStack } from '@isomorphic/stackTrace';
import { stripAnsiEscapes } from '@isomorphic/stringUtils';

import { relativeFilePath } from './util';

import type { TestInfoError } from '../types/test';

const fixTestInstructions = `# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.
`;

export function buildErrorContext(options: {
  titlePath: string[];
  location: { file: string; line: number; column: number };
  errors: TestInfoError[];
  pageSnapshot?: string;
}): string | undefined {
  const { titlePath, location, errors, pageSnapshot } = options;

  const meaningfulErrors = errors.filter(e => !!e.message);

  if (!meaningfulErrors.length && !pageSnapshot)
    return undefined;

  const lines = [
    fixTestInstructions,
    '# Test info',
    '',
    `- Name: ${titlePath.join(' >> ')}`,
    `- Location: ${relativeFilePath(location.file)}:${location.line}:${location.column}`,
  ];

  if (meaningfulErrors.length) {
    lines.push('', '# Error details');

    for (const error of meaningfulErrors) {
      lines.push(
          '',
          '```',
          stripAnsiEscapes(error.message || ''),
          '```',
      );
    }
  }

  if (pageSnapshot) {
    lines.push(
        '',
        '# Page snapshot',
        '',
        '```yaml',
        pageSnapshot,
        '```',
    );
  }

  const lastError = meaningfulErrors[meaningfulErrors.length - 1];
  const codeFrame = lastError ? buildCodeFrame(lastError, location) : undefined;
  if (codeFrame) {
    lines.push(
        '',
        '# Test source',
        '',
        '```ts',
        codeFrame,
        '```',
    );
  }

  return lines.join('\n');
}

function buildCodeFrame(error: TestInfoError, testLocation: { file: string; line: number; column: number }): string | undefined {
  const stack = error.stack;
  if (!stack)
    return undefined;

  const parsed = parseErrorStack(stack, path.sep);
  const errorLocation = parsed.location;
  if (!errorLocation)
    return undefined;

  let source: string;
  try {
    source = fs.readFileSync(errorLocation.file, 'utf8');
  } catch {
    return undefined;
  }

  const sourceLines = source.split('\n');
  const linesAbove = 100;
  const linesBelow = 100;
  const start = Math.max(0, errorLocation.line - linesAbove - 1);
  const end = Math.min(sourceLines.length, errorLocation.line + linesBelow);
  const scope = sourceLines.slice(start, end);
  const lineNumberWidth = String(end).length;
  const message = stripAnsiEscapes(error.message || '').split('\n')[0] || undefined;
  const frame = scope.map((line, index) => `${(start + index + 1) === errorLocation.line ? '> ' : '  '}${(start + index + 1).toString().padEnd(lineNumberWidth, ' ')} | ${line}`);
  if (message)
    frame.splice(errorLocation.line - start, 0, `${' '.repeat(lineNumberWidth + 2)} | ${' '.repeat(Math.max(0, errorLocation.column - 2))} ^ ${message}`);
  return frame.join('\n');
}
