import { test, expect } from '@playwright/test';

test.use({
  storageStateName: 'outlook-test-user'
});

const timestamp = Date.now();
const emailSubject = `Welcome - ${timestamp}`;
const emailBody = `Hi there! ${timestamp}`;

test('send message to self', async ({ page }) => {
  await page.goto('https://outlook.com');
  await test.step('send message to self', async () => {
    await page.getByRole('button', { name: 'New mail' }).getByRole('button', { name: 'New mail' }).click();
    await page.getByRole('textbox', { name: 'To' }).first().click();
    await page.getByRole('textbox', { name: 'To' }).first().fill(process.env.OUTLOOK_USER!);
    await page.getByRole('textbox', { name: 'To' }).filter({ hasText: process.env.OUTLOOK_USER! }).press('Enter');
    await page.getByPlaceholder('Add a subject').click();
    await page.getByPlaceholder('Add a subject').fill(emailSubject);
    await page.getByRole('textbox', { name: 'Message body, press Alt+F10 to exit' }).click();
    await page.getByRole('textbox', { name: 'Message body, press Alt+F10 to exit' }).fill(emailBody);
    await page.getByTestId('ComposeSendButton').getByTitle('Send (Ctrl+Enter)').click();
    // Wait for the message to be sent for realz.
    await expect(page.getByRole('option').getByText(emailSubject)).toBeVisible();
  });
  await test.step('check inbox message', async () => {
    await page.goto('https://outlook.com');
    await page.getByRole('option').getByText(emailSubject).click();
    await expect(page.getByRole('region', { name: 'Message body' })).toHaveText(emailBody);
  });
  await test.step('delete message', async () => {
    await page.goto('https://outlook.com');
    await page.getByRole('option').getByText(emailSubject).hover();
    await page.getByRole('option', { name: new RegExp(emailSubject) }).getByRole('checkbox', { name: 'Select a conversation' }).click();
    // await page.getByRole('menuitem', { name: 'Empty Focused' }).click();
    // await page.getByRole('button', { name: 'OK' }).click();
    await page.getByRole('button', { name: 'Delete' }).nth(1).click();
  });
});
