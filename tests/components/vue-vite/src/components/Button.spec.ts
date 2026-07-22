import { test, expect } from '@playwright/test';

import type { WithTitle } from './Button.story';

test('render props', async ({ mount }) => {
  const component = await mount('components/Button/Submit');
  await expect(component).toContainText('Submit');
});

test('emit a submit event when the button is clicked', async ({ mount }) => {
  const component = await mount('components/Button/RecordsEvents');
  await component.getByRole('button').click();
  await expect(component.getByTestId('submitted')).toHaveValue('hello');
});

test('emit a fallthrough event when the button is double clicked', async ({ mount }) => {
  const component = await mount('components/Button/RecordsEvents');
  await component.getByRole('button').dblclick();
  await expect(component.getByTestId('fallthrough')).toHaveValue('fallthroughEvent');
});

test('unmount', async ({ mount, page }) => {
  const component = await mount('components/Button/Submit');
  await expect(page.locator('#root')).toContainText('Submit');
  await component.unmount();
  await expect(page.locator('#root')).not.toContainText('Submit');
});

test('mount, unmount, then mount again', async ({ mount }) => {
  let component = await mount('components/Button/Submit');
  await component.unmount();
  component = await mount<typeof WithTitle>('components/Button/WithTitle', { title: 'Save' });
  await expect(component).toContainText('Save');
});
