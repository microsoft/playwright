import { test, expect } from '@playwright/experimental-ct-svelte';
import App from '@/App.svelte';

test('navigate to a page by clicking a link', async ({ page, mount }) => {
  const component = await mount(App);
  await expect(component.getByRole('main')).toHaveText('Login');
  await expect(page).toHaveURL('/');
  await component.getByRole('link', { name: 'Dashboard' }).click();
  await expect(component.getByRole('main')).toHaveText('Dashboard');
  await expect(page).toHaveURL('/dashboard');
});
