import { test, expect } from '@playwright/test';

import type { Default, WithSlot } from './Counter.story';

// component.update(props) re-renders the same story on the reused host, so state survives —
// remount-count stays 1 throughout.
test('update props without remounting', async ({ mount }) => {
  const component = await mount<typeof Default>('components/Counter/Default', { count: 9001 });
  await expect(component.getByTestId('props')).toContainText('9001');

  await component.update({ count: 1337 });
  await expect(component).not.toContainText('9001');
  await expect(component.getByTestId('props')).toContainText('1337');

  await expect(component.getByTestId('remount-count')).toContainText('1');
});

test('update slot content without remounting', async ({ mount }) => {
  const component = await mount<typeof WithSlot>('components/Counter/WithSlot');
  await expect(component).toContainText('Default Slot');

  await component.update({ slotText: 'Test Slot' });
  await expect(component).not.toContainText('Default Slot');
  await expect(component).toContainText('Test Slot');

  await expect(component.getByTestId('remount-count')).toContainText('1');
});

test('emit a submit event when clicked', async ({ mount }) => {
  const component = await mount('components/Counter/RecordsSubmit');
  await component.getByRole('button').click();
  await expect(component.getByTestId('submitted')).toHaveValue('hello');
  await expect(component.getByTestId('remount-count')).toContainText('1');
});
