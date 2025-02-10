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

const ansiRegex = new RegExp('([\\u001B\\u009B][[\\]()#;?]*(?:(?:(?:[a-zA-Z\\d]*(?:;[-a-zA-Z\\d\\/#&.:=?%@~_]*)*)?\\u0007)|(?:(?:\\d{1,4}(?:;\\d{0,4})*)?[\\dA-PR-TZcf-ntqry=><~])))', 'g');
function stripAnsiEscapes(str: string): string {
  return str.replace(ansiRegex, '');
}

export function fixTestPrompt(error: string, diff?: string, pageSnapshot?: string) {
  const promptParts = [
    `My Playwright test failed. What's going wrong?`,
    `Please give me a suggestion how to fix it, and then explain what went wrong. Be very concise and apply Playwright best practices.`,
    `Don't include many headings in your output. Make sure what you're saying is correct, and take into account whether there might be a bug in the app.`,
    'Here is the error:',
    '\n',
    '```js',
    stripAnsiEscapes(error),
    '```',
    '\n',
  ];

  if (pageSnapshot) {
    promptParts.push(
        'This is how the page looked at the end of the test:\n',
        '```yaml',
        pageSnapshot,
        '```',
        '\n'
    );
  }

  if (diff) {
    promptParts.push(
        'And this is the code diff:\n',
        '```diff',
        diff,
        '```',
        '\n'
    );
  }

  return promptParts.join('\n');
}
