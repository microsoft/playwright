import { test, expect } from '@playwright/experimental-ct-solid';
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

test('render an empty component', async ({ mount, page }) => {
  const component = await mount(<EmptyFragment />);
  expect(await page.evaluate(() => 'props' in window && window.props)).toEqual({});
  expect(await component.allTextContents()).toEqual(['']);
  expect(await component.textContent()).toBe('');
  await expect(component).toHaveText('');
});
