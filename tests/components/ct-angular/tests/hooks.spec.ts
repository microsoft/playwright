import { expect, test } from '@playwright/experimental-ct-angular';
import type { HooksConfig } from 'playwright';
import { InjectComponent } from '@/components/inject.component';

test('inject a token', async ({ mount }) => {
  const component = await mount<HooksConfig>(InjectComponent, {
    hooksConfig: { injectToken: true },
  });
  await expect(component).toHaveText('has been overwritten');
  await expect(component).not.toHaveText('gets overwritten');
});
