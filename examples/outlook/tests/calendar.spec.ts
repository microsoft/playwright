import { test, expect } from '@playwright/test';

test.use({
  storageStateName: 'outlook-test-user'
});

const timestamp = Date.now();
const eventTitle = `Event - ${timestamp}`;

test('new calendar event', async ({ page }) => {
  await page.goto('https://outlook.com');
  await test.step('switch to calender', async () => {
    await page.getByRole('button', { name: 'Calendar' }).click();
    await page.waitForTimeout(1000);
  });
  await test.step('create all day event', async () => {
    await page.getByRole('button', { name: 'New event' }).getByRole('button', { name: 'New event' }).click();
    await page.getByPlaceholder('Add a title').fill(eventTitle);
    await page.getByRole('switch', { name: 'All day' }).click();
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(1000);
    // Dismiss notification popup.
    await page.getByRole('button', { name: 'Dismiss all' }).click();
  });
  await test.step('delete the event', async () => {
    await page.getByRole('complementary', { name: 'agenda view' }).getByText(eventTitle).click();
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Delete' }).click();
  });
});
