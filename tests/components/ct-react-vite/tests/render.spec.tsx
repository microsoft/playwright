import { test, expect } from '@playwright/experimental-ct-react';
import Button from '@/components/Button';
import EmptyFragment from '@/components/EmptyFragment';

test('render props', async ({ mount }) => {
  const component = await mount(<Button title="Submit" />);
  await expect(component).toContainText('Submit');
});

test('render attributes', async ({ mount }) => {
  const component = await mount(<Button className="primary" title="Submit" />);
  await expect(component).toHaveClass('primary');
});

test('get textContent of the empty fragment', async ({ mount }) => {
  const component = await mount(<EmptyFragment />);
  expect(await component.allTextContents()).toEqual(['']);
  expect(await component.textContent()).toBe('');
  await expect(component).toHaveText('');
});
