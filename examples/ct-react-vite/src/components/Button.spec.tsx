import { test, expect } from '@playwright/test';

test('render props', async ({ mount }) => {
  const component = await mount('components/Button/Default');
  await expect(component).toContainText('Submit');
});

test('render attributes', async ({ mount }) => {
  const component = await mount('components/Button/Default', { className: 'primary' });
  await expect(component).toHaveClass('primary');
});

test('execute callback when the button is clicked', async ({ mount }) => {
  const messages: string[] = [];
  const component = await mount('components/Button/Default', {
    onClick: (data: string) => messages.push(data),
  });
  await component.click();
  expect(messages).toEqual(['hello']);
});

test('unmount', async ({ mount, page }) => {
  const component = await mount('components/Button/Default');
  await expect(page.locator('#root')).toContainText('Submit');
  await component.unmount();
  await expect(page.locator('#root')).not.toContainText('Submit');
});

test('mount, unmount, then mount again', async ({ mount }) => {
  let component = await mount('components/Button/Default');
  await component.unmount();
  component = await mount('components/Button/Default', { title: 'Save' });
  await expect(component).toContainText('Save');
});
