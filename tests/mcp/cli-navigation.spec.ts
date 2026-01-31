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

test('go-back', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);
  await cli('open', server.PREFIX);
  const { output } = await cli('go-back');
  expect(output).toContain(`### Page
- Page URL: ${server.HELLO_WORLD}
- Page Title: Title`);
});

test('go-forward', async ({ cli, server }) => {
  await cli('open', server.PREFIX);
  await cli('open', server.HELLO_WORLD);
  await cli('go-back');
  const { output } = await cli('go-forward');
  expect(output).toContain(`### Page
- Page URL: ${server.HELLO_WORLD}
- Page Title: Title`);
});

test('run-code', async ({ cli, server }) => {
  await cli('open', server.HELLO_WORLD);
  const { output } = await cli('run-code', '() => page.title()');
  expect(output).toContain('"Title"');
});
