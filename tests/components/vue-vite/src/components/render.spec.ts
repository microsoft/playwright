import { test, expect } from '@playwright/test';

test('get textContent of the empty template', async ({ mount }) => {
  const component = await mount('components/render/Empty');
  expect(await component.allTextContents()).toEqual(['']);
  expect(await component.textContent()).toBe('');
  await expect(component).toHaveText('');
});

test('render a multi root component', async ({ mount }) => {
  const component = await mount('components/render/TwoRoots');
  await expect(component).toContainText('root 1');
  await expect(component).toContainText('root 2');
});

test('unmount a multi root component', async ({ mount, page }) => {
  const component = await mount('components/render/TwoRoots');
  await expect(page.locator('#root')).toContainText('root 1');
  await expect(page.locator('#root')).toContainText('root 2');
  await component.unmount();
  await expect(page.locator('#root')).not.toContainText('root 1');
  await expect(page.locator('#root')).not.toContainText('root 2');
});
