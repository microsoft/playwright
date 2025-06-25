/* eslint-disable notice/notice */

import { test, expect } from '@playwright/test';

test('Search and verify Twisters movie', async ({ page }) => {

  // Navigate to https://debs-obrien.github.io/playwright-movies-app
  await page.goto('https://debs-obrien.github.io/playwright-movies-app');

  // Click search icon
  await page.getByRole('search').click();

  // Type "Twister" in the search field and hit Enter
  await page.getByRole('textbox', { name: 'Search Input' }).fill('Twister');
  await page.getByRole('textbox', { name: 'Search Input' }).press('Enter');

  // Verify that the URL contains the search term "twister"
  await expect(page).toHaveURL(/twister/i);

  // Verify that the search results contain an image named "Twisters"
  await expect(page.getByRole('link', { name: 'poster of Twisters Twisters' })).toBeVisible();

  // Click on the link for the movie "Twisters"
  await page.getByRole('link', { name: 'poster of Twisters Twisters' }).click();

  // Verify that the main heading on the movie page is "Twisters"
  await expect(page.getByTestId('movie-summary').getByRole('heading', { name: 'Twisters' })).toBeVisible();
});
