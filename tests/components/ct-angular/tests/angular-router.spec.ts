import { test, expect } from '@playwright/experimental-ct-angular';
import type { HooksConfig } from 'playwright';
import { AppComponent } from '@/app.component';

test('navigate to a page by clicking a link', async ({ page, mount }) => {
  const component = await mount<HooksConfig>(AppComponent, {
    hooksConfig: { routing: true },
  });
  await expect(component.getByRole('main')).toHaveText('Login');
  await component.getByRole('link', { name: 'Dashboard' }).click();
  await expect(component.getByRole('main')).toHaveText('Dashboard');
});
