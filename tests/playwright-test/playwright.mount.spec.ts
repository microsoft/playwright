/**
 * Copyright Microsoft Corporation. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { test, expect } from './playwright-test-fixtures';

test('mount and update should preserve Map and Set props with callbacks', async ({ runInlineTest, server }) => {
  server.setRoute('/gallery.html', (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(`
      <div id="root"></div>
      <script>
        window.mount = async ({ story, props }) => {
          if (!(props.values instanceof Map) || !(props.callbacks instanceof Map))
            throw new Error('Expected Map props');
          const numbers = props.values.get('numbers');
          const callbacks = props.callbacks.get('change');
          if (!(numbers instanceof Set) || !(callbacks instanceof Set))
            throw new Error('Expected nested Set props');
          const text = story + ': ' + [...numbers].join(', ');
          document.querySelector('#root').textContent = text;
          for (const callback of callbacks)
            await callback(text);
        };
      </script>
    `);
  });
  const result = await runInlineTest({
    'playwright.config.ts': `
      module.exports = { use: { baseURL: '${server.PREFIX}/gallery.html' } };
    `,
    'mount.spec.ts': `
      import { test, expect } from '@playwright/test';

      test('collections', async ({ mount }) => {
        const received: string[] = [];
        const callback = async (text: string) => { received.push(text); };
        const component = await mount('collections', {
          values: new Map([['numbers', new Set([1, 2, 2])]]),
          callbacks: new Map([['change', new Set([callback])]]),
        });
        await expect(component).toHaveText('collections: 1, 2');
        expect(received).toEqual(['collections: 1, 2']);

        await component.update({
          values: new Map([['numbers', new Set([3, 4])]]),
          callbacks: new Map([['change', new Set([callback])]]),
        });
        await expect(component).toHaveText('collections: 3, 4');
        expect(received).toEqual(['collections: 1, 2', 'collections: 3, 4']);
      });
    `,
  });
  expect(result.exitCode).toBe(0);
  expect(result.passed).toBe(1);
});
