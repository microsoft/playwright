import { test, expect } from '@playwright/experimental-ct-svelte';
import DefaultSlot from '@/components/DefaultSlot.svelte';
import NamedSlots from '@/components/NamedSlots.svelte';

test('render a default slot', async ({ mount }) => {
  const component = await mount(DefaultSlot, {
    slots: {
      default: 'Main Content',
    },
  });
  await expect(component).toContainText('Main Content');
});

test('render a component with a named slot', async ({ mount }) => {
  const component = await mount(NamedSlots, {
    slots: {
      header: 'Header',
      main: 'Main Content',
      footer: 'Footer',
    },
  });
  await expect(component).toContainText('Header');
  await expect(component).toContainText('Main Content');
  await expect(component).toContainText('Footer');
});
