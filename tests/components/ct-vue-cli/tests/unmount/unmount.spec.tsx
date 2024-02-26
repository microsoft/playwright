import { test, expect } from '@playwright/experimental-ct-vue';
import Button from '@/components/Button.vue';
import MultiRoot from '@/components/MultiRoot.vue';

test('unmount', async ({ page, mount }) => {
  const component = await mount(<Button title="Submit" />);
  await expect(page.locator('#root')).toContainText('Submit');
  await component.unmount();
  await expect(page.locator('#root')).not.toContainText('Submit');
});

test('unmount a multi root component', async ({ mount, page }) => {
  const component = await mount(<MultiRoot />);
  await expect(page.locator('#root')).toContainText('root 1');
  await expect(page.locator('#root')).toContainText('root 2');
  await component.unmount();
  await expect(page.locator('#root')).not.toContainText('root 1');
  await expect(page.locator('#root')).not.toContainText('root 2');
});

test('unmount twice throws an error', async ({ mount }) => {
  const component = await mount(<Button title="Submit" />);
  await component.unmount();
  await expect(component.unmount()).rejects.toThrowError('Component was not mounted');
});
