import { test, expect } from '@playwright/experimental-ct-vue';
import Button from '@/components/Button.vue';
import EmptyTemplate from '@/components/EmptyTemplate.vue';

test('render props', async ({ mount }) => {
  const component = await mount(<Button title="Submit" />);
  await expect(component).toContainText('Submit');
});

test('falltrough attributes', async ({ page, mount }) => {
  // Docs about fallthrough attributes: https://vuejs.org/guide/components/attrs.html#attribute-inheritance
  const messages: string[] = [];
  page.on('console', (message) => messages.push(message.text()));
  await mount(<Button title="Submit" fallthroughProp v-on:fallthroughEvent={() => true} />);
  await expect.poll(() => messages).toContain('{fallthroughProp: true, fallthroughEvent: }');
});

test('render attributes', async ({ mount }) => {
  const component = await mount(<Button class="primary" title="Submit" />);
  await expect(component).toHaveClass('primary');
});

test('get textContent of the empty template', async ({ mount }) => {
  const component = await mount(<EmptyTemplate />);
  expect(await component.allTextContents()).toEqual(['']);
  expect(await component.textContent()).toBe('');
  await expect(component).toHaveText('');
});
