import { test, expect } from '@playwright/test';

test('render a multi-root component', async ({ mount, page }) => {
  await mount('components/MultiRoot/Default');
  await expect(page.locator('#root')).toContainText('root 1');
  await expect(page.locator('#root')).toContainText('root 2');
});

test('unmount a multi-root component', async ({ mount, page }) => {
  const component = await mount('components/MultiRoot/Default');
  await expect(page.locator('#root')).toContainText('root 1');
  await expect(page.locator('#root')).toContainText('root 2');
  await component.unmount();
  await expect(page.locator('#root')).not.toContainText('root 1');
});
