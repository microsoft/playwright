import { test, expect } from '@playwright/test';

test('render a default slot', async ({ mount }) => {
  const component = await mount('components/DefaultSlot.main');
  await expect(component.getByRole('strong')).toContainText('Main Content');
});

test('render a component as slot', async ({ mount }) => {
  const component = await mount('components/DefaultSlot.component');
  await expect(component).toContainText('Submit');
});

test('render a component with multiple slot children', async ({ mount }) => {
  const component = await mount('components/DefaultSlot.multiple');
  await expect(component.getByTestId('one')).toContainText('One');
  await expect(component.getByTestId('two')).toContainText('Two');
});

test('render a component with named slots', async ({ mount }) => {
  const component = await mount('components/NamedSlots.filled');
  await expect(component).toContainText('Header');
  await expect(component).toContainText('Main Content');
  await expect(component).toContainText('Footer');
});

test('render the slot default value', async ({ mount }) => {
  const component = await mount('components/SlotDefaultValue.empty');
  await expect(component).toHaveText('default value');
});

test('slot content should survive an update', { annotation: { type: 'issue', description: 'https://github.com/microsoft/playwright/issues/32809' } }, async ({ mount }) => {
  const component = await mount('components/SlotDefaultValue.text');
  await expect(component).toHaveText('foo');

  await component.update();
  await expect(component).toHaveText('foo');
});
