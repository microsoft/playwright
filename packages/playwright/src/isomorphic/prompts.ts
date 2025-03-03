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

export function fixTestPrompt(error: string, diff?: string, pageSnapshot?: string) {
  const promptParts = [
    `My Playwright test failed.`,
    `Explain why, be concise, respect Playwright best practices.`,
    '',
    'Error:',
    '',
    '```js',
    error,
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

  return promptParts.join('\n');
}
