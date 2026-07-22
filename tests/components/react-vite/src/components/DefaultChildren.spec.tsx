import { test, expect } from '@playwright/test';

test('render a default child', async ({ mount }) => {
  const component = await mount('components/DefaultChildren/Text');
  await expect(component).toContainText('Main Content');
});

test('render a component as a child', async ({ mount }) => {
  const component = await mount('components/DefaultChildren/WithButton');
  await expect(component).toContainText('Submit');
});

test('render multiple children', async ({ mount }) => {
  const component = await mount('components/DefaultChildren/Multiple');
  await expect(component.getByTestId('one')).toContainText('One');
  await expect(component.getByTestId('two')).toContainText('Two');
});

test('render a number as a child', async ({ mount }) => {
  const component = await mount('components/DefaultChildren/Number');
  await expect(component).toContainText('1337');
});

test('execute callback when a child node is clicked', async ({ mount }) => {
  let clickFired = false;
  const component = await mount('components/DefaultChildren/ClickableChild', {
    onChildClick: () => (clickFired = true),
  });
  await component.getByText('Main Content').click();
  expect(clickFired).toBeTruthy();
});
