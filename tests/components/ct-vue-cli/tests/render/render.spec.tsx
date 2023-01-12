import { test, expect } from '@playwright/experimental-ct-vue';
import Button from '@/components/Button.vue';
import EmptyTemplate from '@/components/EmptyTemplate.vue';

test('render props', async ({ mount }) => {
  const component = await mount(<Button title="Submit" />);
  await expect(component).toContainText('Submit');
});

test('get textContent of the empty template', async ({ mount }) => {
  const component = await mount(<EmptyTemplate />);
  expect(await component.allTextContents()).toEqual(['']);
  expect(await component.textContent()).toBe('');
  await expect(component).toHaveText('');
});
