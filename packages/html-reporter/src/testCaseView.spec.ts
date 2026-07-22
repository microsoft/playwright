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

import { expect, test } from '@playwright/test';

import type { AnnotationLinks, AttachmentLinks, Default, PrevNext, TwoAttempts } from './testCaseView.story';

test.use({ viewport: { width: 800, height: 600 } });

test('should render test case', async ({ mount }) => {
  const component = await mount<typeof Default>('testCaseView/Default');
  await expect(component.getByText('Annotation text', { exact: false }).first()).toBeVisible();
  await expect(component.getByText('Hidden annotation')).toBeHidden();
  await component.getByText('Annotations').click();
  await expect(component.getByText('Annotation text')).not.toBeVisible();
  await expect(component.getByText('Outer step')).toBeVisible();
  await expect(component.getByText('Inner step')).not.toBeVisible();
  await component.getByText('Outer step').click();
  await expect(component.getByText('Inner step')).toBeVisible();
  await expect(component.getByText('test.spec.ts:42')).toBeVisible();
  await expect(component.getByText('My test')).toBeVisible();
});

test('should render copy buttons for annotations', async ({ mount, page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);

  const component = await mount<typeof Default>('testCaseView/Default');
  await expect(component.getByText('Annotation text', { exact: false }).first()).toBeVisible();
  await component.getByText('Annotation text', { exact: false }).first().hover();
  await expect(component.locator('.test-case-annotation').getByLabel('Copy to clipboard').first()).toBeVisible();
  await component.locator('.test-case-annotation').getByLabel('Copy to clipboard').first().click();
  const handle = await page.evaluateHandle(() => navigator.clipboard.readText());
  const clipboardContent = await handle.jsonValue();
  expect(clipboardContent).toBe('Annotation text');
});

test('should correctly render links in annotations', async ({ mount }) => {
  const component = await mount<typeof AnnotationLinks>('testCaseView/AnnotationLinks');

  const firstLink = component.getByText('https://playwright.dev/docs/intro').first();
  await expect(firstLink).toBeVisible();
  await expect(firstLink).toHaveAttribute('href', 'https://playwright.dev/docs/intro');

  const secondLink = component.getByText('https://playwright.dev/docs/api/class-playwright').first();
  await expect(secondLink).toBeVisible();
  await expect(secondLink).toHaveAttribute('href', 'https://playwright.dev/docs/api/class-playwright');

  const thirdLink = component.getByText('https://github.com/microsoft/playwright/issues/23180').first();
  await expect(thirdLink).toBeVisible();
  await expect(thirdLink).toHaveAttribute('href', 'https://github.com/microsoft/playwright/issues/23180');

  const fourthLink = component.getByText('https://github.com/microsoft/playwright/issues/23181').first();
  await expect(fourthLink).toBeVisible();
  await expect(fourthLink).toHaveAttribute('href', 'https://github.com/microsoft/playwright/issues/23181');
});

test('should correctly render links in attachments', async ({ mount }) => {
  const component = await mount<typeof AttachmentLinks>('testCaseView/AttachmentLinks');
  await component.getByText('first attachment').click();
  const body = component.getByText('The body with https://playwright.dev/docs/intro link');
  await expect(body).toBeVisible();
  await expect(body.locator('a').filter({ hasText: 'playwright.dev' })).toHaveAttribute('href', 'https://playwright.dev/docs/intro');
  await expect(body.locator('a').filter({ hasText: 'github.com' })).toHaveAttribute('href', 'https://github.com/microsoft/playwright/issues/31284');
  await expect(component).toMatchAriaSnapshot(`
    - link "https://playwright.dev/docs/intro"
    - link "https://github.com/microsoft/playwright/issues/31284"
  `);
});

test('should correctly render links in attachment name', async ({ mount }) => {
  const component = await mount<typeof AttachmentLinks>('testCaseView/AttachmentLinks');
  const link = component.getByText('attachment with inline link').locator('a');
  await expect(link).toHaveAttribute('href', 'https://github.com/microsoft/playwright/issues/31284');
  await expect(link).toHaveText('https://github.com/microsoft/playwright/issues/31284');
  await expect(component).toMatchAriaSnapshot(`
    - link /https:\\/\\/github\\.com\\/microsoft\\/playwright\\/issues\\/\\d+/
  `);
});

test('should correctly render prev and next', async ({ mount }) => {
  const component = await mount<typeof PrevNext>('testCaseView/PrevNext');
  await expect(component).toMatchAriaSnapshot(`
    - text: group
    - link "« previous"
    - link "next »"
    - text: "Test with attachment links test.spec.ts:42 10ms chromium"
  `);
});

test('total duration is selected run duration', async ({ mount, page }) => {
  const component = await mount<typeof TwoAttempts>('testCaseView/TwoAttempts');
  await expect(component).toMatchAriaSnapshot(`
    - text: "Test with two attempts test.spec.ts:42 200ms chromium"
    - tablist:
      - tab "Run 50ms"
      - 'tab "Retry #1 150ms"'
  `);
  await page.getByRole('tab', { name: 'Run' }).click();
  await expect(component).toMatchAriaSnapshot(`
    - text: "Test with two attempts test.spec.ts:42 200ms chromium"
  `);
  await page.getByRole('tab', { name: 'Retry' }).click();
  await expect(component).toMatchAriaSnapshot(`
    - text: "Test with two attempts test.spec.ts:42 200ms chromium"
  `);
});
