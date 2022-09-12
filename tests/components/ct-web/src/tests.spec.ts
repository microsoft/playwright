import { test, expect } from '@playwright/experimental-ct-web'
import Button from './components/Button';

test.use({ viewport: { width: 500, height: 500 } });

test('props should work', async ({ mount }) => {
  const component = await mount(Button);
  await expect(component).toContainText('Submit');
});
