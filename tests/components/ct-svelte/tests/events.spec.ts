import { test, expect } from '@playwright/experimental-ct-svelte';
import Button from '@/components/Button.svelte';

test('emit an submit event when the button is clicked', async ({ mount }) => {
  const messages: string[] = [];
  const component = await mount(Button, {
    props: {
      title: 'Submit',
      onsubmit: (data: string) => messages.push(data),
    },
  });
  await component.click();
  expect(messages).toEqual(['hello']);
});
