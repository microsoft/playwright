import { test, expect } from '@playwright/test';

test('navigate to a page by clicking a link', async ({ mount }) => {
  const component = await mount('App/Routing');
  await expect(component.getByRole('main')).toHaveText('Login');
  await component.getByRole('link', { name: 'Dashboard' }).click();
  await expect(component.getByRole('main')).toHaveText('Dashboard');
});
