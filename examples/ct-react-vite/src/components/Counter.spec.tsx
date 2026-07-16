import { test, expect } from '@playwright/test';

// component.update(props) re-renders the same story on the reused root, so state survives —
// remount-count stays 1 throughout.
test('update props without remounting', async ({ mount }) => {
  const component = await mount('components/Counter/Default', { count: 9001 });
  await expect(component.getByTestId('props')).toContainText('9001');

  await component.update({ count: 1337 });
  await expect(component).not.toContainText('9001');
  await expect(component.getByTestId('props')).toContainText('1337');

  await expect(component.getByTestId('remount-count')).toContainText('1');
});

test('update callbacks without remounting', async ({ mount }) => {
  const component = await mount('components/Counter/Default');

  const messages: string[] = [];
  await component.update({ onClick: (message: string) => messages.push(message) });
  await component.click();
  expect(messages).toEqual(['hello']);

  await expect(component.getByTestId('remount-count')).toContainText('1');
});

test('update children without remounting', async ({ mount }) => {
  const component = await mount('components/Counter/Default', { children: 'Default Slot' });
  await expect(component).toContainText('Default Slot');

  await component.update({ children: 'Test Slot' });
  await expect(component).not.toContainText('Default Slot');
  await expect(component).toContainText('Test Slot');

  await expect(component.getByTestId('remount-count')).toContainText('1');
});
