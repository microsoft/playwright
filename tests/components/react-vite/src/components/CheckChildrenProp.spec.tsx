import { test, expect } from '@playwright/test';

test('absence of children', async ({ mount }) => {
  const component = await mount('components/CheckChildrenProp/NoChildren');
  await expect(component).toContainText('No Children');
});
