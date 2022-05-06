import { test, expect } from '@playwright/test';
import { Button } from './Button';

test.use({ viewport: { width: 500, height: 500 } });

test('should work', async ({ mount }) => {
  let clicked = false;
  const component = await mount(<Button onClick={() => clicked = true }></Button>);
  await expect(component).toContainText('click me');
  expect(clicked).toBe(false);
  await component.click();
  expect.poll(() => clicked).toBe(true);
});
