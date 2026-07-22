import { test, expect } from '@playwright/test';

test('render named children', async ({ mount }) => {
  const component = await mount('components/MultipleChildren/Default');
  await expect(component).toContainText('Header');
  await expect(component).toContainText('Main Content');
  await expect(component).toContainText('Footer');
});
