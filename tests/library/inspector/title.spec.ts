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

import { test, expect } from './inspectorTest';

test('should reflect formatted URL of the page', async ({
  openRecorder,
  server,
}) => {
  const { recorder } = await openRecorder();
  await recorder.setContentAndWait('');
  await expect(recorder.recorderPage).toHaveTitle(
      'Playwright Inspector - about:blank',
  );

  await recorder.setContentAndWait('', server.EMPTY_PAGE);
  await expect(recorder.recorderPage).toHaveTitle(
      `Playwright Inspector - ${server.EMPTY_PAGE}`,
  );
});

test('should update primary page URL when original primary closes', async ({
  context,
  openRecorder,
  server,
}) => {
  const { recorder } = await openRecorder();
  await recorder.setContentAndWait(
      '',
      `${server.PREFIX}/background-color.html`,
  );
  await expect(recorder.recorderPage).toHaveTitle(
      `Playwright Inspector - ${server.PREFIX}/background-color.html`,
  );

  const page2 = await context.newPage();
  await page2.goto(`${server.PREFIX}/empty.html`);
  await expect(recorder.recorderPage).toHaveTitle(
      `Playwright Inspector - ${server.PREFIX}/background-color.html`,
  );

  const page3 = await context.newPage();
  await page3.goto(`${server.PREFIX}/dom.html`);
  await expect(recorder.recorderPage).toHaveTitle(
      `Playwright Inspector - ${server.PREFIX}/background-color.html`,
  );

  const page4 = await context.newPage();
  await page4.goto(`${server.PREFIX}/grid.html`);
  await expect(recorder.recorderPage).toHaveTitle(
      `Playwright Inspector - ${server.PREFIX}/background-color.html`,
  );

  await page2.close();
  await expect(recorder.recorderPage).toHaveTitle(
      `Playwright Inspector - ${server.PREFIX}/background-color.html`,
  );

  await recorder.page.close();
  // URL will not update without performing some action
  await page3.getByRole('checkbox').click();
  await expect(recorder.recorderPage).toHaveTitle(
      `Playwright Inspector - ${server.PREFIX}/dom.html`,
  );

  await page3.close();
  await expect(recorder.recorderPage).toHaveTitle(
      `Playwright Inspector - ${server.PREFIX}/grid.html`,
  );
});
