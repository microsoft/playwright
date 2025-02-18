import { test, expect } from '@playwright/experimental-ct-svelte';
import Counter from '@/components/Counter.svelte';

test('update props without remounting', async ({ mount }) => {
  const component = await mount(Counter, {
    props: { count: 9001 },
  });
  await expect(component.getByTestId('props')).toContainText('9001');

  await component.update({
    props: { count: 1337 },
  });
  await expect(component).not.toContainText('9001');
  await expect(component.getByTestId('props')).toContainText('1337');

  await expect(component.getByTestId('remount-count')).toContainText('1');
});

test('update event listeners without remounting', async ({ mount }) => {
  const component = await mount(Counter);

  const messages: string[] = [];
  await component.update({
    on: {
      submit: (data: string) => messages.push(data),
    },
  });
  await component.click();
  expect(messages).toEqual(['hello']);

  await expect(component.getByTestId('remount-count')).toContainText('1');
});
