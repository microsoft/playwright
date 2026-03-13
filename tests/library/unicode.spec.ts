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

import { contextTest as it, expect } from '../config/browserTest';

it('should handle unpaired surrogates from page.evaluate', async ({ page }) => {
  const result = await page.evaluate(() => {
    // Create a string with an unpaired high surrogate (U+D800)
    return 'before\uD800after';
  });
  // The result should be JSON-stringifiable without issues.
  const json = JSON.stringify({ value: result });
  expect(typeof json).toBe('string');
  expect(JSON.parse(json).value).toContain('before');
  expect(JSON.parse(json).value).toContain('after');
});

it('should handle unpaired surrogates in page content', async ({ page, server }) => {
  server.setRoute('/surrogate.html', (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Send HTML with an unpaired low surrogate in the body text.
    res.end('<body>hello\uDC00world</body>');
  });
  await page.goto(server.PREFIX + '/surrogate.html');
  const content = await page.content();
  expect(() => JSON.stringify(content)).not.toThrow();
  // The unpaired surrogate should be replaced with the replacement character.
  expect(content).toContain('hello\uFFFDworld');
});
