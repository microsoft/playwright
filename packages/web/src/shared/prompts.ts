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

import type { MetadataWithCommitInfo } from '@testIsomorphic/types';

const fixTestInstructions = `
# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.
`.trimStart();

export async function copyPrompt<ErrorInfo extends { message: string }>({
  testInfo,
  metadata,
  errorContext,

  errors,
  buildCodeFrame,
}: {
  testInfo: string;
  metadata: MetadataWithCommitInfo | undefined;
  errorContext: string | undefined;

  errors: ErrorInfo[];
  buildCodeFrame(error: ErrorInfo): Promise<string | undefined>;
}) {
  const meaningfulSingleLineErrors = new Set(errors.filter(e => e.message && !e.message.includes('\n')).map(e => e.message!));
  for (const error of errors) {
    for (const singleLineError of meaningfulSingleLineErrors.keys()) {
      if (error.message?.includes(singleLineError))
        meaningfulSingleLineErrors.delete(singleLineError);
    }
  }

  const meaningfulErrors = errors.filter(error => {
    if (!error.message)
      return false;

    // Skip errors that are just a single line - they are likely to already be the error message.
    if (!error.message.includes('\n') && !meaningfulSingleLineErrors.has(error.message))
      return false;

    return true;
  });

  if (!meaningfulErrors.length)
    return undefined;

  const lines = [
    fixTestInstructions,
    `# Test info`,
    '',
    testInfo,
    '',
    '# Error details',
  ];

  for (const error of meaningfulErrors) {
    lines.push(
        '',
        '```',
        stripAnsiEscapes(error.message || ''),
        '```',
    );
  }

  if (errorContext)
    lines.push(errorContext);

  const codeFrame = await buildCodeFrame(meaningfulErrors[meaningfulErrors.length - 1]);
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

  if (metadata?.gitDiff) {
    lines.push(
        '',
        '# Local changes',
        '',
        '```diff',
        metadata.gitDiff,
        '```',
    );
  }

  return lines.join('\n');
}

const ansiRegex = new RegExp('([\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~])))', 'g');
export function stripAnsiEscapes(str: string): string {
  return str.replace(ansiRegex, '');
}
