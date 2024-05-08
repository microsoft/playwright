import { test, expect } from '@playwright/experimental-ct-vue';
import Button from '@/components/Button.vue';

test('emit a submit event when the button is clicked', async ({ mount }) => {
  const messages = [];
  const component = await mount(Button, {
    props: {
      title: 'Submit',
    },
    on: {
      submit: (message) => messages.push(message),
    },
  });
  await component.click();
  expect(messages).toEqual(['hello']);
});

test('emit a fallthrough event when the button is double clicked', async ({ mount }) => {
  const messages = [];
  const component = await mount(Button, {
    props: {
      title: 'Submit',
    },
    on: {
      dbclick: (message) => messages.push(message),
    },
  });
  await component.dblclick();
  expect(messages).toEqual(['fallthroughEvent']);
});
