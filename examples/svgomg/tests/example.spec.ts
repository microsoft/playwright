/* eslint-disable notice/notice */

import { test, expect } from '@playwright/test';
import fs from 'fs';

test.describe.configure({ mode: 'parallel' });

test.beforeEach(async ({ page }) => {
  await page.goto('https://demo.playwright.dev/svgomg');
});

test('verify menu items', async ({ page }) => {
  await expect(page.locator('.menu li')).toHaveText([
    'Open SVG',
    'Paste markup',
    'Demo',
    'Contribute'
  ]);
});

test.describe('demo tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.locator('.menu-item >> text=Demo').click();
  });

  test('verify default global settings', async ({ page }) => {
    const menuItems = page.locator('.settings-scroller .global .setting-item-toggle');
    await expect(menuItems).toHaveText([
      'Show original',
      'Compare gzipped',
      'Prettify markup',
      'Multipass',
    ]);

    const toggle = page.locator('.setting-item-toggle');
    await expect(toggle.locator('text=Show original')).not.toBeChecked();
    await expect(toggle.locator('text=Compare gzipped')).toBeChecked();
    await expect(toggle.locator('text=Prettify markup')).not.toBeChecked();
    await expect(toggle.locator('text=Multipass')).not.toBeChecked();
  });

  test('verify default features', async ({ page }) => {
    const enabledOptions = [
      'Clean up attribute whitespace',
      'Clean up IDs',
      'Collapse useless groups',
      'Convert non-eccentric <ellipse> to <circle>',
      'Inline styles',
    ];

    const disabledOptions = [
      'Prefer viewBox to width/height',
      'Remove raster images',
      'Remove script elements',
      'Remove style elements',
    ];

    for (const option of enabledOptions) {
      const locator = page.locator(`.setting-item-toggle >> text=${option}`);
      await expect(locator).toBeChecked();
    }

    for (const option of disabledOptions) {
      const locator = page.locator(`.setting-item-toggle >> text=${option}`);
      await expect(locator).not.toBeChecked();
    }
  });

  test('reset settings', async ({ page }) => {
    const showOriginalSetting = page.locator('.setting-item-toggle >> text=Show original');
    await showOriginalSetting.click();
    await expect(showOriginalSetting).toBeChecked();
    await page.locator('button >> text=Reset all').click();
    await expect(showOriginalSetting).not.toBeChecked();
  });

  test('download result', async ({ page }) => {
    const downloadButton = page.locator('a[title=Download]');
    await expect(downloadButton).toHaveAttribute('href', /blob/);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      downloadButton.click()
    ]);
    expect(download.suggestedFilename()).toBe('car-lite.svg');
    const result = fs.readFileSync(await download.path(), 'utf-8');
    expect(result).toContain('<svg');
  });
});

test('open svg', async ({ page }) => {
  // Start waiting for the file chooser, then click the button.
  const [fileChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('text=Open SVG'),
  ]);

  // Set file to the chooser.
  await fileChooser.setFiles({
    name: 'file.svg',
    mimeType: 'image/svg+xml',
    buffer: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="#000000"><path d="M0 0h24v24H0z" fill="none"/><path d="M16.5 3c-1.74 0-3.41.81-4.5 2.09C10.91 3.81 9.24 3 7.5 3 4.42 3 2 5.42 2 8.5c0 3.78 3.4 6.86 8.55 11.54L12 21.35l1.45-1.32C18.6 15.36 22 12.28 22 8.5 22 5.42 19.58 3 16.5 3zm-4.4 15.55l-.1.1-.1-.1C7.14 14.24 4 11.39 4 8.5 4 6.5 5.5 5 7.5 5c1.54 0 3.04.99 3.57 2.36h1.87C13.46 5.99 14.96 5 16.5 5c2 0 3.5 1.5 3.5 3.5 0 2.89-3.14 5.74-7.9 10.05z"/></svg>`)
  });

  // Verify provided svg was rendered.
  const markup = await page.frameLocator('.svg-frame').locator('svg').evaluate(svg => svg.outerHTML);
  expect(markup).toMatch(/<svg.*<\/svg>/);
});
