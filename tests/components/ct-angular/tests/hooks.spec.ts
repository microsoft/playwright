import { test, expect } from '@playwright/experimental-ct-angular';
import type { HooksConfig } from 'playwright';
import { InjectComponent } from '@/components/inject.component';
import { AppComponent } from '@/app.component';


test('navigate to a page by clicking a link', async ({ page, mount }) => {
  const component = await mount<HooksConfig>(AppComponent, {
    hooksConfig: { routing: true },
  });
  await expect(component.getByRole('main')).toHaveText('Login');
  await expect(page).toHaveURL('/');
  await component.getByRole('link', { name: 'Dashboard' }).click();
  await expect(component.getByRole('main')).toHaveText('Dashboard');
});

test('inject a token', async ({ page, mount }) => {
  const component = await mount<HooksConfig>(InjectComponent, {
    hooksConfig: { injectToken: true },
  });
  await expect(component).toHaveText('has been overwritten');
  await expect(component).not.toHaveText('gets overwritten');
});
