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

import { TestError } from '../../types/testReporter';
import { externalScreen, formatError } from '../reporters/base';

export function fixTestPrompt(error: TestError, testFile: { path: string, contents: string }, diff?: string, pageSnapshot?: string) {
  const promptParts = [
    `My Playwright test failed.`,
    `Explain why, be concise, respect Playwright best practices.`,
    '',
    'Error:',
    '',
    '```js',
    formatError(externalScreen, {
      ...error,
      snippet: undefined,
    }).message,
    '```',
  ];

  if (pageSnapshot) {
    promptParts.push(
        '',
        'Page snapshot:',
        '```yaml',
        pageSnapshot,
        '```',
    );
  }

  if (diff) {
    promptParts.push(
        '',
        'Local changes:',
        '```diff',
        diff,
        '```',
    );
  }

  promptParts.push(
      '',
      'Test file:',
      '```ts',
      `// ${testFile.path}`,
      testFile.contents,
      '```',
  );

  return promptParts.join('\n');
}
