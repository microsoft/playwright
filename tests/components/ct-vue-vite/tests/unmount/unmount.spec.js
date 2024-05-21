import { test, expect } from '@playwright/experimental-ct-vue';
import MultiRoot from '@/components/MultiRoot.vue';
import Button from '@/components/Button.vue';

test('unmount a multi root component', async ({ mount, page }) => {
  const component = await mount(MultiRoot);
  await expect(page.locator('#root')).toContainText('root 1');
  await expect(page.locator('#root')).toContainText('root 2');
  await component.unmount();
  await expect(page.locator('#root')).not.toContainText('root 1');
  await expect(page.locator('#root')).not.toContainText('root 2');
});

test('mount then unmount then mount', async ({ mount }) => {
  let component = await mount(Button, {
    props: {
      title: 'Submit',
    },
  });
  await component.unmount();
  component = await mount(Button, {
    props: {
      title: 'Save',
    },
  });
  await expect(component).toContainText('Save');
});

