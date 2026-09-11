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

import { test, expect } from './cli-fixtures';

test('set and clear media features', async ({ cli, server }) => {
  await cli('open', server.PREFIX);

  const expectMatches = async (query: string) => {
    const { output } = await cli('eval', `() => matchMedia('${query}').matches`);
    expect(output).toContain('### Result\ntrue');
  };

  const expectClear = async (command: string, option: string) => {
    const { output } = await cli(command);
    expect(output).toContain(`await page.emulateMedia({ ${option}: null });`);
  };

  await cli('set-color-scheme', 'dark');
  await expectMatches('(prefers-color-scheme: dark)');
  await expectClear('clear-color-scheme', 'colorScheme');

  await cli('set-reduced-motion', 'reduce');
  await expectMatches('(prefers-reduced-motion: reduce)');
  await expectClear('clear-reduced-motion', 'reducedMotion');

  await cli('set-forced-colors', 'active');
  await expectMatches('(forced-colors: active)');
  await expectClear('clear-forced-colors', 'forcedColors');

  await cli('set-contrast', 'more');
  await expectMatches('(prefers-contrast: more)');
  await expectClear('clear-contrast', 'contrast');

  await cli('set-media', 'print');
  await expectMatches('print');
  await expectClear('clear-media', 'media');
});
