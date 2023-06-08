import { test, expect } from '@playwright/experimental-ct-vue';
import Button from '@/components/Button.vue';
import EmptyTemplate from '@/components/EmptyTemplate.vue';
import Component from '@/components/Component.vue';

test('render props', async ({ mount }) => {
  const component = await mount(Button, {
    props: {
      title: 'Submit',
    },
  });
  await expect(component).toContainText('Submit');
});

test('falltrough attributes', async ({ page, mount }) => {
  // Docs about fallthrough attributes: https://vuejs.org/guide/components/attrs.html#attribute-inheritance
  const messages = [];
  page.on('console', (message) => messages.push(message.text()));
  await mount(Button, {
    props: {
      title: 'Submit',
      fallthroughProp: true,
    },
    on: {
      fallthroughEvent: () => true
    },
  });
  await expect.poll(() => messages).toContain('{fallthroughProp: true, fallthroughEvent: }');
});

test('get textContent of the empty template', async ({ mount }) => {
  const component = await mount(EmptyTemplate);
  expect(await component.allTextContents()).toEqual(['']);
  expect(await component.textContent()).toBe('');
  await expect(component).toHaveText('');
});

test('render a component without options', async ({ mount }) => {
  const component = await mount(Component);
  await expect(component).toContainText('test');
});
