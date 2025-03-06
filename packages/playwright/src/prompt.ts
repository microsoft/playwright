/**
 * Copyright (c) Microsoft Corporation.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License");
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
import * as path from 'path';

import { parseErrorStack } from 'playwright-core/lib/utils';

import { stripAnsiEscapes } from './util';
import { codeFrameColumns } from './transform/babelBundle';

import type { TestInfo } from '../types/test';
import type { MetadataWithCommitInfo } from './isomorphic/types';
import type { TestInfoImpl } from './worker/testInfo';

export async function attachErrorPrompts(testInfo: TestInfo, sourceCache: Map<string, string>, ariaSnapshot: string | undefined) {
  if (process.env.PLAYWRIGHT_NO_COPY_PROMPT)
    return;

  const meaningfulSingleLineErrors = new Set(testInfo.errors.filter(e => e.message && !e.message.includes('\n')).map(e => e.message!));
  for (const error of testInfo.errors) {
    for (const singleLineError of meaningfulSingleLineErrors.keys()) {
      if (error.message?.includes(singleLineError))
        meaningfulSingleLineErrors.delete(singleLineError);
    }
  }

  for (const [index, error] of testInfo.errors.entries()) {
    if (!error.message)
      return;
    if (testInfo.attachments.find(a => a.name === `_prompt-${index}`))
      continue;

    // Skip errors that are just a single line - they are likely to already be the error message.
    if (!error.message.includes('\n') && !meaningfulSingleLineErrors.has(error.message))
      continue;

    const metadata = testInfo.config.metadata as MetadataWithCommitInfo;

    const promptParts = [
      `# Instructions`,
      '',
      `- Following Playwright test failed.`,
      `- Explain why, be concise, respect Playwright best practices.`,
      `- Provide a snippet of code with the fix, if possible.`,
      '',
      `# Test info`,
      '',
      `- Name: ${testInfo.titlePath.slice(1).join(' >> ')}`,
      `- Location: ${testInfo.file}:${testInfo.line}:${testInfo.column}`,
      '',
      '# Error details',
      '',
      '```',
      stripAnsiEscapes(error.stack || error.message || ''),
      '```',
    ];

    if (ariaSnapshot) {
      promptParts.push(
          '',
          '# Page snapshot',
          '',
          '```yaml',
          ariaSnapshot,
          '```',
      );
    }

    const parsedError = error.stack ? parseErrorStack(error.stack, path.sep) : undefined;
    const inlineMessage = stripAnsiEscapes(parsedError?.message || error.message || '').split('\n')[0];
    const location = parsedError?.location || { file: testInfo.file, line: testInfo.line, column: testInfo.column };
    const source = await loadSource(location.file, sourceCache);
    const codeFrame = codeFrameColumns(
        source,
        {
          start: {
            line: location.line,
            column: location.column
          },
        },
        {
          highlightCode: false,
          linesAbove: 100,
          linesBelow: 100,
          message: inlineMessage || undefined,
        }
    );
    promptParts.push(
        '',
        '# Test source',
        '',
        '```ts',
        codeFrame,
        '```',
    );

    if (metadata.gitDiff) {
      promptParts.push(
          '',
          '# Local changes',
          '',
          '```diff',
          metadata.gitDiff,
          '```',
      );
    }

    (testInfo as TestInfoImpl)._attach({
      name: `_prompt-${index}`,
      contentType: 'text/markdown',
      body: Buffer.from(promptParts.join('\n')),
    }, undefined);
  }
}

async function loadSource(file: string, sourceCache: Map<string, string>) {
  let source = sourceCache.get(file);
  if (!source) {
    // A mild race is Ok here.
    source = await fs.promises.readFile(file, 'utf8');
    sourceCache.set(file, source);
  }
  return source;
}
