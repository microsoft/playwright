import { test, expect } from '@playwright/experimental-ct-svelte';
import type { HooksConfig } from '../playwright';
import Button from '@/components/Button.svelte';
import Empty from '@/components/Empty.svelte';
import Context from '@/components/Context.svelte';

test('render props', async ({ mount }) => {
  const component = await mount(Button, {
    props: {
      title: 'Submit',
    },
  });
  await expect(component).toContainText('Submit');
});

test('get textContent of the empty component', async ({ mount }) => {
  const component = await mount(Empty);
  expect(await component.allTextContents()).toEqual(['']);
  expect(await component.textContent()).toBe('');
  await expect(component).toHaveText('');
});

test('render context', async ({ mount }) => {
  const component = await mount<HooksConfig>(Context, {
    hooksConfig: {
      context: 'context-value',
    }
  });
  await expect(component).toContainText('context-value');
});
