import { test, expect } from '@playwright/experimental-ct-vue';
import Counter from '@/components/Counter.vue';

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

  const messages = [];
  await component.update({
    on: {
      submit: (count) => messages.push(count),
    },
  });
  await component.click();
  expect(messages).toEqual(['hello']);

  await expect(component.getByTestId('remount-count')).toContainText('1');
});

test('update slots without remounting', async ({ mount }) => {
  const component = await mount(Counter, {
    slots: { default: 'Default Slot' },
  });
  await expect(component).toContainText('Default Slot');

  await component.update({
    slots: { main: 'Test Slot' },
  });
  await expect(component).not.toContainText('Default Slot');
  await expect(component).toContainText('Test Slot');

  await expect(component.getByTestId('remount-count')).toContainText('1');
});
