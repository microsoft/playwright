import { test, expect } from '@playwright/test';

test('test', async ({ page, context, browserName }) => {
  await page.goto('/');
  await page.getByRole('navigation', { name: 'Quick links' }).getByRole('link', { name: 'Sign in' }).click();
  await page.getByRole('textbox', { name: 'Enter your email, phone, or Skype.' }).fill(process.env.OUTLOOK_USER!);
  await page.getByRole('button', { name: 'Next' }).click();

  // Outlook serves different login page for the browsers that use WebKit
  // (based on the User-Agent string).
  if (browserName === 'webkit') {
    await page.getByRole('textbox', { name: `Enter the password for ${process.env.OUTLOOK_USER!}` }).fill(process.env.OUTLOOK_PASSWORD!);
  } else {
    await page.getByPlaceholder('Password').fill(process.env.OUTLOOK_PASSWORD!);
  }
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByLabel('Don\'t show this again').check();
  await page.getByRole('button', { name: 'Yes' }).click();
  expect((await context.cookies()).length).toBeTruthy();

  const contextState = await context.storageState();
  const storage = test.info().storage();
  await storage.set('outlook-test-user', contextState);
});
