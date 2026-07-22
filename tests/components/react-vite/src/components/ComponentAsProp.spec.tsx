import { test, expect } from '@playwright/test';

test('render component as a prop', async ({ mount }) => {
  const component = await mount('components/ComponentAsProp/WithButton');
  await expect(component.getByRole('button', { name: 'Submit' })).toBeVisible();
});

test('render a jsx array as a prop', async ({ mount }) => {
  const component = await mount('components/ComponentAsProp/WithArray');
  await expect(component.getByRole('heading', { level: 4 })).toHaveText('4');
  await expect(component.getByRole('paragraph')).toHaveText('[2,3]');
});
