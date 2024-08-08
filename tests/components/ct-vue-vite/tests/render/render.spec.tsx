import { test, expect } from '@playwright/experimental-ct-vue';
import Button from '@/components/Button.vue';
import EmptyTemplate from '@/components/EmptyTemplate.vue';
import { Story } from '@/components/Story';

test('render props', async ({ mount }) => {
  const component = await mount(<Button title='Submit' />);
  await expect(component).toContainText('Submit');
});

test('render attributes', async ({ mount }) => {
  const component = await mount(<Button class='primary' title='Submit' />);
  await expect(component).toHaveClass('primary');
});

test('render an empty component', async ({ page, mount }) => {
  const component = await mount(<EmptyTemplate />);
  expect(await page.evaluate(() => 'slots' in window && window.slots)).toEqual({});
  expect(await component.allTextContents()).toEqual(['']);
  expect(await component.textContent()).toBe('');
  await expect(component).toHaveText('');
});

test('render props with defineComponent syntax', async ({ mount }) => {
  const component = await mount(<Story title="story/wrapper" />);
  await expect(component).toContainText('story/wrapper');
});
