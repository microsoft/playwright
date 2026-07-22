import { test, expect } from '@playwright/test';

test('navigate to a page by clicking a link', async ({ mount }) => {
  const component = await mount('App/Routing');
  await expect(component.getByRole('main')).toHaveText('Login');
  await component.getByRole('link', { name: 'Dashboard' }).click();
  await expect(component.getByRole('main')).toHaveText('Dashboard');
});

test('update does not reset the router', async ({ mount }) => {
  const component = await mount('App/Routing', { title: 'before' });
  await expect(component.getByRole('heading')).toHaveText('before');
  await expect(component.getByRole('main')).toHaveText('Login');

  await component.update({ title: 'after' });
  await expect(component.getByRole('heading')).toHaveText('after');
  await expect(component.getByRole('main')).toHaveText('Login');
});
