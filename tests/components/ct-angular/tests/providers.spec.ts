import { InjectComponent, TOKEN } from "@/components/inject.component";
import { expect, test } from "@playwright/experimental-ct-angular";

test('inject a token', async ({ mount }) => {
  const component = await mount(InjectComponent, {
    providers: [{ provide: TOKEN, useValue: { text: 'has been overwritten' }}]
  });
  await expect(component).toHaveText('has been overwritten');
});
