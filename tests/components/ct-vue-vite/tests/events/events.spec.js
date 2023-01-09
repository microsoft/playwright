import { test, expect } from '@playwright/experimental-ct-vue';
import Button from '@/components/Button.vue';

test('emit a submit event when the button is clicked', async ({ mount }) => {
  const messages = [];
  const component = await mount(Button, {
    props: {
      title: 'Submit',
    },
    on: {
      submit: (data) => messages.push(data),
    },
  });
  await component.click();
  expect(messages).toEqual(['hello']);
});
