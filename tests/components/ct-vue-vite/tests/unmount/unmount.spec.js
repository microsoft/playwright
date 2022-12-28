import { test, expect } from '@playwright/experimental-ct-vue';
import MultiRoot from '@/components/MultiRoot.vue';

test('unmount a multi root component', async ({ mount, page }) => {
  const component = await mount(MultiRoot);
  await expect(page.locator('#root')).toContainText('root 1');
  await expect(page.locator('#root')).toContainText('root 2');
  await component.unmount();
  await expect(page.locator('#root')).not.toContainText('root 1');
  await expect(page.locator('#root')).not.toContainText('root 2');
});
