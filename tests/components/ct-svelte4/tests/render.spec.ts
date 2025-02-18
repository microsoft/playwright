import { test, expect } from '@playwright/experimental-ct-svelte';
import Button from '@/components/Button.svelte';
import Component from '@/components/Component.svelte';
import Empty from '@/components/Empty.svelte';

test('render props', async ({ mount }) => {
  const component = await mount(Button, {
    props: {
      title: 'Submit',
    },
  });
  await expect(component).toContainText('Submit');
});

test('render a component without options', async ({ mount }) => {
  const component = await mount(Component);
  await expect(component).toContainText('test');
});

test('get textContent of the empty component', async ({ mount }) => {
  const component = await mount(Empty);
  expect(await component.allTextContents()).toEqual(['']);
  expect(await component.textContent()).toBe('');
  await expect(component).toHaveText('');
});
