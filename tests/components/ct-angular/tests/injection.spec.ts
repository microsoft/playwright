import { InjectComponent, TOKEN } from '@/components/inject.component';
import { expect, test } from '@playwright/experimental-ct-angular';
import type { HooksConfig } from 'playwright';

test('inject a token', async ({ mount }) => {
  const component = await mount<HooksConfig>(InjectComponent, {
    hooksConfig: { injectToken: true },
  });
  await expect(component).toHaveText('has been overwritten');
});

